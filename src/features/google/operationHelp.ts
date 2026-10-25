const drive = { name: 'Google Drive API', url: 'https://console.cloud.google.com/apis/library/drive.googleapis.com' }
const sheets = { name: 'Google Sheets API', url: 'https://console.cloud.google.com/apis/library/sheets.googleapis.com' }
const calendar = { name: 'Google Calendar API', url: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com' }
export function apiEnablementHelp(code: string | null, context: 'calendar' | 'sheets') {
  const apis = code === 'GOOGLE_DRIVE_API_DISABLED' ? [drive] : code === 'GOOGLE_SHEETS_API_DISABLED' ? [sheets] : code === 'GOOGLE_CALENDAR_API_DISABLED' ? [calendar] : code === 'GOOGLE_API_DISABLED' ? context === 'sheets' ? [drive, sheets] : [calendar] : null
  return apis ? { title: apis.length === 1 ? `Enable ${apis[0].name}` : 'Enable Google Drive and Sheets APIs', apis } : null
}
