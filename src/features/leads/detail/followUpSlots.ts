import { fromLocalInput, toDateInput, toLocalInput } from '../../tasks/taskTime'

/** Same quick slots as the reference, interpreted in workspace rather than device time. */
export function followUpSlots(now = new Date(), timezone = 'Asia/Kolkata') {
  const day = toDateInput(now, timezone), hour = Number(toLocalInput(now, timezone).slice(11, 13))
  const at = (days: number) => {
    const date = new Date(`${day}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return fromLocalInput(`${date.toISOString().slice(0, 10)}T10:00`, timezone)
  }
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return [
    ...(hour < 17 ? [{ label: 'In 2 hours', at: new Date(now.getTime() + 7200000) }] : []),
    { label: 'Tomorrow', at: at(1) }, { label: 'In 3 days', at: at(3) }, { label: 'Next week', at: at((8-weekday)%7 || 7) },
  ]
}
