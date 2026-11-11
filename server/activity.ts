import { sql, type Row } from './db.js'
import { welcomeEmail } from './emails.js'
import { mailer } from './auth.js'

export type ActivityAction =
  | 'register'
  | 'login'
  | 'google_signup'
  | 'google_login'
  | 'logout'
  | 'email_verified'
  | 'welcome_email_sent'
  | string

export interface RecordActivityOptions {
  userId: string
  action: ActivityAction
  details?: Record<string, unknown>
  ip?: string
}

export async function recordActivity({ userId, action, details = {}, ip }: RecordActivityOptions): Promise<void> {
  try {
    const isLogin = action === 'login' || action === 'google_login' || action === 'register' || action === 'google_signup'
    const jsonDetails = JSON.stringify(details)
    await sql()`
      insert into user_activities (user_id, action, details, ip)
      values (${userId}, ${action}, ${jsonDetails}::jsonb, ${ip ?? null})`

    if (isLogin) {
      await sql()`update users set last_login_at = now(), last_active_at = now() where id = ${userId}`
    } else {
      await sql()`update users set last_active_at = now() where id = ${userId}`
    }

    console.log(`[activity] User ${userId.slice(0, 8)} performed '${action}'${details?.username ? ` (@${details.username})` : ''}`)
  } catch (err) {
    console.error(`[activity] Failed to record activity '${action}' for user ${userId}:`, (err as Error).message)
  }
}

const activeTouch = new Map<string, number>()
export async function touchUserActivity(userId: string): Promise<void> {
  const now = Date.now()
  const last = activeTouch.get(userId) ?? 0
  if (now - last < 60_000) return
  activeTouch.set(userId, now)
  try {
    await sql()`update users set last_active_at = now() where id = ${userId}`
  } catch {
    // Non-critical background touch
  }
}

export async function sendWelcomeIfNew(options: {
  userId: string
  email: string
  username: string
  origin: string
}): Promise<boolean> {
  const { userId, email, username, origin } = options
  if (!email) return false
  try {
    const [user] = await sql()`select welcome_sent_at from users where id = ${userId}`
    if (user?.welcome_sent_at) return false

    const content = welcomeEmail(origin, username)
    await mailer.send(email, content.subject, content.text, content.html)

    await sql()`update users set welcome_sent_at = now() where id = ${userId}`
    await recordActivity({
      userId,
      action: 'welcome_email_sent',
      details: { email, username },
    })
    console.log(`[activity] Welcome email sent to ${email} (@${username})`)
    return true
  } catch (err) {
    console.error(`[activity] Failed to send welcome email to ${email}:`, (err as Error).message)
    return false
  }
}

export interface UserSummaryItem {
  id: string
  username: string
  displayName: string
  email: string | null
  emailVerified: boolean
  isGoogle: boolean
  hasPassword: boolean
  createdAt: string
  lastLoginAt: string | null
  lastActiveAt: string | null
  welcomeSentAt: string | null
}

export interface ActivityItem {
  id: string
  userId: string
  username?: string
  action: string
  details: Record<string, unknown>
  ip: string | null
  createdAt: string
}

export async function getUsersSummary() {
  let usersRows: Row[]
  try {
    usersRows = await sql()`
      select u.id, u.email, u.email_verified_at, u.google_sub is not null as is_google,
             u.password_hash is not null as has_password,
             u.created_at, u.last_login_at, u.last_active_at, u.welcome_sent_at,
             p.handle as username, p.display_name
      from users u
      left join profiles p on p.user_id = u.id
      order by u.created_at asc`
  } catch {
    usersRows = await sql()`
      select u.id, u.email, u.email_verified_at, u.google_sub is not null as is_google,
             u.password_hash is not null as has_password,
             u.created_at, null as last_login_at, null as last_active_at, null as welcome_sent_at,
             p.handle as username, p.display_name
      from users u
      left join profiles p on p.user_id = u.id
      order by u.created_at asc`
  }

  const users: UserSummaryItem[] = usersRows.map(u => ({
    id: u.id,
    username: u.username ?? 'unknown',
    displayName: u.display_name ?? '',
    email: u.email,
    emailVerified: Boolean(u.email_verified_at),
    isGoogle: Boolean(u.is_google),
    hasPassword: Boolean(u.has_password),
    createdAt: u.created_at ? new Date(u.created_at).toISOString() : '',
    lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
    lastActiveAt: u.last_active_at ? new Date(u.last_active_at).toISOString() : null,
    welcomeSentAt: u.welcome_sent_at ? new Date(u.welcome_sent_at).toISOString() : null,
  }))

  let activityRows: Row[]
  try {
    activityRows = await sql()`
      select a.id, a.user_id, a.action, a.details, a.ip, a.created_at, p.handle as username
      from user_activities a
      left join profiles p on p.user_id = a.user_id
      order by a.created_at desc
      limit 20`
  } catch {
    activityRows = []
  }

  const recentActivities: ActivityItem[] = activityRows.map(a => ({
    id: a.id,
    userId: a.user_id,
    username: a.username ?? undefined,
    action: a.action,
    details: a.details ?? {},
    ip: a.ip,
    createdAt: a.created_at ? new Date(a.created_at).toISOString() : '',
  }))

  return {
    totalUsers: users.length,
    users,
    recentActivities,
  }
}

export async function printUsersReport(): Promise<void> {
  const summary = await getUsersSummary()

  console.log('\n========================================================================================')
  console.log(`  SCRIBB USER & ACTIVITY REPORT`)
  console.log(`  Total Users: ${summary.totalUsers}`)
  console.log('========================================================================================\n')

  if (summary.users.length === 0) {
    console.log('No registered users found in the database.\n')
  } else {
    console.log('USERS:')
    const tableData = summary.users.map((u, i) => ({
      '#': i + 1,
      Username: `@${u.username}`,
      Email: u.email ? `${u.email}${u.emailVerified ? ' (verified)' : ''}` : '(none)',
      Provider: u.isGoogle ? 'Google' : u.hasPassword ? 'Password' : 'None',
      'Last Login': u.lastLoginAt ? u.lastLoginAt.replace('T', ' ').slice(0, 19) : 'Never',
      'Last Active': u.lastActiveAt ? u.lastActiveAt.replace('T', ' ').slice(0, 19) : 'Never',
      Joined: u.createdAt.slice(0, 10),
    }))
    console.table(tableData)
  }

  if (summary.recentActivities.length > 0) {
    console.log('\nRECENT ACTIVITIES (latest 20):')
    const actData = summary.recentActivities.map((a, i) => ({
      '#': i + 1,
      Time: a.createdAt.replace('T', ' ').slice(0, 19),
      User: a.username ? `@${a.username}` : a.userId.slice(0, 8),
      Action: a.action,
      Details: JSON.stringify(a.details),
    }))
    console.table(actData)
  }
  console.log('')
}
