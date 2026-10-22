import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, LoaderCircle } from 'lucide-react'
import { enableTwoFactor, startTwoFactorSetup } from '../../services/account'
import { fetchMe } from '../../services/auth'
import { ApiError } from '../../services/http'
import { Button } from '../ui/Button'
import { Field, FormAlert, Input } from '../ui/Form'

// A mount runs the setup effect twice in development (StrictMode). Each call issues a new secret, so
// share one in-flight request — otherwise the QR shown could belong to a superseded secret.
let setupInFlight: ReturnType<typeof startTwoFactorSetup> | null = null
function startSetupOnce() {
  setupInFlight ??= startTwoFactorSetup().finally(() => window.setTimeout(() => (setupInFlight = null), 1000))
  return setupInFlight
}

/** The recovery codes, with copy/download — shown once after enabling or regenerating. */
export function RecoveryCodes({ codes, onDone, doneLabel = 'I’ve saved my codes' }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false)
  const text = `TechSync CRM recovery codes\nEach code can be used once to sign in if you lose your authenticator app.\n\n${codes.join('\n')}\n`

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — download still works */
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'techsync-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <p className="text-sm text-muted">
        Save these somewhere safe, like a password manager. If you lose your phone, each code lets you sign in once. <strong className="font-medium text-ink">You won’t see them again.</strong>
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface-subtle p-4 font-mono text-sm text-ink ring-1 ring-line" aria-label="Recovery codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      </div>
      <Button className="mt-6 w-full" onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  )
}

/**
 * Turning on 2FA: scan the QR code (or type the key), confirm with a code, then save recovery
 * codes. `onComplete` runs after the user confirms they've saved the codes.
 */
export function TwoFactorSetup({ onComplete }: { onComplete: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  useEffect(() => {
    let active = true
    startSetupOnce()
      .then(async ({ secret, otpauthUrl }) => {
        const qr = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 })
        if (active) setSetup({ secret, qr })
      })
      .catch((err) => active && setLoadError(err instanceof ApiError ? err.message : 'Couldn’t start the setup. Please try again.'))
    return () => {
      active = false
    }
  }, [])

  async function confirm(e: FormEvent) {
    e.preventDefault()
    const clean = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(clean)) return setError('Enter the 6-digit code from your app')
    setBusy(true)
    setError(null)
    try {
      const { recoveryCodes } = await enableTwoFactor(clean)
      setCodes(recoveryCodes)
      await fetchMe().catch(() => {})
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (codes) return <RecoveryCodes codes={codes} onDone={onComplete} />
  if (loadError) return <FormAlert>{loadError}</FormAlert>
  if (!setup) {
    return (
      <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Preparing…
      </p>
    )
  }

  const grouped = setup.secret.match(/.{1,4}/g)?.join(' ')
  return (
    <form onSubmit={confirm} noValidate>
      <ol className="space-y-5 text-sm text-ink">
        <li>
          <p>
            <span className="font-medium text-ink">1. Scan this QR code</span> with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
          </p>
          <div className="mt-3 flex flex-col items-center gap-3 rounded-xl bg-surface-subtle p-4 ring-1 ring-line sm:flex-row sm:items-start">
            <img src={setup.qr} alt="QR code for your authenticator app" width={160} height={160} className="rounded-lg bg-surface" />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-xs text-muted">Can’t scan? Enter this key instead:</p>
              <p className="mt-1 font-mono text-sm break-all text-ink select-all">{grouped}</p>
            </div>
          </div>
        </li>
        <li>
          <p className="font-medium text-ink">2. Enter the 6-digit code it shows</p>
          <Field label="Code" className="mt-3" error={error ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123456"
                className="font-mono tracking-widest"
              />
            )}
          </Field>
        </li>
      </ol>
      <Button type="submit" loading={busy} className="mt-6 w-full">
        Turn on two-factor authentication
      </Button>
    </form>
  )
}
