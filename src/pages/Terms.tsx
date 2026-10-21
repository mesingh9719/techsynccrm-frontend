import { legal } from '../services/legal'
import { useSeo } from '../lib/useSeo'
import { LegalPage } from '../components/layout/LegalPage'

export default function Terms() {
  useSeo({ title: 'Terms of Service', description: 'The terms that govern your use of TechSync CRM.' })
  return <LegalPage doc={legal.terms} sibling={{ label: 'Privacy Policy', to: '/privacy' }} />
}
