/** The application creator is identified by verified email ownership, never a client-supplied role. */
const CREATOR_EMAIL = 'maityrohit021@gmail.com'
type AvatarAccount = {email?:unknown;email_verified_at?:unknown;avatar?:unknown}

export const isCreator = (user:AvatarAccount) =>
  typeof user.email === 'string' && user.email.toLowerCase() === CREATOR_EMAIL && Boolean(user.email_verified_at)

/** The reserved portrait is the creator's default; it is never shown for a non-owner's saved id. */
export function profileAvatar(user:AvatarAccount):string {
  const avatar = typeof user.avatar === 'string' ? user.avatar : 'a01'
  return isCreator(user) ? (avatar === 'a01' ? 'mine' : avatar) : (avatar === 'mine' ? 'a01' : avatar)
}
