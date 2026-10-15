/**
 * Wamiwa API client.
 *
 * - Every response is `{ success, data }` or `{ success: false, error, code, hint }`; `request` unwraps
 *   the first and throws `ApiError` for the second.
 * - Access tokens last 15 minutes. A 401 triggers one refresh with the stored refresh token, then a retry.
 * - Writes carry an `Idempotency-Key` (API-00) so a retried request never acts twice.
 */

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8001'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public hint?: string,
    /** Extra fields from the error body, e.g. `attempts_left` or `fields` for validation errors. */
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
  /** First field-level validation message, if any. */
  get fieldMessage() {
    const f = (this.details.fields as { field: string; message: string }[] | undefined)?.[0]
    return f ? `${f.field.replace(/_/g, ' ')}: ${f.message}` : undefined
  }
}

export interface Page<T> {
  data: T[]
  next_cursor: string | null
  has_more: boolean
  count?: number
  [extra: string]: unknown
}

interface Tokens { access: string; refresh: string }
const KEY = 'wamiwa.auth'

let tokens: Tokens | null = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Tokens | null } catch { return null }
})()
const listeners = new Set<() => void>()

export const auth = {
  get tokens() { return tokens },
  set(t: Tokens | null) {
    tokens = t
    try { t ? localStorage.setItem(KEY, JSON.stringify(t)) : localStorage.removeItem(KEY) } catch { /* private mode */ }
    listeners.forEach((l) => l())
  },
  onChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
}

let refreshing: Promise<boolean> | null = null
async function refresh(): Promise<boolean> {
  if (!tokens?.refresh) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: tokens!.refresh }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) { auth.set(null); return false }
      auth.set({ access: body.data.access_token, refresh: body.data.refresh_token ?? tokens!.refresh })
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => { refreshing = null })
    }
  })()
  return refreshing
}

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  query?: Query
  body?: unknown
  form?: FormData
  /** Return the whole envelope (for paginated lists). */
  raw?: boolean
  signal?: AbortSignal
}

function url(path: string, query?: Query) {
  const u = new URL(API_URL + path)
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  return u.toString()
}

async function send<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {}
  if (tokens?.access) headers.authorization = `Bearer ${tokens.access}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') headers['idempotency-key'] = crypto.randomUUID()

  let res: Response
  try {
    res = await fetch(url(path, opts.query), {
      method, headers, signal: opts.signal,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'network', 'Can’t reach Wamiwa. Check your connection and that the API is running.')
  }

  if (res.status === 401 && !retried && tokens?.refresh && !path.startsWith('/auth/')) {
    if (await refresh()) return send<T>(method, path, opts, true)
  }
  // Rate limited: reads wait for Retry-After (up to 5s) and try once more. Writes are never replayed here.
  if (res.status === 429 && method === 'GET' && !retried) {
    const wait = Math.min(5, Number(res.headers.get('retry-after') ?? 1)) * 1000
    await new Promise((r) => setTimeout(r, wait))
    return send<T>(method, path, opts, true)
  }

  const isJson = res.headers.get('content-type')?.includes('json')
  const body = isJson ? await res.json() : await res.text()
  if (!res.ok || (isJson && body.success === false)) {
    const { success: _s, error, code, hint, ...details } = isJson ? body : ({} as Record<string, unknown>)
    void _s
    throw new ApiError(res.status, (code as string) ?? 'error', (error as string) ?? `Request failed (${res.status})`, hint as string | undefined, details)
  }
  if (!isJson) return body as T
  return (opts.raw ? body : body.data) as T
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => send<T>('GET', path, { query, signal }),
  page: <T>(path: string, query?: Query, signal?: AbortSignal) => send<Page<T>>('GET', path, { query, raw: true, signal }),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => send<T>('PUT', path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => send<T>('PATCH', path, { body: body ?? {} }),
  del: <T>(path: string, body?: unknown) => send<T>('DELETE', path, body === undefined ? {} : { body }),
  upload: <T>(path: string, form: FormData) => send<T>('POST', path, { form }),
  /** Any method with query parameters (some endpoints take their options in the query string). */
  call: <T>(method: string, path: string, opts: RequestOptions = {}) => send<T>(method, path, opts),
}

/** Absolute URL for a media ref returned by the API (`/media/...` or a stored ref). */
export function mediaUrl(ref: string | null | undefined) {
  if (!ref) return undefined
  if (/^https?:\/\//.test(ref) || ref.startsWith('data:')) return ref
  return ref.startsWith('/') ? API_URL + ref : `${API_URL}/media/${ref}`
}

export const cents = (c: number | null | undefined) => (c ?? 0) / 100
