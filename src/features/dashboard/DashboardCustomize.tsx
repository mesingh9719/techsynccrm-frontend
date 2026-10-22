import { useState } from 'react'
import { useUnsavedChanges } from '../../components/app/useUnsavedChanges'
import { ArrowDown, ArrowUp, Check, LayoutGrid, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Dialog } from '../../components/app/Dialog'
import { Button } from '../../components/ui/Button'
import {
  defaultPreferences,
  KPI_OPTIONS,
  moveItem,
  WIDGET_OPTIONS,
  type DashboardAccess,
  type DashboardPreferences,
  type KpiId,
  type WidgetId,
} from './preferences'

interface Props {
  preferences: DashboardPreferences
  canAccess: (access: DashboardAccess) => boolean
  onClose: () => void
  onSave: (preferences: DashboardPreferences) => void
}

export function DashboardCustomize({ preferences, canAccess, onClose, onSave }: Props) {
  const available = (value: DashboardPreferences): DashboardPreferences => ({
    ...value,
    kpis: value.kpis.filter((id) => KPI_OPTIONS.some((option) => option.id === id && canAccess(option.access))),
    widgets: value.widgets.filter((id) => WIDGET_OPTIONS.some((option) => option.id === id && canAccess(option.access))),
  })
  const [draft, setDraft] = useState(() => available(preferences))
  const guard = useUnsavedChanges(draft, onClose)

  function toggle(group: 'kpis', id: KpiId): void
  function toggle(group: 'widgets', id: WidgetId): void
  function toggle(group: 'kpis' | 'widgets', id: KpiId | WidgetId) {
    setDraft((current) => {
      if (group === 'kpis') {
        const key = id as KpiId
        return {
          ...current,
          kpis: current.kpis.includes(key) ? current.kpis.filter((item) => item !== key) : [...current.kpis, key],
        }
      }
      const key = id as WidgetId
      return {
        ...current,
        widgets: current.widgets.includes(key)
          ? current.widgets.filter((item) => item !== key)
          : [...current.widgets, key],
      }
    })
  }

  return (
    <>
    <Dialog
      open
      onClose={guard.requestClose}
      title="Make this dashboard yours"
      variant="drawer"
      size="md"
      icon={SlidersHorizontal}
      expandable={false}
      description="Choose what matters to you. Saved for this workspace in this browser."
      footer={
        <>
          <Button variant="secondary" onClick={guard.requestClose}>
            Cancel
          </Button>
          <Button onClick={() => { guard.markSaved(); onSave(draft) }}>
            <Check className="size-4" />
            Save dashboard
          </Button>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-surface-subtle px-3 py-2 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-2">
          <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
          Tick to show, untick to hide. Needs attention always stays first.
        </span>
        <button
          type="button"
          onClick={() => setDraft(available(defaultPreferences()))}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset to default
        </button>
      </div>
      <fieldset>
        <SectionHeading title="Overview metrics" shown={draft.kpis.length} total={KPI_OPTIONS.filter((o) => canAccess(o.access)).length} hint="Shown as a compact band below Needs attention." />
        <div className="space-y-2">
          {KPI_OPTIONS.filter((option) => canAccess(option.access))
            .sort((a, b) => {
              const aIndex = draft.kpis.indexOf(a.id),
                bIndex = draft.kpis.indexOf(b.id)
              return (aIndex < 0 ? 100 : aIndex) - (bIndex < 0 ? 100 : bIndex)
            })
            .map((option) => (
              <PreferenceRow
                key={option.id}
                {...option}
                checked={draft.kpis.includes(option.id)}
                onToggle={() => toggle('kpis', option.id)}
                index={draft.kpis.indexOf(option.id)}
                total={draft.kpis.length}
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    kpis: moveItem(current.kpis, current.kpis.indexOf(option.id), direction),
                  }))
                }
              />
            ))}
        </div>
      </fieldset>
      <fieldset className="mt-8">
        <SectionHeading title="Dashboard cards" shown={draft.widgets.length} total={WIDGET_OPTIONS.filter((o) => canAccess(o.access)).length} hint="Use the arrows to change the order of the cards you show." />
        <div className="space-y-2">
          {WIDGET_OPTIONS.filter((option) => canAccess(option.access))
            .sort((a, b) => {
              const aIndex = draft.widgets.indexOf(a.id),
                bIndex = draft.widgets.indexOf(b.id)
              return (aIndex < 0 ? 100 : aIndex) - (bIndex < 0 ? 100 : bIndex)
            })
            .map((option) => (
              <PreferenceRow
                key={option.id}
                {...option}
                checked={draft.widgets.includes(option.id)}
                onToggle={() => toggle('widgets', option.id)}
                index={draft.widgets.indexOf(option.id)}
                total={draft.widgets.length}
                onMove={(direction) =>
                  setDraft((current) => ({
                    ...current,
                    widgets: moveItem(current.widgets, current.widgets.indexOf(option.id), direction),
                  }))
                }
              />
            ))}
        </div>
      </fieldset>
    </Dialog>
    {guard.confirmation}
    </>
  )
}

function SectionHeading({ title, shown, total, hint }: { title: string; shown: number; total: number; hint: string }) {
  return (
    <legend className="mb-3 w-full">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-muted tabular-nums">
          {shown} of {total} shown
        </span>
      </span>
      <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
    </legend>
  )
}

function PreferenceRow({
  label,
  description,
  checked,
  onToggle,
  onMove,
  index,
  total,
}: {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
  onMove: (direction: -1 | 1) => void
  index: number
  total: number
}) {
  const arrow = 'inline-flex size-10 items-center justify-center text-muted hover:bg-surface-subtle hover:text-ink disabled:pointer-events-none disabled:opacity-30'
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${checked ? 'border-brand-200 bg-brand-50/50' : 'border-line bg-surface'}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 shrink-0 accent-brand-600" />
        <span className="min-w-0">
          <span className={`block text-sm font-medium ${checked ? 'text-ink' : 'text-muted'}`}>{label}</span>
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        </span>
      </label>
      {checked ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="w-5 text-center text-xs font-medium text-muted tabular-nums" aria-label={`Position ${index + 1}`}>
            {index + 1}
          </span>
          <div className="flex overflow-hidden rounded-lg border border-line bg-surface">
            <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)} className={`${arrow} border-r border-line`}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Move ${label} down`} disabled={index === total - 1} onClick={() => onMove(1)} className={`${arrow}`}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <span className="shrink-0 text-xs text-muted">Hidden</span>
      )}
    </div>
  )
}
