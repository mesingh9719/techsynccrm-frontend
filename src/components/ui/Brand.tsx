import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <path d="M9 11.5h14" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 11.5v11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="21.5" r="2.4" fill="#6e8cf6" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2 rounded-md', className)} aria-label="TechSync CRM home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-zinc-950">
        TechSync<span className="ml-1 font-normal text-zinc-500">CRM</span>
      </span>
    </Link>
  )
}

const socialPaths: Record<string, string> = {
  linkedin:
    'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.5 4.77 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.95 1.3-1.95 2.66v5.14H9.5v-11Z',
  x: 'M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z',
  youtube:
    'M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81ZM10 15V9l5.2 3-5.2 3Z',
}

export function SocialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', className)} fill="currentColor" aria-hidden="true">
      <path d={socialPaths[name] ?? ''} />
    </svg>
  )
}

/** Monogram tile standing in for third-party logos (we don't ship trademarks). */
export function Monogram({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const letters = name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  const sizes = { sm: 'size-8 rounded-lg text-xs', md: 'size-11 rounded-xl text-sm', lg: 'size-14 rounded-2xl text-base' }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center font-semibold text-white shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]', sizes[size])}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {letters}
    </span>
  )
}

const coverPalettes: Record<string, [string, string, string]> = {
  'Sales playbooks': ['#eef2ff', '#3349df', '#c6d4fe'],
  'Product updates': ['#f0fdf4', '#15803d', '#bbf7d0'],
  Growth: ['#fff7ed', '#c2410c', '#fed7aa'],
  'Customer stories': ['#faf5ff', '#7e22ce', '#e9d5ff'],
}

/** Generated, category-coloured cover art for blog posts — no stock imagery. */
export function PostCover({ category, seed, className }: { category: string; seed: string; className?: string }) {
  const [bg, ink, soft] = coverPalettes[category] ?? ['#f4f4f5', '#3f3f46', '#e4e4e7']
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
  const bars = Array.from({ length: 7 }, (_, i) => 18 + ((n * (i + 3)) % 46))
  return (
    <svg viewBox="0 0 400 225" className={cn('h-full w-full', className)} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="225" fill={bg} />
      <g opacity="0.55">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="225" stroke={soft} strokeWidth="1" />
        ))}
      </g>
      <circle cx={300 + (n % 40)} cy={70 + (n % 30)} r="56" fill={soft} />
      {bars.map((h, i) => (
        <rect key={i} x={48 + i * 30} y={180 - h * 1.6} width="16" height={h * 1.6} rx="4" fill={i === bars.length - 1 ? ink : soft} />
      ))}
      <rect x="48" y="186" width="210" height="2" fill={ink} opacity="0.25" />
    </svg>
  )
}
