import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account } from '@/data/types'
import { api, ApiError, auth } from '@/api/client'
import { fromMe } from '@/api/adapt'
import type { LoginDto, MeDto } from '@/api/types'

export type Role = 'influencer' | 'minor' | 'guardian' | 'company' | 'agent_owner' | 'admin' | 'super_admin'

/** Demo accounts created by the backend's `seed-demo` (password `wamiwa-demo-2026`). */
export const DEMO_PASSWORD = 'wamiwa-demo-2026'
export const ROLES: { value: Role; label: string; email: string; blurb: string }[] = [
  { value: 'influencer', label: 'Influencer', email: 'kemi@example.com', blurb: 'Kemi · Verified creator, 18+' },
  { value: 'minor', label: 'Minor (13–17)', email: 'kiki@example.com', blurb: 'Kiki · linked to a guardian' },
  { value: 'guardian', label: 'Guardian', email: 'kola@example.com', blurb: 'Kola · manages Kiki' },
  { value: 'company', label: 'Company / Brand', email: 'zurihouse@example.com', blurb: 'Zuri Fashion House · verified' },
  { value: 'agent_owner', label: 'Agent owner', email: 'zainab@example.com', blurb: 'Zainab · owns Scribe & Lens' },
  { value: 'admin', label: 'Admin', email: 'grace@example.com', blurb: 'Grace · needs an authenticator code' },
  { value: 'super_admin', label: 'Super Admin', email: 'dami@example.com', blurb: 'Dami · needs an authenticator code' },
]

export const HOME: Record<Role, string> = {
  influencer: '/app/feed', minor: '/app/feed', guardian: '/app/guardian', company: '/app/studio',
  agent_owner: '/app/agents', admin: '/admin', super_admin: '/admin',
}

type Theme = 'light' | 'dark' | 'system'
type Status = 'loading' | 'anon' | 'ready'

interface Session {
  status: Status
  role: Role
  me: Account
  meDto: MeDto | undefined
  isAdmin: boolean
  /** Sign in; throws ApiError (code `2fa_required` when an authenticator code is needed). */
  login: (email: string, password: string, totp?: string) => Promise<Role>
  logout: () => Promise<void>
  /** Adopt tokens returned by sign-up and load the account. */
  signInWith: (t: { access_token: string; refresh_token: string }) => Promise<Role>
  refreshMe: () => Promise<Role | undefined>
  subscribed: boolean
  setSubscribed: (v: boolean) => void
  theme: Theme
  setTheme: (t: Theme) => void
  feed: 'people' | 'agents'
  setFeed: (f: 'people' | 'agents') => void
  following: Set<string>
  /** Follow / unfollow; pass `on` when the current state is known from the API. */
  toggleFollow: (id: string, on?: boolean) => void
  blocked: Set<string>
  toggleBlock: (id: string, on?: boolean) => void
  liked: Map<string, boolean>
  toggleLike: (id: string, current: boolean) => void
  sponsoredCardsOff: boolean
  setSponsoredCardsOff: (v: boolean) => void
  agentComments: 'all' | 'following' | 'none'
  setAgentComments: (v: 'all' | 'following' | 'none') => void
  /** Videos play by themselves (muted) when scrolled into view or hovered. Saved on this device. */
  autoplay: boolean
  setAutoplay: (v: boolean) => void
  /** Ids of the agents this person owns; owners can delete anything their agents posted (FD-08). */
  myAgentIds: Set<string>
  /** Whether this person can delete a post or comment by this author: their own, or their agent's. */
  canManage: (authorId: string) => boolean
  /** Last API error from a background action, for a toast. */
  onError: (e: unknown) => void
}

const Ctx = createContext<Session | null>(null)

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('wamiwa.' + key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem('wamiwa.' + key, JSON.stringify(v)) } catch { /* private mode */ }
}

const nobody: Account = {
  id: 'anon', handle: 'guest', name: 'Guest', kind: 'human', avatar: '', bio: '', verification: 'none',
  followersHuman: 0, followersAgent: 0, following: 0,
}

const ROLE_CACHE = 'wamiwa.role'

/** Which experience to show. Guardian / agent owner need two look-ups, so the answer is cached for the browser session. */
async function deriveRole(me: MeDto, fresh = false): Promise<Role> {
  if (me.admin_role) return me.admin_role === 'super_admin' ? 'super_admin' : 'admin'
  if (me.type === 'company') return 'company'
  if (me.profile?.is_minor) return 'minor'
  try {
    const cached = JSON.parse(sessionStorage.getItem(ROLE_CACHE) ?? 'null') as { id: string; role: Role } | null
    if (!fresh && cached?.id === me.id) return cached.role
  } catch { /* storage unavailable */ }
  const [minors, agents] = await Promise.all([
    api.get<unknown[]>('/guardians/minors').catch(() => []),
    api.get<unknown[]>('/agents').catch(() => []),
  ])
  const role: Role = minors.length ? 'guardian' : agents.length ? 'agent_owner' : 'influencer'
  try { sessionStorage.setItem(ROLE_CACHE, JSON.stringify({ id: me.id, role })) } catch { /* storage unavailable */ }
  return role
}

/** Everyone this person follows, page by page (bounded, so a huge list can't stall sign-in). */
async function followingIds(maxPages = 20): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  for (let i = 0; i < maxPages; i++) {
    const page = await api.page<{ id: string }>('/follows/following', { limit: 100, cursor })
    ids.push(...page.data.map((f) => f.id))
    if (!page.next_cursor) break
    cursor = page.next_cursor
  }
  return ids
}

const policyIn = { all: 'all', followed: 'following', none: 'none' } as const
const policyOut = { all: 'all', following: 'followed', none: 'none' } as const

export function SessionProvider({ children, onError }: { children: ReactNode; onError?: (e: unknown) => void }) {
  const [status, setStatus] = useState<Status>(auth.tokens ? 'loading' : 'anon')
  const [meDto, setMeDto] = useState<MeDto>()
  const [role, setRole] = useState<Role>('influencer')
  const [theme, setThemeState] = useState<Theme>(() => load('themePref', 'system'))
  const [feed, setFeedState] = useState<'people' | 'agents'>(() => load('feed', 'people'))
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [liked, setLiked] = useState<Map<string, boolean>>(new Map())
  const [subscribed, setSubscribedState] = useState(false)
  const [sponsoredCardsOff, setSponsoredOff] = useState(false)
  const [agentComments, setAgentCommentsState] = useState<'all' | 'following' | 'none'>('all')
  const [autoplay, setAutoplayState] = useState<boolean>(() => load('autoplay', false))
  const [myAgentIds, setMyAgentIds] = useState<Set<string>>(new Set())
  const report = useCallback((e: unknown) => onError?.(e), [onError])

  const hydrate = useCallback(async (fresh = false): Promise<Role | undefined> => {
    try {
      const me = await api.get<MeDto>('/accounts/me')
      const people = !me.admin_role && me.type !== 'company'
      const [r, follows, blocks, agents] = await Promise.all([
        deriveRole(me, fresh),
        followingIds().catch(() => [] as string[]),
        api.get<{ id?: string; account_id?: string }[]>('/blocks').catch(() => []),
        people && !me.profile?.is_minor ? api.get<{ id: string }[]>('/agents').catch(() => []) : Promise.resolve([]),
      ])
      setMeDto(me)
      setRole(r)
      setSubscribedState(me.subscribed)
      setSponsoredOff(!me.sponsored_cards)
      setAgentCommentsState(policyIn[me.profile?.agent_comment_policy ?? 'all'])
      setFollowing(new Set(follows))
      setBlocked(new Set(blocks.map((b) => (b.account_id ?? b.id)!)))
      setMyAgentIds(new Set(agents.map((a) => a.id)))
      setFeedState(me.feed_preference)
      setStatus('ready')
      return r
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) auth.set(null)
      setStatus(auth.tokens ? 'ready' : 'anon')
      report(e)
      return undefined
    }
  }, [report])

  useEffect(() => { if (auth.tokens) void hydrate() }, [hydrate])
  useEffect(() => auth.onChange(() => { if (!auth.tokens) { setStatus('anon'); setMeDto(undefined) } }), [])

  const login = useCallback(async (email: string, password: string, totp?: string) => {
    const res = await api.post<LoginDto>('/auth/login', { email, password, ...(totp ? { totp_code: totp } : {}) })
    auth.set({ access: res.access_token, refresh: res.refresh_token })
    setStatus('loading')
    const r = await hydrate()
    if (!r) throw new ApiError(0, 'error', 'Signed in, but your account couldn’t be loaded. Try again.')
    return r
  }, [hydrate])

  const signInWith = useCallback(async (t: { access_token: string; refresh_token: string }) => {
    auth.set({ access: t.access_token, refresh: t.refresh_token })
    const r = await hydrate()
    if (!r) throw new ApiError(0, 'error', 'Your account was created, but couldn’t be loaded. Try logging in.')
    return r
  }, [hydrate])

  const logout = useCallback(async () => {
    const refresh = auth.tokens?.refresh
    try { if (refresh) await api.post('/auth/logout', { refresh_token: refresh }) } catch { /* token may be expired */ }
    auth.set(null)
    try { sessionStorage.removeItem(ROLE_CACHE) } catch { /* noop */ }
    setMeDto(undefined)
    setStatus('anon')
  }, [])

  const setFeed = useCallback((f: 'people' | 'agents') => {
    setFeedState(f)
    save('feed', f)
    if (auth.tokens) api.patch('/accounts/me/settings', { feed_preference: f }).catch(report) // FD-02: remembered
  }, [report])

  const setTheme = useCallback((t: Theme) => { setThemeState(t); save('themePref', t) }, [])
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') { delete root.dataset.theme; try { localStorage.removeItem('wamiwa.theme') } catch { /* noop */ } }
    else { root.dataset.theme = theme; try { localStorage.setItem('wamiwa.theme', theme) } catch { /* noop */ } }
  }, [theme])

  /** Optimistic set toggle that rolls back if the API refuses. */
  const toggleRemote = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, current: Set<string>, path: (id: string) => string) => (id: string, want?: boolean) => {
      const on = want ?? !current.has(id)
      setter((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })
      ;(on ? api.put(path(id)) : api.del(path(id))).catch((e) => {
        setter((s) => { const n = new Set(s); on ? n.delete(id) : n.add(id); return n })
        report(e)
      })
    }, [report])

  const value = useMemo<Session>(() => ({
    status, role, meDto, isAdmin: role === 'admin' || role === 'super_admin',
    me: meDto ? fromMe(meDto) : nobody,
    // After an action that can change the role (becoming a guardian, deploying an agent), work it out again.
    login, logout, signInWith, refreshMe: () => hydrate(true),
    subscribed, setSubscribed: setSubscribedState,
    theme, setTheme, feed, setFeed,
    following, toggleFollow: toggleRemote(setFollowing, following, (id) => `/follows/${id}`),
    blocked, toggleBlock: toggleRemote(setBlocked, blocked, (id) => `/blocks/${id}`),
    liked,
    toggleLike: (id, current) => {
      const next = !current
      setLiked((m) => new Map(m).set(id, next))
      ;(next ? api.put(`/posts/${id}/like`) : api.del(`/posts/${id}/like`)).catch((e) => {
        setLiked((m) => new Map(m).set(id, current))
        report(e)
      })
    },
    sponsoredCardsOff,
    setSponsoredCardsOff: (v) => {
      setSponsoredOff(v)
      api.patch('/accounts/me/settings', { sponsored_cards: !v }).catch((e) => { setSponsoredOff(!v); report(e) })
    },
    agentComments,
    setAgentComments: (v) => {
      const prev = agentComments
      setAgentCommentsState(v)
      api.patch('/accounts/me/settings', { agent_comment_policy: policyOut[v] }).catch((e) => { setAgentCommentsState(prev); report(e) })
    },
    autoplay,
    setAutoplay: (v) => { setAutoplayState(v); save('autoplay', v) },
    myAgentIds,
    canManage: (authorId) => authorId === meDto?.id || myAgentIds.has(authorId),
    onError: report,
  }), [status, role, meDto, login, logout, signInWith, hydrate, subscribed, theme, setTheme, feed, setFeed, following, blocked,
    liked, sponsoredCardsOff, agentComments, autoplay, myAgentIds, toggleRemote, report])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
