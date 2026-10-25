import { textEmailHtml } from '../email/content'
import type { TemplateChannel, TemplateInput } from './api'

export const channels: Record<TemplateChannel, string> = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' }
export const categories: Record<string, string> = { general: 'General', introduction: 'Introductions', follow_up: 'Follow-ups', meeting: 'Meetings', proposal: 'Proposals', customer_care: 'Customer care' }
export const fieldLabels: Record<string, string> = { firstName: 'First name', lastName: 'Last name', name: 'Full name', company: 'Company', owner: 'Your name', workspace: 'Workspace' }
export const sampleFields: Record<string, string> = { firstName: 'Asha', lastName: 'Shah', name: 'Asha Shah', company: 'Acme Industries', owner: 'Priya', workspace: 'TechSync' }
export function htmlText(html: string) {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, '\n'), 'text/html')
  return doc.body.textContent?.trim() || ''
}
export function templateErrors(input: TemplateInput, allowedKeys: string[] = Object.keys(fieldLabels)) {
  const errors: Record<string, string> = {}
  if (!input.name.trim()) errors.name = 'Give your template a clear name.'
  if (input.channel === 'email' && !input.subject.trim()) errors.subject = 'Add an email subject.'
  if (/[\r\n\0]/.test(input.subject)) errors.subject = 'Use a single line for the subject.'
  const body = htmlText(input.bodyHtml)
  if (!body) errors.bodyHtml = 'Write a message before saving.'
  const max = input.channel === 'sms' ? 1600 : input.channel === 'whatsapp' ? 4096 : 100000
  if (body.length > max) errors.bodyHtml = `Keep this message under ${max.toLocaleString()} characters.`
  for (const field of ['subject', 'bodyHtml'] as const) {
    const missing: string[] = [], allowed = new Set([...allowedKeys, ...(input.variables || []).map((v) => v.key)])
    const remaining = input[field].replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_token, key: string) => { if (!allowed.has(key)) missing.push(key); return '' })
    if (/\{\{|\}\}/.test(remaining)) missing.push('template syntax')
    if (missing.length) errors[field] = `Check personalization: ${missing.join(', ')}. Choose a field from Variables or define it first.`
  }
  return errors
}
export const starters: (TemplateInput & { description: string })[] = [
  { name: 'A warm introduction', channel: 'email', category: 'introduction', shared: false, subject: 'Your enquiry with {{workspace}}', bodyHtml: textEmailHtml('Hi {{firstName}},\n\nThank you for getting in touch with {{workspace}}. I’d love to hear more about what you need and help you find the right solution.\n\nWould you have 15 minutes this week for a quick conversation?\n\nBest regards,\n{{owner}}'), description: 'Turn a new enquiry into a conversation.' },
  { name: 'Proposal follow-up', channel: 'email', category: 'proposal', shared: false, subject: 'Any questions about our proposal?', bodyHtml: textEmailHtml('Hi {{firstName}},\n\nHave you had a chance to review our proposal? I’m happy to answer questions or talk through the next steps.\n\nWhat would be a convenient time to connect?\n\nBest regards,\n{{owner}}'), description: 'Move the conversation forward without pressure.' },
  { name: 'First reply', channel: 'whatsapp', category: 'introduction', shared: false, subject: '', bodyHtml: textEmailHtml('Hi {{firstName}}, this is {{owner}} from {{workspace}}. Thanks for your enquiry! What would be a good time for a quick conversation?'), description: 'Respond quickly and make a personal connection.' },
  { name: 'Meeting confirmation', channel: 'whatsapp', category: 'meeting', shared: false, subject: '', bodyHtml: textEmailHtml('Hi {{firstName}}, looking forward to our upcoming meeting. Does the agreed time still work for you? Please let me know if you need to reschedule. — {{owner}}'), description: 'Confirm plans and reduce missed meetings.' },
  { name: 'Call back request', channel: 'sms', category: 'follow_up', shared: false, subject: '', bodyHtml: textEmailHtml('Hi {{firstName}}, {{owner}} from {{workspace}} here. I tried reaching you about your enquiry. Please call back when convenient.'), description: 'Keep a missed connection moving.' },
  { name: 'Checking in', channel: 'email', category: 'customer_care', shared: false, subject: 'How is everything going, {{firstName}}?', bodyHtml: textEmailHtml('Hi {{firstName}},\n\nI wanted to check that everything is going smoothly. Is there anything our team can help with?\n\nI’m just a reply away.\n\nBest regards,\n{{owner}}'), description: 'Build relationships after the sale.' },
]
