import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { createInvitations, listTeams, type InviteResult } from '../../services/team'
import { ApiError } from '../../services/http'
import { inviteSchema, parseEmails, type InviteValues } from '../../lib/schemas'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { handleGlobalApiError } from '../../lib/apiErrors'
import { cn } from '../../lib/cn'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Textarea } from '../../components/ui/Form'
import { Drawer } from '../../components/app/Dialog'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { RoleSelect, TeamCheckboxes } from './shared'
import { errorText, useTeamData } from './teamData'

/** Invite people by email with a role and optional teams. */
export function InviteDrawer({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const { invalidate, keys } = useTeamData(orgId)
  const canInviteAdmins = useCan('members.manage.admins')
  const seats = useEntitlement('users')
  const teams = useQuery({ queryKey: keys.teams, queryFn: listTeams, enabled: open })
  const [teamIds, setTeamIds] = useState<string[]>([])
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { emails: '', role: 'sales_rep' } })
  const emailsText = useWatch({ control, name: 'emails' })
  const role = useWatch({ control, name: 'role' })
  const parsed = parseEmails(emailsText ?? '')

  function close() {
    guard.markSaved({ isDirty: false, teamIds: [] })
    reset()
    setTeamIds([])
    setResults(null)
    setServerError(null)
    onClose()
  }

  const onSubmit = async (values: InviteValues) => {
    setServerError(null)
    const { valid, invalid } = parseEmails(values.emails)
    if (invalid.length) return setServerError(`Check these addresses: ${invalid.join(', ')}`)
    if (valid.length > 20) return setServerError('Invite up to 20 people at a time.')
    try {
      setResults(await createInvitations({ emails: valid, role: values.role, teamIds }))
      await invalidate()
    } catch (err) {
      // Out of seats: earlier addresses in the batch may already have been invited.
      if (err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED') {
        await invalidate()
        handleGlobalApiError(err)
      }
      setServerError(errorText(err))
    }
  }

  const statusLabel = { invited: 'Invitation sent', already_member: 'Already a member', email_failed: 'Saved, but the email failed — resend it' }

  const guard = useUnsavedChanges({ isDirty, teamIds }, close, isSubmitting, open && !results)
  return (
    <>
    <Drawer
      open={open}
      onClose={guard.requestClose}
      busy={isSubmitting}
      title="Invite people"
      description="They’ll get an email with a link to join this workspace. Links expire after 7 days."
      footer={
        results ? (
          <Button onClick={guard.requestClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={guard.requestClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={isSubmitting}>
              <Send className="size-4" aria-hidden="true" />
              Send {parsed.valid.length > 1 ? `${parsed.valid.length} invitations` : 'invitation'}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <ul className="divide-y divide-zinc-100" aria-label="Invitation results">
          {results.map((r) => (
            <li key={r.email} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="truncate text-ink">{r.email}</span>
              <Badge tone={r.status === 'invited' ? 'success' : r.status === 'already_member' ? 'neutral' : 'warning'}>{statusLabel[r.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <form id="invite-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label="Email addresses" error={errors.emails?.message} hint="Separate several with commas or new lines (up to 20).">
            {({ id, describedBy, invalid }) => <Textarea id={id} rows={4} placeholder="ritika@saffron.in, imran@saffron.in" aria-describedby={describedBy} invalid={invalid} {...register('emails')} />}
          </Field>
          {parsed.invalid.length > 0 && <p className="-mt-3 text-sm text-amber-700">Not valid: {parsed.invalid.join(', ')}</p>}
          <Field label="Role" error={errors.role?.message}>
            {({ id, describedBy }) => <RoleSelect id={id} describedBy={describedBy} value={role} onChange={(r) => setValue('role', r)} allowAdmin={canInviteAdmins} />}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Teams (optional)</legend>
            <TeamCheckboxes teams={teams.data ?? []} value={teamIds} onChange={setTeamIds} />
          </fieldset>
          {seats.limit !== null && seats.used !== null && (
            <p className={cn('text-sm', seats.used + parsed.valid.length > seats.limit ? 'text-amber-700' : 'text-muted')}>
              {seats.used} of {seats.limit} seats used on your plan (pending invitations hold a seat).
            </p>
          )}
          {serverError && <FormAlert>{serverError}</FormAlert>}
        </form>
      )}
    </Drawer>
    {guard.confirmation}
    </>
  )
}
