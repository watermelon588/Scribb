import { Router, type Request } from 'express'
import { currentUser, endSession, fail, requireUser, text, validUsername, verifyPassword } from './auth.js'
import { decodeCursor, encodeCursor, limit, pgCode, sql, type Row } from './db.js'
import { isCreator, profileAvatar } from './creator.js'

/** Profiles, preset avatars, follows, notifications and account deletion. */
export const people = Router()

// Public cutout presets a01 to a12; the reserved mine portrait requires verified creator ownership.
const AVATAR = /^a(0[1-9]|1[0-2])$/
// Keep in step with LINK_KINDS in src/lib/api.ts.
const LINKS = ['website', 'instagram', 'behance', 'cara', 'x', 'youtube', 'pinterest', 'dribbble', 'tiktok', 'linkedin'] as const
const handleOf = (req: Request) => String(req.params.handle).toLowerCase()

async function profile(handle: string, viewer: string | null) {
  const [p] = await sql()`
    select p.user_id, p.handle, p.display_name, p.bio, p.city, p.avatar, p.links, p.created_at, u.email, u.email_verified_at,
           (select count(*)::int from follows where followee_id = p.user_id) as followers,
           (select count(*)::int from follows where follower_id = p.user_id) as following,
           (select count(*)::int from books where user_id = p.user_id and visibility = 'public') as public_books,
           exists (select 1 from follows where follower_id = ${viewer}::uuid and followee_id = p.user_id) as followed
    from profiles p join users u on u.id = p.user_id where p.handle = ${handle}`
  return p && {
    username: p.handle, displayName: p.display_name, bio: p.bio, city: p.city, avatar: profileAvatar(p), isCreator: isCreator(p), links: p.links, joinedAt: p.created_at,
    followers: p.followers, following: p.following, books: p.public_books, followed: p.followed, own: p.user_id === viewer,
  }
}

people.get('/users/:handle', async (req, res) => {
  const found = await profile(handleOf(req), ((await currentUser(req))?.id ?? null) as string | null)
  if (!found) return fail(res, 404, 'not_found', 'No one has that username.')
  res.json({ profile: found })
})

/** Every field is optional; only the ones sent change. */
people.patch('/me/profile', requireUser, async (req, res) => {
  const user = res.locals.user as Row, b = req.body ?? {}
  const field = (name: string, max: number) => (b[name] === undefined ? null : text(b[name]).slice(0, max + 1))
  const displayName = field('displayName', 60), bio = field('bio', 300), city = field('city', 60)
  const username = b.username === undefined ? null : text(b.username).toLowerCase(), avatar = b.avatar ?? null
  if ((displayName?.length ?? 0) > 60 || (bio?.length ?? 0) > 300 || (city?.length ?? 0) > 60) return fail(res, 400, 'too_long', 'Names and cities are up to 60 characters, bios up to 300.')
  if (username !== null && !validUsername(username)) return fail(res, 400, 'bad_username', 'Usernames are 3 to 30 lowercase letters, numbers, dots or underscores.')
  if (avatar !== null && (typeof avatar !== 'string' || (!AVATAR.test(avatar) && avatar !== 'mine'))) return fail(res, 400, 'bad_avatar', 'Choose one of the profile pictures.')
  if (avatar === 'mine' && !isCreator(user)) return fail(res, 403, 'reserved_avatar', 'This profile picture is reserved for the application creator.')
  let links: Record<string, string> | null = null
  if (b.links !== undefined) {
    links = {}
    for (const key of LINKS) {
      const value = text(b.links?.[key])
      if (!value) continue
      let url: URL
      try { url = new URL(value) } catch { return fail(res, 400, 'bad_link', 'Links must be full https:// addresses.') }
      if (url.protocol !== 'https:' || value.length > 200) return fail(res, 400, 'bad_link', 'Links must be full https:// addresses.')
      links[key] = url.href
    }
  }
  if (!(await limit(`profile:${user.id}`, 60, 3600))) return fail(res, 429, 'rate_limited', 'Slow down a little and try again.')
  try {
    await sql()`
      update profiles set display_name = coalesce(${displayName}, display_name), bio = coalesce(${bio}, bio), city = coalesce(${city}, city),
             avatar = coalesce(${avatar}, avatar), handle = coalesce(${username}, handle), links = coalesce(${links && JSON.stringify(links)}::jsonb, links)
      where user_id = ${user.id}`
  } catch (err) {
    if (pgCode(err) === '23505') return fail(res, 409, 'username_taken', 'That username is taken.')
    throw err
  }
  res.json({ profile: await profile(username ?? user.handle, user.id) })
})

// ---- Follows. A follow notifies once per person, however often it is toggled.
people.put('/users/:handle/follow', requireUser, async (req, res) => {
  const user = (res.locals.user as Row).id
  if (!(await limit(`social:${user}`, 300, 3600))) return fail(res, 429, 'rate_limited', 'Slow down a little and try again.')
  const [row] = await sql()`
    with target as (select user_id from profiles where handle = ${handleOf(req)}),
         f as (insert into follows (follower_id, followee_id) select ${user}, user_id from target where user_id <> ${user}
               on conflict do nothing returning followee_id),
         note as (insert into notifications (user_id, actor_id, type) select followee_id, ${user}, 'follow' from f
                  where not exists (select 1 from notifications where user_id = f.followee_id and actor_id = ${user} and type = 'follow'))
    select (select user_id from target) as id`
  if (!row.id) return fail(res, 404, 'not_found', 'No one has that username.')
  if (row.id === user) return fail(res, 400, 'self_follow', 'You cannot follow yourself.')
  res.json({ following: true })
})
people.delete('/users/:handle/follow', requireUser, async (req, res) => {
  await sql()`delete from follows where follower_id = ${(res.locals.user as Row).id}
              and followee_id = (select user_id from profiles where handle = ${handleOf(req)})`
  res.json({ following: false })
})

// ---- Notifications, newest first
people.get('/notifications', requireUser, async (req, res) => {
  const user = (res.locals.user as Row).id, cursor = decodeCursor(req.query.cursor)
  if (cursor === undefined) return fail(res, 400, 'bad_cursor', 'That page link is broken.')
  const [at, after] = cursor ?? [null, null]
  const rows = await sql()`
    select n.id, n.type, n.book_id, n.read_at, n.created_at, n.created_at::text as at, p.handle, p.display_name, p.avatar, b.title
    from notifications n join profiles p on p.user_id = n.actor_id left join books b on b.id = n.book_id
    where n.user_id = ${user} and (${at}::timestamptz is null or (n.created_at, n.id) < (${at}::timestamptz, ${after}::uuid))
    order by n.created_at desc, n.id desc
    limit 26`
  const [{ unread }] = await sql()`select count(*)::int as unread from notifications where user_id = ${user} and read_at is null`
  const shown = rows.slice(0, 25)
  res.json({
    unread,
    notifications: shown.map(n => ({
      id: n.id, type: n.type, read: Boolean(n.read_at), createdAt: n.created_at,
      actor: { username: n.handle, displayName: n.display_name, avatar: n.avatar }, book: n.book_id ? { id: n.book_id, title: n.title } : null,
    })),
    next: rows.length > 25 ? encodeCursor(shown.at(-1)!.at, shown.at(-1)!.id) : null,
  })
})
people.post('/notifications/read', requireUser, async (_req, res) => {
  await sql()`update notifications set read_at = now() where user_id = ${(res.locals.user as Row).id} and read_at is null`
  res.json({ ok: true })
})

/** Deletes the account and everything it owns. Password accounts confirm with the password,
 * Google-only accounts by typing their username. */
people.delete('/me', requireUser, async (req, res) => {
  const user = res.locals.user as Row
  if (!(await limit(`delete:${user.id}`, 10, 3600))) return fail(res, 429, 'rate_limited', 'Too many attempts. Please wait a little and try again.')
  if (user.has_password) {
    const [row] = await sql()`select password_hash from users where id = ${user.id}`
    const password = req.body?.password
    if (typeof password !== 'string' || password.length > 128 || !(await verifyPassword(password, row.password_hash))) return fail(res, 401, 'bad_password', 'Your password is not right.')
  } else if (text(req.body?.confirm).toLowerCase() !== user.handle) return fail(res, 400, 'confirm_required', 'Type your username to confirm.')
  // Likes and saves on other people's books are uncounted in the same statement that deletes the account,
  // in one UPDATE because Postgres applies only one change per row per statement.
  // ponytail: Cloudinary images are not deleted yet; add it with the media routes (Task 8).
  await sql()`
    with liked as (select book_id from likes where user_id = ${user.id}), saved as (select book_id from saves where user_id = ${user.id}),
         uncount as (update books set like_count = like_count - (id in (select book_id from liked))::int,
                                      save_count = save_count - (id in (select book_id from saved))::int
                     where user_id <> ${user.id} and (id in (select book_id from liked) or id in (select book_id from saved)))
    delete from users where id = ${user.id}`
  endSession(res)
  res.status(204).end()
})
