/**
 * Data shapes for the presentational CRM components. The marketing site feeds them demo data
 * (components/product/demo.tsx); the app maps API responses onto them.
 */

export interface BoardStage {
  id: string
  name: string
  /** Won stages get the trophy styling and never show "idle" badges. */
  kind?: 'open' | 'won' | 'lost'
  /** Header total; defaults to the sum of the cards' values. */
  totalLabel?: string
  /** Second header line, e.g. the weighted total. */
  subtitle?: string
  /** Card count when the column is paginated (more deals than cards). */
  count?: number
}

export interface BoardDeal {
  id: string
  stageId: string
  company: string
  title: string
  /** Major units (rupees); formatted compactly (₹1.8L). */
  value: number
  owner: string
  /** Days without activity in the current stage. */
  days: number
  /** Server-computed rotting flag; when set it replaces the staleDays rule. */
  rotting?: boolean
}

export interface LeadRow {
  id: string
  name: string
  company: string
  source: string
  score: number
  owner: string
  status: string
  lastActivity: string
}

export interface Kpi {
  label: string
  value: string
  delta: string
  /** Whether the change is good (colour), independent of its direction (arrow). */
  positive: boolean
  context: string
}

export interface SeriesPoint {
  label: string
  value: number
}

export interface SourceStat {
  source: string
  leads: number
}
