import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'link'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-60 active:translate-y-px'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_2px_rgb(16_24_40/0.12)] hover:bg-brand-700',
  dark: 'bg-zinc-900 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_1px_2px_rgb(16_24_40/0.12)] hover:bg-zinc-800',
  secondary: 'bg-white text-zinc-900 ring-1 ring-zinc-200 ring-inset shadow-card hover:bg-zinc-50 hover:ring-zinc-300',
  ghost: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900',
  link: 'text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline px-0! h-auto!',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-10 rounded-lg px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-[15px]',
}

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

type ButtonAsButton = CommonProps & ComponentProps<'button'> & { to?: never; href?: never; loading?: boolean }
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, 'className'> & { to: string; href?: never }
type ButtonAsAnchor = CommonProps & ComponentProps<'a'> & { href: string; to?: never }

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor

function buttonClasses({ variant = 'primary', size = 'md', className }: Partial<CommonProps>) {
  return cn(base, variants[variant], sizes[size], className)
}

/** Renders a router Link (`to`), an anchor (`href`) or a button, with shared styling. */
export function Button(props: ButtonProps) {
  const { variant, size, className, children } = props
  const classes = buttonClasses({ variant, size, className })

  if ('to' in props && props.to !== undefined) {
    const { variant: _v, size: _s, className: _c, ...rest } = props as ButtonAsLink
    return (
      <Link {...rest} className={classes}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, ...rest } = props as ButtonAsAnchor
    return (
      <a {...rest} className={classes}>
        {children}
      </a>
    )
  }

  const { variant: _v, size: _s, className: _c, loading, type = 'button', disabled, ...rest } = props as ButtonAsButton
  return (
    <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
