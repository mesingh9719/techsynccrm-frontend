import { useState, type FormEvent } from 'react'
import { ClipboardList, Plus, UserRoundCheck, X } from 'lucide-react'
import { Menu, MenuItem, MenuLabel } from '../../../components/app/Menu'
import { cn } from '../../../lib/cn'
import { InlineMoney, InlineText } from '../../crm/components/RecordParts'
import type { LeadRecord } from '../../crm/types'
import { qualificationOptions, type DecisionRole, type LeadQualification } from './extrasApi'
import { Card, InlineSelect, Row } from './InlineFields'
import type { LeadDetail } from './useLeadDetail'

const roleLabel = (role: DecisionRole) => qualificationOptions.decisionRoles.find((r) => r.value === role)?.label ?? role

/** What the customer needs: the qualification facts that decide whether this converts. */
export function RequirementsCard({
  detail,
  qualification,
  saveQualification,
}: {
  detail: LeadDetail
  qualification: LeadQualification
  saveQualification: (values: Partial<LeadQualification>) => Promise<unknown>
}) {
  const lead = detail.lead as LeadRecord
  const { can, patch } = detail
  const [objection, setObjection] = useState('')
  const [person, setPerson] = useState<{ name: string; role: DecisionRole } | null>(null)
  // Failures already show a toast (see LeadDetailPage); list edits don't need inline errors.
  const fire = (values: Partial<LeadQualification>) => void saveQualification(values).catch(() => {})

  function addObjection(text: string) {
    const value = text.trim()
    if (!value || qualification.objections.includes(value)) return
    fire({ objections: [...qualification.objections, value] })
    setObjection('')
  }

  function addPerson(e: FormEvent) {
    e.preventDefault()
    if (!person?.name.trim()) return
    fire({
      decisionMakers: [...qualification.decisionMakers, { id: crypto.randomUUID(), name: person.name.trim(), role: person.role }],
    })
    setPerson(null)
  }

  // The facts the Qualified stage depends on; the meter shows how much of the picture is known.
  const captured = [lead.requirement, lead.budgetMinor !== null, qualification.timeline, qualification.preferences, qualification.decisionMakers.length > 0].filter(Boolean).length
  const total = 5

  return (
    <Card
      title="Requirements"
      icon={ClipboardList}
      id="lead-requirements"
      meta={
        <span
          className={cn(
            'ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ring-1',
            captured === total ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-surface-subtle text-muted ring-line',
          )}
          title={`${captured} of ${total} requirement details captured`}
        >
          <span className="flex gap-0.5" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn('h-1.5 w-2 rounded-full', i < captured ? (captured === total ? 'bg-emerald-500' : 'bg-brand-500') : 'bg-line')} />
            ))}
          </span>
          {captured === total ? 'Complete' : `${captured}/${total}`}
        </span>
      }
    >
      <dl className="lead-fields">
        <Row label="Needs" id="lead-field-requirement">
          <InlineText
            label="what they need"
            multiline
            placeholder="What are they looking for?"
            value={lead.requirement}
            disabled={!can.update}
            onSave={(v) => patch({ requirement: v })}
          />
        </Row>
        <Row label="Budget" id="lead-field-budget">
          <InlineMoney
            label="budget in rupees"
            value={lead.budgetMinor}
            placeholder="Add budget…"
            disabled={!can.update}
            onSave={(budgetMinor) => patch({ budgetMinor })}
          />
        </Row>
        <Row label="Timeline" id="lead-field-timeline">
          <InlineSelect
            label="Buying timeline"
            value={qualification.timeline}
            options={qualificationOptions.timelines}
            placeholder="When will they buy?"
            disabled={!can.update}
            onSave={(timeline) => saveQualification({ timeline })}
          />
        </Row>
        <Row label="Preferences">
          <InlineText
            label="preferences"
            multiline
            placeholder="Brand, specs, delivery, payment terms…"
            value={qualification.preferences}
            disabled={!can.update}
            onSave={(preferences) => saveQualification({ preferences })}
          />
        </Row>
        <Row label="Objections">
          <div className="space-y-2">
            {qualification.objections.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {qualification.objections.map((o) => (
                  <li key={o} className="inline-flex items-center gap-1 rounded-full bg-amber-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                    {o}
                    {can.update && (
                      <button
                        type="button"
                        onClick={() => fire({ objections: qualification.objections.filter((x) => x !== o) })}
                        className="compact-control rounded-full p-0.5 hover:bg-amber-100"
                        aria-label={`Remove objection: ${o}`}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {can.update && (
              <Menu
                className="w-72"
                trigger={(props) => (
                  <button type="button" {...props} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                    <Plus className="size-3" aria-hidden="true" /> Add objection
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <MenuLabel>Common objections</MenuLabel>
                    {qualificationOptions.objections
                      .filter((o) => !qualification.objections.includes(o))
                      .map((o) => (
                        <MenuItem key={o} onSelect={() => (close(), addObjection(o))}>
                          {o}
                        </MenuItem>
                      ))}
                    <form
                      className="mt-1 border-t border-line p-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        addObjection(objection)
                        close()
                      }}
                    >
                      <input
                        value={objection}
                        onChange={(e) => setObjection(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Something else… (Enter)"
                        aria-label="Custom objection"
                        maxLength={120}
                        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                      />
                    </form>
                  </>
                )}
              </Menu>
            )}
          </div>
        </Row>
        <Row label="People" id="lead-field-decisionMakers">
          <div className="space-y-2">
            {qualification.decisionMakers.length > 0 && (
              <ul className="space-y-1.5">
                {qualification.decisionMakers.map((d) => (
                  <li key={d.id} className="group flex items-center gap-2">
                    <UserRoundCheck className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-xs text-muted"> · {roleLabel(d.role)}</span>
                    </span>
                    {can.update && (
                      <button
                        type="button"
                        onClick={() => fire({ decisionMakers: qualification.decisionMakers.filter((x) => x.id !== d.id) })}
                        className="compact-control rounded p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
                        aria-label={`Remove ${d.name}`}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {can.update &&
              (person ? (
                <form onSubmit={addPerson} className="space-y-2 rounded-control bg-surface-subtle p-2 ring-1 ring-line">
                  <input
                    autoFocus
                    value={person.name}
                    onChange={(e) => setPerson({ ...person, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Escape' && setPerson(null)}
                    placeholder="Name"
                    aria-label="Person’s name"
                    maxLength={80}
                    className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={person.role}
                      onChange={(e) => setPerson({ ...person, role: e.target.value as DecisionRole })}
                      aria-label="Role"
                      className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
                    >
                      {qualificationOptions.decisionRoles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-md bg-action px-3 text-sm font-medium text-white hover:bg-action-hover">
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setPerson({ name: '', role: qualification.decisionMakers.length ? 'influencer' : 'decision_maker' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <Plus className="size-3" aria-hidden="true" /> Add person
                </button>
              ))}
          </div>
        </Row>
      </dl>
    </Card>
  )
}
