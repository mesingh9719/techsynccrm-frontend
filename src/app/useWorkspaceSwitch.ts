import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createOrganization, switchOrganization } from '../services/organizations'
import type { CreateWorkspaceValues } from '../lib/schemas'

/**
 * Switching workspace: get a token for the new workspace, drop every cached query (so nothing from
 * the previous workspace can render), then land on its home page.
 */
export function useWorkspaceSwitch() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const switchTo = useCallback(
    async (organizationId: string) => {
      await switchOrganization(organizationId)
      queryClient.clear()
      navigate('/app', { replace: true })
    },
    [queryClient, navigate],
  )

  const createAndSwitch = useCallback(
    async (values: CreateWorkspaceValues) => {
      await createOrganization(values)
      queryClient.clear()
      navigate('/app', { replace: true, state: { newWorkspace: true } })
    },
    [queryClient, navigate],
  )

  return { switchTo, createAndSwitch }
}
