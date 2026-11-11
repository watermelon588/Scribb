import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { testDatabase } from './testdb.js'
import { getUsersSummary, recordActivity, sendWelcomeIfNew } from './activity.js'
import { mailer } from './auth.js'
import { sql } from './db.js'

const sentMail: { to: string; subject: string; body: string; html?: string }[] = []
mailer.send = async (to, subject, body, html) => void sentMail.push({ to, subject, body, html })

before(async () => {
  await testDatabase()
})

test('recordActivity tracks user actions and updates timestamps', async () => {
  // Create a test user
  const [user] = await sql()`
    with u as (insert into users default values returning id)
    insert into profiles (user_id, handle, display_name) select id, 'testuser', 'Test User' from u returning user_id`

  await recordActivity({
    userId: user.user_id,
    action: 'login',
    details: { method: 'password', username: 'testuser' },
    ip: '127.0.0.1',
  })

  const [afterLogin] = await sql()`select last_login_at, last_active_at from users where id = ${user.user_id}`
  assert.ok(afterLogin.last_login_at, 'last_login_at should be populated')
  assert.ok(afterLogin.last_active_at, 'last_active_at should be populated')

  const summary = await getUsersSummary()
  assert.ok(summary.totalUsers >= 1)
  const foundUser = summary.users.find(u => u.username === 'testuser')
  assert.ok(foundUser)
  assert.equal(foundUser.username, 'testuser')

  const foundActivity = summary.recentActivities.find(a => a.userId === user.user_id && a.action === 'login')
  assert.ok(foundActivity)
  assert.equal(foundActivity.action, 'login')
  assert.equal((foundActivity.details as { method?: string }).method, 'password')
})

test('sendWelcomeIfNew sends email once and prevents duplicate sends', async () => {
  const [user] = await sql()`
    with u as (insert into users (email) values ('welcome@example.com') returning id)
    insert into profiles (user_id, handle, display_name) select id, 'newbie', 'Newbie' from u returning user_id`

  const sent = await sendWelcomeIfNew({
    userId: user.user_id,
    email: 'welcome@example.com',
    username: 'newbie',
    origin: 'https://scribb.example',
  })
  assert.equal(sent, true, 'first send should return true')
  assert.equal(sentMail.at(-1)?.to, 'welcome@example.com')
  assert.match(sentMail.at(-1)?.subject ?? '', /Welcome to Scribb!/)

  const secondSend = await sendWelcomeIfNew({
    userId: user.user_id,
    email: 'welcome@example.com',
    username: 'newbie',
    origin: 'https://scribb.example',
  })
  assert.equal(secondSend, false, 'second send should return false (no duplicates)')
})
