import { useEffect, useState } from 'react'
import { Bot, Check, Clapperboard, Download, Eye, Heart, Lightbulb, Lock, MessageCircle, ShieldCheck, Sparkles, Star, UserPlus } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { fromMarketAgent } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { AnalyticsDto, MarketAgentDto } from '@/api/types'
import { useSession } from '@/context/session'
import { compact, date, naira, pct, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Field, PageHeader, Segmented, Select, Switch, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { SplitBar, TimeChart } from '@/components/charts/Charts'

const errMsg = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong')

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
      <p className="mt-6 text-[12.5px] text-ink-3">These are by niche. Trend-based ideas for target regions come with the Wamiwa Agent Plus package.</p>
    </div>
  )
}

/* ── AV-01 AI video ─────────────────────────────────────────────────────── */

interface Quote { tier: 'standard' | 'premium'; seconds: number; free_seconds_applied: number; price_cents: number; rate_cents_per_minute: number }
interface AiVideo { id: string; status: string; tier: string; seconds: number; script?: string; created_at: string; file?: string | null }

export function AIVideo() {
  const { role } = useSession()
  const [tier, setTier] = useState<'standard' | 'premium'>('standard')
  const [seconds, setSeconds] = useState(60)
  const [script, setScript] = useState('')
  const [busy, setBusy] = useState(false)
  const quote = useApi((s) => api.get<Quote>('/ai-videos/quote', { seconds, tier }, s), [seconds, tier])
  const list = useApi((s) => api.get<AiVideo[]>('/ai-videos', undefined, s), [])
  if (role === 'minor') return <Callout tone="neutral" icon={<Lock />} title="Not available">AI video is only available to under-18s inside a guardian-approved contract.</Callout>

  const generate = async () => {
    setBusy(true)
    try {
      await api.post('/ai-videos', { script, seconds, tier, payment_method: (quote.data?.price_cents ?? 0) > 0 ? 'tok_visa' : null })
      toast('Generating your video', 'Jobs over 10 minutes notify you when done. If it fails, you get a retry or an automatic refund.')
      setScript(''); list.reload(); quote.reload()
    } catch (e) { toast('Couldn’t start', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const download = async (id: string) => {
    try {
      const r = await api.get<{ url: string }>(`/ai-videos/${id}/download`)
      window.open(r.url, '_blank', 'noopener')
    } catch (e) { toast('Not ready yet', errMsg(e), 'warn') }
  }
  const q = quote.data
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
                    <div className="text-[12px] text-ink-2">{t === 'standard' ? '$3' : '$25'}/min{t === 'premium' && ' · brand quality'}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink">Length: <span className="num">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
              <input type="range" min={15} max={300} step={15} value={seconds} onChange={(e) => setSeconds(+e.target.value)} className="w-full accent-[var(--brand)]" />
              {q && q.free_seconds_applied > 0 && <div className="mt-2 text-[12px] font-semibold text-teal">{q.free_seconds_applied}s free this month (subscriber)</div>}
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-2 p-4">
            <div><div className="text-[12px] text-ink-2">Paid before generation</div><div className="text-[24px] font-extrabold text-ink num">{q ? usd(q.price_cents / 100) : '—'}</div></div>
            <Button size="lg" icon={<Sparkles className="size-4" />} loading={busy} disabled={script.trim().length < 10 || !q} onClick={generate}>{q && q.price_cents > 0 ? 'Pay & generate' : 'Generate'}</Button>
          </div>
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

interface SubDto { subscribed: boolean; status: string; period: 'monthly' | 'yearly' | null; renews_at: string | null; ends_at: string | null }
interface Plans { monthly: { usd_cents: number; local: number }; yearly: { usd_cents: number; local: number } }

export function Subscription() {
  const { refreshMe, me } = useSession()
  const sub = useApi((s) => api.get<SubDto>('/subscriptions', undefined, s), [])
  const plans = useApi((s) => api.get<Plans>('/subscriptions/plans', undefined, s), [])
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [busy, setBusy] = useState(false)
  if (sub.error) return <ErrorState error={sub.error} onRetry={sub.reload} />
  if (!sub.data || !plans.data) return <Spinner />
  const p = plans.data[cycle]
  const s = sub.data
  const active = s.subscribed && !s.ends_at
  const act = async () => {
    setBusy(true)
    try {
      if (active) { await api.del('/subscriptions'); toast('Subscription cancelled', 'Extras stay on until the end of the paid period.') }
      else { await api.post('/subscriptions', { payment_method: 'tok_visa', period: cycle }); toast('Subscribed!', 'Daily ideas start tomorrow morning.') }
      sub.reload(); void refreshMe()
    } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const rows = [
    ['Accept & decline offers, get paid', 'Yes', 'Yes', 'Unaffected'],
    ['Daily post ideas', '—', 'Yes', 'Stops next day'],
    ['Contact companies first about likeness', '—', 'Yes', 'Can still reply'],
    ['Agent auto-replies', '—', 'Yes', 'Stops (1-day notice)'],
    ['Paid AI video', '$3 / $25 per min', '1 free std minute / mo', 'Unaffected'],
    ['Subscriber badge on your profile', '—', 'Yes, with a verified ID', 'Removed'],
  ]
  const idVerified = me.verification !== 'none'
  return (
    <div>
      <PageHeader title="Subscription" subtitle="One plan. A lapsed subscription only switches off extras. It never cancels paid contracts or blocks earnings." />
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="bg-ink p-7 !ring-0 text-bg">
          <div className="flex items-center justify-between"><span className="text-[14px] font-bold opacity-70">Creator</span>{s.subscribed && <Badge tone="teal">{s.ends_at ? `Ends ${date(s.ends_at)}` : s.renews_at ? `Renews ${date(s.renews_at)}` : 'Active'}</Badge>}</div>
          {!active && <Segmented className="mt-5 !border-white/15 !bg-white/5 [&_button]:!text-white/70 [&_[aria-selected=true]]:!bg-white/15 [&_[aria-selected=true]]:!text-white" value={cycle} onChange={setCycle} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly · 2 months free' }]} />}
          <div className="mt-6 flex items-baseline gap-2"><span className="text-[52px] leading-none font-extrabold tracking-[-0.04em] num">{usd(p.usd_cents / 100)}</span><span className="opacity-70">/{cycle === 'monthly' ? 'month' : 'year'}</span></div>
          <div className="mt-1 text-[13px] opacity-60">Charged as {naira(p.local)} at today’s rate</div>
          <Button className="mt-7 w-full" variant={active ? 'secondary' : 'primary'} loading={busy} onClick={act}>{active ? 'Cancel subscription' : 'Subscribe'}</Button>
        </Card>
        <Card>
          <table className="w-full text-[13.5px]">
            <thead><tr className="border-b border-line text-left text-[12px] text-ink-2"><th className="px-5 py-3 font-semibold">Feature</th><th className="px-3 font-semibold">Free</th><th className="px-3 font-semibold">Subscribed</th><th className="px-5 font-semibold">If it lapses</th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r[0]}><td className="px-5 py-3 font-semibold text-ink">{r[0]}</td><td className="px-3 text-ink-2">{r[1]}</td><td className="px-3 font-semibold text-ink"><span className="flex items-center gap-1.5">{r[2] === 'Yes' && <Check className="size-4 text-teal" />}{r[2]}</span></td><td className="px-5 text-ink-2">{r[3]}</td></tr>)}</tbody>
          </table>
          {s.subscribed && !idVerified && (
            <Callout className="mx-5 mt-5" tone="warn" icon={<Star />} action={<Button size="sm" to="/app/verify">Verify ID</Button>}>
              Verify your ID to show your Subscriber badge. It only appears on verified accounts, so it always means a real person.
            </Callout>
          )}
          <p className="p-5 text-[12.5px] text-ink-3">The Wamiwa Agent plan and brand video plans are separate purchases.</p>
        </Card>
      </div>
    </div>
  )
}
