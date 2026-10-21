import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, UsersRound } from 'lucide-react'
import { acceptInvitation, lookupInvitation, logout, signupWithInvite, type InvitationPreview } from '../services/auth'
import { ApiError } from '../services/http'
import { inviteSignupSchema, type InviteSignupValues } from '../lib/schemas'
import { applyServerErrors } from '../lib/forms'
import { nextPathFor, useAuth } from '../lib/useAuth'
import { useSeo } from '../lib/useSeo'
import { roleLabels } from '../lib/permissions'
import type { AuthUser, MemberRole } from '../types'
import { Button } from '../components/ui/Button'
import { Checkbox, Field, FormAlert, Input, PasswordInput } from '../components/ui/Form'

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 sm:py-20">
      <div className="rounded-dialog bg-white p-8 shadow-card ring-1 ring-zinc-200 sm:p-10">{children}</div>
    </div>
  )
}

function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="text-center" role="alert">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
          <CircleAlert className="size-6 text-amber-600" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        <div className="mt-2 text-zinc-600">{children}</div>
      </div>
    </Card>
  )
}

function Header({ invite }: { invite: InvitationPreview }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 ring-1 ring-brand-100">
        <UsersRound className="size-6 text-brand-700" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-950">Join {invite.organizationName}</h1>
      <p className="mt-2 text-zinc-600">
        {invite.inviterName ?? 'A teammate'} invited <strong className="font-medium text-zinc-900">{invite.email}</strong> to join as{' '}
        {roleLabels[invite.role as MemberRole] ?? invite.role}.
      </p>
    </div>
  )
}

function SignupForm({ token, invite, onJoined }: { token: string; invite: InvitationPreview; onJoined: (user: AuthUser) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteSignupValues>({ resolver: zodResolver(inviteSignupSchema), defaultValues: { fullName: '', jobRole: '', password: '', terms: false } })

  const onSubmit = async ({ terms: _terms, jobRole, ...values }: InviteSignupValues) => {
    setServerError(null)
    try {
      onJoined(await signupWithInvite({ token, ...values, ...(jobRole && { jobRole }), acceptTerms: true }))
    } catch (err) {
      setServerError(applyServerErrors(err, setError, ['fullName', 'jobRole', 'password']))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5" aria-label="Create your account">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <Field label="Email">{({ id }) => <Input id={id} value={invite.email} readOnly disabled />}</Field>
      <Field label="Full name" error={errors.fullName?.message}>
        {({ id, describedBy, invalid }) => <Input id={id} autoComplete="name" autoFocus aria-describedby={describedBy} invalid={invalid} {...register('fullName')} />}
      </Field>
      <Field label="Job title" optional error={errors.jobRole?.message}>
        {({ id, describedBy, invalid }) => <Input id={id} autoComplete="organization-title" aria-describedby={describedBy} invalid={invalid} {...register('jobRole')} />}
      </Field>
      <Field label="Choose a password" error={errors.password?.message} hint="At least 8 characters, with a letter and a number.">
        {({ id, describedBy, invalid }) => <PasswordInput id={id} autoComplete="new-password" aria-describedby={describedBy} invalid={invalid} {...register('password')} />}
      </Field>
      <div>
        <Checkbox
          invalid={Boolean(errors.terms)}
          label={
            <>
              I agree to the{' '}
              <Link to="/terms" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-brand-700 underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              .
            </>
          }
          {...register('terms')}
        />
        {errors.terms && (
          <p role="alert" className="mt-2 ml-[30px] text-sm text-red-600">
            {errors.terms.message}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Create account and join
      </Button>
    </form>
  )
}

/**
 * /invite?token=… — the link from an invitation email. Handles every case: new person (sign up
 * here), existing account signed out (sign in, then come back), signed in with the invited email
 * (accept), signed in as someone else (switch account).
 */
export default function Invite() {
  useSeo({ title: 'Join workspace', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status, user } = useAuth()
  const [invite, setInvite] = useState<InvitationPreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(token ? null : 'This invitation link is incomplete. Please use the full link from your email.')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    lookupInvitation(token)
      .then((data) => active && setInvite(data))
      .catch((err) => active && setLoadError(err instanceof ApiError && err.status < 500 && err.status !== 0 ? err.message : 'We couldn’t load this invitation. Please try again.'))
    return () => {
      active = false
    }
  }, [token])

  function joined(me: AuthUser) {
    queryClient.clear()
    navigate(nextPathFor(me), { replace: true, state: { newWorkspace: true } })
  }

  async function accept() {
    setJoining(true)
    setJoinError(null)
    try {
      const updated = await acceptInvitation(token)
      queryClient.clear()
      navigate(nextPathFor(updated), { replace: true, state: { newWorkspace: true } })
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  if (loadError) return <Problem title="We couldn’t open this invitation">{loadError}</Problem>
  if (!invite || status === 'loading') {
    return (
      <Card>
        <p role="status" className="flex items-center justify-center gap-2 py-8 text-zinc-500">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Loading invitation…
        </p>
      </Card>
    )
  }

  if (invite.status === 'accepted') {
    return (
      <Problem title="This invitation has already been used">
        <p>{user ? <Link to="/app" className="font-medium text-brand-700 hover:underline">Go to your workspace</Link> : <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>}</p>
      </Problem>
    )
  }
  if (invite.status === 'expired') return <Problem title="This invitation has expired">Ask {invite.inviterName ?? 'whoever invited you'} to send it again.</Problem>
  if (invite.status === 'revoked') return <Problem title="This invitation was cancelled">Ask an admin of {invite.organizationName} to invite you again.</Problem>

  // Signed in as someone else.
  if (user && user.email !== invite.email) {
    return (
      <Problem title="This invitation is for another email">
        <p>
          It was sent to <strong className="font-medium text-zinc-900">{invite.email}</strong>, but you’re signed in as {user.email}.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => logout().catch(() => {})}>
          Sign out and continue
        </Button>
      </Problem>
    )
  }

  return (
    <Card>
      <Header invite={invite} />
      {user ? (
        <div className="mt-8">
          {joinError && (
            <div className="mb-4">
              <FormAlert>{joinError}</FormAlert>
            </div>
          )}
          <Button size="lg" className="w-full" loading={joining} onClick={accept}>
            Join {invite.organizationName}
          </Button>
        </div>
      ) : invite.accountExists ? (
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-600">You already have a TechSync account. Sign in to accept.</p>
          <Button size="lg" className="mt-4 w-full" onClick={() => navigate('/login', { state: { from: `/invite?token=${token}` } })}>
            Sign in to accept
          </Button>
        </div>
      ) : (
        <SignupForm token={token} invite={invite} onJoined={joined} />
      )}
    </Card>
  )
}
