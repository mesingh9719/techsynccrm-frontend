import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../lib/useAuth'
import { useOrg } from '../../lib/useOrg'
import { useToast } from '../../components/ui/Toast'
import { authStore } from '../../services/http'
import { startNotificationConnection } from './notificationConnection'
import { createStreamTicket, getUnreadCount, listNotifications, notificationKeys, notificationStreamUrl } from './api'

export function useNotificationCount() {
  const { user } = useAuth()
  const { organization } = useOrg()
  return useQuery({
    queryKey: notificationKeys(user?.organization?.id ?? 'none', user?.id ?? 'none').count,
    queryFn: getUnreadCount,
    enabled: Boolean(user?.organization),
    refetchOnWindowFocus: true,
    ...(organization?.unreadNotificationCount !== undefined && {
      initialData: { unreadCount: organization.unreadNotificationCount },
    }),
  })
}

/** One stream per mounted workspace shell. Polling remains active while SSE reconnects. */
export function useNotificationStream() {
  const { user } = useAuth()
  const orgId = user?.organization?.id
  const userId = user?.id
  const queryClient = useQueryClient()
  const notify = useToast()
  useNotificationCount()
  useEffect(() => {
    if (!orgId || !userId) return
    const keys = notificationKeys(orgId, userId)
    const startedAt = Date.now()
    const toasted = new Set<string>()
    let checking = false
    const active = () =>
      authStore.getState().user?.id === userId && authStore.getState().user?.organization?.id === orgId
    async function changed(count: number) {
      if (!active()) return
      queryClient.setQueryData(keys.count, { unreadCount: count })
      void queryClient.invalidateQueries({ queryKey: keys.preview })
      void queryClient.invalidateQueries({ queryKey: [...keys.all, 'list'] })
      if (checking || !count) return
      checking = true
      try {
        const page = await listNotifications({ unread: true, limit: 20 })
        if (!active()) return
        for (const item of page.items) {
          if (
            !['mention', 'task_reminder', 'lead_assigned', 'new_unassigned_lead'].includes(item.type) ||
            new Date(item.createdAt).getTime() < startedAt ||
            toasted.has(item.id)
          )
            continue
          toasted.add(item.id)
          notify({ title: item.title, description: item.body ?? undefined })
        }
      } catch {
        /* The ordinary inbox/count queries expose network errors and retry. */
      } finally {
        checking = false
      }
    }
    return startNotificationConnection({
      requestTicket: createStreamTicket,
      makeUrl: notificationStreamUrl,
      isActive: active,
      onNotification: (count) => {
        void changed(count)
      },
      onPoll: async () => {
        const { unreadCount } = await queryClient.fetchQuery({
          queryKey: keys.count,
          queryFn: getUnreadCount,
          staleTime: 0,
        })
        await changed(unreadCount)
      },
      ...(typeof EventSource !== 'undefined' && {
        createSource: (url: string) => new EventSource(url, { withCredentials: true }),
      }),
    })
  }, [orgId, userId, queryClient, notify])
}
