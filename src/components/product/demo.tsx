import { useState } from 'react'
import { crmDemo } from '../../services/content'
import { AnalyticsView, KpiTiles } from './AnalyticsView'
import { LeadsTable } from './LeadsTable'
import { PipelineBoard } from './PipelineBoard'
import type { BoardDeal, BoardStage } from './types'

/**
 * The CRM components wired to the static demo data, for the marketing site's interactive previews.
 * The app uses the same components with API data.
 */

const demoStages: BoardStage[] = crmDemo.stages.map((s) => ({ id: s.id, name: s.name, kind: s.id === 'won' ? 'won' : 'open' }))
const demoDeals = (): BoardDeal[] => crmDemo.deals.map(({ stage, ...d }) => ({ ...d, stageId: stage }))
const demoRevenue = crmDemo.revenue.map((d) => ({ label: d.month, value: d.value }))

/** Moves are kept in local state — the preview resets on reload. */
export function DemoPipelineBoard({ compact, className }: { compact?: boolean; className?: string }) {
  const [deals, setDeals] = useState(demoDeals)
  return (
    <PipelineBoard
      stages={demoStages}
      deals={deals}
      compact={compact}
      className={className}
      onMove={(id, stageId) =>
        setDeals((all) => {
          const deal = all.find((d) => d.id === id)
          return deal ? [...all.filter((d) => d.id !== id), { ...deal, stageId, days: 0 }] : all
        })
      }
    />
  )
}

export function DemoLeadsTable({ className }: { className?: string }) {
  return <LeadsTable leads={crmDemo.leads} className={className} />
}

export function DemoKpiTiles({ className }: { className?: string }) {
  return <KpiTiles kpis={crmDemo.kpis} className={className} />
}

export function DemoAnalyticsView({ className }: { className?: string }) {
  return <AnalyticsView kpis={crmDemo.kpis} revenue={demoRevenue} sources={crmDemo.sources} className={className} />
}
