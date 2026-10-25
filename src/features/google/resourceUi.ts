import { useAuth } from '../../lib/useAuth'
import { useOrgId } from '../crm/hooks'
import { googleKey } from './api'

export function useGoogleResourceKey() {
  const orgId = useOrgId(), { user } = useAuth()
  return [...googleKey(orgId), 'resources', user?.id] as const
}
export function operationMessage(code: string | null) {
  const messages: Record<string, string> = {
    GOOGLE_API_DISABLED: 'Enable the required Google API in the same Google Cloud project, then retry.',
    GOOGLE_DRIVE_API_DISABLED: 'Enable Google Drive API in the existing Google Cloud project, then retry.',
    GOOGLE_SHEETS_API_DISABLED: 'Enable Google Sheets API in the existing Google Cloud project, then retry.',
    GOOGLE_CALENDAR_API_DISABLED: 'Enable Google Calendar API in the existing Google Cloud project, then retry.',
    GOOGLE_ACCOUNT_CHANGED: 'Your Google account or permissions changed. Review the connection before retrying.',
    GOOGLE_REMOTE_CONFLICT: 'This meeting changed in Google Calendar. Review it there before replacing it.',
    GOOGLE_REMOTE_NOT_FOUND: 'The Google event was removed. Create a new meeting if needed.',
    GOOGLE_RECONNECT_REQUIRED: 'Reconnect this service in Google connections.',
    GOOGLE_CONSENT_REQUIRED: 'Review and enable this service again in Google connections.',
    GOOGLE_EXPORT_DISABLED: 'An administrator must allow Google exports in Team & Google.',
    GOOGLE_CREATE_UNCERTAIN: 'Google has not confirmed creation. Retry checks for the existing file without creating another.',
    GOOGLE_TASK_CHANGED: 'The linked task changed. Review it in Tasks before retrying.',
    GOOGLE_SOURCE_CHANGED: 'Lead data or access changed while exporting. Review the leads before retrying.',
    GOOGLE_PERMISSION_DENIED: 'Google denied access. Check the connected account and its permissions.',
    GOOGLE_ACCESS_DENIED: 'Your CRM permissions changed. Ask your administrator to review access.',
  }
  return code ? messages[code] || 'Google could not finish this operation. Review your connection and retry.' : ''
}
