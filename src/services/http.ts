/**
 * HTTP client for the TechSync API, plus the in-memory auth session.
 *
 * - The access token (short-lived JWT) lives in memory only — never localStorage.
 * - The refresh token is an httpOnly cookie the browser sends to /api/auth automatically.
 * - On a 401 TOKEN_EXPIRED the client refreshes once (shared across parallel calls) and retries.
 */
import type { AuthUser } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  /** Per-field validation messages from the server, keyed by field name. */
  readonly fields: Record<string, string>
  readonly retryAfter?: number
  /** Raw `error.details` from the server (e.g. the current record on STALE_UPDATE). */
  readonly details?: Record<string, unknown>

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    const fields = { ...((details?.fields as Record<string, string>) ?? {}) }
    if (typeof details?.field === 'string') fields[details.field] = message
    this.fields = fields
    this.retryAfter = typeof details?.retryAfter === 'number' ? details.retryAfter : undefined
  }
}

// ---------- Session store (read in React via useAuth) ----------

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

let accessToken: string | null = null
let state: AuthState = { status: 'loading', user: null }
const listeners = new Set<() => void>()

function emit(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}

export const authStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export interface SessionPayload {
  user: AuthUser
  accessToken: string
}

export function setSession({ user, accessToken: token }: SessionPayload) {
  accessToken = token
  emit({ status: 'authenticated', user })
}

export function updateSessionUser(user: AuthUser) {
  emit({ status: 'authenticated', user })
}

export function clearSession() {
  accessToken = null
  emit({ status: 'anonymous', user: null })
}

// ---------- Requests ----------

type QueryValue = string | number | boolean | null | undefined | Array<string | number>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON-serialisable value, or FormData (sent as multipart, without a JSON content type). */
  body?: unknown
  /** Query-string parameters. Arrays become comma lists; null/undefined/'' are dropped. */
  query?: Record<string, QueryValue>
  /** Optimistic concurrency: the `updatedAt` the client last saw. A mismatch returns 409 STALE_UPDATE. */
  ifMatch?: string
  /** Set false for endpoints that must not trigger a token refresh (login, refresh itself). */
  retryOnExpiry?: boolean
  /** Cancels the request; the promise then rejects with the browser's AbortError (not an ApiError). */
  signal?: AbortSignal
}

/** `/leads` + { status: ['new', 'contacted'], q: '' } → `/api/leads?status=new%2Ccontacted` */
export function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else params.set(key, String(value))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`
}

async function send(path: string, { method = 'GET', body, query, ifMatch, signal }: RequestOptions): Promise<Response> {
  const isForm = body instanceof FormData
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (ifMatch) headers['If-Match'] = ifMatch
  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError('Can’t reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR')
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    const error = json?.error ?? {}
    throw new ApiError(error.message ?? `Request failed (${res.status})`, res.status, error.code, error.details)
  }
  return json?.data as T
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options)
  if (res.status === 401 && options.retryOnExpiry !== false && accessToken) {
    const body = await res.clone().json().catch(() => null)
    if (body?.error?.code === 'TOKEN_EXPIRED' && (await refreshSession())) {
      return parse<T>(await send(path, options))
    }
  }
  return parse<T>(res)
}

// ---------- Refresh (single-flight) ----------

let refreshInFlight: Promise<boolean> | null = null

/**
 * Exchanges the refresh cookie for a new access token. Parallel callers share one request.
 * Returns false (and clears the session) when there is no valid session.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await parse<SessionPayload>(await send('/auth/refresh', { method: 'POST' }))
        setSession(data)
        return true
      } catch (err) {
        // Another tab rotated the cookie a moment ago; the browser now has the new one — retry.
        if (err instanceof ApiError && err.code === 'REFRESH_TOKEN_SUPERSEDED' && attempt === 0) {
          await new Promise((r) => setTimeout(r, 250))
          continue
        }
        if (err instanceof ApiError && err.code === 'NETWORK_ERROR' && state.status !== 'loading') throw err
        clearSession()
        return false
      }
    }
    clearSession()
    return false
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

// ---------- Uploads (with progress) ----------

export interface UploadOptions {
  /** Extra multipart fields sent with the file. */
  fields?: Record<string, string>
  /** Form field name for the file (the backend expects "file"). */
  fieldName?: string
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

function xhrUpload(path: string, file: Blob, { fields, fieldName = 'file', onProgress, signal }: UploadOptions) {
  return new Promise<{ status: number; json: { success?: boolean; data?: unknown; error?: { message?: string; code?: string; details?: Record<string, unknown> } } | null }>(
    (resolve, reject) => {
      const form = new FormData()
      for (const [key, value] of Object.entries(fields ?? {})) form.append(key, value)
      form.append(fieldName, file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', buildUrl(path))
      xhr.withCredentials = true
      xhr.setRequestHeader('Accept', 'application/json')
      if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () => {
        let json = null
        try {
          json = JSON.parse(xhr.responseText)
        } catch {
          /* non-JSON response */
        }
        resolve({ status: xhr.status, json })
      }
      xhr.onerror = () => reject(new ApiError('Can’t reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR'))
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
      signal?.addEventListener('abort', () => xhr.abort(), { once: true })
      xhr.send(form)
    },
  )
}

/** Uploads a file as multipart/form-data, reporting progress (0–1). Refreshes an expired token once. */
export async function upload<T>(path: string, file: Blob, options: UploadOptions = {}): Promise<T> {
  let res = await xhrUpload(path, file, options)
  if (res.status === 401 && res.json?.error?.code === 'TOKEN_EXPIRED' && accessToken && (await refreshSession())) {
    res = await xhrUpload(path, file, options)
  }
  if (res.status < 200 || res.status >= 300 || res.json?.success === false) {
    const error = res.json?.error ?? {}
    throw new ApiError(error.message ?? `Upload failed (${res.status})`, res.status, error.code, error.details)
  }
  return res.json?.data as T
}
