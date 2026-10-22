import { useMemo } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { handleGlobalApiError } from '../../../lib/apiErrors'
import { qk } from '../../../lib/queryKeys'
import { useAuth } from '../../../lib/useAuth'
import { useCan, useOrg } from '../../../lib/useOrg'
import { ApiError } from '../../../services/http'
import { useToast } from '../../../components/ui/Toast'
import { listTasks } from '../../activities/api'
import { useOrgId } from '../../crm/hooks'
import type { LeadRecord, LeadStatus } from '../../crm/types'
import { getLead, updateLead, type LeadInput } from '../api'

export const FROZEN: LeadStatus[] = ['converted', 'lost', 'junk']

/** Everything the lead page needs: the record, what the member may do, and save helpers. */
export function useLeadDetail(id: string) {
  const orgId = useOrgId()
  const { user } = useAuth()
  const { organization } = useOrg()
  const client = useQueryClient()
  const notify = useToast()
  const query = useQuery({ queryKey: qk.org(orgId).leads.detail(id), queryFn: () => getLead(id) })
  const canUpdateAny = useCan('leads.update')
  const canDeleteAny = useCan('leads.delete')
  const canAssign = useCan('records.assign')
  const canTasks = useCan('tasks.read')
  const canCreateTasks = useCan('tasks.create')
  const taskParams = { view: 'open' as const, entityType: 'lead' as const, entityId: id, limit: 50 }
  const taskQuery = useInfiniteQuery({
    queryKey: qk.org(orgId).taskList(taskParams),
    queryFn: ({ pageParam }) => listTasks({ ...taskParams, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: canTasks,
  })
  const taskItems = useMemo(() => taskQuery.data?.pages.flatMap((page) => page.items), [taskQuery.data])
  const tasks = { ...taskQuery, data: taskItems }

  const lead = query.data
  const permissions = user?.organization?.permissions ?? []
  const ownScoped = (action: string) => Boolean(lead) && permissions.includes(`leads.${action}.own`) && lead!.ownerId !== user?.id
  const isOpen = Boolean(lead) && !FROZEN.includes(lead!.status)
  const can = {
    update: Boolean(lead) && canUpdateAny && !ownScoped('update') && !lead!.deletedAt && lead!.status !== 'converted',
    delete: canDeleteAny && !ownScoped('delete'),
    assign: canAssign && isOpen && !lead?.deletedAt,
    claim:
      Boolean(lead) &&
      !lead!.ownerId &&
      !lead!.deletedAt &&
      isOpen &&
      permissions.some((p) => p === 'records.claim' || p.startsWith('records.assign')),
    tasks: canTasks && lead?.status !== 'converted' && !lead?.deletedAt,
    createTasks: canCreateTasks && lead?.status !== 'converted' && !lead?.deletedAt,
  }

  const setLead = (value: LeadRecord) => client.setQueryData(qk.org(orgId).leads.detail(id), value)
  const refreshLists = () => client.invalidateQueries({ queryKey: qk.org(orgId).leads.lists })
  const refreshAll = () => client.invalidateQueries({ queryKey: qk.org(orgId).leads.all })

  /** Inline field save. Throws an Error with a user-facing message (InlineText shows it). */
  async function patch(values: Omit<LeadInput, 'ownerId'>) {
    if (!lead) return
    const key = qk.org(orgId).leads.detail(id)
    await client.cancelQueries({ queryKey: key })
    const previous = client.getQueryData<LeadRecord>(key) ?? lead
    // Contact points and tag relations need server normalization; scalar facts can update now.
    const { emails: _emails, phones: _phones, tagIds: _tags, ...scalars } = values
    setLead({ ...previous, ...scalars })
    try {
      setLead(await updateLead(lead.id, values, { ifMatch: previous.updatedAt }))
      notify({ title: 'Lead details saved' })
      await refreshLists()
      // Campaign attribution lives in utm/sourceDetail; campaign pages count leads from it.
      if ('utm' in values || 'sourceDetail' in values)
        await Promise.all(
          ['campaigns', 'campaign', 'campaign-leads'].map((k) => client.invalidateQueries({ queryKey: ['org', orgId, k] })),
        )
    } catch (err) {
      setLead(previous)
      if (err instanceof ApiError && err.code === 'STALE_UPDATE') {
        await refreshAll()
        throw new Error('Someone else just changed this lead — refreshed, please try again')
      }
      if (handleGlobalApiError(err)) throw new Error('Not saved')
      notify({ tone: 'error', title: 'Details were not saved', description: err instanceof Error ? err.message : undefined })
      throw new Error(err instanceof ApiError ? (Object.values(err.fields)[0] ?? err.message) : 'Couldn’t save')
    }
  }

  /** One-shot record action (claim, status, restore…) with a toast either way. */
  async function act(fn: () => Promise<LeadRecord>, success: string) {
    try {
      setLead(await fn())
      await Promise.all([refreshLists(), client.invalidateQueries({ queryKey: qk.org(orgId).timelineAll })])
      notify({ title: success })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ASSIGNED') await refreshAll()
      if (!handleGlobalApiError(err))
        notify({ tone: 'error', title: 'Couldn’t do that', description: err instanceof ApiError ? err.message : undefined })
      return false
    }
  }

  return { query, lead, tasks, can, isOpen, patch, act, setLead, refreshAll, user, timezone: organization?.timezone ?? 'Asia/Kolkata' }
}

export type LeadDetail = ReturnType<typeof useLeadDetail>
