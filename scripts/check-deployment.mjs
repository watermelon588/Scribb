import { pathToFileURL } from 'node:url'

const empty = value => !value?.trim() || /^(?:change[-_ ]?me|replace[-_ ]?me|your[-_]|paste[-_]|example)/i.test(value.trim())
const origin = value => { try { const u = new URL(value); return u.protocol === 'https:' && u.origin === value && !u.username && !u.password } catch { return false } }

/** Validate values without printing them or contacting production services. */
export function deploymentProblems(env, {runtime=false}={}) {
  const problems = []
  for (const key of ['DATABASE_URL','SESSION_SECRET','APP_ORIGIN','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) {
    if (empty(env[key])) problems.push(`${key} must be configured.`)
  }
  if (env.DATABASE_URL) {
    try { const u = new URL(env.DATABASE_URL); if (!['postgres:','postgresql:'].includes(u.protocol) || !u.hostname || !u.password) throw new Error() }
    catch { problems.push('DATABASE_URL must be a complete Postgres connection string.') }
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) problems.push('SESSION_SECRET must contain at least 32 random characters.')
  if (env.APP_ORIGIN && !origin(env.APP_ORIGIN)) problems.push('APP_ORIGIN must be your HTTPS site origin, without a path.')
  if (env.LOCAL_ONLY) problems.push('Remove LOCAL_ONLY from hosted environments.')
  if (env.RATE_LIMITS === 'off') problems.push('Rate limiting must remain enabled in production.')
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.VITE_GOOGLE_CLIENT_ID) || (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== env.VITE_GOOGLE_CLIENT_ID)) problems.push('Set both Google client IDs to the same value, or leave both unset.')
  if (env.RESEND_API_KEY && empty(env.MAIL_FROM)) problems.push('MAIL_FROM must use a verified Resend sender.')
  if (env.AI_ENABLED !== 'false' && env.AI_ENABLED !== 'true') problems.push('Set AI_ENABLED explicitly to false for the first deployment, or true when AI is ready.')
  if (env.AI_ENABLED === 'true') {
    if (empty(env.AI_TICKET_SECRET) || env.AI_TICKET_SECRET.length < 32) problems.push('AI_TICKET_SECRET must contain at least 32 random characters for both API and AI services.')
    if (env.AI_TICKET_SECRET && env.AI_TICKET_SECRET === env.SESSION_SECRET) problems.push('Use separate secrets for sessions and AI tickets.')
    // Bindings exist in functions at runtime, never in the build environment.
    if (runtime) {
      try { if (!['http:','https:'].includes(new URL(env.AI_URL).protocol)) throw new Error() }
      catch { problems.push('AI_URL must be injected by the api service binding at runtime.') }
    }
    if (empty(env.RESEND_API_KEY) && empty(env.GOOGLE_CLIENT_ID)) problems.push('AI needs verified email: configure Resend or Google sign-in first.')
  }
  for (const key of Object.keys(env)) if (key.startsWith('VITE_') && /SECRET|PASSWORD|DATABASE|API_KEY|TICKET/.test(key)) problems.push(`${key} would expose a secret to the browser. Remove it.`)
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] !== 'vercel') { console.error('Usage: npm run check:deploy -- vercel'); process.exitCode = 1 }
  else {
    try { process.loadEnvFile() } catch { /* Hosted builds use dashboard variables. */ }
    const problems = deploymentProblems(process.env)
    if (problems.length) { console.error(`Deployment configuration needs attention:\n${problems.map(p => `- ${p}`).join('\n')}`); process.exitCode = 1 }
    else console.log('Vercel configuration checks passed. No production services were contacted.')
  }
}
