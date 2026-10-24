import { useEffect, useId, useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { z } from 'zod'
import { FormAlert } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import type { FormField, FormSettings, WebForm } from './types'
import { hiddenValue, isStatic, normalizeForm } from './formConfig'
import { readableText } from '../../lib/color'
import { ApiError } from '../../services/http'

const FONTS = {
  system: undefined,
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif',
}
const RADIUS = {
  sharp: { card: 'rounded-none', control: 'rounded-none', button: 'rounded-none' },
  soft: { card: 'rounded-2xl', control: 'rounded-lg', button: 'rounded-lg' },
  round: { card: 'rounded-3xl', control: 'rounded-xl', button: 'rounded-full' },
}
const CARD = { shadow: 'shadow-card border border-black/5', border: 'border border-black/15', flat: '' }
const LOGO_HEIGHT = { sm: 'max-h-8', md: 'max-h-12', lg: 'max-h-20' }
const ALIGN = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

/** Parameters a hidden field can read: the page's own query string, plus the host page's when embedded. */
function pageParams() {
  const search = new URLSearchParams(window.location.search)
  try {
    const host = search.get('host_url')
    if (host) new URL(host).searchParams.forEach((value, key) => search.has(key) || search.set(key, value))
  } catch {
    /* Ignore a malformed host address. */
  }
  return search
}

function Logo({ settings, url }: { settings: FormSettings; url: string | null }) {
  if (!url) return null
  return (
    <div className={cn('flex', ALIGN[settings.logo.position])}>
      <img src={url} alt="Logo" className={cn('w-auto max-w-[60%] object-contain', LOGO_HEIGHT[settings.logo.size])} />
    </div>
  )
}

/** Turns typed text into paragraphs; text is rendered as text, never as HTML. */
function Copy({ text, className }: { text: string; className?: string }) {
  return text ? <p className={cn('whitespace-pre-line', className)}>{text}</p> : null
}

export function FormRenderer({
  form: raw,
  preview = false,
  workspaceLogoUrl,
  onSubmit,
}: {
  form: WebForm
  preview?: boolean
  workspaceLogoUrl?: string | null
  onSubmit?: (values: Record<string, unknown>) => Promise<{ message?: string; redirectUrl?: string }>
}) {
  const form = normalizeForm(raw),
    { settings } = form,
    { theme } = settings
  const id = useId(),
    frame = useRef<HTMLDivElement>(null)
  const [started] = useState(Date.now)
  const [values, setValues] = useState<Record<string, string | boolean | string[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    if (!frame.current || typeof ResizeObserver === 'undefined' || window.parent === window) return
    const report = () =>
      window.parent.postMessage(
        { type: 'techsync:resize', key: form.key, height: document.documentElement.scrollHeight },
        '*',
      )
    const observer = new ResizeObserver(report)
    observer.observe(frame.current)
    report()
    return () => observer.disconnect()
  }, [form.key])

  const logoUrl =
    settings.logo.mode === 'workspace'
      ? (workspaceLogoUrl ?? form.workspaceLogoUrl ?? null)
      : settings.logo.mode === 'custom'
        ? settings.logo.url || null
        : null
  const band = settings.headerBand || (Boolean(logoUrl) && settings.logo.placement === 'header-band')
  const radius = RADIUS[theme.corners],
    bandText = readableText(settings.brandColor)
  const set = (key: string, value: string | boolean | string[]) => setValues((v) => ({ ...v, [key]: value }))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const next: Record<string, string> = {},
      data: Record<string, unknown> = {},
      params = pageParams()
    for (const field of form.fields) {
      if (isStatic(field)) continue
      const value = field.type === 'hidden' ? hiddenValue(field, params) : (values[field.key] ?? (field.type === 'checkboxes' ? [] : ''))
      const empty = field.type === 'checkbox' ? value !== true : Array.isArray(value) ? !value.length : !String(value).trim()
      if (field.required && empty) next[field.key] = `${field.label} is required.`
      else if (value && field.type === 'email' && !z.email().safeParse(value).success)
        next[field.key] = 'Enter a valid email address.'
      else if (value && field.type === 'tel' && !/^[+()\d\s.-]{6,30}$/.test(String(value)))
        next[field.key] = 'Enter a valid phone number.'
      else if (value && field.type === 'number' && !Number.isFinite(Number(value)))
        next[field.key] = 'Enter a valid number.'
      else if (value && field.type === 'currency' && !(Number.isFinite(Number(value)) && Number(value) >= 0))
        next[field.key] = 'Enter a valid amount.'
      // Amounts are sent in rupees as typed; the server stores paise.
      data[field.key] = value
    }
    if (settings.consentEnabled && !consent) next.consent = 'Please agree before sending.'
    setErrors(next)
    if (Object.keys(next).length) {
      document.getElementById(`${id}-${Object.keys(next)[0]}`)?.focus()
      return
    }
    if (preview) {
      setDone('Preview complete. No lead was created and no email was sent.')
      return
    }
    if (!onSubmit) return
    setBusy(true)
    const search = new URLSearchParams(window.location.search)
    const utm = Object.fromEntries(
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].flatMap((key) =>
        params.get(key) ? [[key, params.get(key)!]] : [],
      ),
    )
    const native = new FormData(event.currentTarget)
    try {
      const result = await onSubmit({
        fields: data,
        consent: settings.consentEnabled,
        consentText: settings.consentEnabled ? settings.consentText : '',
        website: native.get('website') ?? '',
        elapsedMs: Date.now() - started,
        pageUrl: search.get('host_url') ?? window.location.href,
        referrer: search.get('host_referrer') ?? document.referrer,
        utm,
      })
      if (result.redirectUrl) {
        const url = new URL(result.redirectUrl)
        if (url.protocol !== 'https:') throw new Error('The form returned an invalid redirect.')
        window.location.assign(url.toString())
        return
      }
      setDone(result.message || settings.thankYouMessage)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields)
      setError(err instanceof Error ? err.message : 'Your enquiry could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function control(field: FormField) {
    const fieldId = `${id}-${field.key}`,
      fieldError = errors[field.key]
    const describedBy = [fieldError && `${fieldId}-error`, field.helpText && `${fieldId}-help`].filter(Boolean).join(' ') || undefined
    const props = {
      id: fieldId,
      name: field.key,
      required: field.required,
      'aria-describedby': describedBy,
      'aria-invalid': Boolean(fieldError) || undefined,
    }
    const box = cn(
      'block w-full border bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-black/5',
      radius.control,
      fieldError ? 'border-red-400' : 'border-zinc-300 focus:border-zinc-500',
    )
    const value = values[field.key]
    if (field.type === 'textarea')
      return (
        <textarea {...props} rows={4} className={cn(box, 'py-2.5')} value={String(value ?? '')} placeholder={field.placeholder} maxLength={2000} onChange={(e) => set(field.key, e.target.value)} />
      )
    if (field.type === 'select')
      return (
        <select {...props} className={cn(box, 'h-11')} value={String(value ?? '')} onChange={(e) => set(field.key, e.target.value)}>
          <option value="">{field.placeholder || 'Choose an option'}</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    if (field.type === 'radio' || field.type === 'checkboxes') {
      const multi = field.type === 'checkboxes',
        picked = Array.isArray(value) ? value : []
      return (
        <div id={fieldId} tabIndex={-1} className="space-y-2" aria-describedby={describedBy}>
          {field.options?.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={field.key}
                value={o.value}
                checked={multi ? picked.includes(o.value) : value === o.value}
                onChange={(e) => set(field.key, multi ? (e.target.checked ? [...picked, o.value] : picked.filter((v) => v !== o.value)) : o.value)}
                className="size-4 shrink-0"
                style={{ accentColor: settings.brandColor }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    if (field.type === 'checkbox')
      return (
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
          <input {...props} type="checkbox" checked={value === true} onChange={(e) => set(field.key, e.target.checked)} className="mt-1 size-4 shrink-0" style={{ accentColor: settings.brandColor }} />
          <span>
            {field.label}
            {field.required && <span className="ml-1" aria-hidden="true">*</span>}
          </span>
        </label>
      )
    if (field.type === 'currency')
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500" aria-hidden="true">
            ₹
          </span>
          <input
            {...props}
            type="text"
            inputMode="decimal"
            className={cn(box, 'h-11 pl-7')}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            maxLength={16}
            onChange={(e) => set(field.key, e.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
      )
    return (
      <input
        {...props}
        type={field.type}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.key === 'firstName' ? 'name' : undefined}
        className={cn(box, 'h-11')}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        maxLength={field.type === 'tel' ? 30 : 1000}
        onChange={(e) => set(field.key, e.target.value)}
      />
    )
  }

  const header = (
    <>
      {logoUrl && settings.logo.placement === 'above-title' && !settings.headerBand && (
        <div className="mb-5">
          <Logo settings={settings} url={logoUrl} />
        </div>
      )}
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{settings.title}</h2>
      <Copy text={settings.description} className="mt-2 text-sm leading-6 opacity-80" />
    </>
  )

  return (
    <div
      ref={frame}
      className={cn('overflow-hidden', radius.card, CARD[theme.cardStyle])}
      style={{ backgroundColor: theme.cardBackground, color: theme.textColor, fontFamily: FONTS[theme.font] }}
    >
      {band && (
        <header className={cn('space-y-4 px-6 py-6 sm:px-8', theme.titleAlign === 'center' && 'text-center')} style={{ backgroundColor: settings.brandColor, color: bandText }}>
          {logoUrl && settings.logo.placement !== 'card-top' && <Logo settings={settings} url={logoUrl} />}
          {settings.headerBand && <div>{header}</div>}
        </header>
      )}
      <div className="p-6 sm:p-8">
        {logoUrl && settings.logo.placement === 'card-top' && (
          <div className="-mt-1 mb-6 border-b border-black/10 pb-5">
            <Logo settings={settings} url={logoUrl} />
          </div>
        )}
        {done ? (
          <div className="py-10 text-center" role="status">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ backgroundColor: settings.brandColor, color: bandText }}>
              <Check className="size-6" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">{preview ? 'Looking good!' : settings.successTitle}</h2>
            <Copy text={done} className="mt-3 text-sm leading-6 opacity-80" />
            {preview && (
              <Button variant="secondary" size="sm" className="mt-5" onClick={() => setDone('')}>
                Try again
              </Button>
            )}
          </div>
        ) : (
          <>
            {!settings.headerBand && (
              <div className={cn(theme.titleAlign === 'center' && 'text-center')}>
                {!logoUrl && !band && (
                  <div className={cn('mb-6 h-1 w-10 rounded-full', theme.titleAlign === 'center' && 'mx-auto')} style={{ backgroundColor: settings.brandColor }} />
                )}
                {header}
              </div>
            )}
            <form onSubmit={submit} noValidate className={cn('grid gap-x-4 gap-y-5 sm:grid-cols-2', !settings.headerBand && 'mt-7')}>
              {form.fields
                .filter((f) => f.type !== 'hidden')
                .map((field) => {
                  const fieldId = `${id}-${field.key}`,
                    span = field.width === 'half' ? 'sm:col-span-1' : 'sm:col-span-2'
                  if (field.type === 'heading')
                    return (
                      <h3 key={field.key} className="col-span-full mt-2 border-b border-black/10 pb-2 text-base font-semibold">
                        {field.label}
                      </h3>
                    )
                  if (field.type === 'paragraph') return <Copy key={field.key} text={field.helpText ?? ''} className="col-span-full text-sm leading-6 opacity-80" />
                  const grouped = field.type === 'radio' || field.type === 'checkboxes',
                    Wrapper = grouped ? 'fieldset' : 'div'
                  const label = (
                    <>
                      {field.label}
                      {field.required ? (
                        <span className="ml-1" style={{ color: settings.brandColor }} aria-hidden="true">
                          *
                        </span>
                      ) : (
                        <span className="ml-1 font-normal opacity-60">(optional)</span>
                      )}
                    </>
                  )
                  return (
                    <Wrapper key={field.key} className={cn('col-span-full min-w-0', span)}>
                      {field.type === 'checkbox' ? null : grouped ? (
                        <legend className="mb-2 block text-sm font-medium">{label}</legend>
                      ) : (
                        <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
                          {label}
                        </label>
                      )}
                      {control(field)}
                      {field.helpText && (
                        <p id={`${fieldId}-help`} className="mt-1.5 text-xs leading-5 opacity-70">
                          {field.helpText}
                        </p>
                      )}
                      {errors[field.key] && (
                        <p id={`${fieldId}-error`} role="alert" className="mt-2 text-xs text-red-600">
                          {errors[field.key]}
                        </p>
                      )}
                    </Wrapper>
                  )
                })}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label>
                  Leave this field empty
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {settings.consentEnabled && (
                <div className="col-span-full">
                  <label className="flex items-start gap-3 text-xs leading-5 opacity-80">
                    <input
                      id={`${id}-consent`}
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      required
                      aria-invalid={Boolean(errors.consent) || undefined}
                      aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
                      className="mt-1 size-4 shrink-0"
                      style={{ accentColor: settings.brandColor }}
                    />
                    <span className="whitespace-pre-line">{settings.consentText}</span>
                  </label>
                  {errors.consent && (
                    <p id={`${id}-consent-error`} role="alert" className="mt-2 text-xs text-red-600">
                      {errors.consent}
                    </p>
                  )}
                </div>
              )}
              {error && (
                <div className="col-span-full">
                  <FormAlert>{error}</FormAlert>
                </div>
              )}
              <div className={cn('col-span-full', theme.buttonWidth === 'auto' && theme.titleAlign === 'center' && 'text-center')}>
                <button
                  type="submit"
                  disabled={busy}
                  className={cn(
                    'min-h-11 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60',
                    radius.button,
                    theme.buttonWidth === 'full' && 'w-full',
                  )}
                  style={{ backgroundColor: settings.brandColor, color: bandText }}
                >
                  {busy ? 'Sending…' : settings.submitLabel}
                </button>
              </div>
            </form>
          </>
        )}
        {(settings.footerText || settings.showPoweredBy) && (
          <footer className="mt-6 space-y-3 border-t border-black/10 pt-4 text-center text-xs opacity-70">
            <Copy text={settings.footerText} className="leading-5" />
            {settings.showPoweredBy && (
              <p className="flex items-center justify-center gap-2">
                <LockKeyhole className="size-3" />
                {preview ? 'Sample form · no data is sent' : 'Your information stays private'} · TechSync
              </p>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}
