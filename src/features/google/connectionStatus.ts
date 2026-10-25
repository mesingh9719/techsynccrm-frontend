import type { GoogleService, GoogleState } from './api'

const labels: Record<GoogleService, string> = { calendar: 'Google Calendar', drive: 'Google Drive', sheets: 'Google Sheets' }
const setupMessages: Record<string, string> = {
  enabled: 'Workspace tools are turned off on the server (GOOGLE_WORKSPACE_ENABLED).',
  clientId: 'The Workspace OAuth client ID is missing (GOOGLE_WORKSPACE_CLIENT_ID).',
  clientSecret: 'The Workspace OAuth client secret is missing (GOOGLE_WORKSPACE_CLIENT_SECRET).',
  projectNumber: 'The numeric project number must match the OAuth client (GOOGLE_WORKSPACE_PROJECT_NUMBER).',
  redirectUri: 'The Workspace callback URL is missing or invalid (GOOGLE_WORKSPACE_REDIRECT_URI).',
  encryption: 'Workspace credential encryption needs a valid key or KMS configuration.',
}
export const googleSetupMessages = (missing: string[]) => missing.map((key) => setupMessages[key]).filter(Boolean)

/** Google account identity, Gmail access and individual Workspace permissions are distinct. */
export function googleAccessIssue(state: GoogleState, service: GoogleService) {
  const label = labels[service], entry = state.services.find((item) => item.service === service)
  if (!state.setup.ready) return { kind: 'setup', title: `${label} needs server setup`, message: 'The CRM’s Google Workspace configuration is incomplete. You can reuse the same Google account and OAuth project as Gmail.' }
  if (!entry?.available) return { kind: 'server', title: `${label} is turned off`, message: `An administrator needs to enable ${label} in the server configuration.` }
  if (!entry.tenantEnabled) return { kind: 'tenant', title: `${label} is turned off for this workspace`, message: `An administrator can enable ${label} in Team & Google.` }
  if (state.connection?.status === 'reconnect_required' || state.connection?.status === 'disconnected') return { kind: 'connection', title: `Reconnect ${label}`, message: 'This Workspace connection needs to be renewed. Open Google connections to review and reconnect it.' }
  if (!state.connection) return { kind: 'connection', title: `Allow ${label} access`, message: state.gmail?.status === 'CONNECTED' ? `Gmail is connected. ${label} needs its own approval; you can use the same Google account.` : `Google sign-in and Workspace tools use separate permissions. Approve ${label} access for the Google account you want to use.` }
  if (!entry.enabled) return { kind: 'consent', title: `Review ${label} permission`, message: `Your Google account is connected. Review and enable ${label} in Google connections to use it here.` }
  return null
}
