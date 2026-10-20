import { toDateInput } from '../tasks/taskTime'

export function calendarDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function workspaceDates(timezone: string, now = new Date()) {
  const today = toDateInput(now, timezone)
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  return { today, week: calendarDate(today, -((weekday + 6) % 7)), month: `${today.slice(0, 7)}-01` }
}
