import { Router } from 'express'
import { currentUser, fail, mailer, text } from './auth.js'
import { limit } from './db.js'

/** In-app feedback: a 1–5 rating and a note, mailed straight to the founder. Guests may send it too. */
export const feedback = Router()

const FOUNDER = process.env.FEEDBACK_TO ?? 'maityrohit021@gmail.com'
const MAX = 2000

feedback.post('/feedback', async (req, res) => {
  const rating = Number(req.body?.rating), message = text(req.body?.message)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(res, 400, 'bad_rating', 'Choose a rating from 1 to 5.')
  if (message.length > MAX) return fail(res, 400, 'too_long', `Feedback is up to ${MAX} characters.`)
  if (!(await limit(`feedback:${req.ip}`, 5, 3600))) return fail(res, 429, 'rate_limited', 'Thanks! You have sent a lot of feedback already. Try again later.')
  const user = await currentUser(req)
  const from = user ? `@${user.handle}${user.email ? ` <${user.email}>` : ''}` : 'a guest'
  const page = typeof req.body?.page === 'string' ? req.body.page.slice(0, 200) : ''
  await mailer.send(FOUNDER, `Scribb feedback: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} from ${user ? `@${user.handle}` : 'a guest'}`,
    `Rating: ${rating}/5\nFrom: ${from}\nPage: ${page || 'unknown'}\n\n${message || '(no message)'}\n`)
  res.status(204).end()
})
