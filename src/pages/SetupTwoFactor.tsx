import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { fetchMe } from '../services/auth'
import { nextPathFor, useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { RequireStage } from '../components/auth/Guards'
import { TwoFactorSetup } from '../components/app/TwoFactorSetup'

/** Forced setup when the user's workspace requires two-factor authentication. */
export default function SetupTwoFactor() {
  useSeo({ title: 'Set up two-factor authentication', noindex: true })
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <RequireStage path="/setup-2fa">
      <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
        <div className="rounded-dialog bg-white p-8 shadow-card ring-1 ring-zinc-200 sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
            <ShieldCheck className="size-6 text-brand-700" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">Set up two-factor authentication</h1>
          <p className="mt-2 text-zinc-600">
            {user?.organization?.name ?? 'Your workspace'} requires a second step at sign-in to keep customer data safe. It takes about a minute.
          </p>
          <div className="mt-8">
            <TwoFactorSetup
              onComplete={async () => {
                const me = await fetchMe().catch(() => null)
                navigate(me ? nextPathFor(me) : '/app', { replace: true })
              }}
            />
          </div>
        </div>
      </div>
    </RequireStage>
  )
}
