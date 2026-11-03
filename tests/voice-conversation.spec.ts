import {test,expect} from './fixtures'
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}
test('voice conversation submits once, speaks answer, listens again and stops on navigation',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as any;w.voiceStarts=0;w.voiceStops=0;w.spoken=[];
  class Recognition {lang='';continuous=true;interimResults=true;onresult:any;onerror:any;onend:any;start(){w.recognition=this;w.voiceStarts++}stop(){w.voiceStops++;this.onend?.()}}
  w.SpeechRecognition=Recognition;
  w.SpeechSynthesisUtterance=class{text:string;lang='';voice:any=null;pitch=1;rate=1;onend:any;onerror:any;constructor(text:string){this.text=text}};
  const voices=[{name:'Microsoft David',lang:'en-US',localService:true},{name:'Microsoft Zira',lang:'en-US',localService:true}];
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,cancel:()=>{},speak:(u:any)=>{w.spoken.push(u.text);w.voice={name:u.voice?.name,pitch:u.pitch};setTimeout(()=>u.onend?.(),30)}}});
 });
 await page.request.post('/api/ai/consent');await page.route('**/api/auth/me',async r=>{const response=await r.fetch();const data=await response.json();await r.fulfill({json:{...data,user:{...data.user,emailVerified:true}}})});
 await page.route('**/api/ai/status',r=>r.fulfill({json:{url:'https://voice-ai.test'}}));await page.route('https://voice-ai.test/health',r=>r.fulfill({headers:cors,json:{ok:true}}));await page.route('**/api/ai/ticket',r=>r.fulfill({json:{url:'https://voice-ai.test',ticket:'test'}}));let asks=0;
 await page.route('https://voice-ai.test/ask',r=>{asks++;expect(r.request().postDataJSON().question).toBe('What did I write yesterday?');return r.fulfill({headers:cors,json:{answer:'You wrote about a walk.',sources:[]}})});
 await page.goto('/#ask');await page.getByRole('button',{name:'Start voice conversation'}).click();await expect(page.getByRole('button',{name:'End voice conversation'})).toBeVisible();
 await page.evaluate(()=>{const w=window as any;w.recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'What did I write yesterday?'}}]})});
 await expect(page.locator('.ask-answer')).toHaveText('You wrote about a walk.');await expect.poll(()=>page.evaluate(()=>(window as any).voiceStarts)).toBe(2);expect(asks).toBe(1);expect(await page.evaluate(()=>(window as any).spoken.join(''))).toBe('You wrote about a walk.');
 expect(await page.evaluate(()=>(window as any).voice)).toEqual({name:'Microsoft Zira',pitch:1.4});
 await page.getByRole('button',{name:'End voice conversation'}).click();await expect(page.getByRole('button',{name:'Start voice conversation'})).toBeVisible();
 await page.getByRole('button',{name:'Start voice conversation'}).click();await page.getByRole('link',{name:'Privacy',exact:true}).click();expect(await page.evaluate(()=>(window as any).voiceStops)).toBeGreaterThanOrEqual(3);
});
test('unsupported voice remains visible and leaves typing usable',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechRecognition',{value:undefined});Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined})});
 await page.request.post('/api/ai/consent');await page.route('**/api/auth/me',async r=>{const response=await r.fetch();const data=await response.json();await r.fulfill({json:{...data,user:{...data.user,emailVerified:true}}})});
 await page.goto('/#ask');await expect(page.getByRole('button',{name:'Start voice conversation'})).toBeDisabled();await page.getByRole('textbox',{name:'Ask about your journal'}).fill('What did I write?');await expect(page.getByRole('button',{name:'Send question'})).toBeEnabled();
});

test('denied microphone returns to typing and voice controls fit phones',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as any;
  class Recognition {onerror:any;onend:any;start(){setTimeout(()=>{this.onerror?.({error:'not-allowed'});this.onend?.()},10)}stop(){}}
  w.SpeechRecognition=Recognition;
 });
 await page.request.post('/api/ai/consent');await page.route('**/api/auth/me',async r=>{const response=await r.fetch();const data=await response.json();await r.fulfill({json:{...data,user:{...data.user,emailVerified:true}}})});
 await page.goto('/#ask');await page.getByRole('button',{name:'Start voice conversation'}).click();
 await expect(page.getByRole('alert')).toContainText('Microphone access is blocked');
 await page.getByRole('textbox',{name:'Ask about your journal'}).fill('What did I write?');
 await expect(page.getByRole('button',{name:'Send question'})).toBeEnabled();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.impeccable/review/voice-${width}.png`,fullPage:true});
 }
});
