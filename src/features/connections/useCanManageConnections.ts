import { useCan } from '../../lib/useOrg'

/** Owners/admins who manage either team Gmail or team Google connections see the Team tab. */
export function useCanManageConnections() {
  const google = useCan('google.connections.manage'), email = useCan('email.connections.manage')
  return google || email
}
