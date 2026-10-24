import { CheckCheck, CircleAlert, Clock3, MailCheck, Send } from 'lucide-react'
import { StatusChip } from '../../components/ui/Signal'
import { emailStatusLabel } from './content'
import { deliveryTone } from './presentation'

export function DeliveryBadge({ status }: { status: string }) {
  const Icon = status === 'provider_accepted' ? CheckCheck : status === 'received' ? MailCheck : ['failed', 'unknown', 'bounced'].includes(status) ? CircleAlert : status === 'sending' ? Send : Clock3
  return <StatusChip tone={deliveryTone(status)} icon={Icon}>{emailStatusLabel[status] ?? 'Status unavailable'}</StatusChip>
}
