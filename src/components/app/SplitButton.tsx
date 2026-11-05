import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { ButtonGroup } from '../ui/Button'
import { buttonClasses, type ButtonVariant } from '../ui/buttonStyles'
import { Menu } from './Menu'

/**
 * A main action with a dropdown of related actions, e.g. "Save" + "Save and add another".
 * Put `MenuItem`s in `menu`; `close` dismisses the menu.
 */
export function SplitButton({ children, onClick, menu, menuLabel = 'More options', variant = 'primary', size = 'md', disabled }: {
  children: ReactNode
  onClick: () => void
  menu: (close: () => void) => ReactNode
  menuLabel?: string
  variant?: Extract<ButtonVariant, 'primary' | 'secondary' | 'outline' | 'soft'>
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}) {
  return (
    <ButtonGroup className="btn-split">
      <button type="button" disabled={disabled} onClick={onClick} className={buttonClasses({ variant, size })}>
        {children}
      </button>
      <Menu
        align="end"
        trigger={(props) => (
          <button {...props} type="button" disabled={disabled} aria-label={menuLabel} title={menuLabel} className={buttonClasses({ variant, size, icon: true, className: 'btn-split-toggle' })}>
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        )}
      >
        {menu}
      </Menu>
    </ButtonGroup>
  )
}
