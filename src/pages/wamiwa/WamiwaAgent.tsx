import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowUpRight, BarChart3, Check, Clock, Globe2, Lightbulb, Link2, Lock, Pause, Play, Plus, ShieldAlert, Sparkles, Tag, Trash2,
} from 'lucide-react'
import { api, ApiError, errMsg } from '@/api/client'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { date, naira, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, CardHeader, Checkbox, Field, Input, Modal, PageHeader, Segmented, Select, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { RegionPicker, regionName, useRegions } from '@/components/ui/RegionPicker'

type Kind = 'business' | 'seller' | 'artist' | 'label'
interface PlanPrice { usd_cents: number; local: number; links: number }
interface PlansDto { currency: string; prices: Record<Kind, { base: PlanPrice; plus: PlanPrice }>; label_roster_size: number; packages: Record<'base' | 'plus', string> }
interface NameDto { id: string; name: string; status: string; matches_in_plain_text: boolean; default_link: { label: string; url: string } | null }
interface LinkDto { id: string; url: string; label: string; keywords: string[]; name_id: string | null; shared_by_agent: boolean; under_review: boolean; review_reason: string | null }
export interface PlanDto {
  id: string; kind: Kind; tier: 'base' | 'plus'; status: string; category: string | null; target_regions: string[]; cancel_at_period_end: boolean
  renews_at: string; price_cents: number; link_limit: number; link_limit_applies: string; names: NameDto[]; links: LinkDto[]; default_link_rule?: string
}

const KIND_NAME: Record<Kind, string> = { business: 'Business', seller: 'Individual seller', artist: 'Artist', label: 'Record label' }
export default function WamiwaAgent() {
  const { role } = useSession()
  const plan = useApi((s) => api.get<PlanDto | null>('/promotions', undefined, s), [])
  if (role === 'minor') return <Callout tone="neutral" icon={<Lock />} title="Not available for under-18s">The Wamiwa Agent and all sponsored content are adults-only.</Callout>
  if (plan.error) return <ErrorState error={plan.error} onRetry={plan.reload} />
  if (plan.loading) return <Spinner />
  return plan.data ? <ManagePlan plan={plan.data} reload={plan.reload} /> : <BuyPlan onBought={plan.reload} />
}

/* ── WA-01 Buy ──────────────────────────────────────────────────────────── */

function BuyPlan({ onBought }: { onBought: () => void }) {
  const { me, role } = useSession()
  const company = role === 'company'
  const prices = useApi((s) => api.get<PlansDto>('/promotions/plans', undefined, s), [])
  const kinds: Kind[] = company ? ['business', 'label'] : ['seller', 'artist']
  const [kind, setKind] = useState<Kind>(kinds[0])
  const [tier, setTier] = useState<'base' | 'plus'>('base')
  const [name, setName] = useState(company ? me.name : '')
  const [category, setCategory] = useState(me.category?.toLowerCase() ?? 'fashion')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError>()
  if (prices.error) return <ErrorState error={prices.error} onRetry={prices.reload} />
  if (!prices.data) return <Spinner />
  const p = prices.data.prices[kind][tier]
  const needsName = kind === 'seller' || kind === 'artist'
  const needsCategory = kind === 'business' || kind === 'seller'

  const buy = async () => {
    setBusy(true); setError(undefined)
    try {
      await api.post('/promotions', { kind, tier, category: needsCategory ? category : null, brand_name: needsName ? name : null, links: [], target_regions: [], payment_method: 'tok_visa' })
      toast('Wamiwa Agent bought', kind === 'seller' ? 'Your shop name and links are reviewed within 2 working days.' : 'Add the links you want shared.')
      onBought()
    } catch (e) { setError(e instanceof ApiError ? e : undefined); toast('Couldn’t buy the plan', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader eyebrow="Wamiwa Agent" title="Get found wherever you’re mentioned" subtitle="When adults mention your name it becomes tappable. People who ask about you get your link. Sellers appear in Suggested sellers. Everything is labeled Sponsored." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-[15px] font-bold text-ink">1. Choose a plan</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn('rounded-2xl border p-4 text-left transition', kind === k ? 'border-brand bg-brand-soft ring-4 ring-brand/10' : 'border-line hover:bg-wash')}>
                  <div className="flex items-baseline justify-between"><span className="font-bold text-ink">{KIND_NAME[k]}</span><span className="text-[14px] font-extrabold text-ink num">{usd(prices.data!.prices[k].base.usd_cents / 100)}<span className="text-[12px] font-normal text-ink-2">/mo</span></span></div>
                  <div className="mt-1 text-[12.5px] text-ink-2">{prices.data!.prices[k].base.links} links{k === 'label' ? ` per artist · up to ${prices.data!.label_roster_size} artists` : ''}</div>
                </button>
              ))}
            </div>
            <div className="mt-5">
              <div className="mb-2 text-[13px] font-semibold text-ink">Package</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['base', 'plus'] as const).map((t) => (
                  <button key={t} onClick={() => setTier(t)} className={cn('rounded-2xl border p-4 text-left transition', tier === t ? 'border-ink bg-surface' : 'border-line hover:bg-wash')}>
                    <div className="flex items-center gap-2 font-bold text-ink capitalize">{t}{t === 'plus' && <Badge tone="brand" icon={<Sparkles className="size-3" />}>+$10</Badge>}</div>
                    <div className="mt-1 text-[12.5px] text-ink-2">{prices.data!.packages[t]}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-[15px] font-bold text-ink">2. {kind === 'artist' ? 'Your stage name' : kind === 'seller' ? 'Shop or brand name' : 'Your name'}</h3>
            {needsName ? (
              <>
                <p className="mt-1 text-[13px] text-ink-2">{kind === 'artist' ? 'Goes live at once if it matches your handle, verified name or a connected social account. Otherwise an admin approves it first.' : 'Seller names and links are reviewed by an admin within 2 working days. Your month starts when it’s approved.'}</p>
                <Input className="mt-4" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'artist' ? 'Stage name' : 'Shop name'} />
              </>
            ) : <p className="mt-1 text-[13.5px] text-ink-2">Your registered business name <b className="text-ink">{me.name}</b> and @{me.handle} are linked automatically. {kind === 'label' ? 'Add your artists after buying.' : ''}</p>}
            {needsCategory && <Field className="mt-4" label="Category" hint="Used for Suggested sellers."><Select value={category} onChange={(e) => setCategory(e.target.value)}>{['fashion', 'beauty', 'food & drinks', 'electronics', 'home'].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</Select></Field>}
            {error && (
              <Callout className="mt-4" tone="danger" action={error.code?.includes('name') ? <Button size="sm" variant="outline" to="/app/claim-name">This is my name</Button> : undefined}>{error.message} You haven’t been charged.</Callout>
            )}
          </Card>
        </div>
        <aside>
          <Card className="sticky top-10 p-6">
            <div className="text-[13px] font-bold text-ink-2">{KIND_NAME[kind]} · {tier === 'plus' ? 'Plus' : 'Base'}</div>
            <div className="mt-2 flex items-baseline gap-1.5"><span className="text-[44px] leading-none font-extrabold tracking-[-0.04em] text-ink num">{usd(p.usd_cents / 100)}</span><span className="text-ink-2">/month</span></div>
            <div className="text-[12.5px] text-ink-3">Charged {naira(p.local)} at today’s rate. Paid to Wamiwa: no escrow.</div>
            <ul className="mt-5 space-y-2 text-[13.5px] text-ink-2">
              {['Your name becomes a smart mention card', 'The agent answers “who is / where can I buy” with your link', kind === 'business' || kind === 'seller' ? 'Listed in Suggested sellers for your category' : 'Default link: Spotify → YouTube Music → Audiomack', `${p.links} links${kind === 'label' ? ' per artist' : ''}`, tier === 'plus' ? 'Content ideas from likely trends' : null].filter(Boolean).map((t) => <li key={t as string} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-teal" />{t}</li>)}
            </ul>
            <Button size="lg" className="mt-6 w-full" loading={busy} disabled={needsName && name.trim().length < 2} onClick={buy}>Buy for {usd(p.usd_cents / 100)}/month</Button>
            <p className="mt-3 text-center text-[11.5px] text-ink-3">The name is checked before any money is taken. Cancel any time; it takes effect at the end of the paid month.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

/* ── Manage (WA-01/02/03/04/09/11) ──────────────────────────────────────── */

function ManagePlan({ plan, reload }: { plan: PlanDto; reload: () => void }) {
  const [tab, setTab] = useState<'links' | 'names' | 'plan'>('links')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const shared = plan.links.filter((l) => l.shared_by_agent).length
  const flagged = plan.links.filter((l) => l.under_review)
  const statusTone = { active: 'success', review: 'warn', pending_review: 'warn', paused: 'neutral', lapsed: 'danger', suspended: 'danger', cancelled: 'neutral' } as Record<string, 'success' | 'warn' | 'neutral' | 'danger'>

  const act = async (fn: () => Promise<unknown>, done: string, sub?: string) => {
    setBusy(true)
    try { await fn(); toast(done, sub); reload() } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader eyebrow="Wamiwa Agent" title={`${KIND_NAME[plan.kind]} plan`} subtitle={`${plan.tier === 'plus' ? 'Plus' : 'Base'} package · ${plan.cancel_at_period_end ? 'ends' : 'renews'} ${date(plan.renews_at)} · ${usd(plan.price_cents / 100)}/month`}
        actions={<><Badge tone={statusTone[plan.status] ?? 'neutral'} dot className="!text-[13px] !leading-7 !px-3">{plan.status.replace(/_/g, ' ')}</Badge><Button variant="outline" icon={<BarChart3 className="size-4" />} to="/app/analytics">Results</Button>{plan.tier === 'plus' && <Button icon={<Lightbulb className="size-4" />} to="/app/wamiwa-agent/ideas">Content ideas</Button>}</>} />

      {plan.kind === 'seller' && plan.status !== 'active' && <Callout className="mb-6" tone="warn" icon={<Clock />} title="Waiting for review">Shop names and links are checked by an admin within 2 working days. Your month starts when it’s approved; if it’s rejected, your first payment is refunded.</Callout>}
      {flagged.map((l) => <Callout key={l.id} className="mb-4" tone="danger" icon={<ShieldAlert />} title={`“${l.label}” is held back`}>It {l.review_reason ?? 'looks unsafe'}. It’s saved but not shared, and admins have been notified. Replace it with the full address.</Callout>)}

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'links', label: 'Links', count: plan.links.length }, { value: 'names', label: plan.kind === 'label' ? 'Artists' : 'Names', count: plan.names.length }, { value: 'plan', label: 'Plan & billing' }]} />
      <div className="mt-6">
        {tab === 'links' && (
          <Card>
            <CardHeader title="Links the agent shares" subtitle={`${shared} of ${plan.link_limit} shared ${plan.link_limit_applies}. When what someone says fits a link’s label or words, that link is shared; otherwise one is picked at random.`} action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add link</Button>} />
            <ul className="mt-3 divide-y divide-line">
              {plan.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-wash text-ink-2"><Link2 className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-bold text-ink">{l.label}<Badge tone={l.under_review ? 'danger' : l.shared_by_agent ? 'success' : 'neutral'}>{l.under_review ? 'Held — under review' : l.shared_by_agent ? 'Shared' : 'Saved (over limit)'}</Badge></div>
                    <div className="truncate text-[12.5px] text-ink-2">{l.url}{l.name_id && ` · ${plan.names.find((n) => n.id === l.name_id)?.name ?? ''}`}</div>
                    {l.keywords.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{l.keywords.map((k) => <span key={k} className="rounded-badge bg-surface-2 px-1.5 text-[11px] font-semibold text-ink-2">{k}</span>)}</div>}
                  </div>
                  <button aria-label="Delete link" onClick={() => act(() => api.del(`/promotions/links/${l.id}`), 'Link deleted', 'Replies that carried it no longer open it.')} className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                </li>
              ))}
              {plan.links.length === 0 && <li className="p-8 text-center text-[13.5px] text-ink-2">{plan.default_link_rule ?? 'No links yet.'}</li>}
            </ul>
            <div className="border-t border-line px-5 py-3 text-[12px] text-ink-3">Every link is checked for scams when added, and daily while shared.</div>
          </Card>
        )}

        {tab === 'names' && <NamesPanel plan={plan} reload={reload} />}

        {tab === 'plan' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="text-[13px] font-bold text-ink">Package</div>
              <Segmented className="mt-3" value={plan.tier} onChange={(t) => act(() => api.patch('/promotions', { tier: t, payment_method: 'tok_visa' }), t === 'plus' ? 'Moved to Plus' : 'Moved to base', t === 'plus' ? 'The extra $10 is charged now and with each renewal.' : 'All links stay saved; only the first ones within the limit are shared.')} options={[{ value: 'base', label: 'Base' }, { value: 'plus', label: 'Plus' }]} />
            </Card>
            <Card className="p-5">
              <div className="text-[13px] font-bold text-ink">Pause</div>
              <p className="mt-1 text-[12.5px] text-ink-2">Cards, replies and listings stop until you resume.</p>
              <Button size="sm" variant="outline" className="mt-3" loading={busy} icon={plan.status === 'paused' ? <Play className="size-3.5" /> : <Pause className="size-3.5" />} onClick={() => act(() => api.patch('/promotions', { paused: plan.status !== 'paused' }), plan.status === 'paused' ? 'Plan resumed' : 'Plan paused')}>{plan.status === 'paused' ? 'Resume' : 'Pause plan'}</Button>
            </Card>
            <Card className="p-5">
              <div className="text-[13px] font-bold text-ink">Cancel</div>
              <p className="mt-1 text-[12.5px] text-ink-2">Takes effect at the end of the paid month. Names and links stay saved and work again if you buy the agent again.</p>
              {!plan.cancel_at_period_end ? <Button size="sm" variant="ghost" className="mt-3 text-danger" loading={busy} onClick={() => act(() => api.del('/promotions'), `Plan ends on ${date(plan.renews_at)}`)}>Cancel plan</Button> : <Badge tone="warn" className="mt-3">Ends {date(plan.renews_at)}</Badge>}
            </Card>
          </div>
        )}
      </div>
      {adding && <AddLinkModal names={plan.kind === 'label' ? plan.names : []} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); reload() }} />}
    </div>
  )
}

function NamesPanel({ plan, reload }: { plan: PlanDto; reload: () => void }) {
  const [name, setName] = useState('')
  const add = async () => {
    try { await api.post('/promotions/names', { name }); toast(plan.kind === 'label' ? 'Artist added' : 'Name submitted', 'Names that belong to someone else go to admin review.'); setName(''); reload() } catch (e) { toast('Couldn’t add', errMsg(e), 'danger') }
  }
  const remove = async (id: string, n: string) => {
    try { await api.del(`/promotions/names/${id}`); toast(`${n} removed`, plan.kind === 'label' ? 'Their links were removed too.' : undefined); reload() } catch (e) { toast('Couldn’t remove', errMsg(e), 'danger') }
  }
  return (
    <Card>
      <CardHeader title={plan.kind === 'label' ? 'Roster' : 'Names linked to you'} subtitle="Names that are also everyday words only trigger with @, quotes, or a cue like “called”, “by”, “brand” or “artist”." />
      <ul className="mt-3 divide-y divide-line">
        {plan.names.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <Tag className="size-4 text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-bold text-ink">{n.name}<Badge tone={n.status === 'approved' || n.status === 'live' ? 'success' : n.status.includes('claim') ? 'danger' : 'warn'}>{n.status.replace(/_/g, ' ')}</Badge></div>
              <div className="text-[12.5px] text-ink-2">{n.matches_in_plain_text ? 'Matches when written plainly' : 'Matches with @, quotes or a cue word'}{n.default_link && <> · default: {n.default_link.label}</>}</div>
            </div>
            <Button size="xs" variant="ghost" className="text-danger" icon={<Trash2 className="size-3" />} onClick={() => remove(n.id, n.name)}>Remove</Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line p-5">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={plan.kind === 'label' ? 'Artist name' : 'Another name you trade under'} />
        <Button disabled={name.trim().length < 2} onClick={add} icon={<Plus className="size-4" />}>Add</Button>
      </div>
    </Card>
  )
}

function AddLinkModal({ names, onClose, onAdded }: { names: NameDto[]; onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState('https://')
  const [label, setLabel] = useState('')
  const [kw, setKw] = useState('')
  const [nameId, setNameId] = useState(names[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const valid = /^https:\/\/[^\s]+\.[^\s]+/.test(url)
  const add = async () => {
    setBusy(true); setError(undefined)
    try {
      const l = await api.post<LinkDto>('/promotions/links', { url, label, keywords: kw.split(',').map((k) => k.trim()).filter(Boolean), name_id: nameId || null })
      toast(l.under_review ? 'Link saved but held back' : 'Link added', l.under_review ? `It ${l.review_reason}. Admins were notified.` : undefined, l.under_review ? 'warn' : 'success')
      onAdded()
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Add a link" subtitle="Any public https link, with a short label." footer={<Button loading={busy} disabled={!valid || label.length < 2} onClick={add}>Add link</Button>}>
      <div className="space-y-4">
        {names.length > 0 && <Field label="Artist"><Select value={nameId} onChange={(e) => setNameId(e.target.value)}>{names.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select></Field>}
        <Field label="Address" error={url.length > 8 && !valid ? 'Must be a public https link.' : undefined}><Input value={url} onChange={(e) => setUrl(e.target.value)} /></Field>
        <Field label="Label" hint="e.g. Spotify, New single, Shop, Tickets"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="When does it fit?" optional hint="Comma-separated words, e.g. tickets, concert"><Input value={kw} onChange={(e) => setKw(e.target.value)} /></Field>
        {error && <Callout tone="danger" icon={<AlertTriangle />}>{error}</Callout>}
      </div>
    </Modal>
  )
}

/* ── WA-10 Content ideas (Plus) ─────────────────────────────────────────── */

interface IdeasDto { day: string; regions: { region: string; fallback?: boolean; ideas: { idea: string; topic: string; confidence: 'low' | 'medium' | 'high'; why: string[] }[] }[] }

export function ContentIdeas() {
  const plan = useApi((s) => api.get<PlanDto | null>('/promotions', undefined, s), [])
  const ideas = useApi(plan.data?.tier === 'plus' ? (s) => api.get<IdeasDto>('/promotions/content-ideas', undefined, s) : null, [plan.data?.tier, plan.data?.target_regions.join()])
  const [saving, setSaving] = useState(false)
  const allRegions = useRegions()
  if (plan.error) return <ErrorState error={plan.error} onRetry={plan.reload} />
  if (plan.loading) return <Spinner />
  if (plan.data?.tier !== 'plus') return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Sparkles className="size-6" /></div>
      <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.03em] text-ink">Content ideas come with Plus</h1>
      <p className="mt-2 text-ink-2">Ideas based on what’s likely to trend in up to 5 regions you choose. $10 more per month, with twice the links.</p>
      <Button className="mt-6" size="lg" to="/app/wamiwa-agent">{plan.data ? 'Upgrade to Plus' : 'Get the Wamiwa Agent'}</Button>
    </div>
  )
  const regions = plan.data.target_regions
  const save = async (next: string[]) => {
    setSaving(true)
    try { await api.patch('/promotions', { target_regions: next }); plan.reload() } catch (e) { toast('Couldn’t update regions', errMsg(e), 'danger') } finally { setSaving(false) }
  }
  return (
    <div>
      <PageHeader back={{ to: '/app/wamiwa-agent', label: 'Wamiwa Agent' }} title="Content ideas" subtitle="Built from what’s measurably rising in each region (science) and its upcoming cultural moments (art). Suggestions, not guarantees." />
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-2 text-[13.5px] font-bold text-ink"><Globe2 className="size-4 text-brand" />Target regions</span><span className="text-[12px] text-ink-3">{regions.length}/5 · any country, anywhere in the world</span></div>
        <RegionPicker value={regions} onChange={save} max={5} disabled={saving} />
      </Card>
      {ideas.error ? <ErrorState error={ideas.error} onRetry={ideas.reload} /> : !ideas.data ? <Spinner className="min-h-40" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {ideas.data.regions.flatMap((r) => r.ideas.map((i, n) => (
            <Card key={r.region + n} className="p-5">
              <div className="flex items-center justify-between"><Badge tone="neutral" icon={<Globe2 className="size-3" />}>{regionName(r.region, allRegions)}</Badge><Badge tone={i.confidence === 'high' ? 'success' : i.confidence === 'medium' ? 'brand' : 'neutral'}>{i.confidence} confidence</Badge></div>
              <h3 className="mt-3 text-[16px] leading-snug font-extrabold text-ink">{i.idea}</h3>
              <p className="mt-2 text-[12.5px] text-ink-2">Why: {i.why.join(' · ')}</p>
              {r.fallback && <p className="mt-2 text-[12px] font-semibold text-warn">No measurable data yet — based on upcoming moments only</p>}
            </Card>
          )))}
          {ideas.data.regions.length === 0 && <p className="text-[13.5px] text-ink-2">Choose at least one region to get ideas.</p>}
        </div>
      )}
    </div>
  )
}

/* ── WA-02 Claim a name ─────────────────────────────────────────────────── */

export function ClaimName() {
  const [name, setName] = useState('')
  const [evidence, setEvidence] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await api.post('/promotions/names/claim', { name, evidence }); toast('Claim submitted', 'High priority in the Promotions queue. Both sides will be told the outcome.'); setName(''); setEvidence(''); setOk(false) } catch (e) { toast('Couldn’t submit', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="This is my name" subtitle="Any ID-verified adult or verified company can claim a name held on someone else’s plan." />
      <Card className="p-6">
        <Field label="Name you’re claiming"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. your stage name" /></Field>
        <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[13px] text-ink-2">
          <b className="text-ink">If you can already show it’s yours</b> (your handle, verified name, a connected social account, or your registered business name), the name’s cards pause at once while an admin decides. <b className="text-ink">If not,</b> the name stays live until an admin decides, so rivals can’t switch someone off by complaining.
        </div>
        <Field className="mt-5" label="Evidence"><Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Links, documents, anything that shows this name is yours." /></Field>
        <div className="mt-5"><Checkbox checked={ok} onChange={setOk}>I understand that if the claim is upheld, the name passes to me (onto my plan, or held for me for 180 days).</Checkbox></div>
        <Button className="mt-6" loading={busy} disabled={name.length < 2 || !ok} onClick={submit}>Submit claim</Button>
      </Card>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-3"><ArrowUpRight className="size-3.5" /><Link to="/app/support" className="hover:underline">How name ownership works</Link></p>
    </div>
  )
}
