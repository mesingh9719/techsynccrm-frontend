import { connectionLabels, type ConnectionStatus } from './foundationApi'
import { StatusChip, type SignalTone } from '../../components/ui/Signal'

const tones: Record<ConnectionStatus, SignalTone> = { CONNECTED: 'success', DISCONNECTED: 'neutral', NEEDS_RECONNECT: 'warning', ERROR: 'danger' }

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return <StatusChip tone={tones[status]}>{connectionLabels[status]}</StatusChip>
}
