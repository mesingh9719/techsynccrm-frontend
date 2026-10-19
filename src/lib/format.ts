import type { Currency } from '../types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatPrice(value: number, currency: Currency) {
  return currency === 'INR' ? inr.format(value) : usd.format(value)
}

/** Compact Indian notation: ₹85K, ₹4.2L, ₹1.3Cr. */
export function formatINRCompact(value: number) {
  if (value >= 1_00_00_000) return `₹${trim(value / 1_00_00_000)}Cr`
  if (value >= 1_00_000) return `₹${trim(value / 1_00_000)}L`
  if (value >= 1_000) return `₹${trim(value / 1_000)}K`
  return `₹${value}`
}

function trim(n: number) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '')
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso))
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
