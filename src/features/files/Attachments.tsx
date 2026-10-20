import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/app/Dialog'
import { ErrorState } from '../../components/app/States'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../lib/useAuth'
import { useCan } from '../../lib/useOrg'
import { deleteFile, restoreFile, getFile, listFiles, uploadFile, type FileRecord } from './api'

function Attachment({ file, onDelete }: { file: FileRecord; onDelete: () => void }) {
  const [preview, setPreview] = useState(false)
  const notify = useToast()
  const { user } = useAuth()
  const canDelete = file.uploadedById === user?.id || ['owner', 'admin'].includes(user?.organization?.role ?? '')
  const details = useQuery({ queryKey: ['org', user?.organization?.id, 'file', file.id], queryFn: () => getFile(file.id), staleTime: 10 * 60_000 })
  const viewable = file.contentType.startsWith('image/') || file.contentType === 'application/pdf'
  async function remove() {
    try { await deleteFile(file.id); onDelete(); notify({ title: 'File moved to bin', action: { label: 'Undo', onClick: async () => { await restoreFile(file.id); onDelete() } } }) }
    catch (err) { notify({ title: err instanceof Error ? err.message : 'Could not delete file' }) }
  }
  return <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
    {details.data?.thumbnailUrl && <img src={details.data.thumbnailUrl} alt="" className="size-12 rounded object-cover" />}
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-zinc-500">{Math.ceil(file.size / 1024)} KB</p>{details.isError && <p className="text-xs text-red-600">Download unavailable</p>}</div>
    {viewable && <Button size="sm" variant="ghost" disabled={!details.data?.url} onClick={() => setPreview(true)}>Preview</Button>}
    {details.data?.url && <a className="text-sm text-brand-600" href={details.data.url} target="_blank" rel="noreferrer">Download</a>}
    {canDelete && <Button size="sm" variant="ghost" onClick={remove}>Delete</Button>}
    <Dialog open={preview} onClose={() => setPreview(false)} title={file.name}>
      {file.contentType.startsWith('image/') ? <img src={details.data?.url} alt={file.name} className="max-h-[70vh] max-w-full" /> : <iframe src={details.data?.url} title={file.name} className="h-[65vh] w-full" />}
    </Dialog>
  </div>
}
export function Attachments({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { user } = useAuth()
  const resource = { lead: 'leads', contact: 'contacts', company: 'companies', deal: 'deals' }[entityType] as 'leads' | 'contacts' | 'companies' | 'deals'
  const canUpload = useCan(`${resource}.update`)
  const queryClient = useQueryClient(), notify = useToast(), input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const key = ['org', user?.organization?.id, 'files', entityType, entityId]
  const files = useQuery({ queryKey: key, queryFn: () => listFiles({ entityType, entityId }) })
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: key }) }
  async function add(selected: FileList | null) {
    if (!selected || !canUpload || progress !== null) return
    setProgress(0)
    try { for (const file of Array.from(selected)) await uploadFile(file, { entityType, entityId }, setProgress); refresh() }
    catch (err) { notify({ title: err instanceof Error ? err.message : 'Upload failed' }) }
    finally { setProgress(null); if (input.current) input.current.value = '' }
  }
  return <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void add(e.dataTransfer.files) }}>
    <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Attachments</h2>{canUpload && <Button size="sm" variant="secondary" disabled={progress !== null} onClick={() => input.current?.click()}>Upload files</Button>}</div>
    <input ref={input} type="file" multiple hidden aria-label="Upload attachments" onChange={(e) => void add(e.target.files)} />
    {progress !== null && <progress className="mb-3 w-full" max={1} value={progress} aria-label="Upload progress" />}
    {files.isError ? <ErrorState error={files.error} onRetry={() => void files.refetch()} /> : files.isPending ? <p className="text-sm text-zinc-500">Loading attachments…</p> : <div className="space-y-2">{files.data.map((file) => <Attachment key={file.id} file={file} onDelete={refresh} />)}{!files.data.length && <p className="text-sm text-zinc-500">{canUpload ? 'Drop files here or choose Upload files.' : 'No attachments yet.'}</p>}</div>}
  </section>
}
