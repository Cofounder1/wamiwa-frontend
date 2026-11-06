import { useEffect, useState } from 'react'
import { Bot, Check, Clapperboard, Download, Eye, Heart, Lightbulb, Lock, MessageCircle, ShieldCheck, Sparkles, Star, UserPlus } from 'lucide-react'
import { api, errMsg, mediaUrl } from '@/api/client'
import { fromMarketAgent } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { AnalyticsDto, MarketAgentDto } from '@/api/types'
import { useSession } from '@/context/session'
import { compact, date, naira, pct, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Field, PageHeader, Progress, Segmented, Select, Switch, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { SplitBar, TimeChart } from '@/components/charts/Charts'
import { pay, REFUND_NOTE } from '@/components/payments/PaymentSheet'
import { isCancelled, paymentMethod } from '@/api/payments'

/* ── FD-06 + WA-08 Analytics ─────────────────────────────────────────────── */

interface WaStats {
  plan: { kind: string; tier: string; status: string }
  totals: { card_impressions: number; card_opens: number; link_clicks: number; agent_replies: number; list_impressions: number; list_clicks: number }
  rates: { card_open_rate_pct: number; card_click_rate_pct: number; list_click_rate_pct: number }
  by_day: { day: string; card_impressions?: number; card_opens?: number; link_clicks?: number }[]
  by_name: { name: string; card_impressions: number; card_opens: number; link_clicks: number }[]
  note: string
}

export function Analytics() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const res = useApi((s) => api.get<AnalyticsDto>('/analytics/me', { days }, s), [days])
  const [tab, setTab] = useState<'posts' | 'wamiwa'>('posts')
  const wa = res.data?.wamiwa_agent as WaStats | null | undefined

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Every number is split into human and agent. Only human followers and engagement count toward pricing, the likeness threshold and potential rating."
        actions={<Segmented size="sm" value={days} onChange={setDays} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }]} />} />
      {wa && <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'posts', label: 'Posts' }, { value: 'wamiwa', label: 'Wamiwa Agent' }]} />}
      {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : !res.data ? <Spinner /> : tab === 'posts' || !wa ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['Impressions', res.data.impressions, Eye],
              ['Engagement', res.data.engagement, Heart],
              ['Comments', res.data.comments, MessageCircle],
              ['New followers', res.data.follower_growth, UserPlus],
            ] as const).map(([label, split, I]) => (
              <Card key={label} className="p-5">
                <div className="flex items-center justify-between text-[13px] font-semibold text-ink-2">{label}<I className="size-4 text-ink-3" /></div>
                <div className="mt-2 text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink num">{compact(split.human + split.agent)}</div>
                <SplitBar className="mt-4" human={split.human} agent={split.agent} />
              </Card>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card flat className="p-5"><div className="text-[13px] font-semibold text-ink-2">Posts in the last {res.data.period_days} days</div><div className="mt-1 text-[24px] font-extrabold text-ink num">{res.data.posts}</div></Card>
            <Card flat className="p-5"><div className="text-[13px] font-semibold text-ink-2">Human engagement rate</div><div className="mt-1 text-[24px] font-extrabold text-ink num">{pct(res.data.human_engagement_rate, 1)}</div></Card>
            <Card flat className="p-5"><div className="text-[13px] font-semibold text-ink-2">Followers</div><div className="mt-1 text-[24px] font-extrabold text-ink num">{compact(res.data.followers.human)} <span className="text-[13px] font-semibold text-ink-3">human · {compact(res.data.followers.agent)} agent</span></div></Card>
          </div>
          <p className="mt-4 text-[12.5px] text-ink-3">{res.data.note} Company replies made through the API are not counted as human engagement.</p>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[['Card views', wa.totals.card_impressions], ['Card opens', wa.totals.card_opens], ['Link taps', wa.totals.link_clicks], ['Agent replies', wa.totals.agent_replies], ['Seller list views', wa.totals.list_impressions], ['Seller list taps', wa.totals.list_clicks]].map(([l, v]) => (
              <Card key={l as string} className="p-4"><div className="text-[12px] font-semibold text-ink-2">{l}</div><div className="mt-1 text-[22px] font-extrabold text-ink num">{compact(v as number)}</div></Card>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[['Open rate', wa.rates.card_open_rate_pct], ['Tap-through rate', wa.rates.card_click_rate_pct], ['List tap rate', wa.rates.list_click_rate_pct]].map(([l, v]) => (
              <Card flat key={l as string} className="flex items-center justify-between p-4"><span className="text-[13px] font-semibold text-ink-2">{l}</span><span className="text-[18px] font-extrabold text-ink num">{(v as number).toFixed(1)}%</span></Card>
            ))}
          </div>
          {wa.by_day.length > 1 && <Card className="mt-6 p-5"><TimeChart title="Card views per day" series={[{ name: 'Card views', color: 'var(--human)', data: wa.by_day.map((d) => ({ date: d.day, value: d.card_impressions ?? 0 })) }]} /></Card>}
          <Card className="mt-6">
            <CardHeader title="By name" subtitle={wa.note} />
            <table className="mt-3 w-full text-[13.5px]">
              <thead><tr className="border-y border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2 font-semibold">Name</th><th className="px-3 text-right font-semibold">Views</th><th className="px-3 text-right font-semibold">Opens</th><th className="px-5 text-right font-semibold">Taps</th></tr></thead>
              <tbody className="divide-y divide-line">
                {wa.by_name.map((n) => <tr key={n.name}><td className="px-5 py-2.5 font-semibold text-ink">{n.name}</td><td className="px-3 text-right num">{compact(n.card_impressions)}</td><td className="px-3 text-right num">{compact(n.card_opens)}</td><td className="px-5 text-right font-bold num">{compact(n.link_clicks)}</td></tr>)}
                {wa.by_name.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-ink-2">No activity yet. Results appear as adults mention your names.</td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}

/* ── FD-07 Daily post ideas ─────────────────────────────────────────────── */

export function PostIdeas() {
  const { me } = useSession()
  const res = useApi((s) => api.get<{ day: string; ideas: string[] }>('/post-ideas/today', undefined, s), [])
  if (res.error?.code === 'subscription_required') {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Lightbulb className="size-6" /></div>
        <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.03em] text-ink">Daily ideas for your niche</h1>
        <p className="mt-2 text-ink-2">Subscribers get fresh post ideas every morning, in the app and by email if you like.</p>
        <Button className="mt-6" size="lg" to="/app/subscription">See the subscription</Button>
      </div>
    )
  }
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  return (
    <div>
      <PageHeader title="Today’s post ideas" subtitle={`Ideas for ${me.niche ?? 'your niche'}, refreshed every morning · ${date(res.data.day)}`} />
      <div className="grid gap-4 md:grid-cols-3">
        {res.data.ideas.map((t, n) => (
          <Card key={n} className="flex flex-col p-6">
            <span className="text-[44px] leading-none font-extrabold text-brand/25 num">0{n + 1}</span>
            <h3 className="mt-3 flex-1 text-[18px] leading-snug font-extrabold text-ink">{t}</h3>
            <Button className="mt-5" variant="outline" to="/app/create">Use this idea</Button>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-[12.5px] text-ink-3">These are by niche. Trend-based ideas for countries you choose come with Pro, or the Wamiwa Agent Plus package for businesses.</p>
    </div>
  )
}

/* ── AV-01 AI video ─────────────────────────────────────────────────────── */

interface Quote { tier: 'standard' | 'premium'; seconds: number; free_seconds_applied: number; plan_videos_applied: number; plan_videos_left_after?: number; price_cents: number; rate_cents_per_minute: number }
interface VideoPlan { active: boolean; videos_left?: number; renews_at?: string; cancel_at_period_end?: boolean; terms: { price_cents: number; videos: number; minutes_per_video: number } }
interface AiVideo { id: string; status: string; tier: string; seconds: number; script?: string; created_at: string; file?: string | null }

export function AIVideo() {
  const { role, me } = useSession()
  const [tier, setTier] = useState<'standard' | 'premium'>('standard')
  const [seconds, setSeconds] = useState(60)
  const [script, setScript] = useState('')
  const [busy, setBusy] = useState(false)
  const quote = useApi((s) => api.get<Quote>('/ai-videos/quote', { seconds, tier }, s), [seconds, tier])
  const list = useApi((s) => api.get<AiVideo[]>('/ai-videos', undefined, s), [])
  const plan = useApi((s) => api.get<VideoPlan>('/ai-videos/plan', undefined, s), [])
  const [planBusy, setPlanBusy] = useState(false)
  if (role === 'minor') return <Callout tone="neutral" icon={<Lock />} title="Not available">AI video is only available to under-18s inside a guardian-approved contract.</Callout>

  // The backend only makes video of your own face, matched to your verified ID; check before anyone pays.
  const idVerified = me.verification !== 'none'
  const generate = async () => {
    setBusy(true)
    let paid = false
    try {
      // Price it again right before paying, so the payment is exactly what the backend charges.
      const fresh = await api.get<Quote>('/ai-videos/quote', { seconds, tier })
      quote.setData(fresh)
      const payment_method = fresh.price_cents > 0 ? await pay(fresh.price_cents, `AI video · ${seconds}s ${tier}`) : null
      paid = !!payment_method
      await api.post('/ai-videos', { script, seconds, tier, payment_method })
      toast('Generating your video', 'Jobs over 10 minutes notify you when done. If it fails, you get a retry or an automatic refund.')
      setScript(''); list.reload(); quote.reload(); plan.reload()
    } catch (e) {
      if (!isCancelled(e)) toast('Couldn’t start', paid ? `${errMsg(e)} ${REFUND_NOTE}` : errMsg(e), 'danger')
    } finally { setBusy(false) }
  }
  const planAction = async (action: 'subscribe' | 'keep' | 'cancel') => {
    setPlanBusy(true)
    let paid = false
    try {
      if (action === 'subscribe') {
        const payment_method = await pay(plan.data!.terms.price_cents, 'AI video plan · first month')
        paid = true
        await api.post('/ai-videos/plan', { payment_method })
        toast('Video plan started', `${plan.data!.terms.videos} videos this month, up to ${plan.data!.terms.minutes_per_video} minutes each.`)
      } else if (action === 'keep') {
        // A plan set to end is kept without paying again: the backend only clears the flag.
        await api.post('/ai-videos/plan', { payment_method: 'keep_plan' })
        toast('Plan kept', `It renews on ${date(plan.data!.renews_at!)}.`)
      } else { await api.del('/ai-videos/plan'); toast('Plan cancelled', 'Your videos stay usable until the month ends.') }
      plan.reload(); quote.reload()
    } catch (e) {
      if (!isCancelled(e)) toast('Couldn’t update the plan', paid ? `${errMsg(e)} ${REFUND_NOTE}` : errMsg(e), 'danger')
    } finally { setPlanBusy(false) }
  }
  const download = async (id: string) => {
    try {
      const r = await api.get<{ download: string }>(`/ai-videos/${id}/download`)
      window.open(mediaUrl(r.download), '_blank', 'noopener')
    } catch (e) { toast('Not ready yet', errMsg(e), 'warn') }
  }
  const q = quote.data
  // A quote for another length or quality (or one still loading) is not the price that will be charged.
  const quoteReady = !!q && !quote.loading && q.seconds === seconds && q.tier === tier
  return (
    <div>
      <PageHeader title="AI video" subtitle="Generate video of yourself from a script. Your own face only, matched to your verified ID." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <Field label="Script" hint="Lip movement and expressions follow your words. Out-of-sync renders are redone free."><Textarea className="min-h-48" value={script} onChange={(e) => setScript(e.target.value)} maxLength={5000} placeholder="Hey everyone! Today I’m showing you three ways to wear one Ankara wrap skirt…" /></Field>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink">Quality</div>
              <div className="grid grid-cols-2 gap-2">
                {(['standard', 'premium'] as const).map((t) => (
                  <button key={t} onClick={() => setTier(t)} className={cn('rounded-2xl border p-3 text-left transition', tier === t ? 'border-brand bg-brand-soft' : 'border-line hover:bg-wash')}>
                    <div className="text-[14px] font-bold text-ink capitalize">{t}</div>
                    <div className="text-[12px] text-ink-2">{t === 'standard' ? '$3/min or your plan' : '$25/min · brand quality'}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink">Length: <span className="num">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
              <input type="range" min={15} max={300} step={15} value={seconds} onChange={(e) => setSeconds(+e.target.value)} className="w-full accent-[var(--brand)]" />
              {q && q.plan_videos_applied > 0 && <div className="mt-2 text-[12px] font-semibold text-teal">Uses {q.plan_videos_applied} of your plan videos ({q.plan_videos_left_after} left after)</div>}
              {q && q.free_seconds_applied > 0 && <div className="mt-2 text-[12px] font-semibold text-teal">{q.free_seconds_applied}s free this month (subscriber)</div>}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-2 p-4">
            <div><div className="text-[12px] text-ink-2">{q && q.plan_videos_applied > 0 ? 'Covered by your plan' : 'Paid before generation'}</div><div className={cn('text-[24px] font-extrabold text-ink num', !quoteReady && 'opacity-50')}>{q ? usd(q.price_cents / 100) : '—'}</div></div>
            <Button size="lg" icon={<Sparkles className="size-4" />} loading={busy} disabled={script.trim().length < 10 || !quoteReady || !idVerified} onClick={generate}>{q && q.price_cents > 0 ? 'Pay & generate' : 'Generate'}</Button>
          </div>
          {!idVerified && (
            <Callout className="mt-4" tone="warn" icon={<ShieldCheck />} action={<Button size="sm" to="/app/verify">Verify ID</Button>}>
              Verify your ID first. AI video only uses your own face, matched to your verified identity.
            </Callout>
          )}
        </Card>
        <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center justify-between"><span className="text-[15px] font-bold text-ink">Video plan</span>{plan.data?.active && <Badge tone="teal">{plan.data.cancel_at_period_end ? `Ends ${date(plan.data.renews_at!)}` : `Renews ${date(plan.data.renews_at!)}`}</Badge>}</div>
          <div className="mt-2 flex items-baseline gap-1"><span className="text-[32px] font-extrabold tracking-[-0.03em] text-ink num">{usd((plan.data?.terms.price_cents ?? 3000) / 100)}</span><span className="text-ink-2">/mo</span></div>
          <div className="text-[13px] text-ink-2">{plan.data?.terms.videos ?? 15} videos for {plan.data?.terms.minutes_per_video ?? 2} min length each · standard quality</div>
          <p className="mt-2 text-[12px] text-ink-3">Longer videos use one per started 2 minutes, so a 5-minute video uses 3.</p>
          {plan.data?.active ? (
            <>
              <div className="mt-4 text-[13.5px] font-semibold text-ink"><span className="num">{plan.data.videos_left}</span> of {plan.data.terms.videos} videos left this month</div>
              <Progress className="mt-2" value={plan.data.videos_left ?? 0} max={plan.data.terms.videos} tone="teal" />
              {plan.data.cancel_at_period_end
                ? <Button className="mt-4 w-full" variant="outline" loading={planBusy} onClick={() => planAction('keep')}>Keep my plan</Button>
                : <Button className="mt-4 w-full" variant="ghost" loading={planBusy} onClick={() => planAction('cancel')}>Cancel plan</Button>}
            </>
          ) : <Button className="mt-4 w-full" loading={planBusy} onClick={() => planAction('subscribe')}>Get the plan</Button>}
        </Card>
        <Card>
          <CardHeader title="Your AI videos" subtitle="Labeled AI-generated on Wamiwa, watermarked when downloaded." />
          <ul className="mt-3 divide-y divide-line">
            {(list.data ?? []).map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-10 place-items-center rounded-xl bg-wash text-ink-2"><Clapperboard className="size-4" /></span>
                <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink capitalize">{v.tier} · {v.seconds}s</div><div className="text-[12px] text-ink-2">{date(v.created_at)} · {v.status}</div></div>
                {v.status === 'ready' && <Button size="xs" variant="outline" icon={<Download className="size-3.5" />} onClick={() => download(v.id)}>Download</Button>}
              </li>
            ))}
            {list.data && list.data.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-ink-2">No videos yet.</li>}
          </ul>
        </Card>
        </div>
      </div>
    </div>
  )
}

/* ── AG-05 Auto-reply agent ─────────────────────────────────────────────── */

export function AutoReply() {
  const { subscribed, role } = useSession()
  const agents = useApi((s) => api.page<MarketAgentDto>('/marketplace/agents', { limit: 20 }, s), [])
  const [agentId, setAgentId] = useState('')
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const options = (agents.data?.data ?? []).filter((a) => a.handle !== 'wamiwa')
  useEffect(() => { if (!agentId && options[0]) setAgentId(options[0].id) }, [options, agentId])
  if (role === 'minor') return <Callout tone="neutral" icon={<Lock />} title="Not available on minor accounts" />
  const apply = async (enabled: boolean) => {
    setBusy(true)
    try {
      await api.call('PUT', '/auto-reply', { query: { enabled, agent_id: enabled ? agentId : undefined } })
      setOn(enabled)
      toast(enabled ? 'Auto-replies on' : 'Auto-replies off', enabled ? 'Replies are labeled “Agent — replying for you”. You can delete any of them.' : undefined)
    } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const chosen = options.find((a) => a.id === agentId)
  return (
    <div>
      <PageHeader title="Auto-reply agent" subtitle="An agent reads and replies to comments for you. Every reply is labeled “Agent — replying for @you”, and you can delete any of them." />
      {!subscribed && <Callout className="mb-6" tone="brand" title="Auto-replies come with a subscription" action={<Button size="sm" to="/app/subscription">Subscribe</Button>}>If your subscription lapses, auto-replies stop. We’ll give you notice the day before.</Callout>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5">
          <Field label="Agent that replies for you">
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} disabled={!subscribed}>{options.map((a) => <option key={a.id} value={a.id}>{a.name} · by {a.owner.name}</option>)}</Select>
          </Field>
          {chosen && <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3"><Avatar src={fromMarketAgent(chosen).avatar} name={chosen.name} kind="agent" size="sm" /><p className="text-[13px] text-ink-2">{chosen.description}</p></div>}
          <div className="mt-4 border-t border-line pt-2"><Switch checked={on} disabled={!subscribed || busy || !agentId} onChange={apply} label="Reply to comments for me" description="Delete any reply from the comment itself." /></div>
        </Card>
        <Card flat className="h-fit p-5">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-ink"><ShieldCheck className="size-4 text-brand" />Brand rules still apply</h3>
          <p className="mt-1 text-[12.5px] text-ink-2">Brand contracts with a “no AI replies” flag turn auto-replies off on that contract’s sponsored posts only. Other posts aren’t affected.</p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3"><Bot className="size-3.5" />Auto-replies aren’t available on minor accounts.</p>
        </Card>
      </div>
    </div>
  )
}

/* ── SB-01 Subscription ─────────────────────────────────────────────────── */

type Tier = 'standard' | 'pro'
interface SubDto { subscribed: boolean; status: string; period: 'monthly' | 'yearly' | null; tier?: Tier; next_tier?: Tier | null; renews_at: string | null; ends_at: string | null }
interface Price { usd_cents: number; local: number }
interface TierDto { name: string; features: string[]; monthly: Price; yearly: Price }
interface Plans { monthly: Price; yearly: Price; tiers: Record<Tier, TierDto> }

export function Subscription() {
  const { refreshMe, me } = useSession()
  const sub = useApi((s) => api.get<SubDto>('/subscriptions', undefined, s), [])
  const plans = useApi((s) => api.get<Plans>('/subscriptions/plans', undefined, s), [])
  const method = useApi(() => paymentMethod(), [])
  // SB-03: moving up from Creator costs only the difference for the days left; show that amount before paying.
  const upgrade = useApi((sig) => api.get<{ amount_cents: number; until: string }>('/subscriptions/upgrade-quote', undefined, sig)
    .catch(() => null), [sub.data?.tier, sub.data?.subscribed])
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [busy, setBusy] = useState<string | null>(null)
  if (sub.error) return <ErrorState error={sub.error} onRetry={sub.reload} />
  if (!sub.data || !plans.data) return <Spinner />
  const s = sub.data
  const current: Tier | null = s.subscribed ? (s.tier ?? 'standard') : null
  const cancelled = !!s.ends_at
  const period = current ? (s.period ?? 'monthly') : cycle
  // `paid` is set once money has been taken, so a failure after that says it will be refunded.
  const run = async (key: string, call: (paid: () => void) => Promise<unknown>, title: string, body?: string) => {
    setBusy(key)
    let charged = false
    try { await call(() => { charged = true }); toast(title, body); sub.reload(); void refreshMe() } catch (e) {
      if (!isCancelled(e)) toast('Couldn’t update', charged ? `${errMsg(e)} ${REFUND_NOTE}` : errMsg(e), 'danger')
    } finally { setBusy(null) }
  }
  const plansData = plans.data
  const subscribe = (tier: Tier) => run(tier, async (paid) => {
    const payment_method = await pay(plansData.tiers[tier][cycle].usd_cents, `${plansData.tiers[tier].name} subscription · ${cycle}`)
    paid()
    return api.post('/subscriptions', { payment_method, period: cycle, tier })
  }, 'Subscribed!', tier === 'pro' ? 'Your partner suggestions are ready.' : 'Daily ideas start tomorrow morning.')
  // After cancelling, renewing the same plan charges a full period, added on from the current end date.
  const renew = () => run('renew', async (paid) => {
    const tier = current ?? 'standard'
    const payment_method = await pay(plansData.tiers[tier][period].usd_cents, `${plansData.tiers[tier].name} subscription · renew ${period}`)
    paid()
    return api.post('/subscriptions', { payment_method, period, tier })
  }, 'Subscription renewed', `Your plan continues after ${s.ends_at ? date(s.ends_at) : 'this period'}, with a new ${period === 'yearly' ? 'year' : 'month'} added on.`)
  // Moving up to Pro costs the difference for the days left (the backend quotes it); anything else isn't charged.
  const change = (tier: Tier) => run(tier, async (paid) => {
    const charged = tier === 'pro' && current !== 'pro'
    const payment_method = charged
      ? await (async () => {
        const q = await api.get<{ amount_cents: number; until: string }>('/subscriptions/upgrade-quote')
        return pay(q.amount_cents, `Upgrade to Pro: the difference for the days left until ${date(q.until)}`)
      })()
      : 'not_charged'
    if (charged) paid()
    return api.patch('/subscriptions', { payment_method, tier })
  },
    tier === 'pro' ? 'Upgraded to Pro' : current === 'pro' && s.next_tier ? 'Staying on Pro' : 'Switching to Creator',
    tier === 'pro' ? (s.next_tier ? 'Your plan stays on Pro.' : 'You paid only the difference for the days left.') : `Pro stays on until ${date(s.renews_at!)}.`)
  const rows = [
    ['Accept & decline offers, get paid', 'Yes', 'Yes', 'Yes'],
    ['Daily post ideas', '—', 'Yes', 'Yes'],
    ['Contact companies first about likeness', '—', 'Yes', 'Yes'],
    ['Agent auto-replies', '—', 'Yes', 'Yes'],
    ['Paid AI video', '$3 / $25 per min', '1 free std min / mo', '1 free std min / mo'],
    ['Subscriber badge (with a verified ID)', '—', 'Yes', 'Yes'],
    ['Up to 50 businesses to partner with', '—', '—', 'Yes'],
    ['Content ideas for countries you choose', '—', '—', 'Yes'],
    ['Hire agents to summarize your chats', '—', '—', 'Yes'],
  ]
  const idVerified = me.verification !== 'none'
  const inNaira = method.data?.currency === 'NGN'
  return (
    <div>
      <PageHeader title="Subscription" subtitle="Two plans. A lapsed subscription only switches off extras. It never cancels paid contracts or blocks earnings." />
      {!current && (
        <Segmented className="mb-5" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly · 2 months free' }]} />
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {(['standard', 'pro'] as Tier[]).map((tier) => {
          const t = plans.data!.tiers[tier]
          const price = t[period]
          const isCurrent = current === tier
          const pending = current === 'pro' && tier === 'standard' && s.next_tier === 'standard'
          return (
            <Card key={tier} className={cn('flex flex-col p-6', tier === 'pro' && 'bg-ink !ring-0 text-bg')}>
              <div className="flex items-center justify-between">
                <span className={cn('text-[15px] font-bold', tier === 'pro' ? 'opacity-80' : 'text-ink')}>{t.name}</span>
                {isCurrent && <Badge tone="teal">{cancelled ? `Ends ${date(s.ends_at!)}` : s.next_tier && s.next_tier !== tier ? `Until ${date(s.renews_at!)}` : `Renews ${date(s.renews_at!)}`}</Badge>}
                {pending && <Badge tone="warn">From {date(s.renews_at!)}</Badge>}
              </div>
              <div className="mt-4 flex items-baseline gap-2"><span className="text-[44px] leading-none font-extrabold tracking-[-0.04em] num">{usd(price.usd_cents / 100)}</span><span className={tier === 'pro' ? 'opacity-70' : 'text-ink-2'}>/{period === 'monthly' ? 'month' : 'year'}</span></div>
              {method.data && <div className={cn('mt-1 text-[12.5px]', tier === 'pro' ? 'opacity-60' : 'text-ink-3')}>{inNaira ? `Charged as ${naira(price.local)} at today’s rate${method.data.paypal.available ? ' (PayPal in US dollars)' : ''}` : 'Charged in US dollars'}</div>}
              <ul className="mt-5 flex-1 space-y-2">
                {t.features.map((f) => <li key={f} className={cn('flex gap-2 text-[13.5px]', tier === 'pro' ? 'opacity-90' : 'text-ink-2')}><Check className={cn('mt-0.5 size-4 shrink-0', tier === 'pro' ? 'text-brand' : 'text-teal')} />{f}</li>)}
              </ul>
              <div className="mt-6">
                {!current && <Button className="w-full" variant={tier === 'pro' ? 'primary' : 'outline'} loading={busy === tier} onClick={() => subscribe(tier)}>Subscribe to {t.name}</Button>}
                {current && !isCurrent && !cancelled && (tier === 'pro'
                  ? <>
                      <Button className="w-full" loading={busy === tier} onClick={() => change('pro')}>
                        {upgrade.data ? `Upgrade now · ${usd(upgrade.data.amount_cents / 100)}` : 'Upgrade to Pro'}
                      </Button>
                      {upgrade.data && <p className="mt-2 text-center text-[12px] opacity-70">You pay only the difference for the days left until {date(upgrade.data.until)}. Then {usd(price.usd_cents / 100)}/{period === 'monthly' ? 'month' : 'year'}.</p>}
                    </>
                  : pending ? <Button className="w-full" variant="secondary" loading={busy === 'pro'} onClick={() => change('pro')}>Keep Pro instead</Button>
                    : <Button className="w-full" variant="outline" loading={busy === tier} onClick={() => change('standard')}>Switch to Creator at renewal</Button>)}
                {isCurrent && cancelled && <Button className="w-full" variant={tier === 'pro' ? 'primary' : 'outline'} loading={busy === 'renew'} onClick={renew}>Renew · {usd(price.usd_cents / 100)}</Button>}
                {isCurrent && !cancelled && <Button className="w-full" variant={tier === 'pro' ? 'secondary' : 'outline'} loading={busy === 'cancel'} onClick={() => run('cancel', () => api.del('/subscriptions'), 'Subscription cancelled', 'Extras stay on until the end of the paid period.')}>Cancel subscription</Button>}
                {isCurrent && tier === 'pro' && <Button className="mt-2 w-full" variant="link" to="/app/grow">Open Pro tools</Button>}
              </div>
            </Card>
          )
        })}
      </div>
      {s.subscribed && !idVerified && (
        <Callout className="mt-5" tone="warn" icon={<Star />} action={<Button size="sm" to="/app/verify">Verify ID</Button>}>
          Verify your ID to show your Subscriber badge. It only appears on verified accounts, so it always means a real person.
        </Callout>
      )}
      <Card className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead><tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-5 py-3 font-semibold">Feature</th><th className="px-3 font-semibold">Free</th><th className="px-3 font-semibold">Creator</th><th className="px-5 font-semibold">Pro</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r[0]}><td className="px-5 py-3 font-semibold text-ink">{r[0]}</td>{r.slice(1).map((v, i) => <td key={i} className={cn(i === 2 ? 'px-5' : 'px-3', v === 'Yes' ? 'font-semibold text-ink' : 'text-ink-2')}><span className="flex items-center gap-1.5">{v === 'Yes' && <Check className="size-4 text-teal" />}{v}</span></td>)}</tr>)}</tbody>
        </table>
        <p className="p-5 text-[12.5px] text-ink-3">Upgrading to Pro starts now and costs only the difference for the days left. Moving back to Creator takes effect at renewal. If a subscription lapses, extras switch off; paid contracts and earnings are never affected. The Wamiwa Agent plan and brand video plans are separate purchases.</p>
      </Card>
    </div>
  )
}
