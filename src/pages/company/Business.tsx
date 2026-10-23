import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AtSign, Check, Copy, CreditCard, FileUp, Globe, KeyRound, Link2, Lock, MapPin, MessageSquare, Mic2, Plug, Plus, Receipt, RotateCcw, Send, ShieldCheck, Trash2,
} from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { fromPost } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { PostDto } from '@/api/types'
import { useSession } from '@/context/session'
import { date, naira, usd } from '@/lib/format'
import { LIMITS } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Empty, Field, Input, KV, Modal, PageHeader, Select, Stepper, Switch, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { BarList } from '@/components/charts/Charts'
import type { PlanDto } from '@/pages/wamiwa/WamiwaAgent'
import { RegionSelect, regionName, useRegions } from '@/components/ui/RegionPicker'

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

/* ── CO-03 B2B discovery ────────────────────────────────────────────────── */

interface Buyer { id: string; handle: string; name: string; category: string | null; region?: string | null }

export function B2B() {
  const regions = useRegions()
  const { meDto, refreshMe } = useSession()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [pitch, setPitch] = useState<Buyer | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const t = setTimeout(() => setQuery(q.replace(/^@/, '').trim()), 300); return () => clearTimeout(t) }, [q])
  const buyers = useApi((s) => api.get<Buyer[]>('/b2b/likely-buyers', { q: query, limit: 20 }, s), [query])
  const feed = useApi((s) => api.page<PostDto>('/b2b/feed', { limit: 10 }, s), [])
  const optOut = !!meDto?.company?.b2b_opt_out

  const send = async () => {
    if (!pitch) return
    setBusy(true)
    try {
      const m = await api.post<{ conversation_id: string }>('/messages', { recipient_id: pitch.id, body: text, attachments: [] })
      toast('Message sent', `${pitch.name} will see it in their Business inbox.`); setPitch(null); setText(''); nav(`/app/messages/${m.conversation_id}`)
    } catch (e) { toast('Couldn’t send', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const setOpt = async (v: boolean) => {
    try { await api.patch('/companies/settings', { b2b_opt_out: v }); void refreshMe(); toast(v ? 'Hidden from buyer lists' : 'Visible in buyer lists') } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') }
  }

  return (
    <div>
      <PageHeader title="B2B discovery" subtitle="Your posts are shown to companies likely to buy from you. Type @ to find likely buyers." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <Input icon={<AtSign />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="@ to list likely buyers" className="h-12 rounded-pill" />
          <p className="mt-2 text-[12.5px] text-ink-2">Likely buyers come from a category map maintained by Wamiwa{meDto?.company?.category ? ` (for ${cap(meDto.company.category)})` : ''}.</p>
          <Card className="mt-5 divide-y divide-line">
            {buyers.error ? <ErrorState compact error={buyers.error} onRetry={buyers.reload} /> : !buyers.data ? <Spinner className="min-h-32" /> : buyers.data.map((b) => (
              <div key={b.id} className="flex items-center gap-4 p-4">
                <Avatar name={b.name} kind="company" />
                <div className="min-w-0 flex-1"><div className="font-bold text-ink">{b.name}</div><div className="text-[12.5px] text-ink-2">{cap(b.category)}{b.region ? ` · ${regionName(b.region, regions)}` : ''} · @{b.handle}</div></div>
                <Button size="sm" variant="outline" icon={<Send className="size-3.5" />} onClick={() => setPitch(b)}>Pitch</Button>
              </div>
            ))}
            {buyers.data?.length === 0 && <Empty title="No likely buyers yet">When companies in categories that buy from yours join Wamiwa, they show up here.</Empty>}
          </Card>
          <h2 className="mt-8 mb-3 text-[16px] font-extrabold text-ink">From companies in your market</h2>
          <Card className="divide-y divide-line">
            {(feed.data?.data ?? []).map((p) => { const post = fromPost(p); return <div key={p.id} className="p-4 text-[14px]"><div className="text-[12.5px] font-bold text-ink-2">{p.author?.name}</div><p className="mt-1 text-ink">{post.text}</p></div> })}
            {feed.data && feed.data.data.length === 0 && <p className="p-6 text-center text-[13px] text-ink-2">Nothing yet.</p>}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="text-[13px] font-bold text-ink">New B2B conversations</div>
            <div className="mt-1 text-[13px] text-ink-2">Up to {LIMITS.b2bNewPerDay} a day. 3 spam reports remove B2B messaging for 30 days.</div>
          </Card>
          <Card className="p-5"><Switch checked={optOut} onChange={setOpt} label="Hide me from buyer lists" description="Other companies won’t see you as a likely buyer." /></Card>
          <Callout tone="neutral">Competitors see each other’s public posts only, never hires or prices.</Callout>
        </aside>
      </div>
      <Modal open={!!pitch} onClose={() => setPitch(null)} title={`Message ${pitch?.name}`} subtitle="Goes to their Business inbox." footer={<Button loading={busy} disabled={text.length < 5} onClick={send}>Send</Button>}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 w-full rounded-2xl border border-line bg-surface p-4 text-[14px] focus:border-brand focus:outline-none" placeholder="Introduce your business and what you offer." />
      </Modal>
    </div>
  )
}

/* ── API-03 Sentiment ───────────────────────────────────────────────────── */

interface SentimentDto { post_id: string; human_comments_analysed: number; sentiment: { positive: number; negative: number; neutral: number; uncertain: number }; languages: Record<string, number>; supported_languages: string[] }
const LANG: Record<string, string> = { en: 'English', pcm: 'Nigerian Pidgin', yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa' }

export function Sentiment() {
  const { me } = useSession()
  const posts = useApi((s) => api.page<PostDto>(`/profiles/${me.handle}/posts`, { limit: 20 }, s), [me.handle])
  const [postId, setPostId] = useState<string>()
  const current = postId ?? posts.data?.data[0]?.id
  const res = useApi(current ? (s) => api.get<SentimentDto>(`/companies/posts/${current}/sentiment`, undefined, s) : null, [current])
  if (posts.error) return <ErrorState error={posts.error} onRetry={posts.reload} />
  if (!posts.data) return <Spinner />
  if (!posts.data.data.length) return <Empty title="No posts yet">Sentiment is measured on reactions to your posts. Post something first.</Empty>
  const s = res.data
  const total = s ? s.sentiment.positive + s.sentiment.negative + s.sentiment.neutral + s.sentiment.uncertain : 0
  const parts = s ? ([['Positive', s.sentiment.positive, 'bg-success'], ['Neutral', s.sentiment.neutral, 'bg-mist'], ['Negative', s.sentiment.negative, 'bg-danger'], ['Uncertain', s.sentiment.uncertain, 'bg-warn']] as const) : []
  return (
    <div>
      <PageHeader title="Sentiment" subtitle="Reactions to your posts. Only human comments count, and your own API replies are left out." />
      <Field label="Post" className="mb-6 max-w-xl"><Select value={current} onChange={(e) => setPostId(e.target.value)}>{posts.data.data.map((p) => <option key={p.id} value={p.id}>{p.text.slice(0, 80) || 'Video post'} · {date(p.created_at)}</option>)}</Select></Field>
      {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : !s ? <Spinner className="min-h-40" /> : (
        <>
          <Card className="p-6">
            {total === 0 ? <p className="text-[14px] text-ink-2">No human comments on this post yet.</p> : (
              <>
                <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">{parts.map(([l, v, c]) => v > 0 && <div key={l} className={c} style={{ width: `${(v / total) * 100}%` }} title={`${l} ${v}`} />)}</div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {parts.map(([l, v, c]) => <div key={l}><div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2"><span className={cn('size-2 rounded-full', c)} />{l}</div><div className="text-[24px] font-extrabold text-ink num">{Math.round((v / total) * 100)}%</div></div>)}
                </div>
              </>
            )}
            <p className="mt-4 text-[12px] text-ink-3">{s.human_comments_analysed} human comments analysed. Low-confidence results are marked “uncertain” rather than guessed.</p>
          </Card>
          <Card className="mt-6 p-5">
            <h3 className="mb-4 text-[15px] font-bold text-ink">Human comments by language</h3>
            {Object.keys(s.languages).length ? <BarList rows={Object.entries(s.languages).map(([k, v]) => ({ label: LANG[k] ?? k, value: v }))} /> : <p className="text-[13px] text-ink-2">Supports {s.supported_languages.map((l) => LANG[l] ?? l).join(', ')}.</p>}
          </Card>
        </>
      )}
    </div>
  )
}

/* ── API-00/01/02 + MC-01 API keys ──────────────────────────────────────── */

interface KeyDto { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked: boolean; limits: { posts_per_hour: number; replies_per_hour: number }; api_key?: string }

export function ApiKeys() {
  const { me } = useSession()
  const keys = useApi((s) => api.get<KeyDto[]>('/api-keys', undefined, s), [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [created, setCreated] = useState<KeyDto | null>(null)
  const [busy, setBusy] = useState(false)
  const unverified = me.verification !== 'company'
  const create = async () => {
    setBusy(true)
    try { const k = await api.post<KeyDto>('/api-keys', { name }); setCreated(k); setCreating(false); setName(''); keys.reload() } catch (e) { toast('Couldn’t create key', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    try { await api.del(`/api-keys/${id}`); toast('Key revoked', 'Every call with this key now fails.', 'warn'); keys.reload() } catch (e) { toast('Couldn’t revoke', errMsg(e), 'danger') }
  }
  return (
    <div>
      <PageHeader title="API keys" subtitle="Company-scoped keys for the Company API. Revoking a key fails all its calls immediately." actions={<Button icon={<Plus className="size-4" />} disabled={unverified} onClick={() => setCreating(true)}>Create key</Button>} />
      {unverified && <Callout className="mb-6" tone="warn" icon={<Lock />}>Verify your business to use the API.</Callout>}
      <Card>
        <CardHeader title="Keys" subtitle={`${LIMITS.apiPostsPerHour} posts and ${LIMITS.apiRepliesPerHour} comment replies per key per hour.`} />
        {keys.error ? <ErrorState compact error={keys.error} onRetry={keys.reload} /> : (
          <div className="mt-3 divide-y divide-line">
            {(keys.data ?? []).map((k) => (
              <div key={k.id} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', k.revoked && 'opacity-50')}>
                <KeyRound className="size-5 text-ink-3" />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-bold text-ink">{k.name}{k.revoked && <Badge tone="danger">Revoked</Badge>}</div><div className="font-mono text-[12.5px] text-ink-2">{k.prefix}•••••••• · created {date(k.created_at)}{k.last_used_at ? ` · last used ${date(k.last_used_at)}` : ' · never used'}</div></div>
                {!k.revoked && <Button size="sm" variant="ghost" className="text-danger" onClick={() => revoke(k.id)}>Revoke</Button>}
              </div>
            ))}
            {keys.data?.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-2">No keys yet.</p>}
          </div>
        )}
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-[15px] font-bold text-ink">Safe retries</h3>
          <pre className="overflow-x-auto rounded-2xl bg-harbor p-4 font-mono text-[12px] leading-relaxed text-[#cfe4f7]">{`POST /api/company/v1/posts/{id}/comments/{cid}/replies
Authorization: Bearer wmk_…
Idempotency-Key: 7c1e2b9a-reply-cm6

{ "text": "Back in stock in all 6 prints!" }`}</pre>
          <p className="mt-3 text-[12.5px] text-ink-2">Repeat a request with the same key within 24h and you get the first response back; nothing happens twice. Reusing a key for a different request is refused.</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2"><Plug className="size-5 text-brand" /><h3 className="text-[15px] font-bold text-ink">Wamiwa MCP</h3><Badge tone="neutral">Planned</Badge></div>
          <p className="mt-2 text-[13px] text-ink-2">Connect your own AI assistant to your Wamiwa account, read-only for reporting, or read-and-write to post and reply.</p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[12.5px]">
            {['Post content', 'Read comments', 'Reply to comments', 'Sentiment reports', 'View contracts (read)', 'View earnings (read)'].map((t) => <li key={t} className="flex items-center gap-1.5 text-ink"><Check className="size-3.5 text-teal" />{t}</li>)}
            {['Hire or pay', 'Approve deliveries', 'Disputes'].map((t) => <li key={t} className="flex items-center gap-1.5 text-ink-3 line-through">{t}</li>)}
          </ul>
        </Card>
      </div>
      <Callout className="mt-6" tone="neutral">Replies made through the API appear under your company name with the Agent label. They don’t count as human engagement and are left out of sentiment.</Callout>
      <Modal open={creating} onClose={() => setCreating(false)} size="sm" title="Create an API key" footer={<Button loading={busy} disabled={name.length < 2} onClick={create}>Create</Button>}>
        <Field label="Name" hint="So you know where it’s used."><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Content pipeline" /></Field>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title="Your new API key" subtitle="Copy it now. You won’t be able to see it again." footer={<Button onClick={() => setCreated(null)}>Done</Button>}>
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 font-mono text-[13px]">
          <span className="flex-1 break-all">{created?.api_key}</span>
          <button onClick={() => { void navigator.clipboard?.writeText(created?.api_key ?? ''); toast('Copied') }} aria-label="Copy" className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-wash"><Copy className="size-4" /></button>
        </div>
      </Modal>
    </div>
  )
}

/* ── PY-03 + LK-10 Billing ──────────────────────────────────────────────── */

interface PaymentDto { id: string; purpose: string; amount_cents: number; amount_local: number; currency: string; status: string; refunded_local: number; created_at: string }
interface PricesDto { pay_per_video_cents: number; included_seconds: number; extra_final_render_cents: number; extra_minute_cents: number; plans: Record<'growth' | 'scale', { price_cents: number; videos: number }>; arcon_filing: unknown }
const PURPOSE: Record<string, string> = { subscription: 'Subscription', promotion: 'Wamiwa Agent', escrow: 'Escrow', contract: 'Escrow', video: 'Video production', video_plan: 'Video plan', ai_video: 'AI video', extra_render: 'Extra final render', arcon: 'ARCON filing' }

export function Billing() {
  const prices = useApi((s) => api.get<PricesDto>('/video-plans/prices', undefined, s), [])
  const plan = useApi((s) => api.get<{ active: boolean; plan?: string | null; videos_left: number; rollover_left: number; renews_at?: string | null }>('/video-plans', undefined, s), [])
  const payments = useApi((s) => api.page<PaymentDto>('/payments', { limit: 30 }, s), [])
  const [busy, setBusy] = useState(false)
  if (prices.error) return <ErrorState error={prices.error} onRetry={prices.reload} />
  if (!prices.data || !plan.data) return <Spinner />
  const pr = prices.data
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); toast(msg); plan.reload(); payments.reload() } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const cards = [
    { id: null, name: 'Pay per video', price: usd(pr.pay_per_video_cents / 100), sub: `per video, up to ${pr.included_seconds}s`, note: '4 drafts + 2 finals' },
    ...(['growth', 'scale'] as const).map((k) => ({ id: k, name: cap(k), price: usd(pr.plans[k].price_cents / 100), sub: `/month · ${pr.plans[k].videos} videos`, note: `About ${usd(pr.plans[k].price_cents / pr.plans[k].videos / 100)} each` })),
  ]
  const currentPlan = plan.data.active ? plan.data.plan ?? null : null
  return (
    <div>
      <PageHeader title="Billing & refunds" subtitle="Prices shown in USD, charged in Naira at the day’s rate and locked for each contract." />
      <h2 className="mb-3 text-[16px] font-extrabold text-ink">Video plan</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((p) => {
          const current = (p.id ?? null) === currentPlan || (!p.id && !plan.data!.active)
          return (
            <div key={p.name} className={cn('rounded-card border p-5', current ? 'border-brand bg-brand-soft/60 ring-4 ring-brand/10' : 'border-line bg-surface')}>
              <div className="flex items-center justify-between"><span className="font-bold text-ink">{p.name}</span>{current && <Badge>Current</Badge>}</div>
              <div className="mt-2 text-[28px] font-extrabold text-ink num">{p.price}<span className="ml-1 text-[13px] font-normal text-ink-2">{p.sub}</span></div>
              <div className="text-[12.5px] text-ink-2">{p.note}</div>
              {!current && p.id && <Button size="sm" className="mt-4" loading={busy} onClick={() => act(() => api.post('/video-plans', { plan: p.id, payment_method: 'tok_visa' }), `${p.name} plan started`)}>Choose {p.name}</Button>}
            </div>
          )
        })}
      </div>
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center gap-6">
          <div><div className="text-[12.5px] text-ink-2">Videos left</div><div className="text-[22px] font-extrabold text-ink num">{plan.data.active ? plan.data.videos_left : '—'}</div></div>
          <div><div className="text-[12.5px] text-ink-2">Rolled over</div><div className="text-[22px] font-extrabold text-ink num">{plan.data.rollover_left}</div></div>
          <div><div className="text-[12.5px] text-ink-2">Extra final render</div><div className="text-[22px] font-extrabold text-ink num">{usd(pr.extra_final_render_cents / 100)}</div></div>
          <div><div className="text-[12.5px] text-ink-2">Extra length</div><div className="text-[22px] font-extrabold text-ink num">{usd(pr.extra_minute_cents / 100)}/min</div></div>
          {plan.data.active && <Button className="ml-auto" size="sm" variant="ghost" loading={busy} onClick={() => act(() => api.del('/video-plans'), 'Plan cancelled at the end of the paid month')}>Cancel plan</Button>}
        </div>
        <p className="mt-3 text-[12px] text-ink-3">Unused plan videos roll over for one month, then expire. Cancelling takes effect at the end of the paid month.</p>
      </Card>

      <h2 className="mt-10 mb-3 text-[16px] font-extrabold text-ink">Payments & refunds</h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">Date</th><th className="px-3 font-semibold">For</th><th className="px-3 text-right font-semibold">USD</th><th className="px-3 text-right font-semibold">Charged</th><th className="px-5 text-right font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(payments.data?.data ?? []).map((p) => (
              <tr key={p.id}><td className="px-5 py-3 text-ink-2">{date(p.created_at)}</td><td className="px-3 font-semibold text-ink">{PURPOSE[p.purpose] ?? cap(p.purpose.replace(/_/g, ' '))}</td><td className="px-3 text-right num">{usd(p.amount_cents / 100)}</td><td className="px-3 text-right text-ink-2 num">{naira(p.amount_local)}</td><td className="px-5 text-right"><Badge tone={p.refunded_local ? 'warn' : p.status === 'succeeded' ? 'success' : 'neutral'}>{p.refunded_local ? `Refunded ${naira(p.refunded_local)}` : p.status}</Badge></td></tr>
            ))}
            {payments.data?.data.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-2">No payments yet.</td></tr>}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-4 p-5"><CreditCard className="size-6 text-brand" /><div className="flex-1"><div className="font-bold text-ink">Card payments</div><div className="text-[12.5px] text-ink-2">Cleared after the payment provider’s risk check. Refunds return within 5 working days.</div></div></Card>
        <Callout tone="neutral" icon={<RotateCcw />}>A chargeback after payout freezes your account and is pursued from you, not the creator.</Callout>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-3"><Receipt className="size-3.5" />Escrow for hires is shown on each contract.</p>
    </div>
  )
}

/* ── WA-04 Label roster ─────────────────────────────────────────────────── */

export function LabelRoster() {
  const plan = useApi((s) => api.get<PlanDto | null>('/promotions', undefined, s), [])
  const [name, setName] = useState('')
  if (plan.error) return <ErrorState error={plan.error} onRetry={plan.reload} />
  if (plan.loading) return <Spinner />
  if (!plan.data || plan.data.kind !== 'label') return <Empty icon={<Mic2 />} title="Label roster needs the Record label plan" action={<Button to="/app/wamiwa-agent">See Wamiwa Agent plans</Button>}>With the Record label plan ($80/month, up to 50 artists), each artist gets their own links and smart mention card.</Empty>
  const p = plan.data
  const add = async () => { try { await api.post('/promotions/names', { name }); toast('Artist added'); setName(''); plan.reload() } catch (e) { toast('Couldn’t add', errMsg(e), 'danger') } }
  const remove = async (id: string, n: string) => { try { await api.del(`/promotions/names/${id}`); toast(`${n} removed`, 'Their links were removed too.'); plan.reload() } catch (e) { toast('Couldn’t remove', errMsg(e), 'danger') } }
  return (
    <div>
      <PageHeader title="Label roster" subtitle={`${p.names.length} of 50 artists. Each artist has their own links; a mention of an artist shares only that artist’s links.`} />
      <Card className="mb-6 flex gap-2 p-4"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Artist stage name" /><Button icon={<Plus className="size-4" />} disabled={name.length < 2} onClick={add}>Add artist</Button></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {p.names.map((n) => {
          const links = p.links.filter((l) => l.name_id === n.id)
          return (
            <Card key={n.id} className="p-5">
              <div className="flex items-center justify-between"><span className="text-[16px] font-extrabold text-ink">{n.name}</span><Badge tone={n.status === 'approved' || n.status === 'live' ? 'success' : 'warn'}>{n.status.replace(/_/g, ' ')}</Badge></div>
              <div className="mt-3 space-y-2">
                {links.map((l) => <div key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]"><Link2 className="size-3.5 text-ink-3" /><span className="flex-1 font-semibold text-ink">{l.label}</span>{l.under_review && <Badge tone="danger">Held</Badge>}</div>)}
                {links.length === 0 && <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-[13px] text-ink-2"><Globe className="size-3.5" />{n.default_link ? n.default_link.label : 'Default: Spotify → YouTube Music → Audiomack'}</div>}
              </div>
              <div className="mt-4 flex gap-2"><Button size="sm" variant="outline" to="/app/wamiwa-agent" icon={<Plus className="size-3.5" />}>Add link</Button><Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-3.5" />} onClick={() => remove(n.id, n.name)}>Remove</Button></div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ── CO-04 Company settings ─────────────────────────────────────────────── */

export function CompanySettings() {
  const { meDto, refreshMe } = useSession()
  const c = meDto?.company
  const [allow, setAllow] = useState(!!c?.allow_user_messages)
  const [optOut, setOptOut] = useState(!!c?.b2b_opt_out)
  const [site, setSite] = useState(c?.website ?? '')
  const [region, setRegion] = useState(c?.region_targeting ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const save = async () => {
    setBusy(true); setError(undefined)
    try { await api.patch('/companies/settings', { allow_user_messages: allow, b2b_opt_out: optOut, website: site || null, region_targeting: region || null }); toast('Settings saved'); void refreshMe() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  if (!meDto) return <Spinner />
  return (
    <div className="max-w-3xl">
      <PageHeader title="Company settings" />
      <Card className="divide-y divide-line px-5">
        <Switch checked={allow} onChange={setAllow} label="Allow messages from users" description="When off, the message button is hidden on your profile for people." />
        <Switch checked={optOut} onChange={setOptOut} label="Opt out of buyer lists" description="You won’t appear as a likely buyer in B2B discovery." />
      </Card>
      <Card className="mt-6 p-5">
        <Field label="Website" hint="The default link the Wamiwa Agent shares when you haven’t added others. Checked for scams when set." error={error}>
          <Input icon={<Globe />} value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
        </Field>
      </Card>
      <Card className="mt-6 p-5">
        <div className="mb-2 flex items-center gap-2 text-[14px] font-bold text-ink"><MapPin className="size-4 text-brand" />Region targeting</div>
        <p className="mb-3 text-[13px] text-ink-2">Influencers in this country appear first. It never hides anyone completely.</p>
        <RegionSelect className="max-w-sm" value={region} onChange={setRegion} placeholder="No preference" />
      </Card>
      <Card className="mt-6 flex items-center gap-4 p-5"><MessageSquare className="size-5 text-brand" /><div className="flex-1"><div className="font-bold text-ink">Contact Wamiwa support</div><div className="text-[13px] text-ink-2">Payments and safety issues get a reply within 4 hours.</div></div><Button variant="outline" to="/app/support">Open ticket</Button></Card>
      <Button className="mt-6" loading={busy} onClick={save}>Save changes</Button>
    </div>
  )
}

/* ── CO-01 Business verification ────────────────────────────────────────── */

export function CompanyVerify() {
  const { meDto, me, refreshMe } = useSession()
  const c = meDto?.company
  const [reg, setReg] = useState('')
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  if (!meDto) return <Spinner />
  const status = c?.verification_status ?? (c?.verified ? 'passed' : 'not_started')
  const verified = !!c?.verified
  const step = verified ? 3 : status === 'pending' || status === 'in_review' ? 2 : status === 'not_started' ? 0 : 1
  const submit = async () => {
    setBusy(true)
    try {
      const form = new FormData(); form.append('kind', 'document'); form.append('file', file!)
      const up = await api.upload<{ ref: string }>('/uploads', form)
      await api.post('/companies/verification', { registration_no: reg, document_ref: up.ref })
      toast('Submitted', 'An admin reviews business documents within 2 working days.'); void refreshMe()
    } catch (e) { toast('Couldn’t submit', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title="Business verification" subtitle="Reviewed by an admin within 2 working days." />
      <Card className="p-6">
        <Stepper current={step} steps={['Account created', 'Documents submitted', 'Admin review', 'Verified']} />
        <div className="mt-8">
          {verified ? (
            <Callout tone="success" icon={<ShieldCheck />} title={`${me.name} is verified`}>Hiring, payments, B2B discovery, API access and the Wamiwa Agent are unlocked.</Callout>
          ) : status === 'pending' || status === 'in_review' ? (
            <Callout tone="warn" icon={<FileUp />} title="Under review">We’re checking your documents. Until then you can browse, but can’t pay, hire, message people about work or use APIs.</Callout>
          ) : (
            <div className="space-y-4">
              {status === 'failed' && <Callout tone="danger" title="Verification failed">Please check your documents and submit again.</Callout>}
              <Field label="Registration number (CAC RC or equivalent)"><Input value={reg} onChange={(e) => setReg(e.target.value)} placeholder="RC 1234567" /></Field>
              <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 py-6 text-[13.5px] text-ink-2 hover:border-brand"><FileUp className="size-5 text-brand" />{file ? file.name : 'Upload CAC certificate (PDF, JPG, PNG)'}<input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0])} /></label>
              <Button loading={busy} disabled={!reg || !file} onClick={submit}>Submit for review</Button>
            </div>
          )}
          <KV className="mt-6" rows={[['Business name', c?.business_name ?? me.name], ['Category', cap(c?.category) || '—'], ['Status', cap(status.replace(/_/g, ' '))]]} />
        </div>
      </Card>
    </div>
  )
}
