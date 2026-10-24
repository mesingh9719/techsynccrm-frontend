import './switch.css'

/** Native checkbox interaction with a labelled, keyboard-accessible switch presentation. */
export function Switch({ checked, onChange, label, disabled, tone = 'violet', describedBy }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean; tone?: 'violet' | 'info' | 'success'; describedBy?: string }) {
  return <label className="settings-toggle" data-tone={tone}>
    <input type="checkbox" role="switch" aria-label={label} aria-checked={checked} aria-describedby={describedBy} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="settings-toggle-input" />
    <span className="settings-toggle-track" aria-hidden="true"><span /></span>
  </label>
}
