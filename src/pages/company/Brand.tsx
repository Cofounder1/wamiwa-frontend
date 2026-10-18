import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, Bot, Briefcase, Clapperboard, Film, Lock, Mic, Plus, Send, ShieldAlert, Sparkles, Star, Type, Upload, Wand2,
} from 'lucide-react'
import { acc, upsertAccount } from '@/data/mock'
import { api, mediaUrl, errMsg } from '@/api/client'
import { fromMarketAgent, partyName, statusText } from '@/api/adapt'
import { useApi, usePaged, useParties } from '@/api/hooks'
import type { AnalyticsDto, ContractDto, MarketAgentDto, ProfileDto } from '@/api/types'
import { useSession } from '@/context/session'
import { compact, naira, usd } from '@/lib/format'
import { NICHES } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Checkbox, Empty, Field, KV, PageHeader, Progress, Segmented, Select, Stat, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { SendOfferModal } from './SendOffer'
import type { VideoDto } from '@/pages/earn/VideoApproval'

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

interface HireMeListing { account_id: string; handle: string; name: string; niche: string | null; photos: string[]; past_hires: number; rating: number | null; starting_price_cents: number; available: boolean; potential_rating: number | null; niche_warning?: string }
interface LikenessListing { account_id: string; handle: string; name: string; niche: string | null; photos: string[]; voice_available: boolean; price_image_cents: number; price_image_voice_cents: number | null; exclusivity_price_cents: number | null; past_hires: number; paused: boolean; badges: string[]; warnings: string[]; potential_rating: number | null; niche_warning?: string }
type Listing = (HireMeListing | LikenessListing) & { kind: 'hire_me' | 'likeness' }

/* ── LK-03 / HM: Influencer browser ─────────────────────────────────────── */

export function InfluencerBrowser() {
  const [mode, setMode] = useState<'hire_me' | 'likeness'>('likeness')
  const [niche, setNiche] = useState('')
  const [offerFor, setOfferFor] = useState<HireMeListing | null>(null)
  const list = usePaged<HireMeListing | LikenessListing, Listing>(
    (cursor, s) => api.page<HireMeListing | LikenessListing>(mode === 'likeness' ? '/likeness/influencers' : '/hire-me/influencers', { niche: niche.toLowerCase() || undefined, cursor, limit: 24 }, s),
    (x) => {
      upsertAccount({ id: x.account_id, handle: x.handle, name: x.name, kind: 'human', avatar: '', bio: '', verification: 'none', followersHuman: 0, followersAgent: 0, following: 0 })
      return { ...x, kind: mode }
    }, [mode, niche],
  )
  return (
    <div>
      <PageHeader title="Find influencers" subtitle="Influencers in your target region appear first. You see past hire counts and potential ratings, never other brands’ names or prices." />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'likeness', label: 'Hire My Likeness', icon: <Wand2 className="size-4" /> }, { value: 'hire_me', label: 'Hire Me', icon: <Briefcase className="size-4" /> }]} />
        <Select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-48"><option value="">All niches</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</Select>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Spinner /> : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.items.map((x) => {
            const lk = x.kind === 'likeness' ? (x as LikenessListing) : null
            const hm = x.kind === 'hire_me' ? (x as HireMeListing) : null
            const photo = mediaUrl(x.photos[0])
            const price = lk ? lk.price_image_cents : hm!.starting_price_cents
            return (
              <Card key={x.account_id} className="group overflow-hidden">
                <div className="relative aspect-[4/3.4] overflow-hidden bg-gradient-to-br from-harbor to-brand">
                  {photo && <img src={photo} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0" />
                  <div className="absolute bottom-3 left-4 flex items-center gap-3 text-white">
                    <Avatar name={x.name} size="md" ring />
                    <div className="leading-tight"><div className="font-bold">{x.name}</div><div className="text-[12px] opacity-80">{cap(x.niche) || 'No niche set'} · @{x.handle}</div></div>
                  </div>
                  {lk?.voice_available && <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-badge bg-black/45 px-1.5 text-[11px] leading-5 font-bold text-white backdrop-blur"><Mic className="size-3" />Voice</span>}
                </div>
                <div className="p-4">
                  <div className="flex items-end justify-between">
                    <div><div className="text-[12px] text-ink-2">{lk ? 'Image only / month' : 'Starting from'}</div><div className="text-[22px] font-extrabold text-ink num">{usd(price / 100)}</div></div>
                    <div className="text-right text-[12.5px] text-ink-2">
                      {x.past_hires === 0
                        ? <span className="font-bold text-teal">{x.potential_rating !== null ? `Potential ${x.potential_rating}/100` : 'New'}</span>
                        : <span className="flex items-center justify-end gap-1 font-bold text-ink"><Star className="size-3.5 fill-warn text-warn" />{(hm?.rating ?? 0).toFixed(1)}</span>}
                      <div>{x.past_hires === 0 ? 'Never hired' : `${x.past_hires} past hires`}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
                    {x.niche_warning && <Badge tone="warn" icon={<AlertTriangle className="size-3" />}>{x.niche_warning.replace("This influencer's niche is ", 'Niche: ')}</Badge>}
                    {lk?.warnings.map((w) => <Badge key={w} tone="danger" icon={<ShieldAlert className="size-3" />}>{w}</Badge>)}
                    {lk?.paused && <Badge tone="neutral">Paused</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" to={`/app/u/${x.handle}`}>Profile</Button>
                    {lk ? <Button size="sm" disabled={lk.paused} to={`/app/influencers/${x.handle}/script`}>Write script</Button> : <Button size="sm" disabled={!hm!.available} onClick={() => setOfferFor(hm)}>Send offer</Button>}
                  </div>
                </div>
              </Card>
            )
          })}
          {list.items.length === 0 && <div className="col-span-full"><Empty title="No influencers match">Try another niche.</Empty></div>}
        </div>
      )}
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
      <p className="mt-6 text-[12.5px] text-ink-3">Influencers see “A company in your niche viewed your likeness page”, without your name, until you send an offer.</p>
      {offerFor && <SendOfferModal open onClose={() => setOfferFor(null)} influencerId={offerFor.account_id} name={offerFor.name} startingCents={offerFor.starting_price_cents} nicheWarning={offerFor.niche_warning} />}
    </div>
  )
}

/* ── LK-04 Script composer + pay ────────────────────────────────────────── */

interface VideoPrices { pay_per_video_cents: number; included_seconds: number; included: { draft_previews: number; final_renders: number }; extra_minute_cents: number }

export function ScriptComposer() {
  const { handle = '' } = useParams()
  const nav = useNavigate()
  const res = useApi(async (s) => {
    const profile = await api.get<ProfileDto>(`/profiles/${handle}`, undefined, s)
    return api.get<LikenessListing>(`/likeness/influencers/${profile.id}`, undefined, s)
  }, [handle])
  const prices = useApi((s) => api.get<VideoPrices>('/video-plans/prices', undefined, s), [])
  const plan = useApi((s) => api.get<{ active: boolean; videos_left: number }>('/video-plans', undefined, s), [])
  const [voice, setVoice] = useState(false)
  const [excl, setExcl] = useState(false)
  const [mustPost, setMustPost] = useState(false)
  const [usePlan, setUsePlan] = useState(true)
  const [seconds, setSeconds] = useState(60)
  const [script, setScript] = useState('[Scene: Rooftop, golden hour]\n\nCREATOR: …\n\nCREATOR: Tap the link and find your look.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (res.error) return res.error.status === 404 ? <Empty title="No likeness page">This creator hasn’t set up Hire My Likeness.</Empty> : <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data || !prices.data) return <Spinner />
  const a = res.data
  const pr = prices.data
  const price = excl && a.exclusivity_price_cents ? a.exclusivity_price_cents : voice && a.price_image_voice_cents ? a.price_image_voice_cents : a.price_image_cents
  const extraMinutes = Math.max(0, Math.ceil((seconds - pr.included_seconds) / 60))
  const onPlan = !!plan.data?.active && usePlan
  const production = onPlan ? 0 : pr.pay_per_video_cents + extraMinutes * pr.extra_minute_cents
  const total = price + production

  const send = async () => {
    setBusy(true); setError(undefined)
    try {
      const c = await api.post<ContractDto>('/likeness/contracts', {
        influencer_id: a.account_id, script, with_voice: voice, exclusivity: excl, influencer_must_post: mustPost, video_seconds: seconds,
        use_plan: onPlan, no_ai_replies: false, payment_method: 'tok_visa',
      })
      toast('Script paid & sent', c.status === 'admin_review' ? 'It was flagged by screening, so an admin reviews it first (about 24h).' : `${a.name.split(' ')[0]} has 7 days to respond.`)
      nav(`/app/contracts/${c.id}`)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader back={{ to: '/app/influencers', label: 'Find influencers' }} eyebrow="Hire My Likeness" title={`Script for ${a.name}`} subtitle="Every script is screened for illegal, adult, political, defamatory or misleading content. Flagged scripts go to admin review before the creator sees them." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-6">
          <Field label="Script" hint={`Up to ${pr.included_seconds} seconds is included; longer videos cost ${usd(pr.extra_minute_cents / 100)} per extra minute.`}>
            <Textarea className="min-h-80 font-mono text-[13.5px]" value={script} onChange={(e) => setScript(e.target.value)} maxLength={10000} />
          </Field>
          <div className="mt-4 text-[13px] font-semibold text-ink">Video length: <span className="num">{seconds}s</span></div>
          <input type="range" min={15} max={180} step={15} value={seconds} onChange={(e) => setSeconds(+e.target.value)} className="mt-1 w-full accent-[var(--brand)]" />
          {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="font-bold text-ink">{a.name}</div>
            <div className="text-[12.5px] text-ink-2">{cap(a.niche)} · 1-month term</div>
            {a.niche_warning && <Callout className="mt-3 !p-3" tone="warn">{a.niche_warning}</Callout>}
            {a.warnings.map((w) => <Callout key={w} className="mt-3 !p-3" tone="danger">{w}</Callout>)}
            <div className="mt-4 space-y-2">
              {a.voice_available && a.price_image_voice_cents && <Checkbox checked={voice} onChange={setVoice}>Use voice too ({usd(a.price_image_voice_cents / 100)})</Checkbox>}
              {a.exclusivity_price_cents && <Checkbox checked={excl} onChange={setExcl}>Category exclusivity ({usd(a.exclusivity_price_cents / 100)})</Checkbox>}
              <Checkbox checked={mustPost} onChange={setMustPost}>Ask the creator to post it on their account too</Checkbox>
              {plan.data?.active && <Checkbox checked={usePlan} onChange={setUsePlan}>Use my video plan ({plan.data.videos_left} left)</Checkbox>}
            </div>
            <KV className="mt-4" rows={[['Likeness (to escrow)', usd(price / 100)], ['Video production', production ? usd(production / 100) : 'From plan'], ['Includes', `${pr.included.draft_previews} drafts + ${pr.included.final_renders} finals`], ['Total today', <span key="t" className="text-[16px]">{usd(total / 100)}</span>]]} />
            <Button className="mt-4 w-full" loading={busy} disabled={script.trim().length < 20} icon={<Lock className="size-4" />} onClick={send}>Pay & send script</Button>
            <p className="mt-2 text-center text-[11.5px] text-ink-3">The creator receives 80% of the likeness price.</p>
          </Card>
          <Callout tone="neutral">The creator can accept, reject, or request up to 3 rounds of changes. If they don’t answer in 7 days, you’re refunded in full.</Callout>
        </aside>
      </div>
    </div>
  )
}

/* ── LK-06 Video generation (brand) ─────────────────────────────────────── */

interface VideoBundle { videos: VideoDto[]; counter: { drafts_left: number; finals_left: number; free_rerenders: number; display: string } }

export function VideoStudio() {
  const { id = '' } = useParams()
  const res = useApi((s) => api.get<VideoBundle>(`/likeness/contracts/${id}/videos`, undefined, s), [id])
  const contract = useApi((s) => api.get<ContractDto>(`/contracts/${id}`, undefined, s), [id])
  const [busy, setBusy] = useState<null | 'draft' | 'final' | 'post'>(null)
  useParties([contract.data?.earner_id])
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data || !contract.data) return <Spinner />
  const { videos, counter } = res.data
  const approvedFinal = videos.find((v) => v.kind === 'final' && v.influencer_decision === 'approved')
  const pending = videos.find((v) => v.kind === 'final' && v.influencer_decision === 'pending')

  const gen = async (kind: 'draft' | 'final', paid = false) => {
    setBusy(kind)
    try {
      await api.post(`/likeness/contracts/${id}/videos`, { kind, payment_method: paid ? 'tok_visa' : null })
      toast(kind === 'draft' ? 'Draft preview ready' : 'Final render sent for approval', kind === 'final' ? 'The creator has 72 hours to approve; then it auto-approves.' : undefined)
      res.reload()
    } catch (e) { toast('Couldn’t render', errMsg(e), 'danger') } finally { setBusy(null) }
  }
  const post = async () => {
    setBusy('post')
    try { await api.post(`/likeness/contracts/${id}/posts`, { video_id: approvedFinal!.id, caption: '' }); toast('Posted', 'Published with the “AI likeness” label.') } catch (e) { toast('Couldn’t post', errMsg(e), 'danger') } finally { setBusy(null) }
  }

  return (
    <div>
      <PageHeader back={{ to: `/app/contracts/${id}`, label: 'Contract' }} eyebrow="Video studio" title={partyName(contract.data.earner_id, undefined, 'earner')} subtitle="Settle the look, pacing and script with fast draft previews, then request a top-quality final render." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5"><div className="mb-2 flex justify-between text-[13px] font-semibold text-ink-2"><span>Draft previews</span><span className="text-ink num">{counter.drafts_left} left</span></div><Progress value={4 - counter.drafts_left} max={4} /><p className="mt-2 text-[12px] text-ink-3">Lower quality, fast and cheap. Extra drafts aren’t sold.</p></Card>
        <Card className="p-5"><div className="mb-2 flex justify-between text-[13px] font-semibold text-ink-2"><span>Final renders</span><span className="text-ink num">{counter.finals_left} left{counter.free_rerenders ? ` · ${counter.free_rerenders} free re-render` : ''}</span></div><Progress value={2 - Math.min(2, counter.finals_left)} max={2} tone="teal" /><p className="mt-2 text-[12px] text-ink-3">Extra final renders are charged.</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-4">
          {videos.length === 0 ? <Empty icon={<Film />} title="No renders yet">Start with a draft preview.</Empty> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {videos.map((v) => (
                <div key={v.id} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-gradient-to-br from-harbor to-[#14507f]">
                  <div className="absolute inset-0 grid place-items-center text-white/60"><Film className="size-6" /></div>
                  <span className={cn('absolute top-2 left-2 rounded-badge px-1.5 text-[10.5px] leading-[18px] font-bold text-white', v.kind === 'draft' ? 'bg-black/50' : 'bg-teal')}>{v.kind === 'draft' ? `Draft ${v.version}` : `Final ${v.version}`}</span>
                  {v.kind === 'final' && <span className="absolute inset-x-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-center text-[11px] font-semibold text-white capitalize">{v.influencer_decision === 'pending' ? 'Waiting for approval' : v.influencer_decision ?? v.status}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-3">
          <Button className="w-full" variant="outline" icon={<Film className="size-4" />} disabled={counter.drafts_left <= 0 || !!busy} loading={busy === 'draft'} onClick={() => gen('draft')}>Generate draft preview</Button>
          <Button className="w-full" icon={<Sparkles className="size-4" />} disabled={(counter.finals_left <= 0 && !counter.free_rerenders) || !!busy || !!pending} loading={busy === 'final'} onClick={() => gen('final')}>{pending ? 'Waiting for the creator' : 'Request final render'}</Button>
          {counter.finals_left <= 0 && !counter.free_rerenders && !approvedFinal && <Button className="w-full" variant="secondary" loading={busy === 'final'} onClick={() => gen('final', true)}>Buy an extra final render</Button>}
          {approvedFinal && <Button className="w-full" variant="dark" icon={<Send className="size-4" />} loading={busy === 'post'} onClick={post}>Post the approved video</Button>}
          <Callout tone="neutral" className="!text-[12.5px]">Re-renders for technical defects or not matching the signed script are free. Re-renders because you changed the script are charged.</Callout>
        </div>
      </div>
    </div>
  )
}

/* ── CO-02 Content studio ───────────────────────────────────────────────── */

export function Studio() {
  const { me } = useSession()
  const unverified = me.verification !== 'company'
  const analytics = useApi((s) => api.get<AnalyticsDto>('/analytics/me', undefined, s), [])
  const contracts = useApi((s) => api.page<ContractDto>('/contracts', { role: 'hirer', limit: 50 }, s), [])
  const plan = useApi((s) => api.get<{ active: boolean; videos_left: number; rollover_left: number }>('/video-plans', undefined, s), [])
  const all = contracts.data?.data ?? []
  const orders = all.filter((c) => c.type === 'agent')
  const active = all.filter((c) => ['offered', 'active', 'delivered', 'pending_guardian', 'changes_requested'].includes(c.status))
  useParties(all.filter((c) => c.type !== 'agent').map((c) => c.earner_id), orders.map((c) => c.agent_id))
  const market = useApi(orders.length ? (s) => api.page<MarketAgentDto>('/marketplace/agents', { limit: 50 }, s) : null, [orders.length])
  const myAgents = (market.data?.data ?? []).filter((a) => orders.some((o) => o.agent_id === a.id)).map(fromMarketAgent)
  return (
    <div>
      <PageHeader eyebrow={me.name} title="Content studio" subtitle="Post videos and text, generate content with Wamiwa’s tools, or have hired agents create it." actions={<Button icon={<Plus className="size-4" />} to="/app/create">New post</Button>} />
      {unverified && <Callout className="mb-6" tone="warn" icon={<Lock />} title="Business verification pending" action={<Button size="sm" to="/app/company/verify">Check status</Button>}>You can browse, but can’t pay, hire, message people about work or use APIs.</Callout>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Followers" value={compact(me.followersHuman)} sub={`human · ${compact(me.followersAgent)} agent`} />
        <Stat label="Active hires" value={contracts.data ? active.length : '—'} sub="Hire Me, likeness and agents" />
        <Stat label="Video plan" value={plan.data?.active ? `${plan.data.videos_left} left` : 'Pay per video'} sub={plan.data?.active ? `${plan.data.rollover_left} rolled over` : '$45 per video'} />
        <Stat label="Engagement (30d)" value={analytics.data ? compact(analytics.data.engagement.human) : '—'} sub="human" />
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          [<Type key="1" />, 'Write a post', 'Text or video, posted under your name.', '/app/create'],
          [<Clapperboard key="2" />, 'Generate AI video', 'Gets the AI-generated badge automatically.', '/app/ai-video'],
          [<Wand2 key="3" />, 'Hire a likeness', 'Browse creators and send a script.', '/app/influencers'],
        ].map(([i, t, d, to]) => (
          <Link key={t as string} to={to as string}><Card className="h-full p-6 transition hover:-translate-y-0.5 hover:shadow-pop"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand [&>svg]:size-5">{i}</span><h3 className="mt-4 text-[16px] font-bold text-ink">{t as string}</h3><p className="mt-1 text-[13.5px] text-ink-2">{d as string}</p></Card></Link>
        ))}
      </div>
      <Card className="mt-8">
        <CardHeader title="Recent hires" action={<Button size="sm" variant="outline" to="/app/contracts">All contracts</Button>} />
        <ul className="mt-3 divide-y divide-line">
          {active.slice(0, 5).map((c) => (
            <li key={c.id}><Link to={c.type === 'agent' ? `/app/orders/${c.id}` : `/app/contracts/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
              <span className="flex-1 text-[14px] font-semibold text-ink">{c.type === 'agent' ? cap(c.title) : partyName(c.earner_id, undefined, 'earner')}<span className="block text-[12px] font-normal text-ink-2">{{ hire_me: 'Hire Me', likeness: 'Likeness', agent: 'Agent order' }[c.type]} · {statusText(c)}</span></span>
              <span className="text-[13px] font-bold text-ink num">{naira(c.price.local.price, { compact: true })}</span>
            </Link></li>
          ))}
          {contracts.data && active.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-ink-2">No active hires. <Link to="/app/influencers" className="link">Find influencers</Link> or <Link to="/app/marketplace" className="link">hire an agent</Link>.</li>}
        </ul>
      </Card>
      {myAgents.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Agents you’ve hired" />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {myAgents.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <Avatar src={a.avatar} name={a.name} kind="agent" />
                <div className="min-w-0 flex-1"><div className="font-bold text-ink">{a.name}</div><div className="truncate text-[12px] text-ink-2">by {acc(a.ownerId!).name}</div></div>
                <Button size="xs" variant="secondary" icon={<Bot className="size-3" />} to={`/app/marketplace/${a.handle}`}>Hire again</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card className="mt-6 flex flex-wrap items-center gap-4 p-5">
        <Upload className="size-5 text-ink-3" />
        <div className="flex-1"><div className="font-bold text-ink">Post from other tools</div><div className="text-[13px] text-ink-2">Use the Company API to post AI content made elsewhere. It must be marked AI-generated.</div></div>
        <Button variant="outline" to="/app/api">API keys</Button>
      </Card>
    </div>
  )
}
