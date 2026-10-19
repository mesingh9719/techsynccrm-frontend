/** Task dates and presets use the workspace time zone, independently of the browser's zone. */
const pad = (n: number) => String(n).padStart(2, '0')
export const DEFAULT_TASK_TZ = 'Asia/Kolkata'

function parts(d: Date, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
  return values as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

export function toDateInput(d: Date, tz = DEFAULT_TASK_TZ) {
  const p = parts(d, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function toLocalInput(d: Date, tz = DEFAULT_TASK_TZ) {
  const p = parts(d, tz)
  return `${toDateInput(d, tz)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Interpret a datetime-local value as wall-clock time in the workspace. */
export function fromLocalInput(value: string, tz = DEFAULT_TASK_TZ) {
  const [year, month, day, hour = 0, minute = 0] = value.split(/[-T:]/).map(Number)
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  let result = guess
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(result), tz)
    result = guess - (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - result)
  }
  const date = new Date(result)
  if (toLocalInput(date, tz) !== value.slice(0, 16)) throw new RangeError('This time does not exist in the workspace time zone. Choose another time.')
  return date
}

export function duePresets(now = new Date(), tz = DEFAULT_TASK_TZ) {
  const p = parts(now, tz)
  const at = (days: number, hour: number) => {
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
    return fromLocalInput(`${date.toISOString().slice(0, 10)}T${pad(hour)}:00`, tz)
  }
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
  const presets: { key: string; label: string; date: Date }[] = []
  const today6 = at(0, 18)
  if (today6 > now) presets.push({ key: 'today', label: 'Today 6 pm', date: today6 })
  presets.push({ key: 'tomorrow', label: 'Tomorrow 10 am', date: at(1, 10) })
  presets.push({ key: 'monday', label: 'Next Monday 10 am', date: at((1 - weekday + 7) % 7 || 7, 10) })
  presets.push({ key: 'week', label: 'In a week', date: at(7, 10) })
  return presets
}

export function dueLabel(dueAt: string | null, allDay: boolean, now = new Date(), tz = DEFAULT_TASK_TZ) {
  if (!dueAt) return 'No due date'
  const d = new Date(dueAt)
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d)
  const p = parts(now, tz)
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1)).toISOString().slice(0, 10)
  if (toDateInput(d, tz) === toDateInput(now, tz)) return allDay ? 'Today' : `Today ${time}`
  if (toDateInput(d, tz) === tomorrow) return allDay ? 'Tomorrow' : `Tomorrow ${time}`
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  return allDay ? date : `${date}, ${time}`
}
