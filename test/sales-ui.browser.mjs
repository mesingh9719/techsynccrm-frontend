// Real UI verification on guarded synthetic localhost fixtures. Run after the local QA API/Vite.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const base=process.env.QA_ORIGIN||'http://127.0.0.1:5177'
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname))
const [fixture]=JSON.parse(await fs.readFile('/tmp/techsync-campaign-pipeline-fixture.json','utf8'))
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const output=process.env.QA_OUTPUT||'/tmp/sales-ui-review';await fs.mkdir(output,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']})
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage()
let token
const errors=[],results=[],requests=[]
page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().includes('/api/')&&response.status()>=400)requests.push({path:new URL(response.url()).pathname,status:response.status()})})
async function api(path,method='GET',data) {const response=await context.request.fetch(base+'/api'+path,{method,data,headers:token?{authorization:'Bearer '+token}:{}});assert(response.ok(),`${method} ${path}: ${response.status()} ${await response.text()}`);return response.status()===204?null:(await response.json()).data}
const done=name=>{results.push(name);console.log(name)}
async function visit(path,heading) {await page.goto(base+path);await page.getByRole('heading',{level:1,name:heading,exact:true}).waitFor()}
async function shot(name) {await page.screenshot({path:output+'/'+name+'.png',fullPage:false});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' document overflow')}
try {
 token=(await api('/auth/login','POST',{email:fixture.users[0].email,password:'FixturePassword123!'})).accessToken
 const tag=Date.now().toString(36),campaigns=[]
 const examples=[['Website enquiries','website','active',800000,132000],['Search growth','google_ads','active',1250000,645000],['Partner referrals','referral','paused',500000,117000],['Customer reactivation','email','draft',300000,null],['Community launch','offline','completed',180000,195000]]
 for(const [index,[name,type,status,budget,spend]]of examples.entries()) {
  const campaign=(await api('/campaigns','POST',{name:'Studio · '+name,code:'ui-'+tag+'-'+index,type,status,objective:'lead_generation',startDate:'2026-10-01',endDate:'2026-11-30',budgetMinor:budget,actualSpendMinor:spend,sourceId:fixture.sourceId,landingUrl:'https://example.test/enquire',utm:{utm_source:type,utm_campaign:'ui-'+tag+'-'+index}})).campaign
  campaigns.push(campaign)
  for(let n=0;n<index+1;n++)await api('/leads','POST',{firstName:'Studio enquiry '+tag+' '+index+' '+n,campaignId:campaign.id,requirement:'A product consultation',budgetMinor:250000})
 }
 const pipeline=(await api('/pipelines','POST',{name:'Studio sales '+tag})).pipeline
 for(const [index,title]of ['Northstar — annual renewal','Acme — team expansion','Juniper — onboarding','Meridian — consultation','Orbit — regional launch','Beacon — discovery'].entries())await api('/deals','POST',{title,pipelineId:pipeline.id,stageId:pipeline.stages[index<3?0:index<5?1:2].id,valueMinor:[4250000,1800000,735000,2450000,9600000,510000][index],ownerId:fixture.users[0].id})
 const campaignPath='/app/campaigns?q='+encodeURIComponent('ui-'+tag)+'&sort=name',pipelinePath='/app/deals?pipelineId='+pipeline.id
 await visit(campaignPath,'Campaigns');await page.getByRole('link',{name:campaigns[0].name,exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:/Filters/}).getAttribute('aria-expanded'),'false')
 await shot('campaigns-desktop')
 await page.getByRole('button',{name:/Filters/}).click();await page.getByLabel('Campaigns created from',{exact:true}).fill('2026-01-01')
 await page.waitForURL(/createdFrom/)
 await page.getByRole('button',{name:/Filters/}).click()
 assert.equal(await page.getByRole('button',{name:/Filters/}).getAttribute('aria-expanded'),'false')
 await page.reload();await page.getByLabel('Campaigns created from',{exact:true}).waitFor()
 assert.equal(await page.getByLabel('Campaigns created from',{exact:true}).inputValue(),'2026-01-01')
 done('Campaign advanced filters collapse and restore from URL after reload')
 await page.getByRole('button',{name:/^Paused/}).click();await page.waitForURL(/status=paused/)
 await page.getByRole('link',{name:campaigns[2].name,exact:true}).waitFor();await page.waitForFunction(id=>!document.querySelector(`a[href="/app/campaigns/${id}"]`),campaigns[0].id);assert.equal(await page.getByRole('link',{name:campaigns[0].name,exact:true}).count(),0)
 await page.getByRole('button',{name:/^All campaigns/}).click();await page.waitForURL(url=>!url.searchParams.has('status'));await page.getByRole('link',{name:campaigns[0].name,exact:true}).waitFor();await page.getByLabel('Sort campaigns',{exact:true}).selectOption('-actualSpendMinor')
 await page.waitForURL(/sort=-actualSpendMinor/)
 await page.waitForFunction(name=>document.querySelector('table tbody tr a')?.textContent===name,campaigns[1].name)
 assert.equal(await page.getByRole('table',{name:'Campaigns',exact:true}).locator('tbody tr').first().getByRole('link').first().innerText(),campaigns[1].name)
 done('Status shortcuts and whole-collection sorting preserve campaign discovery')
 await visit('/app/campaigns/'+campaigns[0].id,campaigns[0].name);await page.getByRole('region',{name:'Lead journey'}).waitFor();await shot('campaign-detail-desktop')
 await page.getByRole('button',{name:'Duplicate',exact:true}).click();await page.getByRole('dialog',{name:'Create campaign',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click()
 await visit(pipelinePath,'Pipeline');await page.getByText('Northstar — annual renewal',{exact:true}).waitFor();await shot('pipeline-desktop')
 const scroll=await page.locator('.sales-board-columns').evaluate(node=>({height:node.clientHeight,scroll:node.scrollHeight}))
 assert(scroll.height<=740,JSON.stringify(scroll))
 const firstDeal=(await api('/deals?pipelineId='+pipeline.id+'&q='+encodeURIComponent('Northstar'))).items[0],target=pipeline.stages[1]
 await page.getByLabel('Move '+firstDeal.title+' to stage',{exact:true}).selectOption(target.id)
 await page.waitForResponse(response=>response.url().endsWith('/deals/'+firstDeal.id+'/move'))
 assert.equal((await api('/deals/'+firstDeal.id)).deal.stageId,target.id)
 done('Contained board retains accessible stage moves and persists the new stage')
 const moving=page.locator('[draggable=true]').filter({has:page.getByLabel('Move '+firstDeal.title+' to stage',{exact:true})}),dragTarget=pipeline.stages[2]
 await Promise.all([page.waitForResponse(response=>response.url().endsWith('/deals/'+firstDeal.id+'/move')),moving.dragTo(page.getByRole('listitem',{name:new RegExp('^'+dragTarget.name+':')}),{sourcePosition:{x:40,y:20},targetPosition:{x:100,y:30}})])
 assert.equal((await api('/deals/'+firstDeal.id)).deal.stageId,dragTarget.id)
 await visit('/app/deals?pipelineId='+fixture.pipelineId,'Pipeline');await page.getByText('QA Deal 0',{exact:true}).first().waitFor()
 const largeColumn=page.locator('.sales-stage-body').first()
 assert(await largeColumn.evaluate(node=>node.scrollHeight>node.clientHeight))
 const cardsBefore=await largeColumn.locator('[draggable=true]').count()
 await largeColumn.getByRole('button',{name:'Load more',exact:true}).scrollIntoViewIfNeeded()
 await largeColumn.getByRole('button',{name:'Load more',exact:true}).click()
 await page.waitForFunction(count=>document.querySelector('.sales-stage-body').querySelectorAll('[draggable=true]').length>count,cardsBefore)
 assert(await page.evaluate(()=>document.documentElement.scrollHeight<1800),'Large column stretched the document')
 done('Actual drag persists; a large stage scrolls and loads more inside the contained board')
 await visit(pipelinePath,'Pipeline');await page.getByText(firstDeal.title,{exact:true}).first().waitFor()

 await page.getByRole('radio',{name:'List',exact:true}).click();await page.getByRole('table',{name:'Deals',exact:true}).waitFor();await shot('pipeline-list-desktop')
 await page.getByRole('radio',{name:'Forecast',exact:true}).click();await page.getByText('Weighted forecast',{exact:false}).first().waitFor()
 await visit('/app/settings/pipelines','Pipelines')
 const settings=page.getByRole('region',{name:pipeline.name,exact:true});await settings.getByText('Entry rules',{exact:false}).first().click()
 await Promise.all([page.waitForResponse(response=>response.url().includes('/pipelines/'+pipeline.id+'/stages/')&&response.request().method()==='PATCH'),settings.getByRole('button',{name:'Expected close date',exact:true}).first().click()])
 assert((await api('/pipelines')).pipelines.find(item=>item.id===pipeline.id).stages[0].requiredFields.includes('expectedCloseDate'))
 await shot('pipeline-settings-desktop')
 done('Expandable stage entry rules save through the real settings API')
 await page.setViewportSize({width:390,height:844})
 await visit(campaignPath,'Campaigns');await page.getByRole('list',{name:'Campaigns',exact:true}).waitFor();await shot('campaigns-mobile')
 await page.getByRole('list',{name:'Campaigns',exact:true}).locator(':scope > li').first().scrollIntoViewIfNeeded();await shot('campaigns-mobile-cards')
 assert.equal(await page.getByRole('table',{name:'Campaigns',exact:true}).isVisible(),false)
 await page.getByRole('list',{name:'Campaigns',exact:true}).getByRole('button').filter({hasText:campaigns[0].name}).click()
 await page.getByRole('heading',{name:campaigns[0].name,exact:true}).waitFor();await shot('campaign-detail-mobile')
 await visit(pipelinePath,'Pipeline');await page.getByText('Northstar — annual renewal',{exact:true}).waitFor();await shot('pipeline-mobile')
 await page.evaluate(()=>window.scrollBy(0,350));await shot('pipeline-mobile-board')
 await page.locator('.sales-board-columns').evaluate(node=>node.scrollLeft=300)
 await page.getByRole('button',{name:/Filters/}).click();await page.getByLabel('Source',{exact:true}).selectOption(fixture.sourceId);await page.waitForURL(/sourceId/)
 await page.getByRole('heading',{name:'No deals match these filters',exact:true}).waitFor()
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.waitForURL(url=>!url.searchParams.has('sourceId')&&url.searchParams.get('pipelineId')===pipeline.id)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 done('390px mobile campaign cards, detail, horizontal board and filter panel fit the viewport')
 await page.setViewportSize({width:1440,height:1000})
 await visit(campaignPath,'Campaigns');await page.getByRole('link',{name:campaigns[0].name,exact:true}).waitFor();await page.evaluate(()=>document.documentElement.dataset.crmTheme='dark');await shot('campaigns-dark')
 await visit(pipelinePath,'Pipeline');await page.evaluate(()=>document.documentElement.dataset.crmTheme='dark');await page.getByText('Northstar — annual renewal',{exact:true}).waitFor();await shot('pipeline-dark')
 assert.deepEqual(errors,[])
 assert(requests.every(result=>result.path==='/api/notifications/stream-ticket'&&result.status===429),'Unexpected module HTTP failure')
 done('Desktop and dark-mode screenshots captured without uncaught browser errors')
 token=(await api('/auth/login','POST',{email:fixture.users[4].email,password:'FixturePassword123!'})).accessToken
 await visit(pipelinePath,'Pipeline');await page.getByText(firstDeal.title,{exact:true}).first().waitFor()
 assert.equal(await page.getByRole('button',{name:'New deal',exact:true}).count(),0)
 assert.equal(await page.getByRole('link',{name:'Manage stages',exact:true}).count(),0)
 assert.equal(await page.getByLabel('Move '+firstDeal.title+' to stage',{exact:true}).count(),0)
 await visit(campaignPath,'Campaigns');await page.getByRole('link',{name:campaigns[0].name,exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'New campaign',exact:true}).count(),0)
 done('Viewer can read both redesigned modules without create, move or settings controls')
 await fs.writeFile(output+'/fixture.json',JSON.stringify({campaignPath,pipelinePath,campaigns:campaigns.map(({id,name})=>({id,name})),pipelineId:pipeline.id},null,2))
} catch(error) {await page.screenshot({path:output+'/failure.png',fullPage:true});throw error} finally {await fs.writeFile(output+'/results.json',JSON.stringify({results,errors,requests},null,2));await browser.close()}
