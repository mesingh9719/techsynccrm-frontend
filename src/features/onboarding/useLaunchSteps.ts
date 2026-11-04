import { useState, type ComponentType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FileInput, PlugZap, UsersRound } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan, useOrg } from '../../lib/useOrg'
import { qk } from '../../lib/queryKeys'
import { dismissChecklist, getChecklist } from '../../services/organizations'
import { useGmail } from '../email/useGmail'
import { useGoogleState } from '../google/useGoogleState'
import { businessDetailsComplete } from './businessDetails'
import { useSetupProgress } from './useSetupProgress'

export type LaunchStepKey = 'business' | 'connections' | 'source' | 'team'
export interface LaunchStep { key: LaunchStepKey; icon: ComponentType<{ className?: string }>; accent: string; title: string; summary: string; why: string; minutes: number; needs: string[]; done: boolean }

const skipKey = (orgId: string) => `techsync:launch-skip:${orgId}`
const readSkip = (orgId: string) => { try { return sessionStorage.getItem(skipKey(orgId)) === '1' } catch { return false } }

/**
 * The essential steps a new workspace needs before its first lead, plus whether the dashboard
 * should stay in "launch focus" (only the launch panel) until the business details are saved.
 */
export function useLaunchSteps() {
  const { user } = useAuth(), { organization } = useOrg(), client = useQueryClient()
  const orgId = user?.organization?.id ?? 'none'
  const progress = useSetupProgress(), gmail = useGmail(), google = useGoogleState()
  const canWorkspace = useCan('settings.workspace.manage'), canEmail = useCan('email.connect')
  const checklist = useQuery({ queryKey: qk.org(orgId).checklist, queryFn: getChecklist })
  const dismiss = useMutation({ mutationFn: dismissChecklist, onSuccess: () => client.invalidateQueries({ queryKey: qk.org(orgId).checklist }) })
  const [skipped, setSkipped] = useState(() => readSkip(orgId))

  const item = (key: string) => progress.items.find((entry) => entry.key === key)
  const mailbox = gmail.data?.account
  const gmailOn = Boolean(mailbox && ['connected', 'syncing', 'delayed'].includes(mailbox.status))
  const googleOn = google.data?.connection?.status === 'connected'
  const businessDone = businessDetailsComplete(organization)

  const steps: LaunchStep[] = []
  if (canWorkspace) steps.push({ key: 'business', icon: Building2, accent: '#6366f1', title: 'Business details', summary: 'Legal name, GSTIN, address and region', why: 'Quotes, invoices and reports carry your registered details, and reminders run on your local time.', minutes: 2, needs: ['Legal name', 'GSTIN (if registered)', 'Address & PIN'], done: businessDone })
  if (canEmail) steps.push({ key: 'connections', icon: PlugZap, accent: '#db2777', title: 'Gmail & Google', summary: 'Email from your own address, Meet and Sheets', why: 'Emails you send from TechSync go out from your own address, and replies land on the lead.', minutes: 1, needs: ['Your work Google account'], done: gmailOn })
  if (progress.allowed) steps.push({ key: 'source', icon: FileInput, accent: '#0284c7', title: 'Lead sources', summary: 'Web form, Facebook Lead Ads or a spreadsheet', why: 'New enquiries arrive in one inbox automatically, already assigned, instead of being copied by hand.', minutes: 3, needs: ['Your website or Facebook Page'], done: progress.sourceConnected || Boolean(item('import')?.done) })
  if (progress.canInvite) steps.push({ key: 'team', icon: UsersRound, accent: '#059669', title: 'Team & roles', summary: 'Invite people with the right access', why: 'Leads can be assigned the moment they arrive, and everyone sees only what their role allows.', minutes: 1, needs: ['Teammates’ work emails'], done: Boolean(item('team')?.done) })

  const done = steps.filter((step) => step.done).length
  const loading = checklist.isPending || (Boolean(user?.organization) && !organization)
  const dismissed = Boolean(checklist.data?.dismissed) || checklist.isError
  const visible = !loading && !dismissed && steps.length > 0 && done < steps.length
  return {
    organization, steps, done, loading, visible, gmailOn, googleOn,
    /** Only the launch panel is shown until the business details are saved (or the member skips). */
    focus: visible && canWorkspace && !businessDone && !skipped,
    skip: () => { try { sessionStorage.setItem(skipKey(orgId), '1') } catch { /* session-only convenience */ } setSkipped(true) },
    dismiss: () => dismiss.mutate(), dismissing: dismiss.isPending,
  }
}
export type LaunchState = ReturnType<typeof useLaunchSteps>
