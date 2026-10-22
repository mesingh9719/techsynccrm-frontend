import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { CircleAlert, Eye, EyeOff, Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

const control =
  'block w-full rounded-lg border bg-surface px-3 text-sm text-ink shadow-card transition-colors placeholder:text-muted focus:outline-none focus:ring-4 disabled:bg-surface-subtle disabled:text-muted'

function controlState(invalid?: boolean) {
  return invalid
    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
    : 'border-line hover:border-zinc-400 focus:border-brand-500 focus:ring-brand-500/10'
}

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  optional?: boolean
  required?: boolean
  className?: string
  /** Render prop receives ids to wire up aria attributes on the control. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  labelAside?: ReactNode
}

/** Label + control + hint/error, with accessible associations. */
export function Field({ label, error, hint, optional, required, className, children, labelAside }: FieldProps) {
  const id = useId()
  // The hint is replaced by the error message, so only one of them is ever referenced.
  const hintId = hint && !error ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-1 text-danger" aria-label="required">*</span>}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
        {labelAside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="mt-2 flex items-center gap-2 text-sm text-red-600" role="alert">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-2 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type InputProps = ComponentProps<'input'> & { invalid?: boolean }

export function Input({ className, invalid, ...props }: InputProps) {
  return <input {...props} aria-invalid={invalid || undefined} className={cn(control, 'h-10', controlState(invalid), className)} />
}

/** Amount input with a currency symbol inside the field (₹ by default). */
export function MoneyInput({ className, symbol = '₹', ...props }: InputProps & { symbol?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted" aria-hidden="true">
        {symbol}
      </span>
      <Input inputMode="decimal" {...props} className={cn(symbol.length > 1 ? 'pl-11' : 'pl-7', className)} />
    </div>
  )
}

export function PasswordInput({ className, invalid, ...props }: InputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} invalid={invalid} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-500 hover:text-zinc-800"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

export function Select({ className, invalid, children, ...props }: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(control, 'h-10 appearance-none pr-10', controlState(invalid), className)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
    </div>
  )
}

export function Textarea({ className, invalid, ...props }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(control, 'min-h-32 resize-y py-3 leading-relaxed', controlState(invalid), className)}
    />
  )
}

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode
  invalid?: boolean
  description?: string
}

export function Checkbox({ label, invalid, description, className, id, ...props }: CheckboxProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-1 flex size-5 shrink-0">
        <input
          {...props}
          id={inputId}
          type="checkbox"
          aria-invalid={invalid || undefined}
          className={cn(
            'peer size-5 appearance-none rounded-control border bg-surface shadow-card transition-colors checked:border-brand-600 checked:bg-brand-600 focus-visible:ring-4 focus-visible:ring-brand-500/10 focus-visible:outline-none',
            invalid ? 'border-red-400' : 'border-line',
          )}
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      <label htmlFor={inputId} className="text-sm leading-snug text-ink">
        {label}
        {description && <span className="mt-1 block text-xs text-muted">{description}</span>}
      </label>
    </div>
  )
}

/** Error summary shown when a server request fails. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
