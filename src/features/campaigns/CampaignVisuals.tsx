import { Globe, Handshake, Mail, MapPin, Megaphone, MessageSquare, MousePointer2, Target } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui/Badge'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS, type CampaignStatus, type CampaignType } from './types'

const channels = {
  meta_ads: Megaphone,
  google_ads: MousePointer2,
  email: Mail,
  sms: MessageSquare,
  website: Globe,
  referral: Handshake,
  offline: MapPin,
  other: Target,
}

export function CampaignChannelIcon({ type, large = false }: { type: CampaignType; large?: boolean }) {
  const Icon = channels[type]
  return <span title={CAMPAIGN_TYPE_LABELS[type]} className={cn('inline-flex shrink-0 items-center justify-center rounded-control bg-surface-subtle text-muted ring-1 ring-line ring-inset', large ? 'size-10' : 'size-8')}><Icon className="size-4" aria-hidden="true" /></span>
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  // Semantic only: green running, amber paused, blue scheduled, grey draft/completed/archived.
  const tone = status === 'active' ? 'success' : status === 'paused' ? 'warning' : status === 'scheduled' ? 'info' : 'neutral'
  return <Badge tone={tone}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{CAMPAIGN_STATUS_LABELS[status]}</Badge>
}

export function BudgetProgress({ spend, budget }: { spend: number | null | undefined; budget: number | null | undefined }) {
  if (spend == null || !budget || budget <= 0) return null
  const percent = Math.round(spend / budget * 100)
  return <div className="sales-budget-track" data-over={percent > 100} role="img" aria-label={`${percent}% of budget spent`}><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
}
