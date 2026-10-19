type Source = Pick<EventSource, 'onmessage' | 'onerror' | 'close'>
interface ConnectionOptions {
  requestTicket: (signal: AbortSignal) => Promise<{ ticket: string }>
  makeUrl: (ticket: string) => string
  isActive: () => boolean
  onNotification: (count: number) => void
  onPoll: () => void | Promise<unknown>
  createSource?: (url: string) => Source
}

/** The transport owns cleanup and fresh-ticket reconnects, plus polling when SSE is unavailable. */
export function startNotificationConnection(options: ConnectionOptions) {
  const controller = new AbortController()
  let source: Source | null = null
  let reconnect: ReturnType<typeof setTimeout> | undefined
  const active = () => !controller.signal.aborted && options.isActive()
  function retry() {
    source?.close(); source = null
    clearTimeout(reconnect)
    if (active()) reconnect = setTimeout(() => { void connect() }, 10_000)
  }
  async function connect() {
    if (!active() || !options.createSource) return
    try {
      const { ticket } = await options.requestTicket(controller.signal)
      if (!active()) return
      source = options.createSource(options.makeUrl(ticket))
      source.onmessage = (event) => {
        if (!active()) return
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'notification' && Number.isSafeInteger(payload.unreadCount) && payload.unreadCount >= 0) options.onNotification(payload.unreadCount)
        } catch { /* A malformed frame must not break polling or reconnects. */ }
      }
      source.onerror = retry
    } catch { retry() }
  }
  const poll = setInterval(() => {
    if (active()) void Promise.resolve(options.onPoll()).catch(() => {})
  }, 60_000)
  void connect()
  return () => { controller.abort(); clearTimeout(reconnect); clearInterval(poll); source?.close() }
}
