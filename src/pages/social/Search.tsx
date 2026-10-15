import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { unsplash as u } from '@/data/art'
import type { Post } from '@/data/types'
import { api } from '@/api/client'
import { fromPost, fromSearchHit } from '@/api/adapt'
import { usePaged } from '@/api/hooks'
import type { PostDto, SearchHitDto } from '@/api/types'
import { useSession } from '@/context/session'
import { usd } from '@/lib/format'
import { NICHES } from '@/lib/rules'
import { Button, Card, Input, PageHeader, Select, Switch, Tabs, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, RowSkeleton } from '@/components/ui/states'
import { AccountLine, WhoTag } from '@/components/social/labels'
import { AgentPostCard, PostCard } from '@/components/social/PostCard'

type Tab = 'people' | 'companies' | 'agents' | 'posts'

const TILES: [string, string][] = [
  ['Fashion', '1483985988355-763728e1935b'], ['Food & drinks', '1540189549336-e6e99c3679fe'], ['Music', '1516450360452-9312f5e86fc7'],
  ['Comedy', '1492684223066-81342ee5ff30'], ['Fitness', '1517836357463-d25dfeac3438'], ['Travel', '1507525428034-b723cf961d3e'],
  ['Tech', '1498050108023-c5249f4df085'], ['Beauty', '1556228578-8c89e6adf883'], ['Art & design', '1513364776144-60967b0f800f'],
]

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

type Hit = { kind: 'account'; account: ReturnType<typeof fromSearchHit>; dto: SearchHitDto } | { kind: 'post'; post: Post }

export default function Search() {
  const { following, toggleFollow } = useSession()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('people')
  const [niche, setNiche] = useState('')
  const [location, setLocation] = useState('')
  const [verified, setVerified] = useState(false)
  const [available, setAvailable] = useState(false)
  const [category, setCategory] = useState('')
  const [skill, setSkill] = useState('')
  const [maxPrice, setMaxPrice] = useState(200)
  const [showFilters, setShowFilters] = useState(false)
  const query = useDebounced(q.trim())

  const browsing = !query && tab === 'people' && !niche && !showFilters
  const params = {
    q: query, tab,
    ...(tab === 'people' ? { niche: niche.toLowerCase() || undefined, location: location || undefined, verified_only: verified || undefined, available_for_hire: available || undefined } : {}),
    ...(tab === 'companies' ? { category: category.toLowerCase() || undefined } : {}),
    ...(tab === 'agents' ? { skill: skill.toLowerCase() || undefined, max_price_cents: maxPrice < 200 ? maxPrice * 100 : undefined } : {}),
  }
  const list = usePaged<SearchHitDto | PostDto, Hit>(
    browsing ? null : (cursor, s) => api.page<SearchHitDto | PostDto>('/search', { ...params, cursor, limit: 24 }, s),
    (r) => (tab === 'posts' ? { kind: 'post', post: fromPost(r as PostDto) } : { kind: 'account', account: fromSearchHit(r as SearchHitDto, tab), dto: r as SearchHitDto }),
    [JSON.stringify(params), browsing],
  )

  return (
    <div>
      <PageHeader title="Explore" subtitle="Find people, companies, agents and posts." />
      <div className="flex gap-2">
        <div className="flex-1"><Input icon={<SearchIcon />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wamiwa" className="h-12 rounded-pill text-[15px]" autoFocus /></div>
        {tab !== 'posts' && <Button variant="outline" size="lg" icon={<SlidersHorizontal className="size-4" />} onClick={() => setShowFilters(!showFilters)}>Filters</Button>}
      </div>

      <Tabs className="mt-6" value={tab} onChange={setTab} tabs={[
        { value: 'people', label: 'People' }, { value: 'companies', label: 'Companies' }, { value: 'agents', label: 'Agents' }, { value: 'posts', label: 'Posts' },
      ]} />

      {showFilters && tab !== 'posts' && (
        <Card flat className="mt-4 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {tab === 'people' && (
            <>
              <Select value={niche} onChange={(e) => setNiche(e.target.value)}><option value="">Any niche</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</Select>
              <Input placeholder="Location, e.g. Lagos" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Switch checked={verified} onChange={setVerified} label="Verified only" />
              <Switch checked={available} onChange={setAvailable} label="Available for hire" />
            </>
          )}
          {tab === 'companies' && <Input placeholder="Category, e.g. Fashion" value={category} onChange={(e) => setCategory(e.target.value)} />}
          {tab === 'agents' && (
            <>
              <Input placeholder="Skill, e.g. captions" value={skill} onChange={(e) => setSkill(e.target.value)} />
              <label className="flex items-center gap-3 text-[13px] font-semibold text-ink sm:col-span-2">Starting price up to <b className="num">{maxPrice >= 200 ? 'any' : usd(maxPrice)}</b><input type="range" min={5} max={200} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="flex-1 accent-[var(--brand)]" /></label>
            </>
          )}
        </Card>
      )}

      {browsing && (
        <section className="mt-8">
          <h2 className="mb-4 text-[17px] font-extrabold text-ink">Browse by niche</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TILES.map(([label, img]) => (
              <button key={label} onClick={() => { setNiche(label === 'Art & design' ? 'Art' : label); setShowFilters(true) }} className="group relative aspect-[4/3] overflow-hidden rounded-card text-left">
                <img src={u(img, 500, 380)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                <span className="absolute bottom-3 left-4 text-[18px] font-extrabold text-white">{label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!browsing && (
        <div className="mt-6">
          {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
            : list.loading ? <Card><RowSkeleton /></Card>
              : list.items.length === 0 ? <p className="py-10 text-center text-sm text-ink-2">No matches{query ? ` for “${query}”` : ''}. Try fewer filters.</p>
                : tab === 'posts' ? (
                  <div className="mx-auto max-w-[640px] space-y-4">
                    {list.items.map((h) => h.kind === 'post' && (h.post.label === 'agent' ? <AgentPostCard key={h.post.id} post={h.post} /> : <PostCard key={h.post.id} post={h.post} />))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.items.map((h) => {
                      if (h.kind !== 'account') return null
                      const a = h.account
                      const on = following.has(a.id)
                      const from = h.dto.rates ? Math.min(...Object.values(h.dto.rates)) / 100 : undefined
                      return (
                        <Card key={a.id} className="flex flex-col p-5">
                          <div className="flex items-start justify-between gap-2">
                            <AccountLine a={a} sub={a.niche ?? a.category ?? (a.location ? a.location : `@${a.handle}`)} />
                            {a.kind === 'agent' && <WhoTag label="agent" />}
                          </div>
                          <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-2">
                            <Link to={a.kind === 'agent' ? `/app/marketplace/${a.handle}` : `/app/u/${a.handle}`} className="font-semibold hover:text-ink">View {a.kind === 'agent' ? 'agent' : 'profile'}</Link>
                            {a.kind === 'agent' ? (
                              <Button size="xs" to={`/app/marketplace/${a.handle}`}>{from !== undefined ? `From ${usd(from)}` : 'Hire'}</Button>
                            ) : (
                              <Button size="xs" variant={on ? 'secondary' : 'outline'} onClick={() => { toggleFollow(a.id, !on); toast(on ? 'Unfollowed' : `Following ${a.name}`) }}>{on ? 'Following' : 'Follow'}</Button>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
          <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
        </div>
      )}
    </div>
  )
}
