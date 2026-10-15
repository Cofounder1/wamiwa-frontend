import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Flag, Loader2, MapPin, ShieldAlert, ShoppingBag } from 'lucide-react'
import { byHandle } from '@/data/mock'
import type { Mention } from '@/data/types'
import { api, ApiError } from '@/api/client'
import { useApi } from '@/api/hooks'
import { Avatar, Badge, Button, Modal, toast } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

/** Where the text appears. Sponsored gating (minors, blocks, owner settings) is decided by the API. */
export interface SponsorContext {
  authorId: string
  postAuthorId?: string
  machine?: boolean
  onlyFor?: string
}

/**
 * Renders post/comment text with live smart mentions (character ranges from the API), @mentions and #tags.
 * Legacy `[[id|Name]]` markup renders as plain text.
 */
export function RichText({ text, mentions, className }: { text: string; ctx?: SponsorContext; mentions?: Mention[]; className?: string }) {
  const pieces: ReactNode[] = []
  let cursor = 0
  const sorted = [...(mentions ?? [])].sort((a, b) => a.start - b.start).slice(0, 3) // WA-05: at most 3 cards
  sorted.forEach((m, i) => {
    if (m.start < cursor || m.end > text.length) return
    pieces.push(<Plain key={`t${i}`} text={text.slice(cursor, m.start)} />)
    pieces.push(<SmartMention key={`m${i}`} cardUrl={m.cardUrl}>{text.slice(m.start, m.end)}</SmartMention>)
    cursor = m.end
  })
  pieces.push(<Plain key="end" text={text.slice(cursor)} />)
  return <span className={cn('whitespace-pre-line', className)}>{pieces}</span>
}

function Plain({ text }: { text: string }) {
  const parts = text.split(/(\[\[[a-z_]+\|[^\]]+\]\]|@[a-z0-9_]+|#[a-z0-9_]+)/gi)
  return (
    <>
      {parts.map((p, i) => {
        const legacy = p.match(/^\[\[[a-z_]+\|([^\]]+)\]\]$/i)
        if (legacy) return <Fragment key={i}>{legacy[1]}</Fragment>
        if (p.startsWith('@') && p.length > 1) {
          const known = byHandle[p.slice(1)]
          return <Link key={i} to={`/app/u/${p.slice(1)}`} className={cn('font-semibold hover:underline', known?.kind === 'agent' ? 'text-agent' : 'text-brand')}>{p}</Link>
        }
        if (p.startsWith('#') && p.length > 1) return <Link key={i} to={`/app/search?q=${encodeURIComponent(p)}`} className="font-semibold text-brand hover:underline">{p}</Link>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}

/* ── Smart mention card (WA-06) ─────────────────────────────────────────── */

interface CardDto {
  sponsored: boolean; name: string; kind: 'business' | 'seller' | 'artist' | 'label'; category?: string | null
  profile?: { id: string; handle: string } | null
  links: { label: string; click_url: string; report_url: string }[]
}

export function SmartMention({ cardUrl, children }: { cardUrl: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="rounded-[4px] bg-brand-soft/70 px-0.5 font-semibold text-ink underline decoration-brand/50 decoration-dotted decoration-2 underline-offset-[3px] transition hover:bg-brand-soft hover:decoration-brand"
      >
        {children}
      </button>
      {open && <SmartMentionCard cardUrl={cardUrl} anchor={ref.current} onClose={() => setOpen(false)} />}
    </>
  )
}

const KIND = { business: 'Business', seller: 'Seller', artist: 'Artist', label: 'Record label' }

function SmartMentionCard({ cardUrl, anchor, onClose }: { cardUrl: string; anchor: HTMLElement | null; onClose: () => void }) {
  const card = useApi((s) => api.get<CardDto>(cardUrl, undefined, s), [cardUrl])
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [reporting, setReporting] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!anchor) return
    const r = anchor.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - 336)) })
  }, [anchor])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const t = setTimeout(() => document.addEventListener('click', close))
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', onClose, { once: true, capture: true })
    return () => { clearTimeout(t); document.removeEventListener('click', close); document.removeEventListener('keydown', esc) }
  }, [onClose])

  const open = async (l: CardDto['links'][number]) => {
    try {
      const r = await api.post<{ url: string }>(l.click_url)
      window.open(r.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) setBlocked(e.message)
      else toast('Link unavailable', e instanceof ApiError ? e.message : undefined, 'warn')
    }
  }
  const report = async (url: string) => {
    try { await api.post(url, { details: '' }); setReporting(null); toast('Link reported', 'Admins review it. After 3 reports it’s switched off until checked.') } catch (e) { toast('Couldn’t report', e instanceof ApiError ? e.message : undefined, 'danger') }
  }

  const c = card.data
  return createPortal(
    <div ref={ref} style={pos} className="fixed z-[120] w-[320px] animate-pop overflow-hidden rounded-[22px] bg-surface shadow-pop ring-1 ring-line">
      <div className="relative h-14 bg-gradient-to-br from-harbor to-brand">
        <span className="absolute top-2.5 right-2.5 rounded-badge bg-black/40 px-1.5 text-[10.5px] leading-[18px] font-bold tracking-wide text-white uppercase backdrop-blur">Sponsored</span>
      </div>
      <div className="px-4 pb-4">
        {!c ? (
          <div className="grid h-32 place-items-center text-ink-3">{card.error ? <span className="text-[13px]">{card.error.message}</span> : <Loader2 className="size-5 animate-spin" />}</div>
        ) : (
          <>
            <div className="-mt-6 flex items-end gap-3">
              <Avatar name={c.name} kind={c.kind === 'business' || c.kind === 'label' ? 'company' : 'human'} size="lg" ring />
              <div className="min-w-0 pb-0.5">
                <div className="truncate font-bold text-ink">{c.name}</div>
                <div className="text-xs text-ink-2">{KIND[c.kind]}{c.category ? ` · ${c.category.charAt(0).toUpperCase() + c.category.slice(1)}` : ''}</div>
              </div>
            </div>
            {c.profile && <Link to={`/app/u/${c.profile.handle}`} onClick={onClose} className="mt-3 inline-flex text-[13px] font-semibold text-brand hover:underline">View Wamiwa profile</Link>}
            <div className="mt-3 space-y-2">
              {c.links.map((l) => (
                <div key={l.click_url} className="group flex items-center gap-2">
                  <button onClick={() => open(l)} className="flex h-10 flex-1 items-center justify-between rounded-full border border-line bg-surface-2 px-4 text-[13.5px] font-semibold text-ink transition hover:border-brand hover:bg-brand-soft">
                    {l.label}<ArrowUpRight className="size-4 text-ink-3 group-hover:text-brand" />
                  </button>
                  <button aria-label={`Report ${l.label} link`} onClick={() => setReporting(l.report_url)} className="grid size-8 place-items-center rounded-full text-ink-3 opacity-60 transition hover:bg-danger-soft hover:text-danger hover:opacity-100"><Flag className="size-3.5" /></button>
                </div>
              ))}
              {c.links.length === 0 && <p className="text-[12.5px] text-ink-2">No links to share right now.</p>}
            </div>
            {blocked && <div className="mt-3 flex gap-2 rounded-xl bg-danger-soft p-3 text-[12.5px] text-danger"><ShieldAlert className="size-4 shrink-0" />{blocked}</div>}
            {reporting && (
              <div className="mt-3 rounded-xl bg-surface-2 p-3 text-[12.5px] text-ink-2">
                <div className="mb-2 font-semibold text-ink">Report this link as unsafe?</div>
                Admins are notified on every report. After 3 different people report it, the link switches off until reviewed.
                <div className="mt-2.5 flex gap-2"><Button size="xs" variant="danger" onClick={() => report(reporting)}>Report link</Button><Button size="xs" variant="ghost" onClick={() => setReporting(null)}>Cancel</Button></div>
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-ink-3">Links open through Wamiwa so taps can be counted. Shown to adults only.</p>
      </div>
    </div>,
    document.body,
  )
}

/* ── Suggested sellers (WA-07) ──────────────────────────────────────────── */

interface SellersDto { category: string; sponsored: boolean; has_more: boolean; sellers: { name: string; kind: string; profile?: { id: string; handle: string }; in_your_region: boolean; click_url: string }[] }

export function SuggestedSellersLink({ category, url }: { category: string; url?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand/50 bg-brand-soft/50 py-1 pr-3 pl-2 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:bg-brand-soft">
        <ShoppingBag className="size-3.5 text-brand" />
        Suggested sellers for {category.toLowerCase()}
        <span className="text-[10.5px] font-bold tracking-wide text-ink-3 uppercase">· Sponsored</span>
      </button>
      {open && <SuggestedSellersModal onClose={() => setOpen(false)} category={category} url={url ?? `/promotions/suggested?category=${encodeURIComponent(category)}`} />}
    </>
  )
}

function SuggestedSellersModal({ onClose, category, url }: { onClose: () => void; category: string; url: string }) {
  const res = useApi((s) => api.get<SellersDto>(url, { limit: 5 }, s), [url])
  const tap = async (clickUrl: string) => {
    try { const r = await api.post<{ url: string }>(clickUrl); window.open(r.url, '_blank', 'noopener,noreferrer') } catch (e) { toast('Link unavailable', e instanceof ApiError ? e.message : undefined, 'warn') }
  }
  return (
    <Modal open onClose={onClose} size="sm" title={<span className="flex items-center gap-2">Suggested sellers <Badge tone="outline">Sponsored</Badge></span>} subtitle={`Paying sellers in ${category}. Sellers near you first; the rest rotate daily.`}>
      {!res.data ? <div className="grid h-24 place-items-center text-ink-3">{res.error ? res.error.message : <Loader2 className="size-5 animate-spin" />}</div> : (
        <ul className="-mx-2 space-y-1">
          {res.data.sellers.map((s) => (
            <li key={s.click_url}>
              <button onClick={() => tap(s.click_url)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-wash">
                <Avatar name={s.name} kind={s.kind === 'business' ? 'company' : 'human'} />
                <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink">{s.name}</div>{s.profile && <div className="truncate text-[12.5px] text-ink-2">@{s.profile.handle}</div>}</div>
                {s.in_your_region && <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal"><MapPin className="size-3" />Near you</span>}
                <ArrowUpRight className="size-4 text-ink-3" />
              </button>
            </li>
          ))}
          {res.data.sellers.length === 0 && <li className="p-4 text-center text-[13px] text-ink-2">No sellers in this category right now.</li>}
        </ul>
      )}
      <p className="mt-4 text-[11.5px] text-ink-3">Shown because someone said they want this kind of product. Artists and labels are never listed. Tapping a seller opens one of their links.</p>
    </Modal>
  )
}
