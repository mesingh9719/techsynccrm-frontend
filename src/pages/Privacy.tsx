import { legal } from '../services/legal'
import { useSeo } from '../lib/useSeo'
import { LegalPage } from '../components/layout/LegalPage'

export default function Privacy() {
  useSeo({ title: 'Privacy Policy', description: 'How TechSync CRM collects, uses, stores and protects personal data.' })
  return <LegalPage doc={legal.privacy} sibling={{ label: 'Terms of Service', to: '/terms' }} />
}
