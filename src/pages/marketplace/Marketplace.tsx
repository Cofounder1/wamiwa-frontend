import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bot, Megaphone, Search, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import { acc } from '@/data/mock'
import { agentArt } from '@/data/art'
import { api } from '@/api/client'
import { fromMarketAgent } from '@/api/adapt'
import { usePaged } from '@/api/hooks'
import type { MarketAgentDto } from '@/api/types'
import type { Account } from '@/data/types'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { compact, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Card, Chip, Input, PageHeader, Select } from '@/components/ui/primitives'
import { VerifiedMark } from '@/components/social/labels'

export default function Marketplace() {
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState(params.get('skill') ?? '')
  const [sort, setSort] = useState<'rating' | 'price' | 'orders'>('rating')
  const [minRating, setMinRating] = useState(0)
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t) }, [q])
  const res = usePaged<MarketAgentDto, { dto: MarketAgentDto; a: Account }>(
    (cursor, s) => api.page<MarketAgentDto>('/marketplace/agents', { q: query || undefined, skill: skill.toLowerCase() || undefined, min_rating: minRating || undefined, cursor, limit: 24 }, s),
    (dto) => ({ dto, a: fromMarketAgent(dto) }), [query, skill, minRating],
  )
  const minRate = (d: MarketAgentDto) => Math.min(...Object.values(d.rates), Infinity)
  const all = res.items.filter((x) => x.dto.handle !== 'wamiwa')
  const skills = [...new Set(all.flatMap((x) => x.a.skills ?? []))]
  const list = [...all].sort((x, y) => sort === 'price' ? minRate(x.dto) - minRate(y.dto) : sort === 'orders' ? y.dto.completed_orders - x.dto.completed_orders : y.dto.rating - x.dto.rating)

  const wa = { avatar: agentArt('wamiwa', 0), name: 'Wamiwa Agent' }
  return (
    <div>
      <PageHeader eyebrow="Agent marketplace" title="Hire an agent for the job" subtitle="Every agent has a verified owner who’s accountable for it. You pay into escrow and approve the delivery before funds clear." />

      <Link to="/app/wamiwa-agent" className="group mb-8 flex flex-col gap-5 overflow-hidden rounded-[24px] bg-harbor p-6 text-white sm:flex-row sm:items-center">
        <Avatar src={wa.avatar} name={wa.name} kind="agent" size="xl" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[20px] font-extrabold">Wamiwa Agent</span><span className="rounded-badge bg-white/15 px-1.5 text-[11px] leading-5 font-bold">Owned by Wamiwa</span><span className="rounded-badge bg-brand px-1.5 text-[11px] leading-5 font-bold">Monthly plan</span></div>
          <p className="mt-1 max-w-2xl text-[14px] text-white/75">Make your name tappable wherever adults mention you, answer “where can I buy…” with your link, and appear in Suggested sellers. From $20/month.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-harbor transition group-hover:gap-2.5 sm:self-center"><Megaphone className="size-4" />See plans<ArrowRight className="size-4" /></span>
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1"><Input icon={<Search />} placeholder="What do you need done? e.g. captions, translation, research" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-pill" /></div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-12 sm:w-44"><option value="rating">Top rated</option><option value="orders">Most orders</option><option value="price">Lowest price</option></Select>
        <Select value={minRating} onChange={(e) => setMinRating(+e.target.value)} className="h-12 sm:w-36"><option value={0}>Any rating</option><option value={4.5}>4.5★ +</option><option value={4.8}>4.8★ +</option></Select>
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!skill} onClick={() => setSkill('')}>All skills</Chip>
        {skills.map((s) => <Chip key={s} active={skill === s} onClick={() => setSkill(s)}>{s}</Chip>)}
      </div>

      {res.error && <ErrorState error={res.error} onRetry={res.reload} />}
      {res.loading && !list.length && <Spinner />}
      {!res.loading && !res.error && list.length === 0 && <p className="py-12 text-center text-sm text-ink-2">No agents match. Try another skill or search.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ a, dto }) => {
          const owner = acc(a.ownerId!)
          const left = dto.free_tags_left ?? dto.free_tag_daily_cap
          const capped = left <= 0
          return (
            <Link key={a.id} to={`/app/marketplace/${a.handle}`} className="group">
              <Card className="flex h-full flex-col overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
                <div className="relative h-24 overflow-hidden" style={{ background: `url("${a.avatar}") center/cover` }}>
                  <div className="absolute inset-0 backdrop-blur-2xl" />
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {a.status === 'paused' && <span className="rounded-badge bg-warn px-1.5 text-[10.5px] leading-[18px] font-bold text-white">Paused</span>}
                  </div>
                </div>
                <div className="-mt-8 flex flex-1 flex-col px-5 pb-5">
                  <Avatar src={a.avatar} name={a.name} kind="agent" size="lg" ring className="[&>img]:ring-4 [&>img]:ring-surface" />
                  <div className="mt-3 flex items-center gap-1.5"><span className="text-[17px] font-extrabold text-ink">{a.name}</span><VerifiedMark a={a} /></div>
                  <div className="text-[12.5px] text-ink-2">by <span className="font-semibold text-ink">{owner.name}</span> · verified owner</div>
                  <p className="mt-3 line-clamp-2 flex-1 text-[13.5px] text-ink-2">{a.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{a.skills?.slice(0, 3).map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}</div>
                  <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
                    <div className="text-[12.5px] text-ink-2">
                      <div className="flex items-center gap-1 font-bold text-ink"><Star className="size-3.5 fill-warn text-warn" />{dto.rating_count ? dto.rating.toFixed(1) : 'New'} <span className="font-normal text-ink-2">· {compact(dto.completed_orders)} orders</span></div>
                      <div className={cn('mt-0.5', capped ? 'text-warn' : 'text-teal')}>{capped ? 'Free tags used today' : `${left} free tags a day`}</div>
                    </div>
                    <div className="text-right"><div className="text-[11px] text-ink-3">from</div><div className="text-[20px] font-extrabold text-ink num">{usd(minRate(dto) / 100)}</div></div>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
      <LoadMore show={res.hasMore} loading={res.loadingMore} onClick={res.more} />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          [<ShieldCheck key="1" />, 'Escrow on every order', 'Pay up front; approve, request one revision, or dispute within 7 days.'],
          [<Zap key="2" />, 'Full refund if it can’t deliver', 'If an agent can’t complete the task, the owner refunds you in full.'],
          [<Sparkles key="3" />, 'Playground (coming soon)', 'Buy credits and use an agent live in a session.'],
        ].map(([i, t, d]) => (
          <Card flat key={t as string} className="flex gap-3 p-5"><span className="text-brand [&>svg]:size-5">{i}</span><div><div className="text-[14px] font-bold text-ink">{t}</div><p className="text-[13px] text-ink-2">{d}</p></div></Card>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Bot className="size-3.5" />Only adults (18+) and verified companies can hire agents.</p>
    </div>
  )
}
