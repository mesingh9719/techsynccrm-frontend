import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { BadgeCheck, Building2, Globe2, MapPin, ReceiptText } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, FormAlert, Input, Select } from '../../components/ui/Form'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/Toast'
import { gstStates, timeZoneOptions } from '../../lib/india'
import { qk } from '../../lib/queryKeys'
import { ApiError } from '../../services/http'
import { updateCurrentOrganization } from '../../services/organizations'
import type { Organization } from '../../types'

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** Only what invoices, quotes and reports need. Everything else lives in Settings → General. */
const schema = z
  .object({
    legalName: z.string().trim().min(2, 'Enter your registered business name').max(120, 'Keep it under 120 characters'),
    line1: z.string().trim().min(3, 'Enter your business address').max(120, 'Keep it under 120 characters'),
    city: z.string().trim().min(2, 'Enter your city').max(60, 'Keep it under 60 characters'),
    stateCode: z.string().min(1, 'Choose your state'),
    pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a 6-digit PIN code'),
    gstRegistered: z.boolean(),
    gstin: z.string().trim().toUpperCase(),
    timezone: z.string().min(1, 'Choose a time zone'),
    currency: z.enum(['INR', 'USD']),
  })
  .refine((v) => !v.gstRegistered || GSTIN.test(v.gstin), { path: ['gstin'], message: 'Enter a valid 15-character GSTIN' })
  .refine((v) => !v.gstRegistered || !GSTIN.test(v.gstin) || v.gstin.slice(0, 2) === v.stateCode, { path: ['gstin'], message: 'This GSTIN is registered in a different state' })
type Values = z.infer<typeof schema>
const formFields: (keyof Values)[] = ['legalName', 'line1', 'city', 'stateCode', 'pincode', 'gstin', 'timezone', 'currency']

export function BusinessDetailsForm({ org, onSaved }: { org: Organization; onSaved?: () => void }) {
  const client = useQueryClient(), notify = useToast()
  const [tzOptions] = useState(() => timeZoneOptions(org.timezone))
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, control, setValue, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: org.legalName ?? org.name, line1: org.address?.line1 ?? '', city: org.address?.city ?? '', stateCode: org.stateCode ?? '',
      pincode: org.address?.pincode ?? '', gstRegistered: Boolean(org.gstin) || !org.legalName, gstin: org.gstin ?? '', timezone: org.timezone || 'Asia/Kolkata', currency: org.currency ?? 'INR',
    },
  })
  const registered = useWatch({ control, name: 'gstRegistered' })
  const gstin = register('gstin')

  async function onSubmit(v: Values) {
    setServerError('')
    try {
      const updated = await updateCurrentOrganization({
        legalName: v.legalName, stateCode: v.stateCode, gstin: v.gstRegistered ? v.gstin : null, timezone: v.timezone, currency: v.currency,
        address: { line1: v.line1, line2: org.address?.line2 ?? null, city: v.city, pincode: v.pincode },
      })
      client.setQueryData(qk.org(updated.id).current, (old: { organization: Organization } | undefined) => (old ? { ...old, organization: updated } : old))
      void client.invalidateQueries({ queryKey: qk.org(updated.id).checklist })
      notify({ title: 'Business details saved', description: 'Quotes, reports and reminders now use them.' })
      onSaved?.()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        for (const [key, message] of Object.entries(err.fields)) {
          const field = key.replace(/^address\./, '') as keyof Values
          if (formFields.includes(field)) setError(field, { message })
          else setServerError(message)
        }
      } else setServerError(err instanceof ApiError && err.status < 500 && err.status !== 0 ? err.message : 'Couldn’t save your details. Please try again.')
    }
  }

  return <form className="launch-form" onSubmit={handleSubmit(onSubmit)} noValidate>
    <fieldset className="launch-fieldset">
      <legend><Building2 className="size-4" aria-hidden="true" />Registered business</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal business name" required error={errors.legalName?.message} hint="As it should appear on quotes and invoices." className="sm:col-span-2">
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization" aria-describedby={describedBy} invalid={invalid} {...register('legalName')} />}
        </Field>
        <div className="launch-gst sm:col-span-2">
          <div><p className="flex items-center gap-1.5 text-sm font-medium text-ink"><ReceiptText className="size-4 text-muted" aria-hidden="true" />GST registered</p><p id="gst-hint" className="mt-0.5 text-xs text-muted">Turn off if your business doesn’t have a GSTIN yet.</p></div>
          <Switch label="GST registered" describedBy="gst-hint" checked={registered} onChange={(next) => setValue('gstRegistered', next, { shouldDirty: true })} />
        </div>
        {registered && <Field label="GSTIN" required error={errors.gstin?.message} hint="We’ll fill in your state from it." className="sm:col-span-2">
          {({ id, describedBy, invalid }) => <Input id={id} placeholder="29ABCDE1234F1Z5" maxLength={15} className="font-mono uppercase tracking-wider" aria-describedby={describedBy} invalid={invalid} {...gstin}
            onChange={(event) => { void gstin.onChange(event); const code = event.target.value.slice(0, 2); if (gstStates.some(([c]) => c === code)) setValue('stateCode', code, { shouldDirty: true }) }} />}
        </Field>}
      </div>
    </fieldset>
    <fieldset className="launch-fieldset">
      <legend><MapPin className="size-4" aria-hidden="true" />Business address</legend>
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Address" required error={errors.line1?.message} className="sm:col-span-6">
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-line1" placeholder="Building, street, area" aria-describedby={describedBy} invalid={invalid} {...register('line1')} />}
        </Field>
        <Field label="City" required error={errors.city?.message} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => <Input id={id} autoComplete="address-level2" aria-describedby={describedBy} invalid={invalid} {...register('city')} />}
        </Field>
        <Field label="State" required error={errors.stateCode?.message} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register('stateCode')}><option value="">Choose state</option>{gstStates.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select>}
        </Field>
        <Field label="PIN code" required error={errors.pincode?.message} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" maxLength={6} autoComplete="postal-code" aria-describedby={describedBy} invalid={invalid} {...register('pincode')} />}
        </Field>
      </div>
    </fieldset>
    <fieldset className="launch-fieldset">
      <legend><Globe2 className="size-4" aria-hidden="true" />Region &amp; money</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Time zone" required error={errors.timezone?.message} hint="Used for “today”, reminders and reports.">
          {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register('timezone')}>{tzOptions.map((tz) => <option key={tz} value={tz}>{tz.replaceAll('_', ' ')}</option>)}</Select>}
        </Field>
        <Field label="Currency" required error={errors.currency?.message} hint="For deal values and revenue.">
          {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register('currency')}><option value="INR">₹ Indian Rupee (INR)</option><option value="USD">$ US Dollar (USD)</option></Select>}
        </Field>
      </div>
    </fieldset>
    {serverError && <FormAlert>{serverError}</FormAlert>}
    <div className="launch-actions">
      <p className="flex items-center gap-1.5 text-xs text-muted"><BadgeCheck className="size-3.5 text-emerald-600" aria-hidden="true" />You can change these anytime in Settings → General.</p>
      <Button type="submit" loading={isSubmitting}>Save and continue</Button>
    </div>
  </form>
}
