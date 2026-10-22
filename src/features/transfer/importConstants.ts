export const IMPORT_STEPS = [
  { title: 'Upload', description: 'Choose type and file' },
  { title: 'Check sheet', description: 'Header row and data' },
  { title: 'Map columns', description: 'Match CRM fields' },
  { title: 'Options', description: 'Duplicates and owners' },
  { title: 'Review', description: 'Check before importing' },
  { title: 'Import', description: 'Results and undo' },
] as const

/** Human-readable starter headings. The existing mapping step confirms their CRM fields. */
export const SAMPLE_COLUMNS = {
  lead: ['Full name', 'Mobile', 'Email', 'Company', 'Lead source', 'Budget', 'Requirement', 'City', 'State', 'Pincode', 'Owner email', 'Tags'],
  contact: ['Full name', 'Mobile', 'Email', 'Company', 'Title', 'Source', 'Owner email', 'Tags'],
  company: ['Company name', 'Website', 'Domain', 'Phone', 'Email', 'Industry', 'GSTIN', 'Owner email', 'Tags'],
  deal: ['Deal title', 'Amount', 'Close date', 'Company', 'Pipeline', 'Stage', 'Source', 'Owner email', 'Tags'],
} as const
