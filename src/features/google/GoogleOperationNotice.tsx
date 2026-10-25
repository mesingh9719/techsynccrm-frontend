import { CircleAlert, ExternalLink } from 'lucide-react'
import { operationMessage } from './resourceUi'
import { apiEnablementHelp } from './operationHelp'
import { ApiError } from '../../services/http'
import { FormAlert } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'

export function GoogleRequestError({ error, context, onRetry, busy = false }: { error: unknown; context: 'calendar' | 'sheets'; onRetry?: () => void; busy?: boolean }) {
  if (!error) return null
  const code = error instanceof ApiError ? error.code || null : null
  return <div className="space-y-3">{apiEnablementHelp(code, context) ? <GoogleOperationNotice code={code} context={context} /> : <FormAlert>{error instanceof Error ? error.message : typeof error === 'string' ? error : 'Google could not finish this request.'}</FormAlert>}{onRetry && <Button size="sm" variant="secondary" disabled={busy} onClick={onRetry}>Retry</Button>}</div>
}

export function GoogleOperationNotice({ code, context }: { code: string | null; context: 'calendar' | 'sheets' }) {
  if (!code) return null
  const help = apiEnablementHelp(code, context)
  if (!help) return <p role="status" className="text-sm text-danger">{operationMessage(code)}</p>
  return <div className="google-api-notice" role="status">
    <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div className="min-w-0 space-y-3">
      <div><h4 className="font-medium">{help.title}</h4><p className="mt-1 text-sm leading-6">Google has disabled a required API for the connected project. Use the same Cloud project as your existing TechSync OAuth client.</p></div>
      <ol className="list-decimal space-y-1 pl-4 text-sm leading-6"><li>Open the API page below and select your existing project.</li><li>Click <strong>Enable</strong>. If it says Manage, this API is already enabled.</li><li>Return here and retry the {context === 'sheets' ? 'spreadsheet' : 'meeting'}. If Google still reports it disabled, allow a few minutes for the change to take effect.</li></ol>
      <div className="flex flex-wrap gap-3">{help.apis.map((api) => <a key={api.name} className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4" href={api.url} target="_blank" rel="noopener noreferrer">{api.name}<ExternalLink className="size-3.5" aria-hidden="true" /></a>)}</div>
      {context === 'sheets' && <p className="text-xs leading-5">This CRM uses Drive API to create the file and Sheets API to edit its tabs and cells. Both APIs need to be enabled.</p>}
    </div>
  </div>
}
