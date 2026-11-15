import { GuestOnly } from '../components/auth/Guards'
import { AuthShell } from '../components/layout/AuthShell'
import { useSeo } from '../lib/useSeo'

export default function Signup() {
  useSeo({ title: 'Private beta access', description: 'TechSync CRM private beta is free and available to approved businesses by invitation.', noindex: true })
  return <GuestOnly><AuthShell quoteIndex={0}>
    <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Private beta by invitation</h1>
    <p className="mt-4 text-sm leading-relaxed text-muted">Registration is closed for the free private beta. Use the invitation supplied by the operator to join an approved workspace. Your invitation must identify the operator and support contact before you submit customer data.</p>
  </AuthShell></GuestOnly>
}
