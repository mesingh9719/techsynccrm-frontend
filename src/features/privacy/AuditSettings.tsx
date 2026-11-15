import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrg } from '../../lib/useOrg'
import { downloadCsv } from '../../lib/downloadCsv'
import { Button } from '../../components/ui/Button'
import { FormAlert } from '../../components/ui/Form'
import { PageHeader,ErrorState,ListSkeleton } from '../../components/app/States'
import { SearchInput } from '../../components/app/FilterBar'
import { listAudit,exportAudit } from './api'
export default function AuditSettings() {
 const {role,summary}=useOrg(),allowed=role==='owner'||role==='admin'
 const [q,setQ]=useState(''),[cursor,setCursor]=useState<string|undefined>(),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false)
 const query=useQuery({queryKey:['org',summary?.id,'audit',q,cursor],queryFn:()=>listAudit(q,cursor),enabled:allowed})
 async function download() {setBusy(true);setError(null);try{const data=await exportAudit(q,cursor);downloadCsv('workspace-audit-page.csv',['Time','Action','Actor type','Actor ID','Entity type','Entity ID','Changes'],data.items.map(row=>[row.createdAt,row.action,row.actorType,row.actorUserId,row.entityType,row.entityId,JSON.stringify(row.changes)]))}catch(error){setError(error instanceof Error?error.message:'Audit export unavailable.')}finally{setBusy(false)}}
 if(!allowed)return <p role="status">Only workspace owners and admins can view the audit history.</p>
 return <><PageHeader title="Audit history" description="Workspace activity with authentication secrets removed."/><div className="mb-4 flex flex-wrap gap-3"><SearchInput label="Search audit actions" value={q} onChange={value=>{setQ(value);setCursor(undefined)}}/><Button variant="secondary" loading={busy} onClick={()=>void download()}>Export this page as CSV</Button></div>{error&&<FormAlert>{error}</FormAlert>}{query.isPending?<ListSkeleton/>:query.isError?<ErrorState error={query.error} onRetry={()=>void query.refetch()}/>:<><ul className="divide-y divide-line rounded-card border border-line">{!query.data.items.length&&<li className="p-4 text-sm text-muted">No matching audit entries.</li>}{query.data.items.map(row=><li className="p-4 text-sm" key={row.id}><p className="font-medium">{row.action}</p><p className="mt-1 text-xs text-muted">{new Date(row.createdAt).toLocaleString()} · {row.actorType}</p><details className="mt-2"><summary>View changes</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(row.changes,null,2)}</pre></details></li>)}</ul><div className="mt-4 flex gap-3">{cursor&&<Button variant="secondary" onClick={()=>setCursor(undefined)}>Newest entries</Button>}{query.data.nextCursor&&<Button onClick={()=>setCursor(query.data.nextCursor!)}>Older entries</Button>}</div></>}</>
}
