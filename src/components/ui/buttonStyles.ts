import { cn } from '../../lib/cn'

/**
 * primary — brand, tactile (tone shift, inner highlight, darker edge)   · secondary — surface + border + light shadow
 * outline — border only, no fill or shadow                               · soft — tinted brand background
 * ghost — no chrome until hover                                          · danger — destructive actions
 * dark — legacy alias of primary                                         · link — inline text link
 */
export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg'

const base =
  'btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-60'

// Tailwind classes are the marketing-site look; inside the workspace, index.css (.btn-*) layers the
// custom system on top. Keeping both means one component serves both surfaces.
const variants: Record<ButtonVariant, string> = {
  primary: 'btn-primary bg-action text-white hover:bg-action-hover',
  dark: 'btn-primary bg-action text-white hover:bg-action-hover',
  secondary: 'btn-secondary bg-surface text-ink ring-1 ring-line ring-inset hover:bg-surface-subtle',
  outline: 'btn-outline text-ink ring-1 ring-line ring-inset hover:bg-surface-subtle',
  soft: 'btn-soft bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'btn-danger bg-danger-action text-white hover:bg-danger-action-hover',
  ghost: 'btn-ghost text-muted hover:bg-surface-subtle hover:text-ink',
  link: 'btn-link text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline px-0! h-auto!',
}

/** Heights come from CSS variables: the workspace runs sm 30 · md 34 · lg 40px (index.css); the
 *  marketing site keeps its 32/40/44px defaults. */
const sizes: Record<Size, string> = {
  sm: 'btn-sm h-[var(--btn-sm,2rem)] rounded-control px-[var(--btn-sm-px,0.75rem)] text-[length:var(--btn-fs,0.875rem)]',
  md: 'btn-md h-[var(--btn-md,2.5rem)] rounded-control px-[var(--btn-md-px,1rem)] text-[length:var(--btn-fs,0.875rem)]',
  lg: 'btn-lg h-[var(--btn-lg,2.75rem)] rounded-control px-5 text-sm',
}
const iconSizes: Record<Size, string> = {
  sm: 'w-[var(--btn-sm,2rem)] px-0!',
  md: 'w-[var(--btn-md,2.5rem)] px-0!',
  lg: 'w-[var(--btn-lg,2.75rem)] px-0!',
}

export interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: Size
  /** Square, icon-only button. Give it an aria-label. */
  icon?: boolean
  className?: string
}

export function buttonClasses({ variant = 'primary', size = 'md', icon = false, className }: ButtonStyleProps) {
  return cn(base, variants[variant], sizes[size], icon && cn('btn-icon', iconSizes[size]), className)
}

