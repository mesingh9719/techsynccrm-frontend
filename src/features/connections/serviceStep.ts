import type { GoogleService, GoogleState } from '../google/api'

export type ServiceStepKind = 'setup' | 'server' | 'workspace' | 'role' | 'reconnect' | 'connect' | 'enable' | 'ready'
export type ServiceStepTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet'
export interface ServiceStep { kind: ServiceStepKind; tone: ServiceStepTone; badge: string; message: string; envFlag?: string }

/** Server flag that makes a Google service available at all (read once at API start-up). */
export const serviceEnvFlag = (service: GoogleService) => `GOOGLE_WORKSPACE_${service.toUpperCase()}_ENABLED`

/**
 * The one thing blocking a Google service for this member, in the order it has to be fixed:
 * server setup → server flag → workspace switch → role → member's own connection.
 */
export function googleServiceStep(state: GoogleState, service: GoogleService, canManage: boolean): ServiceStep {
  const entry = state.services.find((item) => item.service === service), row = state.connection
  if (!state.setup.ready) return { kind: 'setup', tone: 'warning', badge: 'Setup needed', message: canManage ? 'Google isn’t configured on the server yet. Fix the setup checks above, then restart the API and worker.' : 'Your administrator needs to finish setting up Google for TechSync.' }
  if (!entry?.available) {
    const envFlag = serviceEnvFlag(service)
    return { kind: 'server', tone: 'neutral', badge: 'Not available', envFlag, message: canManage ? `Turned off in the server configuration. Set ${envFlag}=true in backend/.env, then restart the API and worker.` : 'Your administrator hasn’t made this available yet.' }
  }
  if (!entry.tenantEnabled) return { kind: 'workspace', tone: 'warning', badge: 'Off for workspace', message: canManage ? 'Available, but switched off for this workspace. Turn it on so you and your team can connect.' : 'Your administrator needs to turn this on for the workspace. Ask a workspace owner or admin.' }
  if (entry.enabled) return { kind: 'ready', tone: 'success', badge: 'On', message: 'Ready to use.' }
  if (!state.canConnect) return { kind: 'role', tone: 'neutral', badge: 'Not in your role', message: 'Your role can’t connect Google tools. Ask an administrator if you need access.' }
  if (row?.status === 'reconnect_required') return { kind: 'reconnect', tone: 'warning', badge: 'Reconnect', message: 'Google access expired or was removed. Reconnect to keep using it.' }
  if (entry.permissionGranted && row?.status === 'connected') return { kind: 'enable', tone: 'info', badge: 'Ready to turn on', message: 'You’ve already approved this at Google. Turn it on to use it here.' }
  return { kind: 'connect', tone: 'neutral', badge: 'Not connected', message: row?.status === 'connected' ? 'Approve this permission for your connected Google account.' : 'Connect your Google account and approve this permission. You can use the same account as Gmail.' }
}
