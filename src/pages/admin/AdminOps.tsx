import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Check, Clock, FileText, Hand, KeyRound, Lock, Mail, PlayCircle, Plus, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { partyName } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { ContractDto, MeDto } from '@/api/types'
import { useSession } from '@/context/session'
import { ago, date, dateTime, naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Checkbox, Empty, Field, Input, KV, Modal, PageHeader, Select, Switch, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, RowSkeleton, Spinner } from '@/components/ui/states'
import { usePerms } from './AdminDashboards'

const errMsg = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

/* ── AQ-01 / AQ-02 Queues ───────────────────────────────────────────────── */

const QUEUES = ['identity', 'public_figure', 'company_verification', 'scripts', 'reports', 'disputes', 'payouts', 'fake_followers', 'promotions'] as const
type QueueName = (typeof QUEUES)[number]
interface QueueItemDto {
  id: string; queue: QueueName; target_type: string; target_id: string; subject_account_id: string | null; summary: string; severity: 'high' | 'normal' | 'low'
  claimed_by: string | null; escalated: boolean; decision: string | null; reason: string | null; due_at: string; past_target: boolean; created_at: string; context?: Record<string, unknown> | null
}

export function Queues() {
  const [params, setParams] = useSearchParams()
  const queue = (params.get('queue') as QueueName) ?? 'disputes'
  const [mine, setMine] = useState(false)
  const health = useApi((s) => api.get<{ per_queue: Record<string, { waiting: number; past_target: number }> }>('/admin/queues/health', undefined, s), [])
  const list = usePaged<QueueItemDto, QueueItemDto>((cursor, s) => api.page<QueueItemDto>(`/admin/queues/${queue}`, { open_only: true, mine: mine || undefined, cursor, limit: 30 }, s), (i) => i, [queue, mine])
  const [open, setOpen] = useState<QueueItemDto | null>(null)
  const reload = () => { list.reload(); health.reload() }
  return (
    <div>
      <PageHeader title="Review queues" subtitle="Claim an item so no two admins work the same one. Every decision needs a reason and is logged." actions={<Switch checked={mine} onChange={setMine} label="Only mine" />} />
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {QUEUES.map((q) => {
          const h = health.data?.per_queue[q]
          return (
            <button key={q} onClick={() => setParams({ queue: q })} className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-chip border px-3 text-[13px] font-semibold', queue === q ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:bg-wash')}>
              {cap(q)}{h && h.waiting > 0 && <span className={cn('rounded-full px-1.5 text-[11px] num', h.past_target ? 'bg-danger text-white' : queue === q ? 'bg-bg/20' : 'bg-wash')}>{h.waiting}</span>}
            </button>
          )
        })}
      </div>
      <Card className="divide-y divide-line">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : list.loading ? <RowSkeleton /> : list.items.map((i) => (
          <button key={i.id} onClick={() => setOpen(i)} className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-surface-2 sm:flex-nowrap">
            <span className={cn('h-10 w-1 shrink-0 rounded-full', i.severity === 'high' ? 'bg-danger' : i.severity === 'normal' ? 'bg-brand' : 'bg-mist')} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">{cap(i.target_type)}</Badge>{i.severity === 'high' && <Badge tone="danger">High</Badge>}{i.escalated && <Badge tone="warn">Escalated</Badge>}</div>
              <div className="mt-1 text-[14px] font-semibold text-ink">{i.summary}</div>
            </div>
            <div className="text-right text-[12.5px]">
              <div className={cn('flex items-center justify-end gap-1 font-bold', i.past_target ? 'text-danger' : 'text-ink')}><Clock className="size-3.5" />{i.past_target ? 'Past target' : `Due ${dateTime(i.due_at)}`}</div>
              <div className="text-ink-3">{i.claimed_by ? 'Claimed' : 'Unclaimed'} · opened {ago(i.created_at)}</div>
            </div>
          </button>
        ))}
        {!list.loading && !list.error && list.items.length === 0 && <Empty icon={<Check />} title="Nothing waiting">This queue is clear.</Empty>}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
      {open && <QueueItemModal item={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); reload() }} />}
    </div>
  )
}

function QueueItemModal({ item, onClose, onChanged }: { item: QueueItemDto; onClose: () => void; onChanged: () => void }) {
  const { me, role } = useSession()
  const [claimedBy, setClaimedBy] = useState(item.claimed_by)
  const [context, setContext] = useState(item.context)
  const [decision, setDecision] = useState<'approve' | 'reject' | 'request_info' | 'escalate' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const subject = useApi(item.subject_account_id ? (s) => api.get<{ account: MeDto; warnings: number; contracts: number; reports_against: unknown[] }>(`/admin/accounts/${item.subject_account_id}`, undefined, s) : null, [item.subject_account_id])
  const mine = claimedBy === me.id

  const claim = async (release = false) => {
    setBusy(true)
    try {
      const r = await api.post<{ claimed_by: string | null; context?: Record<string, unknown> | null }>(`/admin/queue-items/${item.id}/${release ? 'release' : 'claim'}`)
      setClaimedBy(r.claimed_by); if (r.context) setContext(r.context)
    } catch (e) { toast('Couldn’t claim', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const decide = async () => {
    setBusy(true)
    try { await api.post(`/admin/queue-items/${item.id}/decide`, { decision, reason, payload: {} }); toast(`${cap(decision!)} — logged`, 'The account is notified of the outcome.'); onChanged() } catch (e) { toast('Couldn’t decide', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const isDispute = item.target_type === 'dispute'
  return (
    <Modal open onClose={onClose} size="lg" title={item.summary} subtitle={`${cap(item.queue)} · due ${dateTime(item.due_at)}`}
      footer={!claimedBy ? <Button icon={<Hand className="size-4" />} loading={busy} onClick={() => claim()}>Claim item</Button>
        : !mine ? <Badge tone="neutral">Claimed by another admin</Badge>
          : isDispute ? <><Button variant="ghost" onClick={() => claim(true)}>Release</Button><Button to={`/admin/disputes/${item.target_id}`}>Open dispute</Button></>
            : <><Button variant="ghost" onClick={() => claim(true)}>Release</Button><Button disabled={!decision || reason.length < 4} loading={busy} onClick={decide}>Submit decision</Button></>}>
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <div>
          <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">Context</div>
          <div className="rounded-2xl bg-surface-2 p-4 text-[14px] text-ink">{item.summary}</div>
          {context && <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-line p-4 font-mono text-[12px] whitespace-pre-wrap text-ink-2">{JSON.stringify(context, null, 2)}</pre>}
          {mine && !isDispute && (
            <div className="mt-5">
              <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">Decision</div>
              <div className="grid grid-cols-2 gap-2">
                {(['approve', 'reject', 'request_info', ...(role !== 'super_admin' ? ['escalate'] : [])] as const).map((d) => (
                  <button key={d} onClick={() => setDecision(d as typeof decision)} className={cn('rounded-xl border px-3 py-2.5 text-[13px] font-semibold', decision === d ? 'border-brand bg-brand-soft text-ink' : 'border-line hover:bg-wash')}>{d === 'escalate' ? 'Escalate to Super Admin' : cap(d)}</button>
                ))}
              </div>
              <Field className="mt-3" label="Reason (required)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" /></Field>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {subject.data && (
            <>
              <Card flat className="p-4"><div className="flex items-center gap-2"><Avatar name={subject.data.account.profile?.name ?? subject.data.account.handle} size="sm" /><div className="min-w-0"><div className="truncate text-[13.5px] font-bold text-ink">{subject.data.account.profile?.name ?? subject.data.account.handle}</div><div className="text-[11.5px] text-ink-2">@{subject.data.account.handle} · {subject.data.account.type}</div></div></div></Card>
              <KV rows={[['Status', subject.data.account.status], ['Warnings', subject.data.warnings], ['Contracts', subject.data.contracts], ['Reports against', subject.data.reports_against.length]]} />
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ── AD-02 Accounts ─────────────────────────────────────────────────────── */

interface AccountRow { id: string; type: string; handle: string; email: string | null; name: string; status: string; created_at: string }

export function Accounts() {
  const { role } = useSession()
  const perms = usePerms()
  const superA = role === 'super_admin'
  const [type, setType] = useState<'' | 'user' | 'company' | 'agent'>('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t) }, [q])
  const count = useApi((s) => api.get<{ total_people: number; users: number; companies: number; agents: number }>('/admin/accounts/count', undefined, s), [])
  const list = usePaged<AccountRow, AccountRow>((cursor, s) => api.page<AccountRow>('/admin/accounts', { type: type || undefined, q: query || undefined, cursor, limit: 30 }, s), (a) => a, [type, query])
  const [act, setAct] = useState<null | { row: AccountRow; kind: 'suspend' | 'reinstate' | 'remove' }>(null)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!act) return
    setBusy(true)
    try {
      await api.post(`/admin/accounts/${act.row.id}/${act.kind}`, act.kind === 'reinstate' ? { reason } : { reason, notify })
      toast(`${cap(act.kind)}d @${act.row.handle}`, notify ? 'The account was notified.' : 'Notice skipped; logged with your reason.', 'warn'); setAct(null); setReason(''); list.reload()
    } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="Accounts" subtitle={count.data ? `${count.data.total_people} people (each counted once across roles) · ${count.data.users} users · ${count.data.companies} companies · ${count.data.agents} agents` : 'Users, companies and agents.'} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={type} onChange={setType} tabs={[{ value: '', label: 'All' }, { value: 'user', label: 'Users' }, { value: 'company', label: 'Companies' }, { value: 'agent', label: 'Agents' }]} className="flex-1 border-0" />
        <div className="w-72"><Input icon={<Search />} placeholder="Search handle, name or email" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" /></div>
      </div>
      <Card className="overflow-x-auto">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : (
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">Account</th><th className="px-3 font-semibold">Type</th><th className="px-3 font-semibold">Joined</th><th className="px-3 font-semibold">Status</th><th className="px-5 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-line">
              {list.items.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="px-5 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={a.name} kind={a.type === 'company' ? 'company' : a.type === 'agent' ? 'agent' : 'human'} size="sm" /><div className="leading-tight"><div className="font-bold text-ink">{a.name}</div><div className="text-[12px] text-ink-2">@{a.handle}{a.email ? ` · ${a.email}` : ''}</div></div></div></td>
                  <td className="px-3 text-ink-2 capitalize">{a.type}</td>
                  <td className="px-3 text-ink-2">{date(a.created_at)}</td>
                  <td className="px-3"><Badge tone={a.status === 'active' ? 'success' : a.status === 'suspended' || a.status === 'removed' ? 'danger' : 'warn'} dot>{cap(a.status)}</Badge></td>
                  <td className="px-5 text-right">{a.type !== 'admin' && <div className="flex justify-end gap-1">
                    {a.status === 'suspended' ? <Button size="xs" variant="ghost" onClick={() => setAct({ row: a, kind: 'reinstate' })}>Reinstate</Button> : <Button size="xs" variant="ghost" disabled={!perms.data?.suspend} onClick={() => setAct({ row: a, kind: 'suspend' })}>Suspend</Button>}
                    {superA && a.status !== 'removed' && <Button size="xs" variant="ghost" className="text-danger" onClick={() => setAct({ row: a, kind: 'remove' })}>Remove</Button>}
                  </div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {list.loading && <RowSkeleton />}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
      {!superA && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Lock className="size-3.5" />Permanent removal is Super Admin only. Suspending needs the suspend permission.</p>}
      <Modal open={!!act} onClose={() => setAct(null)} size="sm" title={act ? `${cap(act.kind)} @${act.row.handle}?` : ''} subtitle="Every suspended or removed account can appeal once within 14 days."
        footer={<Button variant={act?.kind === 'reinstate' ? 'primary' : 'danger'} loading={busy} disabled={reason.length < 4} onClick={run}>Confirm</Button>}>
        {act?.kind === 'remove' && <Callout className="mb-3" tone="danger">Active likeness contracts end with pro-rata refunds; photos and voice are deleted within 30 days.</Callout>}
        {act?.kind === 'suspend' && act.row.type === 'user' && <Callout className="mb-3" tone="warn" icon={<AlertTriangle />}>Any agents this account owns are suspended too.</Callout>}
        <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {act?.kind !== 'reinstate' && <div className="mt-3"><Switch checked={notify} onChange={setNotify} disabled={!superA} label="Notify the account" description={superA ? 'Skip only for fraud or legal investigations.' : 'Only a Super Admin can skip notice.'} /></div>}
      </Modal>
    </div>
  )
}

/* ── PY-04 Dispute detail ───────────────────────────────────────────────── */

interface AdminDispute {
  id: string; contract_id: string; raised_by: string; reason: string; status: string; evidence_due_at: string | null; decision_due_at: string | null
  decision: string | null; release_pct: number | null; decision_reason: string | null; appealed_by: string[]; appeal_reason: string | null
  evidence: { submitted_by: string; statement: string; attachments: unknown[]; created_at: string }[]; missing_evidence_from: string[]; contract: ContractDto
}

export function DisputeDetail() {
  const { id = '' } = useParams()
  const { role } = useSession()
  const res = useApi((s) => api.get<AdminDispute>(`/admin/disputes/${id}`, undefined, s), [id])
  const [outcome, setOutcome] = useState<'release' | 'refund' | 'split'>('split')
  const [pct, setPct] = useState(60)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const d = res.data
  const k = d.contract
  const m = k.price.local
  const appeal = d.appealed_by.length > 0 && d.status !== 'final'
  const decide = async () => {
    setBusy(true)
    try {
      await api.post(`/admin/disputes/${id}/${appeal ? 'decide-appeal' : 'decide'}`, { reason, decision: outcome, release_pct: outcome === 'split' ? pct : null })
      toast(appeal ? 'Appeal decided — final on Wamiwa' : 'Decision recorded', appeal ? undefined : 'Takes effect in 3 days unless appealed. Funds stay frozen meanwhile.'); setReason(''); res.reload()
    } catch (e) { toast('Couldn’t record', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const sides = [[k.hirer_id, 'Hirer'], [k.earner_id, 'Earner']] as const
  return (
    <div>
      <PageHeader back={{ to: '/admin/queues?queue=disputes', label: 'Disputes queue' }} eyebrow={`Dispute · ${cap(k.type)} · ${cap(d.status)}`} title={d.reason} subtitle={`${naira(m.price)} frozen${d.decision_due_at ? ` · decide by ${date(d.decision_due_at)}` : ''}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="p-5"><KV rows={[['Contract', k.deliverables.split('\n')[0] || k.title], ['Hirer', partyName(k.hirer_id, k.title)], ['Raised by', d.raised_by === k.hirer_id ? 'Hirer' : 'Earner'], ['Evidence due', d.evidence_due_at ? dateTime(d.evidence_due_at) : '—'], ['Delivery', k.delivery ?? '—']]} /></Card>
          <div className="grid gap-4 md:grid-cols-2">
            {sides.map(([who, label]) => (
              <Card key={who} className="p-5">
                <div className="flex items-center gap-2"><Badge tone="neutral">{label}</Badge>{d.missing_evidence_from.includes(who) && <Badge tone="warn">No evidence yet</Badge>}</div>
                <ul className="mt-4 space-y-2">
                  {d.evidence.filter((e) => e.submitted_by === who).map((e, i) => <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink"><FileText className="mr-1 inline size-3.5 text-ink-3" />{e.statement}{e.attachments.length ? ` · ${e.attachments.length} file(s)` : ''}</li>)}
                  {!d.evidence.some((e) => e.submitted_by === who) && <li className="text-[13px] text-ink-2">Nothing submitted.</li>}
                </ul>
              </Card>
            ))}
          </div>
          {d.decision && <Callout tone="success" title={`Decision: ${d.decision}${d.release_pct !== null ? ` (${d.release_pct}% released)` : ''}`}>{d.decision_reason}</Callout>}
          {appeal && <Callout tone="warn" title="Appealed">{d.appeal_reason}</Callout>}
        </div>
        <Card className="h-fit p-5">
          <h3 className="text-[15px] font-bold text-ink">{appeal ? 'Decide appeal (final)' : 'Decision'}</h3>
          {appeal && role !== 'super_admin' ? <Callout className="mt-3" tone="neutral">Only a Super Admin can decide appeals.</Callout> : d.decision && !appeal ? <p className="mt-2 text-[13px] text-ink-2">Decided. Either side can appeal once within 3 days.</p> : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">{(['release', 'refund', 'split'] as const).map((o) => <button key={o} onClick={() => setOutcome(o)} className={cn('rounded-xl border py-2.5 text-[13px] font-bold capitalize', outcome === o ? 'border-brand bg-brand-soft' : 'border-line')}>{o}</button>)}</div>
              {outcome === 'split' && (
                <div className="mt-4">
                  <input type="range" min={5} max={95} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} className="w-full accent-[var(--brand)]" />
                  <div className="flex justify-between text-[12.5px]"><span>Earner gets <b className="num">{naira(m.net * pct / 100)}</b></span><span>Refund <b className="num">{naira(m.price * (100 - pct) / 100)}</b></span></div>
                </div>
              )}
              <Field className="mt-4" label="Logged reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <Button className="mt-4 w-full" loading={busy} disabled={reason.length < 4} onClick={decide}>Record decision</Button>
            </>
          )}
          <p className="mt-3 text-[12px] text-ink-3">Each side can appeal once within 3 days. A Super Admin decides appeals.</p>
        </Card>
      </div>
    </div>
  )
}

/* ── AD-03 Payouts ──────────────────────────────────────────────────────── */

export function Payouts() {
  const perms = usePerms()
  const queue = useApi((s) => api.page<QueueItemDto>('/admin/queues/payouts', { open_only: true, limit: 30 }, s), [])
  const [q, setQ] = useState('')
  const found = useApi(q.length > 1 ? (s) => api.page<AccountRow>('/admin/accounts', { q, limit: 5 }, s) : null, [q])
  const [earner, setEarner] = useState<AccountRow | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const pay = async () => {
    setBusy(true)
    try { await api.post('/admin/payouts/manual', { earner_id: earner!.id, reason }); toast('Manual payout requested', 'Above the limit, a second admin must approve it in the Payouts queue.'); setEarner(null); setReason(''); queue.reload() } catch (e) { toast('Couldn’t pay out', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="Payout approvals" subtitle="Manual payouts above the set amount need approval from two different admins." />
      {perms.data && !perms.data.approve_payouts && <Callout className="mb-6" tone="neutral" icon={<Lock />}>You don’t have the payouts permission. A Super Admin can grant it, with a limit.</Callout>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Waiting for a second approver" />
          <div className="mt-3 divide-y divide-line">
            {(queue.data?.data ?? []).map((i) => (
              <Link key={i.id} to={`/admin/queues?queue=payouts`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2"><div className="flex-1 text-[14px] font-semibold text-ink">{i.summary}</div><Badge tone={i.past_target ? 'danger' : 'warn'}>{i.past_target ? 'Past target' : 'Waiting'}</Badge></Link>
            ))}
            {queue.data?.data.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-2">No payouts waiting.</p>}
          </div>
        </Card>
        <Card className="h-fit p-5">
          <h3 className="font-bold text-ink">Trigger a manual payout</h3>
          <p className="mt-1 text-[12.5px] text-ink-2">Pays the earner’s cleared balance outside the 2-week cycle.</p>
          <Input className="mt-4" icon={<Search />} placeholder="Find earner" value={q} onChange={(e) => setQ(e.target.value)} />
          {found.data?.data.map((a) => <button key={a.id} onClick={() => { setEarner(a); setQ('') }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[13.5px] hover:bg-wash"><Avatar name={a.name} size="xs" />{a.name} <span className="text-ink-3">@{a.handle}</span></button>)}
          {earner && <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] font-semibold text-ink">{earner.name} · @{earner.handle}</div>}
          <Field className="mt-3" label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button className="mt-4 w-full" loading={busy} disabled={!earner || reason.length < 4 || !perms.data?.approve_payouts} onClick={pay}>Request payout</Button>
        </Card>
      </div>
    </div>
  )
}

/* ── LK-09 Minor contracts + recordings ─────────────────────────────────── */

interface MinorRow { contract_id: string; minor_id: string; guardian_id: string; result: string; call_attempts: number; recording_ref: string | null; decided_at: string | null }

export function MinorContracts() {
  const res = useApi((s) => api.page<MinorRow>('/admin/minor-contracts', { limit: 50 }, s), [])
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  return (
    <div>
      <PageHeader title="Minor contracts" subtitle="Every contract for a 13–17 account, with its guardian approvals and call recordings." />
      <Card className="divide-y divide-line">
        {!res.data ? <RowSkeleton /> : res.data.data.map((c) => (
          <div key={c.contract_id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1"><div className="font-bold text-ink">Contract …{c.contract_id.slice(-6).toUpperCase()}</div><div className="text-[12.5px] text-ink-2">Minor …{c.minor_id.slice(-6)} · guardian …{c.guardian_id.slice(-6)}{c.decided_at ? ` · decided ${date(c.decided_at)}` : ''}</div></div>
            <Badge tone={c.result === 'approved' ? 'success' : c.result === 'declined' || c.result === 'expired' ? 'neutral' : 'warn'}>{cap(c.result)}</Badge>
            <Badge tone="neutral">Calls {c.call_attempts}/3</Badge>
            {c.recording_ref && <Button size="sm" variant="outline" icon={<PlayCircle className="size-4" />} onClick={() => toast('Recording', c.recording_ref ?? '')}>Recording</Button>}
          </div>
        ))}
        {res.data?.data.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-2">No contracts for minors yet.</p>}
      </Card>
    </div>
  )
}

/* ── AD-01 Admin management ─────────────────────────────────────────────── */

const PERMS = [['suspend', 'Suspend accounts'], ['approve_payouts', 'Approve payouts (with limit)'], ['b2b_category_map', 'Edit B2B category map'], ['view_dashboard', 'See the dashboard'], ['view_revenue', 'See revenue figures']] as const
interface AdminRow { id: string; email: string; handle: string; role: 'admin' | 'super_admin'; status: string; two_factor_enabled: boolean; permissions: (string | { permission: string; payout_limit?: number | null })[] }

export function AdminManagement() {
  const res = useApi((s) => api.get<AdminRow[]>('/admin/admins', undefined, s), [])
  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin')
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [removing, setRemoving] = useState<AdminRow | null>(null)
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const supers = res.data.filter((a) => a.role === 'super_admin').length
  const permNames = (a: AdminRow) => a.permissions.map((p) => typeof p === 'string' ? p : p.permission)
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); toast(msg, 'Logged in the audit log.'); res.reload(); setReason('') } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const togglePerm = (a: AdminRow, p: string, on: boolean) => run(() => on
    ? api.put(`/admin/admins/${a.id}/permissions`, { reason: reason || 'Granted by Super Admin', permission: p, payout_limit: p === 'approve_payouts' ? 200000000 : null })
    : api.del(`/admin/admins/${a.id}/permissions/${p}`, { reason: reason || 'Revoked by Super Admin' }), on ? 'Permission granted' : 'Permission removed')
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Admins" subtitle="Admins only get the permissions you grant. There must always be at least two Super Admins." actions={<Button icon={<UserPlus className="size-4" />} onClick={() => setInvite(true)}>Invite admin</Button>} />
      <Card className="divide-y divide-line">
        {res.data.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <Avatar name={a.handle} size="md" />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-bold text-ink">@{a.handle}<Badge tone={a.role === 'super_admin' ? 'dark' : 'neutral'}>{cap(a.role)}</Badge>{!a.two_factor_enabled && <Badge tone="warn" icon={<KeyRound className="size-3" />}>2FA not set</Badge>}</div><div className="text-[12.5px] text-ink-2">{a.email}</div></div>
            <div className="flex flex-wrap gap-1">{a.role === 'super_admin' ? <Badge tone="outline">All permissions</Badge> : permNames(a).map((p) => <Badge key={p} tone="outline">{cap(p)}</Badge>)}</div>
            {a.role === 'admin' && <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Permissions</Button>}
            <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-3.5" />} disabled={a.role === 'super_admin' && supers <= 2} title={a.role === 'super_admin' && supers <= 2 ? 'The last two Super Admins can’t be removed' : undefined} onClick={() => setRemoving(a)}>Remove</Button>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-[12.5px] text-ink-3">Admins can’t act on their own account or another admin’s account.</p>
      <Modal open={invite} onClose={() => setInvite(false)} title="Invite an admin" subtitle="They get a one-time link by email and must set up two-factor login. Credentials are never emailed."
        footer={<Button icon={<Mail className="size-4" />} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email) || reason.length < 4} onClick={() => run(() => api.post('/admin/invites', { email, role: newRole, reason }), 'Invite sent').then(() => { setInvite(false); setEmail('') })}>Send invite</Button>}>
        <div className="space-y-4">
          <Field label="Work email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@wamiwa.site" /></Field>
          <Field label="Role"><Select value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin')}><option value="admin">Admin</option><option value="super_admin">Super Admin</option></Select></Field>
          <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this person needs access" /></Field>
        </div>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Permissions for @${editing?.handle}`} subtitle="Changes are logged with the reason below.">
        {editing && (
          <div className="space-y-3">
            <Field label="Reason (logged)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {PERMS.map(([p, label]) => <Checkbox key={p} checked={permNames(editing).includes(p)} onChange={(on) => { void togglePerm(editing, p, on).then(() => setEditing(null)) }}>{label}</Checkbox>)}
          </div>
        )}
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} size="sm" title={`Remove @${removing?.handle}?`} footer={<Button variant="danger" loading={busy} disabled={reason.length < 4} onClick={() => run(() => api.del(`/admin/admins/${removing!.id}`, { reason }), 'Admin removed').then(() => setRemoving(null))}>Remove</Button>}>
        <Field label="Reason"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}

/* ── AD-04 Audit log ────────────────────────────────────────────────────── */

interface AuditRow { id: string; actor_id: string; actor_handle?: string; action: string; target_type?: string; target_id?: string; target?: string; reason: string | null; at?: string; created_at?: string }

export function AuditLog() {
  const [action, setAction] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => { const t = setTimeout(() => setQuery(action.trim()), 300); return () => clearTimeout(t) }, [action])
  const list = usePaged<AuditRow, AuditRow>((cursor, s) => api.page<AuditRow>('/admin/audit-log', { action: query || undefined, cursor, limit: 50 }, s), (r) => r, [query])
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every admin action and escrow state change: who, what, when and why. Entries can’t be edited or deleted." />
      <div className="mb-4 flex items-center gap-3"><div className="w-80"><Input icon={<Search />} placeholder="Filter by action, e.g. suspend" value={action} onChange={(e) => setAction(e.target.value)} className="h-10" /></div><Badge tone="neutral" icon={<Lock className="size-3" />}>Append-only</Badge></div>
      <Card className="overflow-x-auto">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : (
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">When</th><th className="px-3 font-semibold">Who</th><th className="px-3 font-semibold">Action</th><th className="px-3 font-semibold">Target</th><th className="px-5 font-semibold">Why</th></tr></thead>
            <tbody className="divide-y divide-line font-mono text-[12.5px]">
              {list.items.map((r) => {
                const at = r.at ?? r.created_at ?? ''
                return <tr key={r.id}><td className="px-5 py-2.5 whitespace-nowrap text-ink-2">{at && dateTime(at)}</td><td className="px-3 font-sans font-semibold whitespace-nowrap text-ink">{r.actor_handle ? `@${r.actor_handle}` : `…${r.actor_id.slice(-6)}`}</td><td className="px-3 text-ink">{r.action}</td><td className="px-3 text-ink-2">{r.target ?? [r.target_type, r.target_id?.slice(-8)].filter(Boolean).join(' …')}</td><td className="px-5 font-sans text-ink-2">{r.reason ?? '—'}</td></tr>
              })}
              {!list.loading && list.items.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center font-sans text-ink-2">No entries{query ? ` for “${query}”` : ''} yet.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
    </div>
  )
}

/* ── CO-03 Category map ─────────────────────────────────────────────────── */

export function CategoryMap() {
  const perms = usePerms()
  const res = useApi((s) => api.get<Record<string, string[]>>('/admin/b2b/category-map', undefined, s), [])
  const [seller, setSeller] = useState('')
  const [edit, setEdit] = useState<{ seller: string; buyers: string[] } | null>(null)
  const [reason, setReason] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const can = !!perms.data?.b2b_category_map
  const save = async () => {
    setBusy(true)
    try { await api.put('/admin/b2b/category-map', { seller_category: edit!.seller, buyer_categories: edit!.buyers, reason }); toast('Category map saved', 'Logged in the audit log.'); setEdit(null); setReason(''); res.reload() } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="B2B category map" subtitle="Which kinds of companies are likely buyers for each seller category." actions={can && <div className="flex gap-2"><Input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="New seller category" className="h-10" /><Button icon={<Plus className="size-4" />} disabled={!seller} onClick={() => { setEdit({ seller: seller.toLowerCase(), buyers: [] }); setSeller('') }}>Add</Button></div>} />
      {!can && <Callout className="mb-6" tone="neutral" icon={<Lock />}>Read-only. Editing needs the category map permission.</Callout>}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(res.data).map(([s, buyers]) => (
          <Card key={s} className="p-5">
            <div className="flex items-center gap-2"><span className="font-extrabold text-ink">{cap(s)}</span><ArrowUpRight className="size-4 text-ink-3" /><span className="text-[12px] text-ink-3">likely buyers</span>{can && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEdit({ seller: s, buyers })}>Edit</Button>}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{buyers.map((b) => <span key={b} className="rounded-chip bg-wash px-2.5 py-1 text-[12.5px] font-semibold text-ink">{cap(b)}</span>)}</div>
          </Card>
        ))}
        {Object.keys(res.data).length === 0 && <div className="md:col-span-2"><Empty title="The map is empty">Add a seller category and the buyer categories that usually buy from it.</Empty></div>}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Buyers for ${edit ? cap(edit.seller) : ''}`} footer={<Button loading={busy} disabled={reason.length < 4} onClick={save}>Save</Button>}>
        {edit && (
          <>
            <div className="flex flex-wrap gap-1.5">{edit.buyers.map((b) => <span key={b} className="inline-flex items-center gap-1 rounded-chip bg-wash px-2.5 py-1 text-[12.5px] font-semibold">{cap(b)}<button aria-label="Remove" onClick={() => setEdit({ ...edit, buyers: edit.buyers.filter((x) => x !== b) })}><X className="size-3 text-ink-3" /></button></span>)}</div>
            <div className="mt-3 flex gap-2"><Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Buyer category" onKeyDown={(e) => { if (e.key === 'Enter' && word) { setEdit({ ...edit, buyers: [...edit.buyers, word.toLowerCase()] }); setWord('') } }} /><Button variant="outline" disabled={!word} onClick={() => { setEdit({ ...edit, buyers: [...edit.buyers, word.toLowerCase()] }); setWord('') }}>Add</Button></div>
            <Field className="mt-4" label="Reason (logged)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </>
        )}
      </Modal>
    </div>
  )
}

/* ── WA-07 Seller keywords ──────────────────────────────────────────────── */

export function Keywords() {
  const res = useApi((s) => api.get<Record<string, string[]>>('/admin/promotions/keywords', undefined, s), [])
  const [edit, setEdit] = useState<{ category: string; words: string[] } | null>(null)
  const [cat, setCat] = useState('')
  const [word, setWord] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const save = async () => {
    setBusy(true)
    try { await api.put('/admin/promotions/keywords', { category: edit!.category, keywords: edit!.words, reason }); toast('Keywords saved', 'Logged in the audit log.'); setEdit(null); setReason(''); res.reload() } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="Suggested sellers keywords" subtitle="Words that point a clear wish to buy (“I need…”, “looking for…”) to a category. Past tense and negatives never trigger." actions={<div className="flex gap-2"><Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" className="h-10" /><Button icon={<Plus className="size-4" />} disabled={!cat} onClick={() => { setEdit({ category: cat.toLowerCase(), words: [] }); setCat('') }}>Add</Button></div>} />
      <Callout className="mb-6" tone="neutral" icon={<ShieldCheck />}>Minors’ words are never used to choose a category.</Callout>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(res.data).map(([c, words]) => (
          <Card key={c} className="p-5">
            <div className="flex items-center"><span className="font-extrabold text-ink">{cap(c)}</span><Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEdit({ category: c, words })}>Edit</Button></div>
            <div className="mt-3 flex flex-wrap gap-1.5">{words.map((w) => <span key={w} className="rounded-chip bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-ink">{w}</span>)}</div>
          </Card>
        ))}
        {Object.keys(res.data).length === 0 && <div className="md:col-span-2"><Empty title="No keywords yet">Without keywords, Suggested sellers never appears. Add a category like “fashion” with words like “shirt”, “dress”.</Empty></div>}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Keywords for ${edit ? cap(edit.category) : ''}`} footer={<Button loading={busy} disabled={reason.length < 4 || !edit?.words.length} onClick={save}>Save</Button>}>
        {edit && (
          <>
            <div className="flex flex-wrap gap-1.5">{edit.words.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-chip bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold">{w}<button aria-label="Remove" onClick={() => setEdit({ ...edit, words: edit.words.filter((x) => x !== w) })}><X className="size-3 text-ink-3" /></button></span>)}</div>
            <div className="mt-3 flex gap-2"><Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Keyword" onKeyDown={(e) => { if (e.key === 'Enter' && word) { setEdit({ ...edit, words: [...edit.words, word.toLowerCase()] }); setWord('') } }} /><Button variant="outline" disabled={!word} onClick={() => { setEdit({ ...edit, words: [...edit.words, word.toLowerCase()] }); setWord('') }}>Add</Button></div>
            <Field className="mt-4" label="Reason (logged)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </>
        )}
      </Modal>
    </div>
  )
}

