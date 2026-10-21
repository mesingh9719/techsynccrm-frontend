import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, LayoutGrid, RotateCcw } from 'lucide-react'
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
  const [draft, setDraft] = useState(preferences)

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
    <Dialog
      open
      onClose={onClose}
      title="Make this dashboard yours"
      variant="drawer"
      size="md"
      description="Choose what matters to you. Your layout is saved for this workspace in this browser."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>
            <Check className="size-4" />
            Save dashboard
          </Button>
        </>
      }
    >
      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-surface-subtle p-3 text-xs text-muted">
        <span className="flex items-center gap-2">
          <LayoutGrid className="size-4" />
          Show, hide and reorder cards. Needs attention stays first.
        </span>
        <button
          type="button"
          onClick={() => setDraft(defaultPreferences())}
          className="flex items-center gap-1 font-medium text-brand-700"
        >
          <RotateCcw className="size-4" />
          Reset
        </button>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Overview metrics</legend>
        <p className="mb-3 mt-1 text-xs text-muted">Selected metrics appear in a compact band after your attention queue.</p>
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
      <fieldset className="mt-7">
        <legend className="text-sm font-semibold text-ink">Dashboard cards</legend>
        <p className="mb-3 mt-1 text-xs text-muted">Use the arrows to change the order of selected cards.</p>
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
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-3 transition-colors ${checked ? 'border-brand-500/30 bg-brand-500/5' : 'border-line'}`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 shrink-0 accent-brand-600" />
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="mt-1 block text-xs text-muted">{description}</span>
        </span>
      </label>
      {checked && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded-lg p-2 text-muted hover:bg-surface disabled:opacity-25"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="rounded-lg p-2 text-muted hover:bg-surface disabled:opacity-25"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
