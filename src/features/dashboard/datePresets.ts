import { calendarDate } from './dates'

export type DatePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom'

export interface DateRange {
  from: string
  to: string
  prevFrom: string
  prevTo: string
  label: string
}

export function getDateRangeForPreset(preset: DatePreset, today: string, customFrom?: string, customTo?: string): DateRange {
  if (preset === 'custom' && customFrom && customTo) {
    const from = customFrom <= customTo ? customFrom : customTo
    const to = customFrom <= customTo ? customTo : customFrom
    const duration = Math.max(1, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1)
    const prevTo = calendarDate(from, -1)
    const prevFrom = calendarDate(prevTo, -(duration - 1))
    return { from, to, prevFrom, prevTo, label: `${from} to ${to}` }
  }

  const [yearStr, monthStr] = today.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) // 1 - 12

  switch (preset) {
    case 'today': {
      const prev = calendarDate(today, -1)
      return { from: today, to: today, prevFrom: prev, prevTo: prev, label: 'Today' }
    }
    case 'yesterday': {
      const yesterday = calendarDate(today, -1)
      const prev = calendarDate(yesterday, -1)
      return { from: yesterday, to: yesterday, prevFrom: prev, prevTo: prev, label: 'Yesterday' }
    }
    case '7d': {
      const from = calendarDate(today, -6)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -6)
      return { from, to: today, prevFrom, prevTo, label: 'Last 7 days' }
    }
    case '30d': {
      const from = calendarDate(today, -29)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -29)
      return { from, to: today, prevFrom, prevTo, label: 'Last 30 days' }
    }
    case 'this_month': {
      const from = `${today.slice(0, 7)}-01`
      const duration = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -(duration - 1))
      return { from, to: today, prevFrom, prevTo, label: 'This month' }
    }
    case 'last_month': {
      const prevMonthDate = new Date(`${today.slice(0, 7)}-15T12:00:00Z`)
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1)
      const prevMonthStr = prevMonthDate.toISOString().slice(0, 7)
      const from = `${prevMonthStr}-01`
      const lastDay = new Date(Date.UTC(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1, 0)).getUTCDate()
      const to = `${prevMonthStr}-${String(lastDay).padStart(2, '0')}`

      const prev2Date = new Date(`${from}T12:00:00Z`)
      prev2Date.setUTCMonth(prev2Date.getUTCMonth() - 1)
      const prev2MonthStr = prev2Date.toISOString().slice(0, 7)
      const prevFrom = `${prev2MonthStr}-01`
      const prevLastDay = new Date(Date.UTC(prev2Date.getUTCFullYear(), prev2Date.getUTCMonth() + 1, 0)).getUTCDate()
      const prevTo = `${prev2MonthStr}-${String(prevLastDay).padStart(2, '0')}`
      return { from, to, prevFrom, prevTo, label: 'Last month' }
    }
    case 'this_quarter': {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1
      const from = `${year}-${String(quarterStartMonth).padStart(2, '0')}-01`
      const duration = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -(duration - 1))
      return { from, to: today, prevFrom, prevTo, label: 'This quarter' }
    }
    case 'this_year': {
      const from = `${year}-01-01`
      const duration = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -(duration - 1))
      return { from, to: today, prevFrom, prevTo, label: 'This year' }
    }
    default: {
      const from = calendarDate(today, -6)
      const prevTo = calendarDate(from, -1)
      const prevFrom = calendarDate(prevTo, -6)
      return { from, to: today, prevFrom, prevTo, label: 'Last 7 days' }
    }
  }
}
