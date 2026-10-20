import { calendarDate } from '../dashboard/dates'

export function reportPeriods(today: string, fiscalYearStartMonth = 4) {
  const [year, month] = today.split('-').map(Number)
  const startYear = month < fiscalYearStartMonth ? year - 1 : year
  const fiscal = `${startYear}-${String(fiscalYearStartMonth).padStart(2, '0')}-01`
  const shiftMonths = (date: string, amount: number) => {
    const result = new Date(`${date}T12:00:00Z`)
    result.setUTCMonth(result.getUTCMonth() + amount)
    return result.toISOString().slice(0, 10)
  }
  const quarter = shiftMonths(fiscal, Math.floor(((month - fiscalYearStartMonth + 12) % 12) / 3) * 3)
  return [
    { key: 'month', label: 'This month', from: `${today.slice(0, 7)}-01`, to: today },
    { key: '30', label: 'Last 30 days', from: calendarDate(today, -29), to: today },
    { key: 'quarter', label: 'This fiscal quarter', from: quarter, to: today },
    {
      key: 'last-quarter',
      label: 'Last fiscal quarter',
      from: shiftMonths(quarter, -3),
      to: calendarDate(quarter, -1),
    },
    { key: 'fy', label: 'This financial year', from: fiscal, to: today },
  ]
}
