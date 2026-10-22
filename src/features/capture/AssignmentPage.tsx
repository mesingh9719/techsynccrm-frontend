import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  FlaskConical,
  GripVertical,
  Plus,
  Route,
  Save,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { useCan, useEntitlement } from '../../lib/useOrg'
import { memberOptions } from '../../services/team'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Tabs'
import { Field, FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { Dialog, ConfirmDialog } from '../../components/app/Dialog'
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '../../components/app/States'
import { PreviewNotice } from '../../components/app/PreviewNotice'
import { useToast } from '../../components/ui/Toast'
import { useCustomFieldDefs } from '../crm/hooks'
import { useLeadSources } from '../leads/api'
import { captureKeys, captureLive, makeCaptureApi } from './api'
import type { AssignmentRule, AssignmentTest, RuleCondition, WorkingHours } from './types'
import type { MemberOption } from '../../types'

const strategyLabels = {
  round_robin: 'Round robin',
  load_balanced: 'Balance workload',
  specific_user: 'Specific teammate',
}
const conditionFields = [
  { value: 'sourceId', label: 'Lead source ID' },
  { value: 'formId', label: 'Web form ID' },
  { value: 'city', label: 'City' },
  { value: 'stateCode', label: 'State code' },
  { value: 'pincode', label: 'PIN code' },
  { value: 'budgetMinor', label: 'Budget (paise)' },
  { value: 'tag', label: 'Tag ID' },
  { value: 'createdVia', label: 'Created via' },
]
function RuleEditor({
  rule,
  members,
  onClose,
  onSave,
}: {
  rule: AssignmentRule
  members: MemberOption[]
  onClose: () => void
  onSave: (rule: AssignmentRule) => Promise<void>
}) {
  const [draft, setDraft] = useState(rule),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const sources = useLeadSources(),
    defs = useCustomFieldDefs('lead'),
    territory = useEntitlement('territories')
  const fields = [
    ...conditionFields,
    ...(defs.data ?? []).filter((d) => !d.archived).map((d) => ({ value: `cf.${d.key}`, label: d.label })),
  ]
  const set = <K extends keyof AssignmentRule>(key: K, value: AssignmentRule[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const condition = (index: number, patch: Partial<RuleCondition>) =>
    set(
      'conditions',
      draft.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    )
  async function save() {
    setError('')
    if (!draft.name.trim()) return setError('Give this rule a name.')
    if (!draft.memberIds.length) return setError('Choose at least one active teammate.')
    if (draft.conditions.some((c) => !c.value.trim())) return setError('Complete each condition, or remove it.')
    if (draft.dailyCap !== null && (!Number.isInteger(draft.dailyCap) || draft.dailyCap < 1))
      return setError('Daily cap must be a positive whole number.')
    if (!territory.enabled && draft.conditions.some((c) => ['city', 'stateCode', 'pincode'].includes(c.field)))
      return setError('Territory conditions are included in Business and higher plans.')
    setBusy(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save this rule.')
    } finally {
      setBusy(false)
    }
  }
  const guard = useUnsavedChanges(draft, onClose, busy)
  return (
    <>
    <Dialog
      open
      onClose={guard.requestClose}
      busy={busy}
      title={rule.name ? 'Edit assignment rule' : 'Create assignment rule'}
      description="All conditions must match. The first matching rule gets the lead."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={guard.requestClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            <Save className="size-4" />
            Save rule
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Rule name">
          {({ id }) => (
            <Input
              id={id}
              autoFocus
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Website leads → Sales team"
              maxLength={100}
            />
          )}
        </Field>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">When all of these match</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                set('conditions', [...draft.conditions, { field: 'sourceId', operator: 'equals', value: '' }])
              }
            >
              <Plus className="size-4" />
              Condition
            </Button>
          </div>
          {!draft.conditions.length && (
            <p className="rounded-lg bg-surface-subtle p-3 text-xs text-muted">
              No conditions: this rule matches every new lead.
            </p>
          )}
          <div className="space-y-2">
            {draft.conditions.map((c, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <Select
                  aria-label={`Condition ${i + 1} field`}
                  value={c.field}
                  onChange={(e) => condition(i, { field: e.target.value, value: '' })}
                  className="h-10! text-xs"
                >
                  {fields.map((f) => (
                    <option
                      key={f.value}
                      value={f.value}
                      disabled={!territory.enabled && ['city', 'stateCode', 'pincode'].includes(f.value)}
                    >
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={`Condition ${i + 1} operator`}
                  value={c.operator}
                  onChange={(e) => condition(i, { operator: e.target.value as RuleCondition['operator'] })}
                  className="h-10! text-xs"
                >
                  <option value="equals">is exactly</option>
                  <option value="contains">contains</option>
                  <option value="starts_with">starts with</option>
                  <option value="gte">at least</option>
                  <option value="lte">at most</option>
                </Select>
                {c.field === 'sourceId' ? (
                  <Select
                    aria-label={`Condition ${i + 1} source`}
                    value={c.value}
                    onChange={(e) => condition(i, { value: e.target.value })}
                    className="h-10! text-xs"
                  >
                    <option value="">Choose source</option>
                    {sources.data
                      ?.filter((s) => !s.archived)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    aria-label={`Condition ${i + 1} value`}
                    value={c.value}
                    onChange={(e) => condition(i, { value: e.target.value })}
                    placeholder="Value"
                    className="h-10! text-xs"
                  />
                )}
                <button
                  aria-label={`Remove condition ${i + 1}`}
                  onClick={() =>
                    set(
                      'conditions',
                      draft.conditions.filter((_, n) => n !== i),
                    )
                  }
                  className="rounded-control p-1 text-muted hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <Field label="Then assign using">
          {({ id }) => (
            <Select
              id={id}
              value={draft.strategy}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  strategy: e.target.value as AssignmentRule['strategy'],
                  memberIds: e.target.value === 'specific_user' ? d.memberIds.slice(0, 1) : d.memberIds,
                }))
              }
            >
              {Object.entries(strategyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="-mt-3 text-xs leading-5 text-muted">
          {draft.strategy === 'round_robin'
            ? 'Rotate new leads evenly through the selected teammates.'
            : draft.strategy === 'load_balanced'
              ? 'Choose the teammate with the fewest open leads assigned in the last seven days.'
              : 'Always assign matching leads to one teammate.'}
        </p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Eligible teammates</legend>
          <div className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
            {members.map((member) => (
              <label key={member.userId} className="flex items-center gap-2 py-1 text-sm text-muted">
                <input
                  type={draft.strategy === 'specific_user' ? 'radio' : 'checkbox'}
                  name="assignment-member"
                  checked={draft.memberIds.includes(member.userId)}
                  onChange={(e) =>
                    set(
                      'memberIds',
                      draft.strategy === 'specific_user'
                        ? [member.userId]
                        : e.target.checked
                          ? [...draft.memberIds, member.userId]
                          : draft.memberIds.filter((id) => id !== member.userId),
                    )
                  }
                  className="size-4 accent-brand-600"
                />
                {member.fullName}
              </label>
            ))}
            {!members.length && (
              <p className="text-sm text-muted">No active teammates available. Invite your team in Settings.</p>
            )}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outside working hours">
            {({ id }) => (
              <Select
                id={id}
                value={draft.outsideHours}
                onChange={(e) => set('outsideHours', e.target.value as AssignmentRule['outsideHours'])}
              >
                <option value="assign_anyway">Assign anyway</option>
                <option value="hold_until_open">Hold until opening</option>
                <option value="fallback">Use fallback owner</option>
              </Select>
            )}
          </Field>
          <Field label="Daily leads per teammate" optional>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={draft.dailyCap ?? ''}
                onChange={(e) => set('dailyCap', e.target.value ? Number(e.target.value) : null)}
                placeholder="No cap"
              />
            )}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={draft.onlyWorkingHours}
            onChange={(e) => set('onlyWorkingHours', e.target.checked)}
            className="accent-brand-600"
          />
          Check teammate working hours
        </label>
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Dialog>
    {guard.confirmation}
    </>
  )
}
function HoursEditor({
  initial,
  members,
  onSave,
}: {
  initial: WorkingHours
  members: MemberOption[]
  onSave: (hours: WorkingHours) => Promise<unknown>
}) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const notify = useToast(),
    territories = useEntitlement('territories')
  const guard = useUnsavedChanges(draft, () => {}, busy)
  return (
    <section className="surface space-y-5 p-5">
      {guard.confirmation}
      <div>
        <h2 className="section-title">A schedule that works for your team</h2>
        <p className="mt-1 text-sm text-muted">
          Use workspace time, with a fallback so enquiries always have a next step.
        </p>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">Working days</legend>
        <div className="flex flex-wrap gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <label
              key={d}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle px-3 py-2 text-sm text-muted"
            >
              <input
                type="checkbox"
                checked={draft.days.includes(i)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    days: e.target.checked ? [...draft.days, i] : draft.days.filter((day) => day !== i),
                  })
                }
                className="accent-brand-600"
              />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start time">
          {({ id }) => (
            <Input
              id={id}
              type="time"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          )}
        </Field>
        <Field label="End time">
          {({ id }) => (
            <Input
              id={id}
              type="time"
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          )}
        </Field>
        <Field label="Time zone">
          {({ id }) => (
            <Select id={id} value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
              {Array.from(
                new Set([draft.timezone, 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC']),
              ).map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Fallback owner" hint="Used when no rule matches or no teammate is eligible.">
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={draft.fallbackOwnerId ?? ''}
            onChange={(e) => setDraft({ ...draft, fallbackOwnerId: e.target.value || null })}
          >
            <option value="">Leave unassigned for the team to claim</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label="First-response reminder (working minutes)"
        optional
        hint="Remind the owner at this interval, then escalate at twice the interval. Leave empty to disable."
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="number"
            min={1}
            max={1440}
            value={draft.firstResponseSlaMinutes ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, firstResponseSlaMinutes: e.target.value ? Number(e.target.value) : null })
            }
          />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          disabled={!territories.enabled}
          checked={draft.slaAutoReassign}
          onChange={(e) => setDraft({ ...draft, slaAutoReassign: e.target.checked })}
          className="accent-brand-600"
        />
        Reassign after SLA escalation (Business+)
      </label>
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        loading={busy}
        onClick={async () => {
          setError('')
          if (!draft.days.length || !draft.start || !draft.end || draft.start >= draft.end)
            return setError('Choose at least one working day and an end time after the start.')
          if (
            draft.firstResponseSlaMinutes !== null &&
            (!Number.isInteger(draft.firstResponseSlaMinutes) || draft.firstResponseSlaMinutes < 1)
          )
            return setError('Use a positive whole number of minutes.')
          setBusy(true)
          try {
            await onSave(draft)
            guard.markSaved(draft)
            notify({ title: captureLive ? 'Working hours saved' : 'Working-hours preview saved' })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t save.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <Save className="size-4" />
        Save working hours
      </Button>
    </section>
  )
}
export default function AssignmentPage() {
  const { user } = useAuth(),
    allowed = useCan('settings.workspace.manage'),
    client = useQueryClient(),
    notify = useToast()
  const scope = `${user?.organization?.id}:${user?.id}`,
    service = makeCaptureApi(scope),
    key = captureKeys(scope)
  const rules = useQuery({ queryKey: [...key, 'rules'], queryFn: service.listRules, enabled: allowed }),
    hours = useQuery({ queryKey: [...key, 'hours'], queryFn: service.getHours, enabled: allowed }),
    members = useQuery({
      queryKey: ['org', user?.organization?.id, 'memberOptions', ''],
      queryFn: () => memberOptions(),
      enabled: allowed,
    })
  const [tab, setTab] = useState<'rules' | 'hours' | 'test'>('rules'),
    [editing, setEditing] = useState<AssignmentRule | null>(null),
    [removing, setRemoving] = useState<AssignmentRule | null>(null),
    [error, setError] = useState(''),
    [testing, setTesting] = useState(false),
    [sample, setSample] = useState('{\n  "createdVia": "form",\n  "city": "Bengaluru",\n  "pincode": "560001"\n}'),
    [result, setResult] = useState<AssignmentTest | null>(null),
    [busy, setBusy] = useState(false)
  const refresh = () => client.invalidateQueries({ queryKey: key })
  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t update rules.')
    } finally {
      setBusy(false)
    }
  }
  async function reorder(from: number, to: number) {
    const ids = rules.data?.map((r) => r.id) ?? []
    if (to < 0 || to >= ids.length) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    await run(() => service.orderRules(ids))
  }
  if (!allowed)
    return (
      <EmptyState
        title="Assignment is managed by your workspace admin"
        action={<Button to="/app/tasks">My follow-ups</Button>}
      />
    )
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lead assignment"
        description="The right enquiry, with the right teammate. Every time."
        actions={
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                name: '',
                position: rules.data?.length ?? 0,
                isActive: true,
                conditions: [],
                strategy: 'round_robin',
                memberIds: [],
                outsideHours: 'assign_anyway',
                onlyWorkingHours: true,
                dailyCap: null,
                lastAssignedIndex: -1,
              })
            }
          >
            <Plus className="size-4" />
            Create rule
          </Button>
        }
      />
      {!captureLive && (
        <PreviewNotice>
          Rules and working hours are saved in this browser for planning. They do not assign live leads or send
          reminders until live routing is connected.
        </PreviewNotice>
      )}
      <Tabs
        label="Assignment settings"
        value={tab}
        onChange={setTab}
        items={[
          {
            value: 'rules',
            label: (
              <span className="flex items-center gap-2">
                <Route className="size-4" />
                Rules
              </span>
            ),
          },
          {
            value: 'hours',
            label: (
              <span className="flex items-center gap-2">
                <Clock3 className="size-4" />
                Working hours & SLA
              </span>
            ),
          },
          {
            value: 'test',
            label: (
              <span className="flex items-center gap-2">
                <FlaskConical className="size-4" />
                Test a lead
              </span>
            ),
          },
        ]}
      />
      {error && <FormAlert>{error}</FormAlert>}
      {members.isError && <ErrorState error={members.error} onRetry={() => members.refetch()} />}
      {tab === 'rules' ? (
        rules.isPending ? (
          <ListSkeleton />
        ) : rules.isError ? (
          <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
        ) : !rules.data.length ? (
          <EmptyState
            icon={UsersRound}
            title="Give every lead an owner"
            description="Create a rule to share incoming enquiries across your team. Manual assignments are always respected."
            action={
              <Button
                onClick={() =>
                  setEditing({
                    id: crypto.randomUUID(),
                    name: '',
                    position: 0,
                    isActive: true,
                    conditions: [],
                    strategy: 'round_robin',
                    memberIds: [],
                    outsideHours: 'assign_anyway',
                    onlyWorkingHours: true,
                    dailyCap: null,
                    lastAssignedIndex: -1,
                  })
                }
              >
                Create your first rule
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-xs text-muted">Evaluated from top to bottom. First matching rule wins.</p>
            <div className="space-y-3">
              {rules.data.map((rule, index) => (
                <article key={rule.id} className="surface flex flex-wrap items-center gap-3 p-4">
                  <GripVertical className="size-4 text-zinc-300" />
                  <span className="flex size-6 items-center justify-center rounded-md bg-zinc-100 text-xs text-muted">
                    {index + 1}
                  </span>
                  <button onClick={() => setEditing(rule)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-ink">{rule.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {rule.conditions.length ? `${rule.conditions.length} conditions` : 'All incoming leads'} ·{' '}
                      {strategyLabels[rule.strategy]} · {rule.memberIds.length} teammates
                    </p>
                  </button>
                  <Badge tone={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Enabled' : 'Paused'}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => service.saveRule({ ...rule, isActive: !rule.isActive }, false))}
                  >
                    {rule.isActive ? 'Pause' : 'Enable'}
                  </Button>
                  <div className="flex">
                    <button
                      aria-label={`Move ${rule.name} up`}
                      disabled={busy || !index}
                      onClick={() => reorder(index, index - 1)}
                      className="rounded-control p-2 text-muted hover:bg-zinc-100 disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      aria-label={`Move ${rule.name} down`}
                      disabled={busy || index === rules.data.length - 1}
                      onClick={() => reorder(index, index + 1)}
                      className="rounded-control p-2 text-muted hover:bg-zinc-100 disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      aria-label={`Delete ${rule.name}`}
                      disabled={busy}
                      onClick={() => setRemoving(rule)}
                      className="rounded-control p-2 text-muted hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      ) : tab === 'hours' ? (
        hours.isPending ? (
          <ListSkeleton />
        ) : hours.isError ? (
          <ErrorState error={hours.error} onRetry={() => hours.refetch()} />
        ) : (
          <HoursEditor
            key={JSON.stringify(hours.data)}
            initial={hours.data}
            members={members.data ?? []}
            onSave={async (h) => {
              await service.saveHours(h)
              await refresh()
            }}
          />
        )
      ) : (
        <section className="surface space-y-4 p-5">
          <h2 className="section-title">Try a lead before switching on a rule</h2>
          <p className="text-sm leading-6 text-muted">
            Use field keys such as sourceId, city, stateCode, pincode, budgetMinor or createdVia. Testing never changes
            a lead or advances the round robin.
          </p>
          <Field label="Sample lead (JSON)">
            {({ id }) => (
              <Textarea
                id={id}
                value={sample}
                onChange={(e) => {
                  setSample(e.target.value)
                  setResult(null)
                }}
                rows={8}
                className="font-mono text-xs"
              />
            )}
          </Field>
          <Button
            loading={testing}
            onClick={async () => {
              setError('')
              setResult(null)
              let leadSample: Record<string, string>
              try {
                const parsed: unknown = JSON.parse(sample)
                if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error()
                leadSample = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]))
              } catch {
                setError('Enter a valid JSON object, such as {"city":"Bengaluru"}.')
                return
              }
              setTesting(true)
              try {
                setResult(await service.test(leadSample))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Test failed.')
              } finally {
                setTesting(false)
              }
            }}
          >
            <FlaskConical className="size-4" />
            Run dry test
          </Button>
          {result && (
            <div role="status" className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="font-semibold text-brand-900">{result.ruleName ?? 'Fallback routing'}</p>
              <p className="mt-2 text-sm text-brand-800">
                Suggested owner:{' '}
                {members.data?.find((m) => m.userId === result.ownerId)?.fullName ??
                  (result.ownerId ? 'Configured teammate' : 'Unassigned')}
              </p>
              <p className="mt-2 text-xs leading-6 text-brand-700">{result.explanation}</p>
            </div>
          )}
        </section>
      )}
      {editing && (
        <RuleEditor
          rule={editing}
          members={members.data ?? []}
          onClose={() => setEditing(null)}
          onSave={async (rule) => {
            await service.saveRule(rule, !rules.data?.some((r) => r.id === rule.id))
            await refresh()
            notify({ title: captureLive ? 'Assignment rule saved' : 'Rule preview saved' })
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Delete assignment rule?"
        description="New leads will be evaluated against the remaining rules."
        confirmLabel="Delete rule"
        tone="danger"
        error={error}
        onConfirm={async () => {
          if (!removing) return
          try {
            await service.deleteRule(removing.id)
            await refresh()
            setRemoving(null)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Couldn’t delete rule.')
          }
        }}
      />
    </div>
  )
}
