import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, EyeOff, Lock, Megaphone, ShieldAlert, Trash2 } from 'lucide-react'
import { api, API_URL, ApiError, auth, errMsg } from '@/api/client'
import { useApi } from '@/api/hooks'
import { compact, date, int, naira, usd } from '@/lib/format'
import { NICHES, TARGETS } from '@/lib/rules'
import { Badge, Button, Callout, Card, CardHeader, Field, KV, Modal, PageHeader, Segmented, Select, Stat, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { useSession } from '@/context/session'
import { ErrorState, Spinner } from '@/components/ui/states'
import { BarList, TargetMeter } from '@/components/charts/Charts'
import { RegionSelect } from '@/components/ui/RegionPicker'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
export interface Perms { suspend: boolean; approve_payouts: boolean; b2b_category_map: boolean; view_dashboard: boolean; view_revenue: boolean; investigate?: boolean }
export const usePerms = () => useApi((s) => api.get<Perms>('/admin/me/permissions', undefined, s), [])

interface Metrics {
  growth: { dau: number; mau: number; dau_mau_ratio: number; new_signups_by_role: Record<string, number> }
  retention: { user_churn_pct: number; subscriber_churn_pct: number; brand_churn_pct: number; cohorts: { signup_month: string; signed_up: number; retained: number; retention_pct: number }[] }
  revenue?: { currency: string; gross_escrow_value: number; gross_escrow_value_usd: number; fees_by_type: Record<string, number>; subscription_revenue: number; mrr_usd: number; paying_subscribers: number; refunds: number }
  marketplace: { completed_contracts: number; repeat_brand_rate_pct: number; median_days_to_active: number | null; verified_influencers_with_paid_contract_pct: number }
  trust_and_safety: { dispute_rate_pct: number; misuse_takedowns: number; misuse_takedown_rate_pct: number; reports_by_reason: Record<string, number>; suspensions: number }
  verification: Record<'identity' | 'company' | 'public_figure', { started: number; passed: number; failed: number; waiting: number }>
  wamiwa_agent: Record<string, number>
  agents: { active_agents: number; content_count: number; video_hours: number; free_tags: number; helpful_rating_pct: number }
}
interface Dashboard { range: { start: string; end: string }; metrics: Metrics; previous_period?: Metrics }

const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const

export function Filters({ range, setRange, role, setRole, niche, setNiche, region, setRegion, onExport }: {
  range: keyof typeof RANGES; setRange: (r: keyof typeof RANGES) => void; role: string; setRole: (r: string) => void
  niche?: string; setNiche?: (n: string) => void; region: string; setRegion: (r: string) => void; onExport?: () => void
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Segmented size="sm" value={range} onChange={setRange} options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }]} />
      <Select className="!h-9 !w-40 text-[13px]" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="user">People</option><option value="company">Companies</option><option value="agent">Agents</option></Select>
      {setNiche && <Select className="!h-9 !w-44 text-[13px]" value={niche ?? ''} onChange={(e) => setNiche(e.target.value)}><option value="">All niches</option>{NICHES.map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}</Select>}
      <RegionSelect className="!h-9 !w-44 text-[13px]" value={region} onChange={setRegion} placeholder="All regions" />
      {onExport && <Button size="sm" variant="outline" className="ml-auto" icon={<Download className="size-3.5" />} onClick={onExport}>Export CSV</Button>}
    </div>
  )
}

const delta = (cur: number, prev?: number) => (prev === undefined || prev === 0 ? undefined : ((cur - prev) / prev) * 100)

/* ── AD-05 Overview ─────────────────────────────────────────────────────── */

export function AdminOverview() {
  const perms = usePerms()
  const superA = useSession().role === 'super_admin'
  const [range, setRange] = useState<keyof typeof RANGES>('30d')
  const [role, setRole] = useState('')
  const [niche, setNiche] = useState('')
  const [region, setRegion] = useState('')
  const [tab, setTab] = useState<'growth' | 'marketplace' | 'safety' | 'agents'>('growth')
  const start = new Date(Date.now() - RANGES[range] * 864e5).toISOString()
  const query = { start, role: role || undefined, niche: niche || undefined, region: region || undefined, compare: true }
  const res = useApi((s) => api.get<Dashboard>('/admin/dashboard', query, s), [range, role, niche, region])
  // Queue health is Super Admin only (AQ-03); other admins don't see the past-target banner.
  const health = useApi(superA ? (s) => api.get<{ per_queue: Record<string, { waiting: number; past_target: number }> }>('/admin/queues/health', undefined, s) : null, [superA])

  const exportCsv = async () => {
    try {
      const u = new URL(`${API_URL}/admin/dashboard/export.csv`)
      Object.entries(query).forEach(([k, v]) => v !== undefined && u.searchParams.set(k, String(v)))
      const r = await fetch(u, { headers: { authorization: `Bearer ${auth.tokens?.access}` } })
      if (!r.ok) throw new ApiError(r.status, 'export', 'Export failed')
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = `wamiwa-dashboard-${range}.csv`; a.click(); URL.revokeObjectURL(url)
    } catch (e) { toast('Couldn’t export', errMsg(e), 'danger') }
  }

  if (perms.data && !perms.data.view_dashboard) return <Callout tone="neutral" title="Dashboard access not granted">A Super Admin can give you the dashboard permission. Your queues are still available.</Callout>
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  const m = res.data?.metrics
  const p = res.data?.previous_period
  const late = Object.entries(health.data?.per_queue ?? {}).filter(([, v]) => v.past_target > 0)
  const canRevenue = !!perms.data?.view_revenue && !!m?.revenue

  const kpis: { label: string; value: number; target: number; fmt: (n: number) => string; inverse?: boolean; hidden?: boolean }[] = m ? [
    { label: 'Completed contracts', value: m.marketplace.completed_contracts, target: TARGETS.completedContracts, fmt: int },
    { label: 'Gross value through escrow', value: m.revenue?.gross_escrow_value_usd ?? 0, target: TARGETS.escrowGmv, fmt: (n) => usd(n), hidden: !canRevenue },
    { label: 'Paying subscribers', value: m.revenue?.paying_subscribers ?? 0, target: TARGETS.payingSubscribers, fmt: int, hidden: !canRevenue },
    { label: 'Verified influencers with a paid contract', value: m.marketplace.verified_influencers_with_paid_contract_pct / 100, target: TARGETS.verifiedWithContract, fmt: (n) => `${(n * 100).toFixed(0)}%` },
    { label: 'Brands hiring again within 90 days', value: m.marketplace.repeat_brand_rate_pct / 100, target: TARGETS.repeatBrand, fmt: (n) => `${(n * 100).toFixed(0)}%` },
    { label: 'Median days offer → active', value: m.marketplace.median_days_to_active ?? 0, target: TARGETS.medianDaysToActive, fmt: (n) => `${n.toFixed(1)}d`, inverse: true },
    { label: 'Dispute rate', value: m.trust_and_safety.dispute_rate_pct / 100, target: TARGETS.disputeRate, fmt: (n) => `${(n * 100).toFixed(1)}%`, inverse: true },
    { label: 'Likeness takedowns for misuse', value: m.trust_and_safety.misuse_takedown_rate_pct / 100, target: TARGETS.likenessTakedown, fmt: (n) => `${(n * 100).toFixed(1)}%`, inverse: true },
    { label: 'Agent comments rated helpful', value: m.agents.helpful_rating_pct / 100, target: TARGETS.agentHelpful, fmt: (n) => `${(n * 100).toFixed(0)}%` },
    { label: 'Monthly active users', value: m.growth.mau, target: TARGETS.mau, fmt: compact },
  ] : []

  return (
    <div>
      <PageHeader eyebrow="Platform" title="Overview" subtitle="Success metrics against their 6-month targets. Review targets after the first 60 days of data." />
      <Filters range={range} setRange={setRange} role={role} setRole={setRole} niche={niche} setNiche={setNiche} region={region} setRegion={setRegion} onExport={exportCsv} />
      {late.length > 0 && <Callout className="mb-6" tone="warn" icon={<AlertTriangle />} title={`${late.reduce((n, [, v]) => n + v.past_target, 0)} queue ${late.length === 1 ? 'item' : 'items'} past target`} action={<Button size="sm" to="/admin/queues">Open queues</Button>}>{late.map(([q]) => cap(q)).join(', ')}</Callout>}
      {!m ? <Spinner /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label} className="flex flex-col p-4">
                <div className="min-h-9 text-[12px] leading-snug font-semibold text-ink-2">{k.label}</div>
                {k.hidden ? <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-3"><EyeOff className="size-3.5" />Needs revenue permission</div> : (
                  <>
                    <div className="mt-1 mb-3 text-[24px] font-extrabold tracking-[-0.03em] text-ink num">{k.fmt(k.value)}</div>
                    <div className="mt-auto"><TargetMeter value={k.value} target={k.target} inverse={k.inverse} format={k.fmt} /></div>
                  </>
                )}
              </Card>
            ))}
          </div>

          <Tabs className="mt-10" value={tab} onChange={setTab} tabs={[{ value: 'growth', label: 'Growth & revenue' }, { value: 'marketplace', label: 'Marketplace & verification' }, { value: 'safety', label: 'Trust & safety' }, { value: 'agents', label: 'Agents & Wamiwa Agent' }]} />
          <div className="mt-6">
            {tab === 'growth' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
                  <Stat label="Daily active users" value={compact(m.growth.dau)} trend={delta(m.growth.dau, p?.growth.dau)} />
                  <Stat label="Monthly active users" value={compact(m.growth.mau)} trend={delta(m.growth.mau, p?.growth.mau)} />
                  <Stat label="DAU / MAU" value={`${(m.growth.dau_mau_ratio * 100).toFixed(0)}%`} />
                </div>
                <Card className="p-5"><h3 className="mb-4 text-[15px] font-bold text-ink">New signups by role</h3>{Object.keys(m.growth.new_signups_by_role).length ? <BarList rows={Object.entries(m.growth.new_signups_by_role).map(([k, v]) => ({ label: cap(k), value: v }))} /> : <p className="text-[13px] text-ink-2">No signups in this period.</p>}</Card>
                <Card className="p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-ink">Retention & churn</h3>
                  <KV rows={[['User churn (30 days inactive)', `${m.retention.user_churn_pct.toFixed(1)}%`], ['Subscriber churn', `${m.retention.subscriber_churn_pct.toFixed(1)}%`], ['Brand churn (90 days, no contract)', `${m.retention.brand_churn_pct.toFixed(1)}%`], ...m.retention.cohorts.map((c) => [`Cohort ${c.signup_month}`, `${c.retention_pct.toFixed(0)}% of ${c.signed_up}`] as [string, string])]} />
                </Card>
                <Card className="p-5 lg:col-span-2">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold text-ink">Revenue</h3>{!canRevenue && <Badge tone="neutral" icon={<EyeOff className="size-3" />}>Hidden — needs revenue permission</Badge>}</div>
                  {canRevenue && m.revenue ? (
                    <div className="grid gap-4 sm:grid-cols-5">
                      {[['Gross through escrow', naira(m.revenue.gross_escrow_value)], ['Subscription revenue', naira(m.revenue.subscription_revenue)], ['MRR', usd(m.revenue.mrr_usd)], ['Refunds', naira(m.revenue.refunds)], ...Object.entries(m.revenue.fees_by_type).map(([k, v]) => [`${cap(k)} fees`, naira(v)])].map(([l, v]) => <div key={l}><div className="text-[12px] text-ink-2">{l}</div><div className="text-[18px] font-extrabold text-ink num">{v}</div></div>)}
                    </div>
                  ) : <div className="h-16 rounded-xl bg-[repeating-linear-gradient(45deg,var(--wash),var(--wash)_8px,transparent_8px,transparent_16px)]" />}
                </Card>
              </div>
            )}
            {tab === 'marketplace' && (
              <div className="grid gap-6 lg:grid-cols-3">
                {(['identity', 'company', 'public_figure'] as const).map((k) => (
                  <Card key={k} className="p-5"><h3 className="mb-4 text-[15px] font-bold text-ink">{cap(k)} verification</h3><BarList rows={(['started', 'passed', 'failed', 'waiting'] as const).map((s) => ({ label: cap(s), value: m.verification[k][s] }))} /></Card>
                ))}
              </div>
            )}
            {tab === 'safety' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-5"><h3 className="mb-4 text-[15px] font-bold text-ink">Reports by reason</h3>{Object.keys(m.trust_and_safety.reports_by_reason).length ? <BarList color="var(--agent)" rows={Object.entries(m.trust_and_safety.reports_by_reason).map(([k, v]) => ({ label: cap(k), value: v }))} /> : <p className="text-[13px] text-ink-2">No reports in this period.</p>}</Card>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Stat label="Suspensions" value={m.trust_and_safety.suspensions} />
                  <Stat label="Misuse takedowns" value={m.trust_and_safety.misuse_takedowns} />
                  <Stat label="Dispute rate" value={`${m.trust_and_safety.dispute_rate_pct.toFixed(1)}%`} />
                  <Stat label="Misuse rate" value={`${m.trust_and_safety.misuse_takedown_rate_pct.toFixed(1)}%`} />
                </div>
              </div>
            )}
            {tab === 'agents' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Active agents" value={m.agents.active_agents} />
                  <Stat label="Agent content" value={compact(m.agents.content_count)} />
                  <Stat label="Agent video hours" value={m.agents.video_hours.toFixed(1)} />
                  <Stat label="Free tags answered" value={compact(m.agents.free_tags)} />
                  <Stat label="Rated helpful" value={`${m.agents.helpful_rating_pct.toFixed(0)}%`} />
                </div>
                <Card className="mt-6 p-5"><h3 className="mb-4 text-[15px] font-bold text-ink">Wamiwa Agent</h3><div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">{Object.entries(m.wamiwa_agent).map(([k, v]) => <div key={k}><div className="text-[12px] text-ink-2">{cap(k)}</div><div className="text-[20px] font-extrabold text-ink num">{compact(v)}</div></div>)}</div></Card>
              </>
            )}
          </div>
          <p className="mt-6 text-[12px] text-ink-3">{date(res.data!.range.start)} – {date(res.data!.range.end)}{p ? ', compared with the previous period' : ''}.</p>
        </>
      )}
    </div>
  )
}

/* ── AQ-03 Queue health (Super Admin) ───────────────────────────────────── */

interface Health { per_queue: Record<string, { waiting: number; past_target: number; decided: number; average_decision_hours: number | null }>; per_admin: Record<string, { name?: string; decided: number; average_decision_hours: number | null; past_target?: number }>; generated_at: string }

export function QueueHealth() {
  const superA = useSession().role === 'super_admin'
  const res = useApi(superA ? (s) => api.get<Health>('/admin/queues/health', undefined, s) : null, [superA])
  if (!superA) return <Callout tone="neutral" icon={<Lock />} title="Super Admin only">Queue health is visible to Super Admins. Your queues are still available.</Callout>
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Queue health" subtitle="Items waiting, average decision time and items past target, per queue and per admin." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">Queue</th><th className="px-3 text-right font-semibold">Waiting</th><th className="px-3 text-right font-semibold">Decided</th><th className="px-3 text-right font-semibold">Avg decision</th><th className="px-5 text-right font-semibold">Past target</th></tr></thead>
          <tbody className="divide-y divide-line">
            {Object.entries(res.data.per_queue).map(([q, v]) => (
              <tr key={q}><td className="px-5 py-3"><Link to={`/admin/queues?queue=${q}`} className="font-semibold text-ink hover:underline">{cap(q)}</Link></td><td className="px-3 text-right num">{v.waiting}</td><td className="px-3 text-right num">{v.decided}</td><td className="px-3 text-right num">{v.average_decision_hours !== null ? `${v.average_decision_hours.toFixed(1)}h` : '—'}</td><td className="px-5 text-right">{v.past_target ? <Badge tone="danger">{v.past_target}</Badge> : <span className="text-ink-3">0</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
      <h2 className="mt-10 mb-3 text-[16px] font-extrabold text-ink">By admin</h2>
      {Object.keys(res.data.per_admin).length === 0 ? <p className="text-[13.5px] text-ink-2">No decisions yet.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(res.data.per_admin).map(([id, v]) => (
            <Card key={id} className="p-5"><div className="font-bold text-ink">{v.name ?? id.slice(-6)}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px]"><div><div className="text-[18px] font-extrabold text-ink num">{v.decided}</div>decided</div><div><div className="text-[18px] font-extrabold text-ink num">{v.average_decision_hours !== null ? `${v.average_decision_hours.toFixed(1)}h` : '—'}</div>avg</div><div><div className="text-[18px] font-extrabold text-ink num">{v.past_target ?? 0}</div>late</div></div></Card>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── WA-12 Wamiwa Agent monitoring ──────────────────────────────────────── */

interface PromoOverview { period_days: number; plans_by_status: Record<string, number>; active_plans: Record<string, number>; activity: Record<string, number>; names_live: number; links_saved: number; links_under_review: number; waiting_for_review: number; revenue?: { monthly_recurring_usd: number; collected_in_period: number } }
interface PromoRow { id: string; account_id: string; handle: string; kind: string; tier: string; status: string; category: string | null; renews_at: string | null }
/** GET /admin/promotions/{id}: the owner's plan as they see it, who owns it, and 30 days of results. */
interface PromoDetail {
  plan: {
    id: string; kind: string; tier: string; status: string; category: string | null; renews_at: string | null; cancel_at_period_end: boolean
    names: { id: string; name: string; status: string; matches_in_plain_text: boolean }[]
    links: { id: string; url: string; label: string; keywords: string[]; under_review: boolean; review_reason: string | null; shared_by_agent: boolean }[]
  } | null
  owner: { id: string; handle: string; status: string }
  results: { totals: Record<string, number>; rates: Record<string, number> } | null
}
const PROMO_KINDS = ['business', 'seller', 'artist', 'label'] as const
const PROMO_DAYS = { '7': 7, '30': 30, '90': 90 } as const

export function WamiwaAgentAdmin() {
  const perms = usePerms()
  const [filter, setFilter] = useState<'all' | 'active' | 'review'>('all')
  const [days, setDays] = useState<keyof typeof PROMO_DAYS>('30')
  const [kind, setKind] = useState('')
  const overview = useApi((s) => api.get<PromoOverview>('/admin/promotions/overview', { days: PROMO_DAYS[days] }, s), [days])
  const list = useApi((s) => api.page<PromoRow>('/admin/promotions', { status: filter === 'active' ? 'active' : undefined, kind: kind || undefined, under_review: filter === 'review' || undefined, limit: 50 }, s), [filter, kind])
  const [open, setOpen] = useState<string | null>(null)
  const detail = useApi(open ? (s) => api.get<PromoDetail>(`/admin/promotions/${open}`, undefined, s) : null, [open])
  const [action, setAction] = useState<null | { kind: 'suspend' | 'restore' | 'remove-link'; label: string; linkId?: string }>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!action || !open) return
    setBusy(true)
    try {
      if (action.kind === 'remove-link') await api.del(`/admin/promotions/links/${action.linkId}`, { reason })
      else await api.post(`/admin/promotions/${open}/${action.kind}`, { reason })
      toast(`${action.label} — done`, 'Written to the audit log.'); setAction(null); setReason(''); detail.reload(); list.reload(); overview.reload()
    } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const o = overview.data
  const d = detail.data
  const plan = d?.plan
  const showMoney = !!perms.data?.view_revenue && !!o?.revenue
  return (
    <div>
      <PageHeader eyebrow="Wamiwa Agent" title="Plans & links" subtitle="Everything the Wamiwa Agent does, open to every admin. Money figures need the revenue permission."
        actions={<Segmented size="sm" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />} />
      {overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} /> : !o ? <Spinner className="min-h-32" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Active plans" value={o.plans_by_status.active ?? 0} />
            <Stat label="Names live" value={o.names_live} />
            <Stat label="Links saved" value={o.links_saved} />
            <Stat label="Links under review" value={o.links_under_review} />
            <Stat label="Waiting for review" value={o.waiting_for_review} />
            <Stat label="MRR" value={showMoney ? usd(o.revenue!.monthly_recurring_usd) : '—'} sub={perms.data?.view_revenue ? undefined : 'Needs revenue permission'} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card className="p-5">
              <h3 className="mb-3 text-[15px] font-bold text-ink">Active plans by type and package</h3>
              {Object.keys(o.active_plans).length ? <BarList rows={Object.entries(o.active_plans).map(([k, v]) => { const [pk, tier] = k.split(':'); return { label: `${cap(pk)} · ${cap(tier ?? '')}`, value: v } })} /> : <p className="text-[13px] text-ink-2">No active plans.</p>}
            </Card>
            {showMoney && <Stat label={`Collected in the last ${o.period_days} days`} value={naira(o.revenue!.collected_in_period)} sub="Plan payments, less refunds" />}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(o.activity).map(([k, v]) => <Card flat key={k} className="p-4"><div className="text-[12px] text-ink-2">{cap(k)}</div><div className="text-[18px] font-extrabold text-ink num">{compact(v)}</div></Card>)}
          </div>
        </>
      )}
      <Card className="mt-6">
        <CardHeader title="Plans" action={<div className="flex flex-wrap items-center gap-2">
          <Select className="!h-9 !w-36 text-[13px]" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All kinds</option>{PROMO_KINDS.map((k) => <option key={k} value={k}>{cap(k)}</option>)}</Select>
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'review', label: 'Links under review' }]} />
        </div>} />
        <div className="mt-3 divide-y divide-line">
          {(list.data?.data ?? []).map((p) => (
            <button key={p.id} onClick={() => setOpen(p.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-2">
              <div className="min-w-0 flex-1"><div className="font-bold text-ink">@{p.handle}</div><div className="text-[12.5px] text-ink-2">{cap(p.kind)} · {p.tier}{p.category ? ` · ${cap(p.category)}` : ''}{p.renews_at ? ` · renews ${date(p.renews_at)}` : ''}</div></div>
              <Badge tone={p.status === 'active' ? 'success' : p.status === 'suspended' ? 'danger' : 'warn'}>{cap(p.status)}</Badge>
            </button>
          ))}
          {list.data?.data.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-2">No plans match.</p>}
        </div>
      </Card>

      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" title={d ? `@${d.owner.handle}` : 'Plan'} subtitle={plan ? `${cap(plan.kind)} · ${plan.tier} · ${cap(plan.status)}${plan.renews_at ? ` · renews ${date(plan.renews_at)}` : ''}${d!.owner.status !== 'active' ? ` · account ${d!.owner.status}` : ''}` : undefined}
        footer={plan && <><Button variant="ghost" to={`/admin/audit?target=${plan.id}`}>Audit log</Button>{plan.status === 'suspended' ? <Button disabled={!perms.data?.suspend} onClick={() => setAction({ kind: 'restore', label: 'Restore plan' })}>Restore</Button> : <Button variant="danger" disabled={!perms.data?.suspend} onClick={() => setAction({ kind: 'suspend', label: 'Suspend plan' })}>Suspend plan</Button>}</>}>
        {detail.error ? <ErrorState compact error={detail.error} onRetry={detail.reload} /> : !d ? <Spinner className="min-h-32" /> : !plan ? <p className="text-[13.5px] text-ink-2">This plan no longer exists.</p> : (
          <>
            {d.results && <div className="mb-5 grid gap-3 sm:grid-cols-4">{Object.entries(d.results.totals).slice(0, 8).map(([k, v]) => <Card flat key={k} className="p-3"><div className="text-[11.5px] text-ink-2">{cap(k)} · 30d</div><div className="text-[16px] font-extrabold text-ink num">{compact(v)}</div></Card>)}</div>}
            <div className="mb-2 text-[13px] font-bold text-ink">Names</div>
            <div className="mb-5 flex flex-wrap gap-1.5">{plan.names.length ? plan.names.map((n) => <Badge key={n.id} tone={n.status === 'approved' ? 'success' : 'warn'}>{n.name} · {n.status.replace(/_/g, ' ')}</Badge>) : <span className="text-[13px] text-ink-2">No names.</span>}</div>
            <div className="mb-2 text-[13px] font-bold text-ink">Links</div>
            <ul className="space-y-2">
              {plan.links.length === 0 && <li className="text-[13px] text-ink-2">No links.</li>}
              {plan.links.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[13.5px] font-bold text-ink">{l.label}{l.under_review && <Badge tone="danger" icon={<ShieldAlert className="size-3" />}>{l.review_reason ?? 'Under review'}</Badge>}</div><div className="truncate font-mono text-[12px] text-ink-2">{l.url}</div></div>
                  <Button size="xs" variant="ghost" className="text-danger" icon={<Trash2 className="size-3" />} onClick={() => setAction({ kind: 'remove-link', label: `Remove ${l.label}`, linkId: l.id })}>Remove</Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
      <Modal open={!!action} onClose={() => setAction(null)} size="sm" title={action?.label} subtitle="A reason is required. This is written to the audit log." footer={<Button variant={action?.kind === 'restore' ? 'primary' : 'danger'} loading={busy} disabled={reason.length < 4} onClick={run}>Confirm</Button>}>
        <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
      <p className="mt-6 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Megaphone className="size-3.5" /><Link to="/admin/queues?queue=promotions" className="hover:underline">Promotions queue</Link> holds seller reviews, unproven names, claims and suspected scam links.</p>
    </div>
  )
}
