import { useRef, useState, type ReactNode } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Check, ImageUp, PanelTop, Rows3, Type } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, Textarea } from '../../components/ui/Form'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { getFile, uploadFile } from '../files/api'
import type { FormLogo, FormSettings, FormTheme, LogoPlacement } from './types'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const THEMES: { name: string; brandColor: string; theme: Pick<FormTheme, 'pageBackground' | 'cardBackground' | 'textColor'> }[] = [
  { name: 'Classic', brandColor: '#3349df', theme: { pageBackground: '#f4f5f7', cardBackground: '#ffffff', textColor: '#18181b' } },
  { name: 'Ocean', brandColor: '#0e7490', theme: { pageBackground: '#ecfeff', cardBackground: '#ffffff', textColor: '#0f172a' } },
  { name: 'Forest', brandColor: '#15803d', theme: { pageBackground: '#f0fdf4', cardBackground: '#ffffff', textColor: '#14532d' } },
  { name: 'Sunset', brandColor: '#ea580c', theme: { pageBackground: '#fff7ed', cardBackground: '#ffffff', textColor: '#431407' } },
  { name: 'Royal', brandColor: '#7c3aed', theme: { pageBackground: '#f5f3ff', cardBackground: '#ffffff', textColor: '#1e1b4b' } },
  { name: 'Midnight', brandColor: '#818cf8', theme: { pageBackground: '#020617', cardBackground: '#1e293b', textColor: '#f1f5f9' } },
]
const PLACEMENTS: { value: LogoPlacement; label: string; hint: string; icon: typeof PanelTop }[] = [
  { value: 'card-top', label: 'Top of the form', hint: 'Above everything, with a divider', icon: Rows3 },
  { value: 'above-title', label: 'Above the headline', hint: 'Sits right on top of your title', icon: Type },
  { value: 'header-band', label: 'In a coloured header', hint: 'On a band in your brand colour', icon: PanelTop },
]

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line pb-6 last:border-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      {({ id }) => (
        <div className="flex items-center gap-2">
          <input type="color" id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1" />
          <span className="font-mono text-xs text-muted">{value}</span>
        </div>
      )}
    </Field>
  )
}

function LogoEditor({ logo, workspaceLogoUrl, onChange }: { logo: FormLogo; workspaceLogoUrl: string | null; onChange: (logo: FormLogo) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState('')
  const set = (patch: Partial<FormLogo>) => onChange({ ...logo, ...patch })
  async function pick(file: File | undefined) {
    if (input.current) input.current.value = ''
    if (!file) return
    setError('')
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError('Use a PNG, JPG or WebP image.')
    if (file.size > MAX_LOGO_BYTES) return setError('Use an image smaller than 2 MB.')
    setProgress(0)
    try {
      const stored = await uploadFile(file, undefined, setProgress)
      const url = stored.url ?? (await getFile(stored.id)).url
      if (!url) throw new Error('The logo was uploaded but could not be displayed. Try again.')
      set({ mode: 'custom', fileId: stored.id, url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t upload the logo.')
    } finally {
      setProgress(null)
    }
  }
  const shown = logo.mode === 'workspace' ? workspaceLogoUrl : logo.mode === 'custom' ? logo.url : null
  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Logo"
        size="sm"
        value={logo.mode}
        onChange={(mode) => (mode === 'custom' && !logo.url ? input.current?.click() : set({ mode }))}
        options={[
          { value: 'none', label: 'No logo' },
          { value: 'workspace', label: 'Company logo' },
          { value: 'custom', label: 'Upload a logo' },
        ]}
      />
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files?.[0])} />
      {logo.mode === 'workspace' && !workspaceLogoUrl && (
        <p className="text-xs text-amber-800">Your workspace has no logo yet. Add one in Workspace settings, or upload a logo just for this form.</p>
      )}
      {(logo.mode === 'custom' || progress !== null) && (
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-subtle/60 p-3">
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-line">
            {shown ? <img src={shown} alt="Uploaded logo" className="max-h-14 max-w-14 object-contain" /> : <ImageUp className="size-5 text-muted" />}
          </span>
          <div className="min-w-0">
            <Button variant="secondary" size="sm" loading={progress !== null} onClick={() => input.current?.click()}>
              <ImageUp className="size-4" />
              {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : shown ? 'Replace logo' : 'Choose an image'}
            </Button>
            <p className="mt-1.5 text-xs text-muted">PNG, JPG or WebP, up to 2 MB. A transparent PNG looks best.</p>
          </div>
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {logo.mode !== 'none' && (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Where should it go?</p>
            <div role="radiogroup" aria-label="Logo placement" className="grid gap-2 sm:grid-cols-3">
              {PLACEMENTS.map((p) => {
                const active = logo.placement === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set({ placement: p.value })}
                    className={cn('relative rounded-xl border p-3 text-left transition-colors', active ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' : 'border-line hover:border-zinc-300')}
                  >
                    <p.icon className="size-4 text-brand-700" aria-hidden="true" />
                    <span className="mt-2 block text-sm font-medium text-ink">{p.label}</span>
                    <span className="block text-xs text-muted">{p.hint}</span>
                    {active && <Check className="absolute top-3 right-3 size-4 text-brand-700" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Alignment</p>
              <SegmentedControl
                label="Logo alignment"
                size="sm"
                value={logo.position}
                onChange={(position) => set({ position })}
                options={[
                  { value: 'left', label: <><AlignLeft className="size-4" aria-hidden="true" />Left</> },
                  { value: 'center', label: <><AlignCenter className="size-4" aria-hidden="true" />Centre</> },
                  { value: 'right', label: <><AlignRight className="size-4" aria-hidden="true" />Right</> },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Size</p>
              <SegmentedControl
                label="Logo size"
                size="sm"
                value={logo.size}
                onChange={(size) => set({ size })}
                options={[
                  { value: 'sm', label: 'Small' },
                  { value: 'md', label: 'Medium' },
                  { value: 'lg', label: 'Large' },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function DesignEditor({
  settings,
  workspaceLogoUrl,
  onChange,
}: {
  settings: FormSettings
  workspaceLogoUrl: string | null
  onChange: (settings: FormSettings) => void
}) {
  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) => onChange({ ...settings, [key]: value })
  const theme = <K extends keyof FormTheme>(key: K, value: FormTheme[K]) => set('theme', { ...settings.theme, [key]: value })
  return (
    <div className="space-y-6">
      <Section title="Logo" description="Show your company logo, or upload one just for this form.">
        <LogoEditor logo={settings.logo} workspaceLogoUrl={workspaceLogoUrl} onChange={(logo) => set('logo', logo)} />
      </Section>

      <Section title="Header">
        <Field label="Headline">{({ id }) => <Input id={id} value={settings.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />}</Field>
        <Field label="Introduction" optional>
          {({ id }) => <Textarea id={id} value={settings.description} onChange={(e) => set('description', e.target.value)} maxLength={500} rows={2} />}
        </Field>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Checkbox label="Show the header on a coloured band" checked={settings.headerBand} onChange={(e) => set('headerBand', e.target.checked)} />
          <div className="flex items-center gap-2 text-sm text-ink">
            Text
            <SegmentedControl
              label="Header alignment"
              size="sm"
              value={settings.theme.titleAlign}
              onChange={(v) => theme('titleAlign', v)}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Colours" description="Pick a ready-made look, then fine-tune if you like.">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => {
            const active = settings.brandColor === t.brandColor && settings.theme.pageBackground === t.theme.pageBackground && settings.theme.cardBackground === t.theme.cardBackground
            return (
              <button
                key={t.name}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...settings, brandColor: t.brandColor, theme: { ...settings.theme, ...t.theme } })}
                className={cn('rounded-xl border p-2 text-center text-xs font-medium text-ink transition-colors', active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-line hover:border-zinc-300')}
              >
                <span className="mb-1.5 flex h-8 items-center justify-center rounded-lg" style={{ backgroundColor: t.theme.pageBackground }}>
                  <span className="flex h-5 w-10 items-center justify-center rounded-md" style={{ backgroundColor: t.theme.cardBackground }}>
                    <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: t.brandColor }} />
                  </span>
                </span>
                {t.name}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ColorInput label="Brand & button" value={settings.brandColor} onChange={(v) => set('brandColor', v)} />
          <ColorInput label="Page background" value={settings.theme.pageBackground} onChange={(v) => theme('pageBackground', v)} />
          <ColorInput label="Form background" value={settings.theme.cardBackground} onChange={(v) => theme('cardBackground', v)} />
          <ColorInput label="Text" value={settings.theme.textColor} onChange={(v) => theme('textColor', v)} />
        </div>
      </Section>

      <Section title="Style">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Corners</p>
            <SegmentedControl
              label="Corners"
              size="sm"
              value={settings.theme.corners}
              onChange={(v) => theme('corners', v)}
              options={[
                { value: 'sharp', label: 'Square' },
                { value: 'soft', label: 'Soft' },
                { value: 'round', label: 'Round' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Form edge</p>
            <SegmentedControl
              label="Form edge"
              size="sm"
              value={settings.theme.cardStyle}
              onChange={(v) => theme('cardStyle', v)}
              options={[
                { value: 'shadow', label: 'Shadow' },
                { value: 'border', label: 'Outline' },
                { value: 'flat', label: 'None' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Font</p>
            <SegmentedControl
              label="Font"
              size="sm"
              value={settings.theme.font}
              onChange={(v) => theme('font', v)}
              options={[
                { value: 'system', label: 'Modern' },
                { value: 'serif', label: 'Classic' },
                { value: 'rounded', label: 'Friendly' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Button</p>
            <SegmentedControl
              label="Button width"
              size="sm"
              value={settings.theme.buttonWidth}
              onChange={(v) => theme('buttonWidth', v)}
              options={[
                { value: 'full', label: 'Full width' },
                { value: 'auto', label: 'Fit text' },
              ]}
            />
          </div>
        </div>
        <Field label="Button label">{({ id }) => <Input id={id} value={settings.submitLabel} onChange={(e) => set('submitLabel', e.target.value)} maxLength={40} />}</Field>
      </Section>

      <Section title="Footer" description="Small print under the button: address, office hours, a privacy note.">
        <Field label="Footer text" optional>
          {({ id }) => <Textarea id={id} rows={2} value={settings.footerText} onChange={(e) => set('footerText', e.target.value)} maxLength={500} placeholder="e.g. Open Mon–Sat, 10 am – 7 pm · Bengaluru" />}
        </Field>
        <Checkbox label="Show “Your information stays private · TechSync”" checked={settings.showPoweredBy} onChange={(e) => set('showPoweredBy', e.target.checked)} />
      </Section>
    </div>
  )
}
