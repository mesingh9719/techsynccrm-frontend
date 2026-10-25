// Public form -> real capture/assignment -> campaign attribution; disposable localhost only.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/home/butcher/.cache/ms-playwright-go/1.57.0/package/index.mjs')
const base=process.env.QA_ORIGIN||'http://127.0.0.1:5177';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname))
const [f,other]=JSON.parse(await fs.readFile(process.env.QA_FIXTURE || '/tmp/techsync-campaign-pipeline-fixture.json','utf8'))
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']})
const admin=await browser.newContext(),visitor=await browser.newContext(),page=await visitor.newPage(),tag=Date.now().toString(36)
let token,form,rule
const api=async(path,method='GET',data)=>{const r=await admin.request.fetch(base+'/api'+path,{method,data,headers:token?{authorization:'Bearer '+token}:{}});assert(r.ok(),`${method} ${path}: ${r.status()} ${await r.text()}`);return r.status()===204?null:(await r.json()).data}
try {
 token=(await api('/auth/login','POST',{email:f.users[0].email,password:'FixturePassword123!'})).accessToken
 form=(await api('/forms','POST',{name:'Capture QA '+tag,isActive:true,sourceId:f.sourceId,fields:[{key:'firstName',type:'text',label:'Your name',required:true},{key:'email',type:'email',label:'Email',required:true}],settings:{title:'Campaign capture QA',notifyOwner:false,autoReply:false}})).form
 rule=(await api('/assignment-rules','POST',{name:'Capture QA '+tag,isActive:true,conditions:[{field:'formId',operator:'equals',value:form.id}],strategy:'specific_user',memberIds:[f.users[3].id],onlyWorkingHours:false,outsideHours:'assign_anyway'})).rule
 const email='capture-'+tag+'@example.test'
 await page.goto(`${base}/f/${form.key}?utm_campaign=${f.campaigns[0].code}&utm_source=qa-site&utm_medium=referral`)
 await page.getByLabel('Your name',{exact:false}).fill('Public campaign enquiry '+tag)
 await page.getByLabel('Email',{exact:false}).fill(email)
 await page.getByRole('checkbox').check()
 await page.waitForTimeout(2500)
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/forms/'+form.key+'/submit')&&r.status()===201),page.getByRole('button',{name:'Send enquiry',exact:true}).click()])
 const first=(await api('/leads?q='+encodeURIComponent(email)+'&count=true')).items[0]
 assert(first);assert.equal(first.campaignId,f.campaigns[0].id);assert.equal(first.ownerId,f.users[3].id);assert.equal(first.sourceId,f.sourceId);assert.equal(first.status,'new')
 assert.equal((await api('/deals?leadId='+first.id+'&count=true')).total,0,'Capture creates a lead; deals begin on conversion')
 const repeat={fields:{firstName:'Repeat enquiry',email},consent:true,elapsedMs:5000,website:'',utm:{utm_campaign:f.campaigns[1].code}}
 const submit=await visitor.request.post(base+'/api/public/forms/'+form.key+'/submit',{data:repeat});assert.equal(submit.status(),201)
 const leads=await api('/leads?q='+encodeURIComponent(email)+'&count=true');assert.equal(leads.total,1);assert.equal(leads.items[0].campaignId,first.campaignId);assert.equal(leads.items[0].ownerId,first.ownerId);assert.equal(leads.items[0].enquiryCount,2)
 const invalid=await visitor.request.post(base+'/api/public/forms/'+form.key+'/submit',{data:{...repeat,fields:{email:'invalid'}}});assert.equal(invalid.status(),400)
 const submissions=(await api('/forms/'+form.id+'/submissions')).items;assert.equal(submissions.length,2)
 token=(await api('/auth/login','POST',{email:other.users[0].email,password:'FixturePassword123!'})).accessToken
 const foreign=await admin.request.get(base+'/api/forms/'+form.id,{headers:{authorization:'Bearer '+token}});assert.equal(foreign.status(),404)
 token=(await api('/auth/login','POST',{email:f.users[0].email,password:'FixturePassword123!'})).accessToken
 await api('/forms/'+form.id,'PATCH',{isActive:false})
 const closed=await visitor.request.post(base+'/api/public/forms/'+form.key+'/submit',{data:repeat});assert.equal(closed.status(),410)
 const deletedCampaign=(await api('/campaigns','POST',{name:'Deleted attribution '+tag,code:'deleted-attribution-'+tag,type:'website',objective:'lead_generation',status:'active',startDate:'2026-10-01'})).campaign
 const retained=(await api('/leads','POST',{firstName:'Deleted attribution lead '+tag,campaignId:deletedCampaign.id})).lead
 await api('/campaigns/'+deletedCampaign.id,'DELETE')
 const detail=await admin.newPage();await detail.goto(base+'/app/leads/'+retained.id)
 await detail.getByText('Deleted campaign',{exact:true}).waitFor()
 assert.equal(await detail.getByRole('link',{name:deletedCampaign.name,exact:true}).count(),0)
 await detail.getByText(deletedCampaign.name,{exact:true}).waitFor()
 console.log(JSON.stringify({deletedAttributionWithoutDeadLink:true,publicBrowserSubmit:true,utmAttribution:true,configuredAssignment:true,repeatDedupe:true,firstTouchPreserved:true,noImplicitDeal:true,invalidInput:400,foreignTenant:404,closedForm:410,submissions:2}))
} finally {
 if(token&&rule)await api('/assignment-rules/'+rule.id,'DELETE')
 if(token&&form)await api('/forms/'+form.id,'DELETE')
 await browser.close()
}
