import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

import { buttonClasses, type ButtonStyleProps } from './buttonStyles'

export type { ButtonVariant } from './buttonStyles'

type CommonProps = ButtonStyleProps & { children: ReactNode }

type ButtonAsButton = CommonProps & ComponentProps<'button'> & { to?: never; href?: never; loading?: boolean }
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, 'className'> & { to: string; href?: never }
type ButtonAsAnchor = CommonProps & ComponentProps<'a'> & { href: string; to?: never }

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor

/** Renders a router Link (`to`), an anchor (`href`) or a button, with shared styling. */
export function Button(props: ButtonProps) {
  const { variant, size, icon, className, children } = props
  const classes = buttonClasses({ variant, size, icon, className })

  if ('to' in props && props.to !== undefined) {
    const { variant: _v, size: _s, icon: _i, className: _c, ...rest } = props as ButtonAsLink
    return (
      <Link {...rest} title={rest.title ?? rest['aria-label']} className={classes}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href !== undefined) {
    const { variant: _v, size: _s, icon: _i, className: _c, ...rest } = props as ButtonAsAnchor
    return (
      <a {...rest} title={rest.title ?? rest['aria-label']} className={classes}>
        {children}
      </a>
    )
  }

  const { variant: _v, size: _s, icon: _i, className: _c, loading, type = 'button', disabled, ...rest } = props as ButtonAsButton
  return (
    <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading || undefined} title={rest.title ?? rest['aria-label']} className={classes}>
      {/* The label keeps its space while loading, so the button never changes width. */}
      <span className={cn('inline-flex items-center justify-center gap-[inherit]', loading && 'invisible')}>{children}</span>
      {loading && <LoaderCircle className="absolute inset-0 m-auto size-4 animate-spin" aria-hidden="true" />}
    </button>
  )
}

/** Joins buttons into one control (shared borders, outer corners only). */
export function ButtonGroup({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn('btn-group inline-flex', className)}>
      {children}
    </div>
  )
}
