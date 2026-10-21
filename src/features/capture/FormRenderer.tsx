import { useEffect, useId, useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'
import { z } from 'zod'
import { FormAlert, Input, Select, Textarea } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'
import type { WebForm } from './types'
import { readableText } from '../../lib/color'

export function FormRenderer({
  form,
  preview = false,
  onSubmit,
}: {
  form: WebForm
  preview?: boolean
  onSubmit?: (values: Record<string, unknown>) => Promise<{ message?: string; redirectUrl?: string }>
}) {
  const id = useId(),
    frame = useRef<HTMLDivElement>(null)
  const [started] = useState(Date.now)
  const [values, setValues] = useState<Record<string, string | boolean>>({})
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const next: Record<string, string> = {},
      data: Record<string, unknown> = {}
    for (const field of form.fields) {
      const value = field.hidden ? (field.defaultValue ?? '') : (values[field.key] ?? '')
      if (field.required && (field.type === 'checkbox' ? value !== true : !String(value).trim()))
        next[field.key] = `${field.label} is required.`
      else if (value && field.type === 'email' && !z.email().safeParse(value).success)
        next[field.key] = 'Enter a valid email address.'
      else if (value && field.type === 'tel' && !/^[+()\d\s.-]{6,30}$/.test(String(value)))
        next[field.key] = 'Enter a valid phone number.'
      else if (value && field.type === 'number' && !Number.isFinite(Number(value)))
        next[field.key] = 'Enter a valid number.'
      data[field.key] = field.key === 'budgetMinor' && value !== '' ? Math.round(Number(value) * 100) : value
    }
    if (!consent) next.consent = 'Please agree before sending your enquiry.'
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
        search.get(key) ? [[key, search.get(key)!]] : [],
      ),
    )
    const native = new FormData(event.currentTarget)
    try {
      const result = await onSubmit({
        fields: data,
        consent: true,
        consentText: form.settings.consentText,
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
      setDone(result.message || form.settings.thankYouMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your enquiry could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div ref={frame} className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
      {done ? (
        <div className="py-10 text-center" role="status">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-ink">{preview ? 'Looking good!' : 'You’re all set!'}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{done}</p>
          {preview && (
            <Button variant="secondary" size="sm" className="mt-5" onClick={() => setDone('')}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-6 h-1 w-10 rounded-full" style={{ backgroundColor: form.settings.brandColor }} />
          <h2 className="text-xl font-semibold tracking-tight text-ink">{form.settings.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{form.settings.description}</p>
          <form onSubmit={submit} noValidate className="mt-7 space-y-5">
            {form.fields
              .filter((f) => !f.hidden)
              .map((field) => {
                const fieldId = `${id}-${field.key}`,
                  fieldError = errors[field.key]
                const props = {
                  id: fieldId,
                  name: field.key,
                  required: field.required,
                  'aria-describedby': fieldError ? `${fieldId}-error` : undefined,
                  'aria-invalid': Boolean(fieldError) || undefined,
                }
                return (
                  <div key={field.key}>
                    <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-ink">
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-brand-700" aria-hidden="true">
                          *
                        </span>
                      ) : (
                        <span className="ml-1 font-normal text-muted">(optional)</span>
                      )}
                    </label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        {...props}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        maxLength={2000}
                      />
                    ) : field.type === 'select' ? (
                      <Select
                        {...props}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      >
                        <option value="">Choose an option</option>
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    ) : field.type === 'checkbox' ? (
                      <input
                        {...props}
                        type="checkbox"
                        checked={Boolean(values[field.key])}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.checked }))}
                        className="size-4 accent-brand-600"
                      />
                    ) : (
                      <Input
                        {...props}
                        type={field.type}
                        value={String(values[field.key] ?? '')}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        maxLength={field.type === 'tel' ? 30 : 1000}
                      />
                    )}
                    {fieldError && (
                      <p id={`${fieldId}-error`} role="alert" className="mt-2 text-xs text-danger">
                        {fieldError}
                      </p>
                    )}
                  </div>
                )
              })}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label>
                Leave this field empty
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <div>
              <label className="flex items-start gap-3 text-xs leading-5 text-muted">
                <input
                  id={`${id}-consent`}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  aria-invalid={Boolean(errors.consent) || undefined}
                  aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
                  className="mt-1 size-4 shrink-0 accent-brand-600"
                />
                {form.settings.consentText}
              </label>
              {errors.consent && (
                <p id={`${id}-consent-error`} role="alert" className="mt-2 text-xs text-danger">
                  {errors.consent}
                </p>
              )}
            </div>
            {error && <FormAlert>{error}</FormAlert>}
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: form.settings.brandColor, color: readableText(form.settings.brandColor) }}
            >
              {busy ? 'Sending…' : form.settings.submitLabel}
            </button>
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              <LockKeyhole className="size-3" />
              {preview ? 'Sample form · no data is sent' : 'Your information stays private'} · TechSync
            </p>
          </form>
        </>
      )}
    </div>
  )
}
