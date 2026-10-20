import { Globe2, Mail, Megaphone, Phone, Radio, Upload, Webhook } from 'lucide-react'

import { Facebook, Instagram } from './BrandIcons'

export function sourceIcon(name: string) {
  if (/instagram/i.test(name)) return Instagram
  if (/facebook|meta/i.test(name)) return Facebook
  if (/google|ads/i.test(name)) return Megaphone
  if (/website|form|widget/i.test(name)) return Globe2
  if (/webhook|zapier|api/i.test(name)) return Webhook
  if (/csv|excel|import/i.test(name)) return Upload
  if (/phone|call/i.test(name)) return Phone
  if (/email/i.test(name)) return Mail
  return Radio
}
