import { Globe, Handshake, Mail, MapPin, Megaphone, MessageSquare, MousePointer2, Target } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui/Badge'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS, type CampaignStatus, type CampaignType } from './types'

const channels = {
  meta_ads: { icon: Megaphone, color: 'bg-brand-50 text-brand-700' },
  google_ads: { icon: MousePointer2, color: 'bg-emerald-50 text-emerald-700' },
  email: { icon: Mail, color: 'bg-violet-50 text-violet-700' },
  sms: { icon: MessageSquare, color: 'bg-emerald-50 text-emerald-700' },
  website: { icon: Globe, color: 'bg-sky-50 text-sky-700' },
  referral: { icon: Handshake, color: 'bg-amber-50 text-amber-800' },
  offline: { icon: MapPin, color: 'bg-orange-50 text-orange-700' },
  other: { icon: Target, color: 'bg-surface-subtle text-muted' },
}

export function CampaignChannelIcon({ type, large = false }: { type: CampaignType; large?: boolean }) {
  const { icon: Icon, color } = channels[type]
  return <span title={CAMPAIGN_TYPE_LABELS[type]} className={cn('sales-channel-icon inline-flex shrink-0 items-center justify-center rounded-xl', large ? 'size-12' : 'size-10', color)}><Icon className={large ? 'size-6' : 'size-4'} aria-hidden="true" /></span>
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const tone = status === 'active' ? 'success' : status === 'paused' ? 'warning' : status === 'scheduled' ? 'brand' : 'neutral'
  return <Badge tone={tone}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{CAMPAIGN_STATUS_LABELS[status]}</Badge>
}

export function BudgetProgress({ spend, budget }: { spend: number | null | undefined; budget: number | null | undefined }) {
  if (spend == null || !budget || budget <= 0) return null
  const percent = Math.round(spend / budget * 100)
  return <div className="sales-budget-track" data-over={percent > 100} role="img" aria-label={`${percent}% of budget spent`}><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
}
