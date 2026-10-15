import { useCallback, useEffect, useRef, useState } from 'react'
import { byId, upsertAccount } from '@/data/mock'
import { api as client, ApiError, type Page } from './client'

export interface Loadable<T> {
  data: T | undefined
  error: ApiError | undefined
  loading: boolean
  reload: () => void
  setData: React.Dispatch<React.SetStateAction<T | undefined>>
}

/** Runs an API call when `deps` change; cancels stale calls. Pass `null` as `fn` to skip. */
export function useApi<T>(fn: ((signal: AbortSignal) => Promise<T>) | null, deps: unknown[]): Loadable<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<ApiError>()
  const [loading, setLoading] = useState(!!fn)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!fnRef.current) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    setError(undefined)
    fnRef.current(ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) setData(d) })
      .catch((e) => { if (!ctrl.signal.aborted && e.name !== 'AbortError') setError(e instanceof ApiError ? e : new ApiError(0, 'error', String(e))) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload, setData }
}

/** Cursor-paginated list: first page on mount / deps change, `more()` appends the next page. */
export function usePaged<Raw, T = Raw>(
  fn: ((cursor: string | undefined, signal?: AbortSignal) => Promise<Page<Raw>>) | null,
  map: (r: Raw) => T,
  deps: unknown[],
) {
  const [items, setItems] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [meta, setMeta] = useState<Record<string, unknown>>({})
  const [loadingMore, setLoadingMore] = useState(false)
  const mapRef = useRef(map)
  mapRef.current = map

  const first = useApi(fn ? (signal) => fn(undefined, signal) : null, deps)
  useEffect(() => {
    if (!first.data) return
    const { data, next_cursor, has_more, ...rest } = first.data
    setItems(data.map((r) => mapRef.current(r)))
    setCursor(next_cursor)
    setHasMore(has_more)
    setMeta(rest)
  }, [first.data])

  const more = useCallback(async () => {
    if (!fn || !cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fn(cursor)
      setItems((x) => [...x, ...page.data.map((r) => mapRef.current(r))])
      setCursor(page.next_cursor)
      setHasMore(page.has_more)
    } finally {
      setLoadingMore(false)
    }
  }, [fn, cursor, loadingMore])

  return { items, setItems, hasMore, more, loadingMore, meta, loading: first.loading, error: first.error, reload: first.reload }
}

/* ── Name resolution for contract parties ───────────────────────────────── */
// Contract responses carry only ids. Influencers and agents can be looked up by id, so unknown
// parties are resolved once (cached for the session) and registered for `acc()` / `partyName()`.

const resolving = new Map<string, Promise<void>>()

function resolveOne(id: string, kind: 'person' | 'agent'): Promise<void> {
  if (byId[id] || resolving.has(id)) return resolving.get(id) ?? Promise.resolve()
  const p = (async () => {
    try {
      if (kind === 'agent') {
        const a = await client.get<{ id: string; handle: string; name: string }>(`/marketplace/agents/${id}`)
        upsertAccount({ id, handle: a.handle, name: a.name, kind: 'agent', avatar: '', bio: '', verification: 'id', followersHuman: 0, followersAgent: 0, following: 0 })
      } else {
        const r = await client.get<{ handle: string; name: string }>(`/hire-me/influencers/${id}`)
          .catch(() => client.get<{ handle: string; name: string }>(`/likeness/influencers/${id}`))
        upsertAccount({ id, handle: r.handle, name: r.name, kind: 'human', avatar: '', bio: '', verification: 'none', followersHuman: 0, followersAgent: 0, following: 0 })
      }
    } catch { /* not resolvable; callers fall back to a role label */ }
  })()
  resolving.set(id, p)
  return p
}

/** Resolves the given person / agent ids; returns a counter that changes when names arrive. */
export function useParties(people: (string | null | undefined)[], agents: (string | null | undefined)[] = []) {
  const [version, setVersion] = useState(0)
  const key = [...people, '|', ...agents].join(',')
  useEffect(() => {
    const todo = [
      ...people.filter((id): id is string => !!id && !byId[id]).map((id) => resolveOne(id, 'person')),
      ...agents.filter((id): id is string => !!id && !byId[id]).map((id) => resolveOne(id, 'agent')),
    ]
    if (todo.length) void Promise.all(todo).then(() => setVersion((v) => v + 1))
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return version
}
