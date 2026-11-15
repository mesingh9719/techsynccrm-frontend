import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function verifiedOrigin(value) {
  const url=new URL(value)
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||['localhost','127.0.0.1','techsynccrm-backend.vercel.app'].includes(url.hostname)) throw new Error('Use the confirmed VPS HTTPS origin without credentials, a path or query')
  return url.origin
}
async function main(){
 const [origin,output]=process.argv.slice(2)
 if(!origin||!output||path.basename(output)==='vercel.json')throw new Error('Usage: prepare-api-routing.mjs HTTPS_VPS_ORIGIN REVIEW_OUTPUT.json (never edits vercel.json)')
 const target=verifiedOrigin(origin),response=await fetch(target+'/api/health/ready',{redirect:'error',signal:AbortSignal.timeout(10000)})
 if(!response.ok||(await response.json()).data?.status!=='ready')throw new Error('VPS readiness has not passed; routing was not prepared')
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'))
 config.rewrites=config.rewrites.map(r=>r.source==='/api/:path*'?{...r,destination:target+'/api/:path*'}:r)
 await writeFile(output,JSON.stringify(config,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({status:'prepared_for_review',origin:target,productionChanged:false,forwardedHeaderReviewRequired:true}))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1})
