/* TechSync form embed. Standalone, dependency-free and isolated from the host site's CSS. */
;(() => {
  const script = document.currentScript
  if (!script || !script.dataset.form || !/^[a-zA-Z0-9_-]{22}$/.test(script.dataset.form)) return
  const key = script.dataset.form
  const origin = new URL(script.src, document.baseURI).origin
  const url = new URL(`/f/${encodeURIComponent(key)}`, origin)
  url.searchParams.set('embed', '1')
  url.searchParams.set('host_url', window.location.href)
  url.searchParams.set('host_referrer', document.referrer)
  const params = new URLSearchParams(window.location.search)
  for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    if (params.has(name)) url.searchParams.set(name, params.get(name))
  }
  const frame = document.createElement('iframe')
  frame.src = url.href
  frame.title = script.dataset.title || 'Contact enquiry form'
  frame.loading = 'lazy'
  frame.style.cssText = 'display:block;width:100%;height:760px;border:0;max-width:100%;color-scheme:light;'
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
  script.insertAdjacentElement('afterend', frame)
  const resize = (event) => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return
    const message = event.data
    if (!message || message.type !== 'techsync:resize' || message.key !== key || !Number.isFinite(message.height))
      return
    frame.style.height = `${Math.min(12000, Math.max(200, message.height))}px`
  }
  window.addEventListener('message', resize)
  const observer = new MutationObserver(() => {
    if (!frame.isConnected) {
      window.removeEventListener('message', resize)
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
})()
