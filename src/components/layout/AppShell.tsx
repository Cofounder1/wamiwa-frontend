import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronsUpDown, Loader2, LogOut, Menu as MenuIcon, Monitor, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DEMO_PASSWORD, HOME, ROLES, useSession } from '@/context/session'
import { api, ApiError } from '@/api/client'
import { Avatar, Kbd, toast } from '@/components/ui/primitives'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { ADMIN_NAV, NAV, type NavGroup } from './nav'
import { CommandPalette } from './CommandPalette'
import { FeedbackPrompt } from './FeedbackPrompt'

/** Unread notifications, refreshed on navigation and every minute. */
function useUnread(enabled: boolean) {
  const [n, setN] = useState(0)
  const loc = useLocation()
  useEffect(() => {
    if (!enabled) return
    const load = () => api.page('/notifications', { unread_only: true, limit: 1 }).then((p) => setN(Number(p.unread_count ?? p.count ?? 0))).catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [enabled, loc.pathname])
  return n
}

export function AppShell({ admin }: { admin?: boolean }) {
  const { role, isAdmin, status } = useSession()
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const loc = useLocation()
  const unread = useUnread(status === 'ready' && !admin)
  const groups = (admin ? ADMIN_NAV(role === 'super_admin') : NAV[role]).map((g) => ({
    ...g, items: g.items.map((i) => (i.to === '/app/notifications' && unread ? { ...i, badge: unread } : i)),
  }))

  useEffect(() => { setDrawer(false) }, [loc.pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) } }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [])

  if (status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  if (status === 'loading') return <div className="grid min-h-dvh place-items-center text-ink-3"><Loader2 className="size-6 animate-spin" /></div>
  if (admin && !isAdmin) return <Navigate to={HOME[role]} replace />
  if (!admin && isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className={cn('min-h-dvh', admin ? 'bg-bg-2' : 'bg-bg')}>
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col lg:flex', admin ? 'bg-harbor text-white' : 'border-r border-line bg-surface')}>
        <Sidebar groups={groups} admin={admin} onSearch={() => setPalette(true)} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-harbor/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className={cn('absolute inset-y-0 left-0 flex w-[290px] animate-pop flex-col shadow-pop', admin ? 'bg-harbor text-white' : 'bg-surface')}>
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute top-4 right-3 grid size-9 place-items-center rounded-full opacity-70 hover:opacity-100"><X className="size-5" /></button>
            <Sidebar groups={groups} admin={admin} onSearch={() => { setDrawer(false); setPalette(true) }} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-xl lg:hidden">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-full hover:bg-wash"><MenuIcon className="size-5" /></button>
          <Link to={admin ? '/admin' : '/app/feed'}><Logo size="sm" /></Link>
          <div className="flex-1" />
          <button onClick={() => setPalette(true)} aria-label="Search" className="grid size-10 place-items-center rounded-full hover:bg-wash"><Search className="size-5" /></button>
          {!admin && <Link to="/app/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full hover:bg-wash"><Bell className="size-5" /><span className="absolute top-2 right-2.5 size-2 rounded-full bg-brand ring-2 ring-surface" /></Link>}
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile create FAB */}
      {!admin && role !== 'guardian' && (
        <Link to="/app/create" aria-label="Create post" className="fixed right-5 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-pop transition hover:scale-105 lg:hidden">
          <Plus className="size-6" strokeWidth={2.5} />
        </Link>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {!admin && <FeedbackPrompt />}
    </div>
  )
}

function Sidebar({ groups, admin, onSearch }: { groups: NavGroup[]; admin?: boolean; onSearch: () => void }) {
  const { role } = useSession()
  return (
    <>
      <div className="flex h-[72px] shrink-0 items-center gap-2 px-5">
        <Link to={admin ? '/admin' : '/app/feed'} className="flex items-center gap-2">
          {admin ? <><LogoMark /><span className="text-[22px] font-extrabold tracking-[-0.045em] text-white">wamiwa</span><span className="rounded-badge bg-white/10 px-1.5 text-[10.5px] leading-5 font-bold tracking-wider text-white/80 uppercase">{role === 'super_admin' ? 'Super admin' : 'Admin'}</span></> : <Logo />}
        </Link>
      </div>
      <div className="px-4">
        <button
          onClick={onSearch}
          className={cn('flex h-10 w-full items-center gap-2 rounded-full px-3.5 text-[13.5px] transition', admin ? 'bg-white/8 text-white/60 hover:bg-white/12' : 'border border-line bg-surface-2 text-ink-3 hover:border-line-strong')}
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search Wamiwa</span>
          <Kbd>⌘K</Kbd>
        </button>
        {!admin && role !== 'guardian' && (
          <Link to="/app/create" className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-on-brand transition hover:bg-brand-strong hover:shadow-lift">
            <Plus className="size-4" strokeWidth={2.5} />Create post
          </Link>
        )}
      </div>
      <nav className="scroll-thin mt-4 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g, gi) => (
          <div key={gi} className="mb-4">
            {g.title && <div className={cn('mb-1 px-3 text-[11px] font-bold tracking-[0.08em] uppercase', admin ? 'text-white/40' : 'text-ink-3')}>{g.title}</div>}
            {g.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/admin' || i.to === '/app/agents' || i.to === '/app/guardian'}
                className={({ isActive }) => cn(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition',
                  admin
                    ? isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/6 hover:text-white'
                    : isActive ? 'bg-brand-soft text-ink' : 'text-ink-2 hover:bg-wash hover:text-ink',
                )}
              >
                {({ isActive }) => (
                  <>
                    <i.icon className={cn('size-[18px] shrink-0', isActive && !admin && 'text-brand')} strokeWidth={isActive ? 2.4 : 2} />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.badge && <span className={cn('rounded-full px-1.5 text-[11px] leading-5 font-bold num', admin ? 'bg-brand text-white' : 'bg-brand text-on-brand')}>{i.badge}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className={cn('shrink-0 border-t p-3', admin ? 'border-white/10' : 'border-line')}>
        <ThemeToggle admin={admin} />
        <RoleSwitcher admin={admin} />
      </div>
    </>
  )
}

function ThemeToggle({ admin }: { admin?: boolean }) {
  const { theme, setTheme } = useSession()
  const opts = [{ v: 'light', i: Sun }, { v: 'system', i: Monitor }, { v: 'dark', i: Moon }] as const
  return (
    <div className={cn('mb-2 flex rounded-full p-1', admin ? 'bg-white/8' : 'bg-wash')} role="radiogroup" aria-label="Theme">
      {opts.map(({ v, i: I }) => (
        <button
          key={v}
          role="radio"
          aria-checked={theme === v}
          aria-label={`${v} theme`}
          onClick={() => setTheme(v)}
          className={cn('flex h-7 flex-1 items-center justify-center rounded-full transition', theme === v ? (admin ? 'bg-white/15 text-white' : 'bg-surface text-ink shadow-sm') : admin ? 'text-white/50' : 'text-ink-3')}
        >
          <I className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

function RoleSwitcher({ admin }: { admin?: boolean }) {
  const { me, role, login, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string>()
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const c = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', c)
    return () => document.removeEventListener('mousedown', c)
  }, [open])

  /** Development only: sign in as one of the seeded demo accounts. */
  const switchTo = async (email: string) => {
    setBusy(email)
    try {
      const r = await login(email, DEMO_PASSWORD)
      setOpen(false)
      nav(HOME[r])
    } catch (e) {
      if (e instanceof ApiError && e.code === '2fa_required') { await logout(); nav(`/login?email=${encodeURIComponent(email)}`) }
      else toast('Couldn’t switch account', e instanceof ApiError ? e.message : undefined, 'danger')
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[300px] animate-pop rounded-2xl bg-surface p-1.5 text-ink shadow-pop ring-1 ring-line">
          <div className="px-3 pt-2 pb-2">
            <div className="truncate text-[13.5px] font-bold">{me.name}</div>
            <div className="truncate text-[12px] text-ink-2">@{me.handle} · {ROLES.find((r) => r.value === role)?.label}</div>
          </div>
          {!admin && <Link to="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-wash"><Settings className="size-4" />Settings</Link>}
          <button onClick={async () => { await logout(); nav('/') }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold text-ink-2 hover:bg-wash"><LogOut className="size-4" />Sign out</button>
          {import.meta.env.DEV && (
            <>
              <div className="my-1 h-px bg-line" />
              <div className="px-3 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">Switch demo account</div>
              {ROLES.map((r) => (
                <button key={r.value} disabled={!!busy} onClick={() => switchTo(r.email)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-wash disabled:opacity-60">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold">{r.label}</div>
                    <div className="truncate text-[12px] text-ink-2">{r.blurb}</div>
                  </div>
                  {busy === r.email ? <Loader2 className="size-4 animate-spin text-ink-3" /> : role === r.value && <Check className="size-4 text-brand" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button onClick={() => setOpen(!open)} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition', admin ? 'hover:bg-white/8' : 'hover:bg-wash')}>
        {me.avatar ? <Avatar src={me.avatar} name={me.name} kind={me.kind} size="md" /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{me.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}
        <div className="min-w-0 flex-1 leading-tight">
          <div className={cn('truncate text-[13.5px] font-bold', admin ? 'text-white' : 'text-ink')}>{me.name}</div>
          <div className={cn('truncate text-[12px]', admin ? 'text-white/55' : 'text-ink-2')}>{ROLES.find((r) => r.value === role)?.label}</div>
        </div>
        <ChevronsUpDown className={cn('size-4', admin ? 'text-white/50' : 'text-ink-3')} />
      </button>
    </div>
  )
}
