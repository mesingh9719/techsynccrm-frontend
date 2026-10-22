import { UnsavedChangesProvider } from './UnsavedChangesProvider'
import { Outlet } from 'react-router-dom'
import { GlobalUi } from './GlobalUi'

/** Root element shared by every route: renders the page plus dialogs/toasts raised from outside React. */
export function RootShell() {
  return (
    <UnsavedChangesProvider>
      <Outlet />
      <GlobalUi />
    </UnsavedChangesProvider>
  )
}
