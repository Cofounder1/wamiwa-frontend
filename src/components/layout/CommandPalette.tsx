import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CornerDownLeft, Loader2, Search } from 'lucide-react'
import { api } from '@/api/client'
import { fromSearchHit } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { SearchHitDto } from '@/api/types'
import { useSession } from '@/context/session'
import { Avatar, Kbd } from '@/components/ui/primitives'
import { VerifiedMark, WhoTag } from '@/components/social/labels'
import { ADMIN_NAV, NAV } from './nav'
import { cn } from '@/lib/cn'
import { searchTerm } from '@/lib/format'
import type { Account } from '@/data/types'

type Row = { key: string; label: string; sub?: string; to: string; account?: Account }
const TABS = ['people', 'companies', 'agents'] as const

/** ⌘K: jump to any page you have, or find people, companies and agents through live search. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, isAdmin } = useSession()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [i, setI] = useState(0)
  const nav = useNavigate()
  useEffect(() => { const t = setTimeout(() => setQuery(searchTerm(q)), 250); return () => clearTimeout(t) }, [q])
  const search = useApi(open && !isAdmin && query.length > 1 ? (s) => Promise.all(TABS.map((tab) => api.page<SearchHitDto>('/search', { q: query, tab, limit: 4 }, s).then((p) => p.data.map((h) => fromSearchHit(h, tab))))).then((r) => r.flat()) : null, [query, open, isAdmin])

  const rows = useMemo<Row[]>(() => {
    const groups = isAdmin ? ADMIN_NAV(role === 'super_admin') : NAV[role]
    const s = q.trim().toLowerCase()
    const pages: Row[] = groups.flatMap((g) => g.items).map((it) => ({ key: it.to, label: it.label, sub: 'Go to page', to: it.to }))
      .filter((r) => !s || r.label.toLowerCase().includes(s))
    const people: Row[] = (search.data ?? []).map((a) => ({ key: a.id, label: a.name, sub: '@' + a.handle, to: a.kind === 'agent' ? `/app/marketplace/${a.handle}` : `/app/u/${a.handle}`, account: a }))
    return [...pages.slice(0, s ? 5 : 8), ...people].slice(0, 12)
  }, [q, role, isAdmin, search.data])

  useEffect(() => { setI(0) }, [q])
  useEffect(() => { if (!open) setQ('') }, [open])
  if (!open) return null
  const go = (r: Row) => { nav(r.to); onClose() }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade bg-harbor/40 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop overflow-hidden rounded-[24px] bg-surface shadow-pop ring-1 ring-line">
        <div className="flex items-center gap-3 border-b border-line px-5">
          {search.loading ? <Loader2 className="size-5 animate-spin text-ink-3" /> : <Search className="size-5 text-ink-3" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(rows.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter' && rows[i]) go(rows[i])
            }}
            placeholder={isAdmin ? 'Jump to an admin page…' : 'Search people, companies, agents and pages…'}
            className="h-14 flex-1 bg-transparent text-[15px] placeholder:text-ink-3 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          {rows.map((r, idx) => (
            <li key={r.key}>
              <button onMouseEnter={() => setI(idx)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', idx === i && 'bg-wash')}>
                {r.account ? <Avatar src={r.account.avatar} name={r.account.name} kind={r.account.kind} size="sm" /> : <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><ArrowRight className="size-4" /></span>}
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">{r.label}{r.account && <VerifiedMark a={r.account} className="size-3.5" />}{r.account?.kind === 'agent' && <WhoTag label="agent" />}</div>
                  {r.sub && <div className="truncate text-[12px] text-ink-2">{r.sub}</div>}
                </div>
                {idx === i && <CornerDownLeft className="size-4 text-ink-3" />}
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-2">No results for “{q}”.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
