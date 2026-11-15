import { Link } from 'react-router-dom'

export function PrivateBetaNotice() {
  return <section className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
    <p className="text-sm font-medium text-brand-700">TechSync CRM · Free private beta</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight">Core CRM for an invited business</h1>
    <p className="mt-5 text-lg text-muted">Organize leads, contacts, companies, deals and follow-up tasks. Capture enquiries through website forms or import CSV and Excel files.</p>
    <p className="mt-5 text-sm text-muted">Registration is closed while the hosting, recovery and support checks are completed. Approved businesses join through an invitation. Provider integrations require separate acceptance, and paid subscriptions are not offered in this beta.</p>
    <div className="mt-8 flex flex-wrap gap-5"><Link className="font-medium text-brand-700 underline" to="/login">Sign in</Link><Link className="underline" to="/privacy">Privacy notice</Link><Link className="underline" to="/terms">Beta terms</Link></div>
  </section>
}
