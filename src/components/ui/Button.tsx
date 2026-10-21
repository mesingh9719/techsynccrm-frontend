import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-60 active:translate-y-px'

const variants: Record<Variant, string> = {
  primary:
    'bg-action text-white shadow-card hover:bg-action-hover',
  dark: 'bg-action text-white shadow-card hover:bg-action-hover',
  secondary: 'bg-surface text-ink ring-1 ring-line ring-inset shadow-card hover:bg-surface-subtle hover:ring-brand-300',
  danger: 'bg-danger-action text-white shadow-card hover:bg-danger-action-hover',
  ghost: 'text-muted hover:bg-surface-subtle hover:text-ink',
  link: 'text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline px-0! h-auto!',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-10 rounded-lg px-4 text-sm',
  lg: 'h-11 rounded-control px-5 text-sm',
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
