import legalJson from '../data/legal.json'
import type { LegalDocument } from '../types'

export const legal = legalJson as { privacy: LegalDocument; terms: LegalDocument }
