import { connectionLabels, type ConnectionStatus } from './foundationApi'

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === 'CONNECTED' ? 'bg-brand-50 text-brand-800' : status === 'DISCONNECTED' ? 'bg-surface-subtle text-muted' : 'bg-amber-50 text-amber-900'}`}>{connectionLabels[status]}</span>
}
