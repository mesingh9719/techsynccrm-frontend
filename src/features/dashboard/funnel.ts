export const FUNNEL_STAGES = [
  { id: 'new', label: 'New enquiries', hint: 'Ready for first contact', color: 'var(--color-chart-1)' },
  { id: 'contacted', label: 'Contacted', hint: 'Conversations started', color: 'var(--color-chart-2)' },
  { id: 'qualified', label: 'Qualified', hint: 'Ready for the next step', color: 'var(--color-chart-3)' },
  { id: 'converted', label: 'Converted', hint: 'Converted into contacts', color: 'var(--color-chart-4)' },
] as const

export const LEAD_CHART_OPTIONS = [
  { id: 'flow', label: 'Flow funnel' },
  { id: 'bars', label: 'Horizontal bars' },
  { id: 'columns', label: 'Column chart' },
  { id: 'donut', label: 'Donut chart' },
  { id: 'stacked', label: 'Stacked bar' },
  { id: 'table', label: 'Data table' },
] as const

export type LeadChartType = (typeof LEAD_CHART_OPTIONS)[number]['id']

export function isLeadChartType(value: unknown): value is LeadChartType {
  return LEAD_CHART_OPTIONS.some((option) => option.id === value)
}

/** Smooth, symmetric envelope. Its thickness follows recorded status counts. */
export function funnelPath(values: number[], scale = 1) {
  const max = Math.max(1, ...values)
  const points = values.map((value, i) => ({ x: 125 + i * 250, h: (Math.max(0, value) / max) * 104 * scale }))
  if (!points.length) return ''
  const first = points[0],
    last = points[points.length - 1]
  let path = `M 0 ${140 - first.h * 0.35} C 60 ${140 - first.h * 0.35}, 65 ${140 - first.h}, ${first.x} ${140 - first.h}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1],
      point = points[i],
      middle = (prev.x + point.x) / 2
    path += ` C ${middle} ${140 - prev.h}, ${middle} ${140 - point.h}, ${point.x} ${140 - point.h}`
  }
  path += ` L 1000 ${140 - last.h} L 1000 ${140 + last.h} L ${last.x} ${140 + last.h}`
  for (let i = points.length - 2; i >= 0; i--) {
    const next = points[i + 1],
      point = points[i],
      middle = (next.x + point.x) / 2
    path += ` C ${middle} ${140 + next.h}, ${middle} ${140 + point.h}, ${point.x} ${140 + point.h}`
  }
  return `${path} C 65 ${140 + first.h}, 60 ${140 + first.h * 0.35}, 0 ${140 + first.h * 0.35} Z`
}
