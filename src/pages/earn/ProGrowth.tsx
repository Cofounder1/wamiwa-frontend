import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Building2, Globe2, Lightbulb, Sparkles } from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { useApi } from '@/api/hooks'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Card, PageHeader, Tabs, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { RegionPicker, regionName, useRegions } from '@/components/ui/RegionPicker'

/** SB-03: Pro growth tools. Partner businesses matched to what you post about, and ideas for chosen countries. */

interface SubDto { subscribed: boolean; tier?: 'standard' | 'pro'; target_regions?: string[] }
interface Partner { id: string; handle: string; name: string; category: string | null; hiring: boolean; accepts_messages: boolean; why: string[] }
interface PartnersDto { partners: Partner[]; based_on: { topics?: string[]; categories?: string[] }; hint?: string }
interface Idea { idea: string; topic: string; confidence: 'low' | 'medium' | 'high'; why: string[] }
interface IdeasDto { topic_area: string | null; regions: { region: string; ideas: Idea[]; based_on: { posts_analysed: number; upcoming_moments: string[] } }[] }

export default function ProGrowth() {
  const sub = useApi((s) => api.get<SubDto>('/subscriptions', undefined, s), [])
  const [tab, setTab] = useState<'partners' | 'ideas'>('partners')
  if (sub.error) return <ErrorState error={sub.error} onRetry={sub.reload} />
  if (!sub.data) return <Spinner />
  if (!(sub.data.subscribed && sub.data.tier === 'pro')) return <Upsell subscribed={sub.data.subscribed} />
  return (
    <div>
      <PageHeader title="Grow with Pro" subtitle="Businesses that fit what you post about, and what to post next for the countries you want to reach." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'partners', label: 'Partners' }, { value: 'ideas', label: 'Content ideas' }]} />
      {tab === 'partners' ? <Partners /> : <RegionIdeas saved={sub.data.target_regions ?? []} onSaved={sub.reload} />}
    </div>
  )
}

function Upsell({ subscribed }: { subscribed: boolean }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Sparkles className="size-6" /></div>
      <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.03em] text-ink">Grow with Pro</h1>
      <p className="mt-2 text-ink-2">Up to 50 businesses to partner with, matched to what you actually post about, trend-based content ideas for any countries you choose, and agents to summarize your chats. $16 a month, with everything in Creator.</p>
      <Button className="mt-6" size="lg" to="/app/subscription">{subscribed ? 'Upgrade to Pro' : 'See plans'}</Button>
    </div>
  )
}

function Partners() {
  const res = useApi((s) => api.get<PartnersDto>('/growth/partners', undefined, s), [])
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner className="min-h-40" />
  const { partners, based_on: basis } = res.data
  const topics = [...(basis.categories ?? []).map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase())), ...(basis.topics ?? []).slice(0, 5).map((t) => `#${t}`)]
  if (partners.length === 0) {
    return (
      <Card className="p-10 text-center">
        <div className="text-[15px] font-bold text-ink">No matches yet</div>
        <p className="mt-1 text-[13.5px] text-ink-2">{res.data.hint ?? 'As more verified businesses post in your topics, they’ll appear here.'}</p>
        <Button className="mt-4" variant="outline" to="/app/settings">Choose your niches</Button>
      </Card>
    )
  }
  return (
    <div>
      {topics.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
          <span className="font-semibold">Matched on</span>{topics.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
        </div>
      )}
      <Card className="divide-y divide-line">
        {partners.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="w-6 shrink-0 pt-2 text-right text-[12px] font-bold text-ink-3 num">{i + 1}</span>
              <Avatar name={p.name} kind="company" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/u/${p.handle}`} className="font-bold text-ink hover:underline">{p.name}</Link>
                  {p.category && <Badge tone="neutral">{p.category}</Badge>}
                  {p.hiring && <Badge tone="teal" icon={<Briefcase className="size-3" />}>Hiring creators</Badge>}
                </div>
                <div className="mt-1 text-[12.5px] text-ink-2">{p.why.filter((w) => w !== 'Hiring creators now').join(' · ')}</div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 pl-9 sm:pl-0">
              <Button size="sm" variant="outline" to={`/app/u/${p.handle}`} icon={<Building2 className="size-3.5" />}>View</Button>
              {p.accepts_messages && <Button size="sm" to={`/app/u/${p.handle}`}>Pitch</Button>}
            </div>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-[12px] text-ink-3">Verified businesses only, ranked by how well they match your niches and recent posts. Refreshed hourly.</p>
    </div>
  )
}

function RegionIdeas({ saved, onSaved }: { saved: string[]; onSaved: () => void }) {
  const regions = useRegions()
  const [saving, setSaving] = useState(false)
  const ideas = useApi(saved.length ? (s) => api.get<IdeasDto>('/growth/ideas', undefined, s) : null, [saved.join()])
  const save = async (next: string[]) => {
    setSaving(true)
    try { await api.put('/growth/regions', { regions: next }); onSaved() } catch (e) { toast('Couldn’t update countries', errMsg(e), 'danger') } finally { setSaving(false) }
  }
  return (
    <div>
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-[13.5px] font-bold text-ink"><Globe2 className="size-4 text-brand" />Countries you want to reach</span><span className="text-[12px] text-ink-3">{saved.length}/5</span></div>
        <RegionPicker value={saved} onChange={save} max={5} disabled={saving} />
      </Card>
      {!saved.length ? (
        <p className="text-[13.5px] text-ink-2">Choose at least one country to get ideas.</p>
      ) : ideas.error ? <ErrorState error={ideas.error} onRetry={ideas.reload} /> : !ideas.data ? <Spinner className="min-h-40" /> : (
        <>
          {ideas.data.topic_area && <p className="mb-4 text-[13px] text-ink-2">Ideas for <b className="text-ink">{ideas.data.topic_area}</b>, your main topic.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {ideas.data.regions.flatMap((r) => r.ideas.map((i, n) => (
              <Card key={r.region + n} className="p-5">
                <div className="flex items-center justify-between"><Badge tone="neutral" icon={<Globe2 className="size-3" />}>{regionName(r.region, regions)}</Badge><Badge tone={i.confidence === 'high' ? 'success' : i.confidence === 'medium' ? 'brand' : 'neutral'}>{i.confidence} confidence</Badge></div>
                <h3 className="mt-3 flex gap-2 text-[16px] leading-snug font-extrabold text-ink"><Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" />{i.idea}</h3>
                <p className={cn('mt-2 text-[12.5px] text-ink-2')}>Why: {i.why.join(' · ')}</p>
              </Card>
            )))}
          </div>
          <p className="mt-4 text-[12px] text-ink-3">Built from engagement on Wamiwa in each country and its upcoming cultural moments. Suggestions, not guarantees.</p>
        </>
      )}
    </div>
  )
}
