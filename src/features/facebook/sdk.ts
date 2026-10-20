import type { FacebookSdkConfiguration } from './api'
export type FacebookLoginStatus = 'connected' | 'not_authorized' | 'unknown'
export interface FacebookLoginResponse {
  status?: FacebookLoginStatus
  authResponse?: { accessToken?: string; userID?: string; signedRequest?: string; expiresIn?: number }
}
export interface FacebookSdk {
  init(options: { appId: string; version: string; cookie: boolean; xfbml: boolean; autoLogAppEvents: boolean; status: boolean }): void
  getLoginStatus(callback: (response: FacebookLoginResponse) => void): void
  login(callback: (response: FacebookLoginResponse) => void, options: { config_id?: string; scope?: string; auth_type?: string; return_scopes?: boolean }): void
}
declare global {
  interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void }
}
const SCRIPT_ID = 'facebook-jssdk'
const SCRIPT_URL = 'https://connect.facebook.net/en_US/sdk.js'
let initializedFor: string | null = null
let loading: Promise<FacebookSdk> | null = null

/** One asynchronous SDK script per document; retries after network/ad-blocker failures. */
export function loadFacebookSdk(config: FacebookSdkConfiguration): Promise<FacebookSdk> {
  if (window.location.protocol !== 'https:') return Promise.reject(new Error('Facebook SDK login requires HTTPS. Open the app through your HTTPS development tunnel.'))
  const identity = `${config.appId}:${config.version}`
  if (initializedFor && initializedFor !== identity) return Promise.reject(new Error('Facebook app configuration changed. Reload the page before connecting.'))
  const initialize = () => {
    if (!window.FB) throw new Error('The Facebook SDK did not initialize. Use redirect login or allow the SDK to load.')
    if (!initializedFor) {
      window.FB.init({ appId: config.appId, version: config.version, cookie: true, xfbml: false, autoLogAppEvents: false, status: false })
      initializedFor = identity
    }
    return window.FB
  }
  if (window.FB) { try { return Promise.resolve(initialize()) } catch (err) { return Promise.reject(err) } }
  if (loading) return loading.then(() => initialize())
  const pending = new Promise<FacebookSdk>((resolve, reject) => {
    let settled = false
    const existing = document.getElementById(SCRIPT_ID)
    if (existing && (!(existing instanceof HTMLScriptElement) || existing.src !== SCRIPT_URL)) { reject(new Error('An incompatible Facebook SDK script is already loaded. Reload the page.')); return }
    const script = (existing as HTMLScriptElement | null) ?? document.createElement('script')
    const previous = window.fbAsyncInit
    const cleanup = () => { window.clearTimeout(timer); script.removeEventListener('load', ready); script.removeEventListener('error', failed); if (window.fbAsyncInit === onInitialize) window.fbAsyncInit = previous }
    const fail = () => { if (settled) return; settled = true; cleanup(); script.remove(); reject(new Error('Facebook SDK could not load. Use redirect login or check browser tracking protection.')) }
    const failed = () => fail()
    const ready = () => {
      if (settled) return
      try { const sdk = initialize(); settled = true; cleanup(); resolve(sdk) }
      catch { fail() }
    }
    const onInitialize = () => { try { previous?.() } finally { ready() } }
    const timer = window.setTimeout(fail, 15000)
    window.fbAsyncInit = onInitialize
    script.addEventListener('load', ready)
    script.addEventListener('error', failed)
    if (!existing) { script.id = SCRIPT_ID; script.src = SCRIPT_URL; script.async = true; script.defer = true; script.crossOrigin = 'anonymous'; document.head.appendChild(script) }
  })
  loading = pending
  void pending.catch(() => { if (loading === pending) loading = null })
  return pending
}

/** Expose only status to React state; never retain/log authResponse access tokens. */
export function facebookLoginStatus(sdk: FacebookSdk): Promise<FacebookLoginStatus> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve('unknown'), 15000)
    try { sdk.getLoginStatus((response) => { window.clearTimeout(timer); resolve(response.status === 'connected' || response.status === 'not_authorized' ? response.status : 'unknown') }) }
    catch { window.clearTimeout(timer); resolve('unknown') }
  })
}
