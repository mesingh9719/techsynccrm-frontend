import { useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDown, Bot, CheckCheck, CircleCheck, Clock, MessageCircle, Sparkles, UserPlus, Zap } from 'lucide-react'
import { crmDemo } from '../../services/content'
import { cn } from '../../lib/cn'
import { Avatar, Badge } from '../ui/Badge'
import { Funnel } from './Charts'
import { DemoKpiTiles, DemoPipelineBoard } from './demo'

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-white p-4 shadow-frame sm:p-5', className)}>{children}</div>
}

function LeadInboxVisual() {
  const leads = crmDemo.leads.slice(0, 5)
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">Lead inbox</p>
        <Badge tone="brand">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
          Live
        </Badge>
      </div>
      <ul className="mt-4 divide-y divide-zinc-100">
        {leads.map((lead, i) => (
          <li key={lead.id} className="flex items-center gap-3 py-3">
            <Avatar name={lead.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{lead.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {lead.company} · via {lead.source}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-zinc-800 tabular-nums">Score {lead.score}</p>
              <p className="text-[11px] text-zinc-500">→ {lead.owner.split(' ')[0]}</p>
            </div>
            {i === 0 && <Badge tone="success">New</Badge>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function WorkflowVisual() {
  const steps = [
    { icon: Zap, kind: 'Trigger', label: 'New lead from IndiaMART', tone: 'bg-amber-50 text-amber-700 ring-amber-200/70' },
    { icon: UserPlus, kind: 'Action', label: 'Assign by territory → West zone', tone: 'bg-brand-50 text-brand-700 ring-brand-200/70' },
    { icon: MessageCircle, kind: 'Action', label: 'Send WhatsApp template “Welcome + catalogue”', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
    { icon: Clock, kind: 'Action', label: 'Create call task · next working day, 10:00', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  ]
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">Workflow · Marketplace leads</p>
        <Badge tone="success">Active</Badge>
      </div>
      <ol className="mt-5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-zinc-200">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1', s.tone)}>
                <s.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">{s.kind}</p>
                <p className="text-sm text-zinc-900">{s.label}</p>
              </div>
            </div>
            {i < steps.length - 1 && <ArrowDown className="mx-auto my-1.5 size-4 text-zinc-300" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
        <CircleCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
        Ran 214 times this month · 0 errors
      </p>
    </Panel>
  )
}

function WhatsAppVisual() {
  const [sent, setSent] = useState(false)
  return (
    <Panel className="p-0 sm:p-0">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <Avatar name="Ritika Sharma" size="sm" />
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-900">Ritika Sharma</p>
          <p className="text-xs text-zinc-500">Saffron Retail · Deal: Store POS rollout</p>
        </div>
        <Badge tone="success">WhatsApp</Badge>
      </div>
      <div className="space-y-3 bg-zinc-50/70 px-4 py-5 text-sm">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-zinc-800 shadow-card ring-1 ring-zinc-200/70">
          Hi, can you share pricing for 12 stores? We want to go live before Diwali.
          <span className="mt-1 block text-right text-[10px] text-zinc-400">10:42</span>
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-emerald-50 px-3.5 py-2.5 text-zinc-800 ring-1 ring-emerald-200/60">
          Absolutely, Ritika — sharing the quote now. Volume pricing applies from 10 stores.
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-500">
            10:44 · Ravi <CheckCheck className="size-3 text-sky-500" aria-hidden="true" />
          </span>
        </div>
        <div className="ml-auto max-w-[80%] rounded-xl bg-white p-3 ring-1 ring-zinc-200">
          <p className="text-xs text-zinc-500">Quote QT-2291 · PDF</p>
          <p className="mt-0.5 font-medium text-zinc-900">₹1,85,000 + GST</p>
          <p className="mt-1 text-[11px] text-emerald-700">Viewed 2 times</p>
        </div>
      </div>
      <div className="border-t border-zinc-100 p-3">
        <div className="flex items-start gap-2 rounded-xl bg-brand-50/60 p-3 ring-1 ring-brand-100">
          <Bot className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="flex-1 text-xs">
            <p className="font-medium text-brand-900">Suggested follow-up · tomorrow 11:00</p>
            <p className="mt-0.5 text-brand-900/80">“Hi Ritika, did the team get a chance to review the quote? Happy to walk through rollout timelines.”</p>
          </div>
          <button
            type="button"
            onClick={() => setSent(true)}
            disabled={sent}
            className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:bg-emerald-600"
          >
            {sent ? 'Scheduled' : 'Schedule'}
          </button>
        </div>
      </div>
    </Panel>
  )
}

function QuoteVisual() {
  const items = [
    { name: 'POS terminal — Pro', hsn: '8470', qty: 12, rate: 11500 },
    { name: 'Installation & training', hsn: '9983', qty: 12, rate: 2500 },
    { name: 'Annual support', hsn: '9987', qty: 1, rate: 17000 },
  ]
  const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0)
  const gst = Math.round(subtotal * 0.18)
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`
  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] text-zinc-500">QUOTATION · QT-2291</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">Saffron Retail Pvt. Ltd.</p>
          <p className="text-xs text-zinc-500">GSTIN 29ABCDE1234F1Z5 · Valid till 31 Oct</p>
        </div>
        <Badge tone="warning">Awaiting approval</Badge>
      </div>
      <table className="mt-5 w-full text-xs">
        <thead className="text-zinc-500">
          <tr className="border-b border-zinc-100">
            <th className="py-2 text-left font-medium">Item</th>
            <th className="py-2 text-left font-medium">HSN</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800">
          {items.map((i) => (
            <tr key={i.name} className="border-b border-zinc-100">
              <td className="py-2.5 pr-2">{i.name}</td>
              <td className="py-2.5 font-mono text-zinc-500">{i.hsn}</td>
              <td className="py-2.5 text-right tabular-nums">{i.qty}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(i.qty * i.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto w-48 space-y-1.5 text-xs">
        <div className="flex justify-between text-zinc-600">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{fmt(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-zinc-600">
          <dt>GST 18%</dt>
          <dd className="tabular-nums">{fmt(gst)}</dd>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-sm font-semibold text-zinc-950">
          <dt>Total</dt>
          <dd className="tabular-nums">{fmt(subtotal + gst)}</dd>
        </div>
      </dl>
    </Panel>
  )
}

function AnalyticsVisual() {
  return (
    <Panel className="space-y-4">
      <DemoKpiTiles className="xl:grid-cols-2" />
      <div className="rounded-lg p-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-900">Conversion funnel</p>
          <p className="text-xs text-zinc-500">This quarter</p>
        </div>
        <Funnel data={crmDemo.funnel} />
      </div>
    </Panel>
  )
}

function PipelineVisual() {
  return (
    <Panel className="p-3 sm:p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-zinc-900">New business</p>
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Sparkles className="size-3.5 text-brand-600" aria-hidden="true" />
          Try dragging a deal
        </span>
      </div>
      <DemoPipelineBoard compact />
    </Panel>
  )
}

const visuals: Record<string, ComponentType> = {
  leads: LeadInboxVisual,
  pipeline: PipelineVisual,
  automation: WorkflowVisual,
  communication: WhatsAppVisual,
  quotes: QuoteVisual,
  analytics: AnalyticsVisual,
}

export function FeatureVisual({ id }: { id: string }) {
  const Visual = visuals[id] ?? LeadInboxVisual
  return <Visual />
}
