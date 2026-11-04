import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useOrgId } from '../crm/hooks'
import { googleKey, googleMe } from './api'

/** The signed-in member's Google tools state (shares its cache key with the service gates). */
export const useGoogleState = () => {
  const orgId = useOrgId(), { user } = useAuth()
  return useQuery({ queryKey: [...googleKey(orgId), 'me', user?.id], queryFn: googleMe })
}
