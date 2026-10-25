export function localMeetingInput(value: string | Date) {
  const date = new Date(value)
  if (!Number.isFinite(+date)) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export function meetingDuration(start: string, end: string) {
  return Math.round((+new Date(end) - +new Date(start)) / 60000)
}
export function shiftedMeetingEnd(previousStart: string, previousEnd: string, nextStart: string) {
  const minutes = meetingDuration(previousStart, previousEnd)
  return localMeetingInput(new Date(+new Date(nextStart) + (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60000)) || previousEnd
}
export function meetingGuests(value: string) {
  return [...new Set(value.split(/[,;\n]/).map((email) => email.trim().toLowerCase()).filter(Boolean))]
}
