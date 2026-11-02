import assert from 'node:assert/strict'
import {test} from 'node:test'
import {passwordResetEmail,verificationEmail,verifiedEmail} from './emails.js'
import {mailer} from './auth.js'

test('email templates escape text, use absolute app links and keep plain text usable',()=>{
 const verify=verificationEmail('https://scribb.example/','mira<"&','safe-token')
 assert.match(verify.html,/Hi @mira&lt;&quot;&amp;,/)
 assert.match(verify.html,/https:\/\/scribb\.example\/brand\/scribb-mark\.png/)
 assert.match(verify.html,/href="https:\/\/scribb\.example\/#verify-email\/safe-token"/)
 assert.match(verify.text,/https:\/\/scribb\.example\/#verify-email\/safe-token/)
 assert.match(passwordResetEmail('https://scribb.example/','reset-token').html,/#reset\/reset-token/)
 assert.match(verifiedEmail('https://scribb.example/').html,/href="https:\/\/scribb\.example\/"[^>]*>Go to homepage/)
 assert.throws(()=>verificationEmail('javascript:alert(1)','mira','token'))
 assert.throws(()=>verifiedEmail('https://user:password@scribb.example/'))
})

test('mailer supplies the branded HTML alongside plain text to the delivery service',async t=>{
 const oldKey=process.env.RESEND_API_KEY
 process.env.RESEND_API_KEY='test-only-mail-key'
 const content=verificationEmail('https://scribb.example/','mira','test-token')
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  assert.equal(input,'https://api.resend.com/emails')
  const body=JSON.parse(String(init?.body))
  assert.equal(body.to,'mira@example.com')
  assert.equal(body.html,content.html)
  assert.equal(body.text,content.text)
  return new Response(JSON.stringify({id:'test-message'}),{status:200})
 })
 try{await mailer.send('mira@example.com',content.subject,content.text,content.html)}
 finally{if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey}
})
