import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deploymentProblems} from './check-deployment.mjs'
import {readFileSync} from 'node:fs'

const ready = () => ({DATABASE_URL:'postgresql://owner:test@database.example/app?sslmode=require',SESSION_SECRET:'test-session-value-with-at-least-32-characters',APP_ORIGIN:'https://scribb.example',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'test-key',CLOUDINARY_API_SECRET:'test-secret',AI_ENABLED:'false'})
test('core hosting works with AI explicitly off and no optional provider credentials',()=>assert.deepEqual(deploymentProblems(ready()),[]))
test('unsafe production settings and public secrets are refused without leaking their values',()=>{
 const env={...ready(),LOCAL_ONLY:'1',RATE_LIMITS:'off',VITE_DATABASE_URL:'private-value',SESSION_SECRET:'short',APP_ORIGIN:'http://localhost:5173'}
 const problems=deploymentProblems(env)
 assert.equal(problems.length,5)
 assert.ok(!problems.join('').includes('private-value'))
})
test('enabling AI needs distinct shared secret, HTTPS service and email delivery',()=>{
 const env={...ready(),AI_ENABLED:'true',AI_TICKET_SECRET:ready().SESSION_SECRET,AI_URL:'http://localhost:8000'}
 assert.equal(deploymentProblems(env).length,3)
 assert.deepEqual(deploymentProblems({...env,AI_TICKET_SECRET:'test-ai-ticket-value-with-at-least-32-characters',AI_URL:'https://scribb-ai.onrender.com',RESEND_API_KEY:'test-email-key',MAIL_FROM:'Scribb <hello@example.com>'}),[])
})
test('Google sign-in cannot be half configured',()=>assert.match(deploymentProblems({...ready(),GOOGLE_CLIENT_ID:'public-id'})[0],/both Google client IDs/))
test('verified Google accounts can use AI without requiring a mail provider',()=>{
 assert.deepEqual(deploymentProblems({...ready(),AI_ENABLED:'true',AI_TICKET_SECRET:'test-ai-ticket-value-with-at-least-32-characters',AI_URL:'https://scribb-ai.onrender.com',GOOGLE_CLIENT_ID:'public-client-id',VITE_GOOGLE_CLIENT_ID:'public-client-id'}),[])
})
test('bundled cover metadata matches the preserved public asset records',()=>{
 for(const kind of ['sketchbook','journal']){
  const source=JSON.parse(readFileSync(new URL(`../src/data/${kind}-covers.json`,import.meta.url),'utf8'))
  const record=JSON.parse(readFileSync(new URL(`../public/covers/${kind}/manifest.json`,import.meta.url),'utf8'))
  assert.deepEqual(source.items,record.items)
 }
})
