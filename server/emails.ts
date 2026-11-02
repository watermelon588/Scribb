/** Table-based transactional mail: inline styles, absolute links and a plain-text alternative. */
export type AccountEmail={subject:string;text:string;html:string}
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
function homeURL(origin:string){
 const url=new URL(origin)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid app origin for email.')
 return `${url.origin}/`
}
type Content={subject:string;label:string;title:string;greeting:string;copy:string;action:string;url:string;note:string;fallback?:boolean}
function template(home:string,c:Content):AccountEmail{
 const link=escape(c.url),site=escape(home)
 return {subject:c.subject,text:`${c.greeting}\n\n${c.title}\n${c.copy}\n\n${c.action}:\n${c.url}\n\n${c.note}\n\nScribb — A little space for what’s on your mind.\n${home}`,
 html:`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#eeeee7;color:#303b31;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(c.copy)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eeeee7"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#faf9f6">
<tr><td style="padding:32px 24px 24px"><a href="${site}" style="color:#303b31;text-decoration:none"><img src="${site}brand/scribb-mark.png" alt="Scribb companion" width="48" height="48" style="display:inline-block;vertical-align:middle;border:0"><span style="vertical-align:middle;font-family:Georgia,serif;font-size:30px;font-style:italic;padding-left:12px">Scribb</span></a></td></tr>
<tr><td style="padding:8px 24px 32px">
<p style="margin:0 0 16px;font-size:12px;line-height:18px;letter-spacing:2px;color:#67715f">${escape(c.label)}</p>
<h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:32px;line-height:1.2;font-weight:400">${escape(c.title)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:24px">${escape(c.greeting)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#56604f">${escape(c.copy)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#415339" style="background:#415339;padding:12px 24px;text-align:center"><a href="${link}" style="display:inline-block;color:#ffffff;font-size:15px;line-height:24px;text-decoration:none;font-weight:400">${escape(c.action)}</a></td></tr></table>
${c.fallback?`<p style="margin:24px 0 0;font-size:13px;line-height:22px;color:#67715f">Or copy this link into your browser:<br><a href="${link}" style="color:#415339;word-break:break-all;overflow-wrap:anywhere">${escape(c.url)}</a></p>`:''}
<p style="margin:24px 0 0;font-size:13px;line-height:22px;color:#67715f">${escape(c.note)}</p>
</td></tr>
<tr><td style="padding:24px;background:#e6eadf;font-size:13px;line-height:22px;color:#56604f"><a href="${site}" style="color:#303b31;text-decoration:none">Scribb</a><br>A little space for what’s on your mind.</td></tr>
</table></td></tr></table></body></html>`}
}
export function verificationEmail(origin:string,username:string,token:string):AccountEmail{
 const home=homeURL(origin)
 return template(home,{subject:'Verify your email for Scribb',label:'MAKE YOURSELF AT HOME',title:'One small step. Your space awaits.',greeting:`Hi @${username},`,copy:'Confirm your email to keep your Scribb account connected to you. This link works once and expires in 24 hours.',action:'Verify my email',url:`${home}#verify-email/${encodeURIComponent(token)}`,note:'If you didn’t request this email, you can safely ignore it. Your account stays as it is.',fallback:true})
}
export function verifiedEmail(origin:string):AccountEmail{
 const home=homeURL(origin)
 return template(home,{subject:'Your Scribb email is verified',label:'YOU’RE ALL SET',title:'A little welcome to your creative space.',greeting:'Congratulations — your email is verified!',copy:'Your email is now connected to your Scribb account. Settle in, save a few thoughts, or turn the page on something new.',action:'Go to homepage',url:home,note:'You can manage your email in Settings. Scribb may ask you to sign in when you return.'})
}
export function passwordResetEmail(origin:string,token:string):AccountEmail{
 const home=homeURL(origin)
 return template(home,{subject:'Reset your Scribb password',label:'BACK TO YOUR SPACE',title:'Let’s get you back in.',greeting:'Hello again,',copy:'Choose a new password for your Scribb account. This link works once and expires in one hour.',action:'Reset my password',url:`${home}#reset/${encodeURIComponent(token)}`,note:'If you didn’t ask to reset your password, ignore this email. Your password will stay the same.',fallback:true})
}
