import {test,expect,seedBook,seedJournal} from './fixtures'

test('a save the server refuses shows an error and keeps the draft',async({page})=>{
 await page.goto('/#new');await page.getByLabel('Sketchbook name').fill('Abort at commit')
 await page.locator('input[type=file]').last().setInputFiles('public/artworks/roses.jpg');await page.locator('.artwork-edit-card').first().waitFor()
 await page.route('**/api/books/*',route=>route.request().method()==='PUT'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'down',message:'The server is resting.'}})}):route.continue())
 await page.getByRole('button',{name:'Save sketchbook'}).click()
 await expect(page.locator('.notification')).toContainText('Could not save');await expect(page.getByRole('button',{name:'Save sketchbook'})).toBeEnabled();await expect(page.getByLabel('Sketchbook name')).toHaveValue('Abort at commit')
})

test('blocked local storage still renders the portfolio',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('denied','SecurityError')}})
 await page.goto('/');await expect(page.locator('.artist-profile')).toBeVisible()
})

test('an unsaved draft survives reload and is not replaced by a new book',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click()
 await page.getByLabel('Sketchbook name').fill('My unsaved work')
 await page.getByRole('button',{name:'Back to portfolio'}).click();await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click()
 await expect(page.getByLabel('Sketchbook name')).toHaveValue('My unsaved work');await expect(page.locator('.notification')).toContainText('unsaved draft')
 await page.waitForTimeout(900);await page.reload();await expect(page.getByLabel('Sketchbook name')).toHaveValue('My unsaved work')
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Discard draft'}).click()
 await expect(page.locator('.artist-profile')).toBeVisible();await page.reload();await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click();await expect(page.getByLabel('Sketchbook name')).toHaveValue('Untitled sketchbook')
})

async function newJournal(page:import('@playwright/test').Page){
 await page.goto('/#new');await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Journal'}).click()
 await expect(page.getByLabel('Journal name')).toHaveValue('Untitled journal')
}
const field=(page:import('@playwright/test').Page)=>page.getByRole('textbox',{name:'Paragraph'})

test('the customizing section switches between sketchbook and journal and saves a journal with no pictures',async({page,account})=>{
 await newJournal(page);await expect(page.getByRole('heading',{name:'Your pages'})).toBeVisible()
 await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Sketchbook'}).click();await expect(page.getByLabel('Sketchbook name')).toHaveValue('Untitled sketchbook');await expect(page.getByRole('heading',{name:'Your artwork'})).toBeVisible()
 await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Journal'}).click()
 await page.getByLabel('Journal name').fill('Slow notes');await page.getByLabel('About this journal').fill('What the days felt like.')
 await page.getByRole('button',{name:'Write on page 1'}).click();await page.getByRole('button',{name:'Everyday font'}).click()
 await field(page).click();await page.keyboard.type('Today was quiet.');await expect(page.locator('.journal-canvas-page .j-text')).toHaveText('Today was quiet.')
 await expect(page.locator('.journal-canvas-page .j-text')).toHaveCSS('font-family',/Caveat/)
 await page.getByRole('button',{name:'Back to book'}).click();await page.getByRole('button',{name:'Save journal'}).click()
 await expect(page.getByRole('button',{name:'Journals',exact:true})).toHaveAttribute('aria-pressed','true');await page.reload()
 await page.getByRole('button',{name:'Open Slow notes'}).click()
 const stage=page.locator('.portfolio-dialog .book-stage');await expect(stage.locator('.stf__item').first()).toBeAttached()
 const pages=stage.locator('[hidden] .book-page')
 // Cover, inside cover, front page, one written page, two blanks, one to keep the spread even, back cover.
 await expect(pages).toHaveCount(8);await expect(pages.nth(2)).toContainText('What the days felt like.');await expect(pages.nth(2)).toContainText(account.username);await expect(pages.nth(2)).toContainText('Started')
 await expect(pages.nth(3)).toContainText('Today was quiet.');await expect(pages.nth(3).locator('.j-number')).toHaveText('1')
})

test('long writing continues across pages and word limits hold',async({page})=>{
 await newJournal(page);await page.getByRole('button',{name:'Write on page 1'}).click();await field(page).click()
 await page.evaluate(()=>document.execCommand('insertText',false,'word '.repeat(400)))
 await expect(page.locator('.journal-status')).toContainText('2 pages');await expect(page.locator('.journal-status')).toContainText('400 / 1000 words')
 await page.getByRole('button',{name:'Statement layout'}).click();await expect(page.locator('.journal-status')).toContainText('Too much text');await expect(page.getByRole('button',{name:'Writing layout'})).toHaveAttribute('aria-pressed','true')
})

test('every layout, layered and spread, adapts to every format without losing text',async({page})=>{
 await newJournal(page);await page.getByRole('button',{name:'Write on page 1'}).click();await field(page).click();await page.keyboard.type('Kept across every layout.')
 for(const name of ['Statement','Window','Margin Note','Two Frames','Zigzag','Stepped Essay','Inset Columns','Ledger','Collage Story','Overlap Title','Photo Stack','Title Card','Offset Frames','Ribbon Title','Panorama','Across the Fold','Scrapbook','Fold Band']){
  await page.getByRole('button',{name:`${name} layout`}).click();await expect(page.locator('.journal-canvas-page .j-box').filter({hasText:'Kept across every layout.'})).toHaveCount(1)
 }
 await page.getByRole('button',{name:'Back to book'}).click()
 for(const format of ['1:1','4:3','16:9','3:4']){
  await page.getByRole('button',{name:`${format} format`}).click();await expect(page.locator('.journal-thumb .j-grid .j-text')).toHaveText('Kept across every layout.')
  const inside=await page.locator('.journal-thumb .j-grid').evaluate(grid=>{const box=grid.getBoundingClientRect();return [...grid.querySelectorAll<HTMLElement>('.j-image')].every(slot=>{const r=slot.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1})})
  expect(inside).toBe(true)
 }
})

test('a box stops at its limits and pictures are reduced under 200 KB',async({page})=>{
 await newJournal(page);await page.getByRole('button',{name:'Write on page 1'}).click();await page.getByRole('button',{name:'Statement layout'}).click()
 await page.getByRole('button',{name:'Edit title'}).click();await page.getByRole('textbox',{name:'Title'}).click()
 await page.evaluate(()=>document.execCommand('insertText',false,'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen'))
 await expect(page.locator('.journal-status')).toContainText('Word limit');await expect(page.getByRole('textbox',{name:'Title'})).toHaveText('')
 await page.locator('.journal-composer input[type=file]').evaluate(()=>{})
 await page.getByRole('button',{name:'Edit picture'}).click({noWaitAfter:true}).catch(()=>{})
 await page.locator('.journal-composer input[type=file]').setInputFiles('public/textures/woven.jpg')
 const image=page.locator('.journal-canvas-page .j-image img');await expect(image).toBeVisible()
 const bytes=await image.evaluate(img=>{const src=(img as HTMLImageElement).src;return (src.length-src.indexOf(',')-1)*.75});expect(bytes).toBeLessThan(200*1024)
})

test('stored markup cannot run',async({page})=>{
 // The server strips it on save; whatever reaches the browser is sanitized again before it is drawn.
 await seedJournal(page.request,'Hostile',[{layout:'writing',texts:{p0:'<img src=x onerror="window.pwned=1"><script>window.pwned=1</script><b onclick="window.pwned=1">safe</b>'}}])
 await page.goto('/');await page.getByRole('button',{name:'Journals',exact:true}).click();await page.getByRole('button',{name:'Open Hostile'}).click()
 const text=page.locator('.portfolio-dialog [hidden] .j-text');await expect(text.locator('b')).toHaveText('safe');await expect(text.locator('img')).toHaveCount(0);expect(await text.locator('b').getAttribute('onclick')).toBeNull();expect(await page.evaluate(()=>'pwned' in window)).toBe(false)
})

async function deskWith(page:import('@playwright/test').Page,entry:object){
 await seedJournal(page.request,'Moves',[entry])
 await page.goto('/');await page.getByRole('button',{name:'Journals',exact:true}).click();await page.getByRole('button',{name:'Edit Moves'}).click();await page.getByRole('button',{name:'Write on page 1'}).click()
}
const slotText=(page:import('@playwright/test').Page,id:string)=>page.locator(`.journal-canvas-page [data-slot=${id}] .j-text`)

test('text and pictures move between boxes by drag or by tap',async({page})=>{
 await deskWith(page,{layout:'frames',texts:{p0:'First box',p1:'Second box'},images:{i0:'/artworks/roses.jpg'}})
 const from=await page.locator('.journal-canvas-page [data-slot=p0]').boundingBox(),to=await page.locator('.journal-canvas-page [data-slot=p1]').boundingBox()
 await page.mouse.move(from!.x+from!.width/2,from!.y+20);await page.mouse.down();await page.mouse.move(to!.x+to!.width/2,to!.y+30,{steps:8})
 await expect(page.locator('.journal-ghost')).toBeVisible();await expect(page.locator('.journal-canvas-page [data-slot=p1]')).toHaveClass(/is-target/);await expect(page.locator('.journal-canvas-page [data-slot=i0]')).not.toHaveClass(/is-target/)
 await page.mouse.up();await expect(slotText(page,'p0')).toHaveText('Second box');await expect(slotText(page,'p1')).toHaveText('First box');await expect(page.locator('.journal-ghost')).toHaveCount(0)
 await expect(field(page)).toHaveText('First box')
 await page.getByRole('button',{name:'Move paragraph'}).click();await expect(page.locator('.journal-status')).toContainText('Choose a box')
 await page.getByRole('button',{name:'Edit picture'}).first().click();await expect(page.locator('.journal-status')).toContainText('keep their own boxes');await expect(slotText(page,'p1')).toHaveText('First box')
 await page.getByRole('button',{name:'Edit picture'}).first().click();await page.getByRole('button',{name:'Move picture',exact:true}).click();await page.getByRole('button',{name:'Edit picture'}).last().click()
 await expect(page.locator('.journal-canvas-page [data-slot=i1] img')).toHaveAttribute('src','/artworks/roses.jpg');await expect(page.locator('.journal-canvas-page [data-slot=i0] img')).toHaveCount(0)
})

test('a move that does not fit is refused and boxes resize, reset and keep their size in the book',async({page})=>{
 await deskWith(page,{layout:'statement',texts:{p0:'A paragraph that is much too long to become the title of this page, even now that titles hold sixteen words'}})
 await page.getByRole('button',{name:'Edit paragraph'}).click();await page.getByRole('button',{name:'Move paragraph'}).click();await page.getByRole('button',{name:'Edit title'}).click()
 await expect(page.locator('.journal-status')).toContainText('Too long');await expect(slotText(page,'p0')).toContainText('A paragraph')
 const edge=page.locator('.journal-canvas-page .j-edge').last(),image=page.locator('.journal-canvas-page [data-slot=i0]')
 const before=(await image.boundingBox())!.height
 await edge.focus();await page.keyboard.press('ArrowDown');await expect.poll(async()=>(await image.boundingBox())!.height).toBeGreaterThan(before+5)
 await page.getByRole('button',{name:'Back to book'}).click();await expect(page.locator('.journal-thumb [style*="span 6"]')).toHaveCount(1)
 await page.getByRole('button',{name:'Write on page 1'}).click();await page.getByRole('button',{name:'Reset boxes'}).click()
 await expect.poll(async()=>Math.round((await image.boundingBox())!.height)).toBe(Math.round(before));await expect(page.getByRole('button',{name:'Reset boxes'})).toHaveCount(0)
})

test('text without a box waits in the tray and pictures keep their chosen focus',async({page})=>{
 await deskWith(page,{layout:'ledger',texts:{p0:'One',p1:'Two',p2:'Three'},images:{i0:'/artworks/venice.jpg'}})
 await page.getByRole('button',{name:'Statement layout'}).click()
 const tray=page.locator('.journal-tray button');await expect(tray).toHaveCount(2)
 await tray.first().click();await page.getByRole('button',{name:'Edit title'}).click();await expect(tray).toHaveCount(1);await expect(page.locator('.journal-canvas-page [data-slot=t0] .j-text')).toHaveText('Two')
 await page.getByRole('button',{name:'Edit picture'}).click();const frame=page.getByRole('slider',{name:'Picture position'})
 await frame.focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft')
 await expect(page.locator('.journal-canvas-page [data-slot=i0] img')).toHaveCSS('object-position','40% 50%')
 await page.getByRole('button',{name:'Back to book'}).click();await expect(page.locator('.journal-thumb .j-image img').first()).toHaveCSS('object-position','40% 50%')
})

// A stand-in for the browser's recognizer, so tests can speak.
async function fakeSpeech(page:import('@playwright/test').Page){
 await page.addInitScript(()=>{
  const w=window as unknown as Record<string,unknown>
  w.SpeechRecognition=class{onresult:unknown;onend:(()=>void)|null=null;start(){w.voice=this;w.starts=((w.starts as number)||0)+1}stop(){this.onend?.()}}
 })
}
const say=(page:import('@playwright/test').Page,text:string,final:boolean)=>page.evaluate(([text,final])=>{const voice=(window as unknown as {voice:{onresult:(e:unknown)=>void}}).voice;voice.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]})},[text,final] as const)

test('voice typing writes live, survives restarts and moves on when a box fills',async({page})=>{
 await fakeSpeech(page);await deskWith(page,{layout:'statement',texts:{}})
 await page.getByRole('button',{name:'Edit title'}).click();await page.getByRole('button',{name:'Voice typing'}).click()
 await expect(page.getByRole('button',{name:'Voice typing'})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.journal-tools small')).toContainText('speech service')
 await say(page,'A quiet',false);await expect(slotText(page,'t0')).toHaveText('A quiet');await expect(page.getByRole('textbox',{name:'Title'})).toHaveAttribute('aria-readonly','true')
 await say(page,'A quiet <b>morning</b>',true);await expect(slotText(page,'t0')).toHaveText('A quiet <b>morning</b>');await expect(slotText(page,'t0').locator('b')).toHaveCount(0)
 // The browser ends a session after silence; the next one must not repeat what was kept.
 await page.evaluate(()=>(window as unknown as {voice:{onend:()=>void}}).voice.onend());expect(await page.evaluate(()=>(window as unknown as {starts:number}).starts)).toBe(2)
 await say(page,'by the sea and the long road home where the gulls call out all evening',true)
 await expect(slotText(page,'t0')).toHaveText('A quiet <b>morning</b>');await expect(slotText(page,'p0')).toHaveText('by the sea and the long road home where the gulls call out all evening')
 await expect(page.getByRole('textbox',{name:'Paragraph'})).toHaveText('by the sea and the long road home where the gulls call out all evening')
 await page.getByRole('button',{name:'Voice typing'}).click();await expect(page.getByRole('button',{name:'Voice typing'})).toHaveAttribute('aria-pressed','false')
 await expect(page.getByRole('textbox',{name:'Paragraph'})).toHaveAttribute('contenteditable','true')
})

test('voice typing is hidden where the browser cannot listen',async({page})=>{
 await page.addInitScript(()=>{const w=window as unknown as Record<string,unknown>;delete w.SpeechRecognition;delete w.webkitSpeechRecognition})
 await deskWith(page,{layout:'writing',texts:{}});await expect(field(page)).toBeVisible();await expect(page.getByRole('button',{name:'Voice typing'})).toHaveCount(0)
})

test('formatting and links are drawn on the page, and only web links survive',async({page})=>{
 await deskWith(page,{layout:'writing',texts:{p0:'<a href="javascript:window.pwned=1">bad</a> and <a href="https://ok.example/x">good</a>'}})
 const text=page.locator('.journal-canvas-page .j-text')
 await expect(text.locator('a')).toHaveCount(1);await expect(text.locator('a')).toHaveAttribute('href','https://ok.example/x');await expect(text.locator('a')).toHaveAttribute('rel',/noopener/)
 await field(page).click();await page.keyboard.press('Control+A');await page.keyboard.type('A quiet morning');await page.keyboard.press('Control+A')
 for(const name of ['Bold','Italic','Underline','Highlight'])await page.getByRole('button',{name,exact:true}).click()
 for(const tag of ['b','i','u','mark'])await expect(text.locator(tag)).toHaveText('A quiet morning')
 await expect(page.getByRole('button',{name:'Highlight',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Highlight',exact:true}).click();await expect(text.locator('mark')).toHaveCount(0);await expect(text.locator('b')).toHaveText('A quiet morning')
 await page.keyboard.press('End');await page.getByRole('button',{name:'Add link'}).click()
 await page.getByLabel('Link address').fill('not a link');await page.getByRole('button',{name:'Save link'}).click();await expect(page.getByRole('alert')).toContainText('web address')
 await page.getByLabel('Link address').fill('www.example.com/notes?user=8812');await page.getByRole('button',{name:'Save link'}).click()
 const link=text.locator('a');await expect(link).toHaveText('example.com');await expect(link).toHaveAttribute('href','https://www.example.com/notes?user=8812');await expect(link).toHaveAttribute('target','_blank')
 expect(await page.evaluate(()=>'pwned' in window)).toBe(false)
})

test('rough scribbles are placed, moved, removed and limited per page',async({page})=>{
 await deskWith(page,{layout:'statement',texts:{t0:'Sunday'}})
 await page.getByRole('button',{name:'Add heart scribble'}).click()
 const mark=page.locator('.journal-canvas-page .j-scribble');await expect(mark).toHaveCount(1);await expect(mark.locator('path').first()).toBeAttached()
 const left=await mark.evaluate(node=>parseFloat((node as HTMLElement).style.left))
 await page.getByRole('button',{name:'Heart scribble',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight')
 await expect.poll(()=>mark.evaluate(node=>parseFloat((node as HTMLElement).style.left))).toBe(left+16)
 const width=await mark.evaluate(node=>(node as HTMLElement).offsetWidth);await page.keyboard.press('Shift+ArrowRight');await expect.poll(()=>mark.evaluate(node=>(node as HTMLElement).offsetWidth)).toBe(width+8)
 await page.keyboard.press('Delete');await expect(mark).toHaveCount(0)
 for(const name of ['underline','box','circle','arrow','star','check'])await page.getByRole('button',{name:`Add ${name} scribble`}).click()
 await expect(mark).toHaveCount(6);await expect(page.getByRole('button',{name:'Add smile scribble'})).toBeDisabled()
 await page.getByRole('button',{name:'Back to book'}).click();await expect(page.locator('.journal-thumb .j-scribble')).toHaveCount(6)
})

test('the watermark puts the owner on every written page and nowhere else',async({page,account})=>{
 await newJournal(page);await page.getByRole('button',{name:'Add page'}).click();await field(page).click();await page.keyboard.type('Second page.')
 await page.getByRole('button',{name:'Watermark with your name and picture'}).click();await page.getByRole('button',{name:'Back to book'}).click()
 const thumbs=page.locator('.journal-thumb .j-watermark');await expect(thumbs).toHaveCount(2);await expect(thumbs.first()).toHaveText(`@${account.username}`)
 await page.getByLabel('Journal name').fill('Marked');await page.getByRole('button',{name:'Save journal'}).click();await page.getByRole('button',{name:'Open Marked'}).click()
 const pages=page.locator('.portfolio-dialog [hidden] .book-page');await expect(pages.first()).toBeAttached()
 // Front page, two written pages and the blanks: only the written pages carry the mark.
 await expect(page.locator('.portfolio-dialog [hidden] .j-watermark')).toHaveCount(2);await expect(pages.nth(2).locator('.j-watermark')).toHaveCount(0)
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Edit Marked'}).click();await page.getByRole('button',{name:'Write on page 1'}).click();await page.getByRole('button',{name:'No watermark'}).click();await page.getByRole('button',{name:'Back to book'}).click();await expect(thumbs).toHaveCount(0)
})

test('a journal turns in 3D by drag and keys, still turns pages, and returns flat',async({page})=>{
 await newJournal(page);const stage=page.locator('.book-stage'),orbit=stage.locator('.book-orbit'),view=stage.getByRole('button',{name:'3D view'})
 await expect(stage.locator('.stf__item').first()).toBeAttached();await expect(stage.locator('.book-slab')).toHaveCount(0)
 await view.click();await expect(view).toHaveAttribute('aria-pressed','true');await expect(stage.locator('.book-slab')).toBeAttached()
 const angle=()=>orbit.evaluate(node=>node.style.transform)
 const box=(await stage.locator('.book-area').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+200,box.y+box.height/2,{steps:8});await page.mouse.up()
 await expect.poll(angle).toMatch(/rotateY\((4\d|5\d|6\d)/)
 await stage.locator('.book-area').focus();await page.keyboard.press('Shift+ArrowRight');await expect.poll(angle).toMatch(/rotate\(6/)
 // Dragging never turned a page; the buttons still do.
 const previous=stage.getByRole('button',{name:'Previous pages'});await expect(previous).toBeDisabled()
 await stage.getByRole('button',{name:'Next pages'}).click();await expect(previous).toBeEnabled()
 await view.click();await expect(view).toHaveAttribute('aria-pressed','false');await expect(stage.locator('.book-slab')).toHaveCount(0);await expect.poll(angle).toBe('')
})

test('journals are always Linen, with no elastic or wire, while sketchbooks keep every binding',async({page})=>{
 await newJournal(page);const stage=page.locator('.book-stage')
 await expect(page.locator('.creator-binding')).toHaveCount(0);await expect(stage).toHaveClass(/preset-linen/);await expect(stage.locator('.elastic-band')).toHaveCount(0)
 await expect(page.getByRole('button',{name:/^Elastic /})).toHaveCount(0)
 // Back to Sketchbook: the bindings and the Watercolor elastic are still there.
 await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Sketchbook'}).click()
 await expect(page.locator('.creator-binding')).toBeVisible();await expect(stage).toHaveClass(/preset-watercolor/);await expect(stage.locator('.elastic-band')).toHaveCount(1)
 await page.getByRole('button',{name:'Spiral'}).click();await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Journal'}).click();await expect(stage).toHaveClass(/preset-linen/)
 await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Sketchbook'}).click();await expect(stage).toHaveClass(/preset-spiral/)
 // A journal stored with another binding opens as Linen.
 await seedBook(page.request,{title:'Old',kind:'journal',design:{presetId:'watercolor',journal:{font:'book',size:'m',ink:'#262826',rule:'lined',about:'',created:'2026-11-02'}}})
 await page.goto('/');await page.reload();await page.getByRole('button',{name:'Journals',exact:true}).click();await page.getByRole('button',{name:'Open Old'}).click()
 const view=page.locator('.portfolio-dialog .book-stage');await expect(view).toHaveClass(/preset-linen/);await expect(view.locator('.elastic-band')).toHaveCount(0)
})

test('front and back covers use fixed layouts in the book and on the shelf',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Small summer');await page.getByLabel('Cover caption').fill('Volume one')
 const source=page.locator('.book-stage [hidden]')
 await page.getByRole('button',{name:'Title front cover'}).click();await expect(page.getByRole('button',{name:'Title front cover'})).toHaveAttribute('aria-pressed','true')
 await page.getByLabel('Quote',{exact:true}).fill('Write it down.');await page.getByLabel('Quote by',{exact:true}).fill('Me')
 const front=source.locator('.cover').first();await expect(front.locator('.jc-titled')).toContainText('Small summer');await expect(front.locator('.jc-titled q')).toHaveText('Write it down.');await expect(front.locator('.jc-titled cite')).toHaveText('Me')
 // Title is plain material: the artwork is not drawn edge to edge, and the caption is not repeated.
 await expect(front.locator('.cover-art-image')).toHaveCount(0);await expect(front.locator('.cover-phrase')).toHaveCount(0)
 await page.getByRole('button',{name:'Quote back cover'}).click();await page.getByLabel('Back quote',{exact:true}).fill('<b>Keep</b> the small days.')
 await expect(source.locator('.cover').last().locator('.jc-quote q')).toHaveText('<b>Keep</b> the small days.')
 await page.getByRole('button',{name:'Picture back cover'}).click();await page.getByLabel('Note',{exact:true}).fill('The river house.')
 await page.locator('.cover-picture-row input[type=file]').setInputFiles('public/textures/woven.jpg')
 await expect(source.locator('.cover').last().locator('.jc-picture img')).toHaveAttribute('src',/^data:image\//);await expect(source.locator('.cover').last()).toContainText('The river house.')
 await page.getByRole('button',{name:'Save journal'}).click()
 await expect(page.locator('.portfolio-cover .jc-titled')).toContainText('Small summer')
 await page.setViewportSize({width:320,height:640});await page.getByRole('button',{name:'Edit Small summer'}).click()
 await page.getByRole('navigation',{name:'Tools'}).getByRole('button',{name:'Layout',exact:true}).click();await page.getByRole('button',{name:'Lettering',exact:true}).click()
 expect(parseFloat(await page.getByLabel('Note',{exact:true}).evaluate(node=>getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('the preview turns to the cover being changed, and a saved journal opens for editing from its preview and the shelf',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Turns');const stage=page.locator('.creation-preview .book-stage')
 await expect(stage).toHaveClass(/is-closed/);await expect(stage).not.toHaveClass(/is-back/)
 await page.getByRole('button',{name:'Quote back cover'}).click();await expect(stage).toHaveClass(/is-back/)
 await page.getByLabel('Back quote',{exact:true}).fill('Slowly.');await expect(stage).toHaveClass(/is-back/);await expect(stage.locator('[hidden] .jc-quote')).toHaveText('Slowly.')
 await page.getByRole('button',{name:'Label front cover'}).click();await expect(stage).not.toHaveClass(/is-back/);await expect(stage).toHaveClass(/is-closed/)
 // The cover phrase shows focus with its underline, not an outline cutting through the label.
 await page.getByLabel('Cover caption').focus();await expect(page.getByLabel('Cover caption')).toHaveCSS('outline-style','none')
 await page.getByRole('button',{name:'Save journal'}).click()
 await page.getByRole('button',{name:'Open Turns'}).click();await page.locator('.portfolio-dialog').getByRole('button',{name:'Edit Turns'}).click()
 await expect(page.getByLabel('Journal name')).toHaveValue('Turns');await page.getByRole('button',{name:'Back to portfolio'}).click()
 await page.getByRole('button',{name:'Bookshelf'}).click();await page.getByRole('button',{name:'Select Turns'}).click();await expect(page.locator('.portfolio-dialog')).toBeVisible()
})

test('Collage keeps three overlapping pictures and no hidden box',async({page})=>{
 await deskWith(page,{layout:'collage',texts:{},images:{}})
 await expect(page.locator('.journal-canvas-page [data-slot^=i]')).toHaveCount(3)
})

test('a spread is one surface over two pages, starts on a left page and carries a subtitle',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Spreads');await page.getByRole('button',{name:'Write on page 1'}).click()
 await field(page).click();await page.keyboard.type('First page.');await page.getByRole('button',{name:'Back to book'}).click()
 await page.getByRole('button',{name:'Add page'}).click();await page.getByRole('button',{name:'Across the Fold layout'}).click()
 const canvas=page.locator('.journal-canvas-page')
 await expect(canvas).toHaveClass(/is-spread/);await expect(canvas.locator('.j-edge')).toHaveCount(0)
 // Page 2 would be a right page, so a blank comes first and the spread is pages 3 and 4.
 await expect(canvas.locator('.j-number')).toHaveText(['3','4'])
 await canvas.getByRole('button',{name:'Edit subtitle'}).click();await page.getByRole('textbox',{name:'Subtitle'}).click();await page.keyboard.type('A weekend away')
 await expect(canvas.locator('.j-text.j-H')).toHaveText('A weekend away')
 await page.getByRole('button',{name:'Back to book'}).click();await expect(page.getByRole('button',{name:'Write on page 3'})).toBeVisible()
 await page.getByRole('button',{name:'Save journal'}).click();await page.getByRole('button',{name:'Open Spreads'}).click()
 const stage=page.locator('.portfolio-dialog .book-stage');await expect(stage.locator('.stf__item').first()).toBeAttached()
 // Both pages of the spread draw the same sheet; the right page shows its second half.
 await expect(stage.locator('.stf__item .journal-sheet.is-spread').filter({hasText:'A weekend away'})).toHaveCount(2)
 await expect(stage.locator('.stf__item .journal-sheet.is-right-half')).toHaveCount(1)
})

test('journals show one page at a time on phones and everything fits at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:640});await newJournal(page)
 await expect(page.locator('.book-stage')).toHaveClass(/is-portrait/);await page.getByRole('button',{name:'Write on page 1'}).click();await expect(field(page)).toBeVisible()
 const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(fits).toBe(true)
 expect(parseFloat(await field(page).evaluate(node=>getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16)
})

test('a journal opens at its newest written page, jumps from the page strip and turns back to the start',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Recent');await page.getByRole('button',{name:'Write on page 1'}).click()
 await field(page).click();await page.keyboard.type('Latest words.');await page.getByRole('button',{name:'Back to book'}).click();await page.getByRole('button',{name:'Save journal'}).click()
 await page.getByRole('button',{name:'Open Recent'}).click()
 const stage=page.locator('.portfolio-dialog .book-stage');await expect(stage.locator('.stf__item').first()).toBeAttached()
 await expect(stage).not.toHaveClass(/is-closed/)
 await stage.getByRole('button',{name:'Pages',exact:true}).click()
 // Cover, inside cover, front page, the written page, then blanks and the back cover; the written page is showing.
 await expect(stage.getByRole('button',{name:'Page 3'})).toHaveAttribute('aria-current','true')
 await stage.getByRole('button',{name:'Back cover'}).click();await expect(stage).toHaveClass(/is-back/)
 await expect(stage.getByRole('button',{name:'Next pages'})).toHaveCount(0)
 await stage.getByRole('button',{name:'Back to start'}).click();await expect(stage).not.toHaveClass(/is-back/);await expect(stage).toHaveClass(/is-closed/)
 await expect(stage.getByRole('button',{name:'Front cover'})).toHaveAttribute('aria-current','true')
 await expect(stage.locator('.book-orbit')).not.toHaveAttribute('style',/rotate/)
})

test('stickers are pressed onto a page, moved, turned, removed and limited, and the book draws them',async({page})=>{
 await deskWith(page,{layout:'margin',texts:{p0:'A quiet day.'},stickers:[{id:'bad',src:'/artworks/roses.jpg',name:'Bad',x:50,y:50,size:20,rotate:0}]})
 const canvas=page.locator('.journal-canvas-page')
 // A stored record that is not a prepared cutout is never drawn.
 await expect(canvas.locator('.sticker')).toHaveCount(0)
 const tray=page.locator('.journal-desk .sticker-tray')
 await tray.getByRole('button',{name:'Faces',exact:true}).click();await expect(tray.locator('button.sticker-pick').first()).toBeVisible()
 for(const src of await tray.locator('.sticker-pick img').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src'))))expect(src).toContain('/stickers/expressions/')
 await tray.locator('button.sticker-pick').first().click()
 await expect(canvas.locator('.sticker')).toHaveCount(1);await expect(page.locator('.journal-desk .sticker-count')).toHaveText('1 / 8')
 const sticker=canvas.locator('.sticker').first(),hit=canvas.locator('.sticker-hit').first()
 const left=await sticker.evaluate(n=>parseFloat((n as HTMLElement).style.left))
 await hit.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>sticker.evaluate(n=>parseFloat((n as HTMLElement).style.left))).toBeCloseTo(Math.min(100,left+1),1)
 const width=await sticker.evaluate(n=>parseFloat((n as HTMLElement).style.width))
 await page.keyboard.press('Shift+ArrowUp');await expect.poll(()=>sticker.evaluate(n=>parseFloat((n as HTMLElement).style.width))).toBeCloseTo(width+1,1)
 await page.keyboard.press('Shift+ArrowRight');await expect(sticker).toHaveAttribute('style',/rotate\(-?\d+deg\)/)
 await page.keyboard.press('Delete');await expect(canvas.locator('.sticker')).toHaveCount(0)
 for(let i=0;i<8;i++)await tray.locator('button.sticker-pick').nth(i).click()
 await expect(canvas.locator('.sticker')).toHaveCount(8);await expect(tray.locator('button.sticker-pick').first()).toBeDisabled()
 await page.getByRole('button',{name:'Back to book'}).click()
 await expect(page.locator('.book-stage [hidden] .journal-page .sticker')).toHaveCount(8)
})

test('cover stickers are arranged on the flat cover, limited, and shown in the book and on the shelf',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Stuck')
 const tray=page.locator('.journal-cover-settings .sticker-tray')
 await tray.getByRole('button',{name:'Nature',exact:true}).click();await tray.locator('button.sticker-pick').first().click()
 const editor=page.locator('.cover-stickers-editor');await expect(editor.locator('.sticker')).toHaveCount(1)
 await expect(page.getByRole('button',{name:'Cover stickers'})).toHaveAttribute('aria-pressed','true')
 // Dragging a sticker from the tray drops it where it is released.
 const pick=await tray.locator('button.sticker-pick').nth(1).boundingBox(),surface=await editor.locator('[data-sticker-surface]').boundingBox()
 await page.mouse.move(pick!.x+20,pick!.y+20);await page.mouse.down();await page.mouse.move(pick!.x+40,pick!.y+40,{steps:3});await page.mouse.move(surface!.x+surface!.width*.25,surface!.y+surface!.height*.75,{steps:8});await page.mouse.up()
 await expect(editor.locator('.sticker')).toHaveCount(2)
 const dropped=await editor.locator('.sticker').nth(1).evaluate(n=>[parseFloat((n as HTMLElement).style.left),parseFloat((n as HTMLElement).style.top)])
 expect(dropped[0]).toBeCloseTo(25,0);expect(dropped[1]).toBeCloseTo(75,0)
 for(let i=2;i<5;i++)await tray.locator('button.sticker-pick').nth(i).click()
 await expect(editor.locator('.sticker')).toHaveCount(5);await expect(tray.locator('button.sticker-pick').first()).toBeDisabled()
 await page.locator('.cover-stickers-editor .sticker-hit').first().focus();await page.getByRole('button',{name:'Remove sticker'}).click()
 await expect(editor.locator('.sticker')).toHaveCount(4)
 await page.getByRole('button',{name:'Preview book'}).first().click()
 await expect(page.locator('.creation-preview .book-stage [hidden] .cover').first().locator('.sticker')).toHaveCount(4)
 await expect(page.locator('.creation-preview .book-stage [hidden] .cover').last().locator('.sticker')).toHaveCount(0)
 await page.getByRole('button',{name:'Save journal'}).click()
 await expect(page.locator('.portfolio-cover .sticker')).toHaveCount(4)
})

test('text aligns per box, pictures are positioned on the page and cropped under 200 KB',async({page})=>{
 await deskWith(page,{layout:'margin',texts:{p0:'A quiet day.',c0:'Caption'},images:{i0:'/artworks/irises.jpg'}})
 const canvas=page.locator('.journal-canvas-page')
 await page.getByRole('button',{name:'Edit paragraph'}).click();await page.getByRole('button',{name:'Align centre'}).click()
 await expect(canvas.locator('[data-slot=p0] .j-text')).toHaveCSS('text-align','center');await expect(field(page)).toHaveCSS('text-align','center')
 await expect(canvas.locator('[data-slot=c0] .j-text')).toHaveCSS('text-align','left')
 await page.getByRole('button',{name:'Edit picture'}).click();await page.getByRole('button',{name:'Position picture'}).click()
 const pad=canvas.getByRole('slider',{name:'Picture position'});await expect(pad).toBeVisible()
 await pad.focus();await page.keyboard.press('ArrowRight');await expect(canvas.locator('[data-slot=i0] img')).toHaveCSS('object-position','55% 50%')
 await page.getByRole('button',{name:'Crop picture'}).click();await expect(pad).toHaveCount(0)
 await page.getByRole('button',{name:'Apply crop'}).click()
 const src=canvas.locator('[data-slot=i0] img');await expect(src).toHaveAttribute('src',/^data:image\//)
 expect(((await src.getAttribute('src'))!.length*3/4)).toBeLessThan(200*1024)
 await page.getByRole('button',{name:'Back to book'}).click()
 await expect(page.locator('.book-stage [hidden] .j-layout-margin [style*="text-align: center"]')).toHaveCount(1)
})

test('page style is chosen beside the page, not with the cover',async({page})=>{
 await newJournal(page)
 for(const name of ['Lined paper','Large text','Navy ink','No watermark','Cotton paper'])await expect(page.getByRole('button',{name})).toHaveCount(0)
 await page.getByRole('button',{name:'Write on page 1'}).click()
 await page.getByRole('button',{name:'Grid paper'}).click();await page.getByRole('button',{name:'Large text'}).click();await page.getByRole('button',{name:'Cotton paper'}).click()
 await expect(page.locator('.journal-canvas-page')).toHaveCSS('--paper-image',/cotton/);await expect(page.getByRole('button',{name:'Grid paper'})).toHaveAttribute('aria-pressed','true')
})

test('bold, italic, underline and highlight show in every font, also from the caret',async({page})=>{
 await deskWith(page,{layout:'writing',texts:{}})
 await page.getByRole('button',{name:'Rough font'}).click()
 await field(page).click()
 for(const name of ['Bold','Italic','Underline','Highlight'])await page.getByRole('button',{name,exact:true}).click()
 for(const name of ['Bold','Italic','Underline','Highlight'])await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true')
 await page.keyboard.type('Loud words')
 const text=page.locator('.journal-canvas-page .j-text')
 for(const tag of ['b','i','u','mark'])await expect(text.locator(tag)).toHaveText('Loud words')
 // Fonts with one weight and no italic still draw bold and italic.
 await expect(text).toHaveCSS('font-synthesis-weight','auto');await expect(text).toHaveCSS('font-synthesis-style','auto')
 expect(await text.evaluate(node=>node.innerHTML.includes('​'))).toBe(false)
})

test('a longer title shrinks to fit a narrow box',async({page})=>{
 await deskWith(page,{layout:'inset',texts:{}})
 await page.getByRole('button',{name:'Edit title'}).click();await page.getByRole('textbox',{name:'Title'}).click()
 await page.keyboard.type('A long slow summer by the quiet grey sea with old friends')
 const title=slotText(page,'t0');await expect(title).toHaveText('A long slow summer by the quiet grey sea with old friends')
 expect(Number(await title.evaluate(node=>getComputedStyle(node).getPropertyValue('--fit')))).toBeLessThan(1)
})

test('two journal presets are saved to the account and applied to a new journal',async({page})=>{
 await newJournal(page);await page.getByLabel('Journal name').fill('Quiet style')
 await page.getByRole('button',{name:'Write on page 1'}).click();await page.getByRole('button',{name:'Rough font'}).click();await page.getByRole('button',{name:'Grid paper'}).click();await page.getByRole('button',{name:'Navy ink'}).click()
 await page.getByRole('button',{name:'Statement layout'}).click();await page.getByRole('button',{name:'Back to book'}).click()
 await page.getByRole('button',{name:'Title front cover'}).click()
 await page.getByRole('button',{name:'Save as preset'}).click();await expect(page.getByRole('button',{name:'Apply preset Quiet style'})).toBeVisible()
 await page.getByLabel('Journal name').fill('Second style');await page.getByRole('button',{name:'Save as preset'}).click()
 await expect(page.getByRole('button',{name:'Apply preset Second style'})).toBeVisible();await expect(page.getByRole('button',{name:'Save as preset'})).toHaveCount(0)
 expect((await page.request.put('/api/me/presets',{data:{presets:[{name:'a'},{name:'b'},{name:'c'}]}})).status()).toBe(400)
 // A fresh journal takes the whole look from the saved preset.
 page.on('dialog',dialog=>void dialog.accept())
 await page.getByRole('button',{name:'Discard draft'}).click();await newJournal(page)
 await page.getByRole('button',{name:'Apply preset Quiet style'}).click()
 await expect(page.getByRole('button',{name:'Title front cover'})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Write on page 1'}).click()
 for(const name of ['Rough font','Grid paper','Navy ink','Statement layout'])await expect(page.getByRole('button',{name})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Back to book'}).click();await page.getByRole('button',{name:'Delete preset Second style'}).click()
 await expect(page.getByRole('button',{name:'Apply preset Second style'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Save as preset'})).toBeVisible()
})
