import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Check, Clock, FileText, Hand, KeyRound, Lock, Mail, PlayCircle, Plus, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react'
import { api, errMsg, mediaUrl } from '@/api/client'
import { partyName } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { ContractDto, MeDto } from '@/api/types'
import { useSession } from '@/context/session'
import { ago, date, dateTime, naira, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Checkbox, Empty, Field, Input, KV, Modal, PageHeader, Select, Switch, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, RowSkeleton, Spinner } from '@/components/ui/states'
import { usePerms } from './AdminDashboards'
import { FEEDBACK_PREFIX } from '@/components/layout/FeedbackPrompt'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

/* ── AQ-01 / AQ-02 Queues ───────────────────────────────────────────────── */

const QUEUES = ['identity', 'public_figure', 'company_verification', 'scripts', 'reports', 'disputes', 'payouts', 'fake_followers', 'promotions', 'investigations'] as const
type QueueName = (typeof QUEUES)[number]
interface QueueItemDto {
  id: string; queue: QueueName; target_type: string; target_id: string; subject_account_id: string | null; summary: string; severity: 'high' | 'normal' | 'low'
  claimed_by: string | null; escalated: boolean; decision: string | null; reason: string | null; due_at: string; past_target: boolean; created_at: string
}
/** The record under review, returned by the claim (AQ-02). Fields depend on `target_type`; null for types without a detail view. */
type QueueTarget = Record<string, unknown> & {
  // identity_document / identity_verification / duplicate_identity
  document_type?: string; document_ref?: string | null; selfie_ref?: string | null; liveness_result?: string | null
  verified_name?: string | null; verified_dob?: string | null; failure_reason?: string | null
  // script
  contract_id?: string; version?: number; text?: string; screening_result?: Record<string, unknown> | null
  contract?: { title: string; price_cents: number; hirer_id: string; earner_id: string; requires_guardian: boolean }
  // report
  reporter_id?: string; target_type?: string; target_id?: string; target_account_id?: string | null; reason?: string | null; details?: string | null
  // payout
  account_id?: string; amount?: number; currency?: string; manual?: boolean; needs_second_approval?: boolean
  // promo_link / promo_name
  url?: string; label?: string; keywords?: string[]; flagged?: boolean; flag_reason?: string | null; reports?: number
  name?: string; plain_text_match?: boolean; status?: string
}
interface AccountDetailDto {
  account: MeDto; suspended_reason: string | null; warnings: number; false_reports: number; contracts: number
  reports_against: { id: string; reason: string; status: string; details: string | null; created_at: string }[]
  admin_history: { action: string; actor_id: string; reason: string | null; at: string }[]
}
type Decision = 'approve' | 'reject' | 'request_info' | 'escalate'

const ID_TYPES = ['identity_document', 'identity_verification']
const DISPUTE_TYPES = ['dispute', 'dispute_appeal']
/** Money in a currency's minor units. */
const money = (minor: number, currency = 'NGN') => currency === 'NGN' ? naira(minor) : `${(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`

export function Queues() {
  const { role } = useSession()
  const superA = role === 'super_admin'
  const perms = usePerms()
  const [params, setParams] = useSearchParams()
  const queue = (params.get('queue') as QueueName) ?? 'disputes'
  const [mine, setMine] = useState(false)
  // AQ-03: queue health is Super Admin only, so regular admins don't ask for the counts.
  const health = useApi(superA ? (s) => api.get<{ per_queue: Record<string, { waiting: number; past_target: number }> }>('/admin/queues/health', undefined, s) : null, [superA])
  const list = usePaged<QueueItemDto, QueueItemDto>((cursor, s) => api.page<QueueItemDto>(`/admin/queues/${queue}`, { open_only: true, mine: mine || undefined, cursor, limit: 30 }, s), (i) => i, [queue, mine])
  const [open, setOpen] = useState<QueueItemDto | null>(null)
  const reload = () => { list.reload(); if (superA) health.reload() }
  const canInvestigate = superA || !!perms.data?.investigate
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
      {queue === 'investigations' && perms.data && !canInvestigate && <Callout className="mb-4" tone="neutral" icon={<Lock />}>Only the investigation team can claim and decide these. A Super Admin can grant the investigate permission.</Callout>}
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
      {open && <QueueItemModal item={open} canInvestigate={canInvestigate} canSuspend={!!perms.data?.suspend} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); reload() }} />}
    </div>
  )
}

function QueueItemModal({ item, canInvestigate, canSuspend, onClose, onChanged }: { item: QueueItemDto; canInvestigate: boolean; canSuspend: boolean; onClose: () => void; onChanged: () => void }) {
  const { me, role } = useSession()
  const superA = role === 'super_admin'
  const [claimedBy, setClaimedBy] = useState(item.claimed_by)
  const [target, setTarget] = useState<QueueTarget | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [verifiedName, setVerifiedName] = useState('')
  const [verifiedDob, setVerifiedDob] = useState('')
  const [suspend, setSuspend] = useState(false)
  const [falseReport, setFalseReport] = useState(false)
  const [suspendPlan, setSuspendPlan] = useState(false)
  const [plainText, setPlainText] = useState(false)
  const [busy, setBusy] = useState(false)
  const subject = useApi(item.subject_account_id ? (s) => api.get<AccountDetailDto>(`/admin/accounts/${item.subject_account_id}`, undefined, s) : null, [item.subject_account_id])
  const mine = claimedBy === me.id
  const t = item.target_type
  const isDispute = DISPUTE_TYPES.includes(t)
  const isId = ID_TYPES.includes(t)
  // RP-02: investigations need the investigate permission; escalated items are for a Super Admin.
  const claimBlock = item.queue === 'investigations' && !canInvestigate ? 'Only the investigation team can claim this.'
    : item.escalated && !superA ? 'Escalated — a Super Admin decides this.' : null

  const gotTarget = (tg: QueueTarget | null | undefined) => {
    setTarget(tg ?? null)
    if (tg) {
      setVerifiedName(tg.verified_name ?? '')
      setVerifiedDob(tg.verified_dob?.slice(0, 10) ?? '')
      setPlainText(!!tg.plain_text_match)
    }
  }
  const claim = async (release = false, quiet = false) => {
    setBusy(true)
    try {
      const r = await api.post<{ claimed_by: string | null; target?: QueueTarget | null }>(`/admin/queue-items/${item.id}/${release ? 'release' : 'claim'}`)
      setClaimedBy(r.claimed_by)
      if (!release) gotTarget(r.target)
    } catch (e) { if (!quiet) toast('Couldn’t claim', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  // Already claimed by me (e.g. reopened): claiming again is allowed and returns the record under review.
  useEffect(() => { if (item.claimed_by === me.id && !isDispute) void claim(false, true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const needsIdDetails = isId && decision === 'approve'
  const payload: Record<string, unknown> = {}
  if (needsIdDetails) Object.assign(payload, { verified_name: verifiedName.trim(), verified_dob: verifiedDob })
  if ((t === 'report' || t === 'off_platform') && decision === 'approve' && suspend) payload.suspend = true
  if (t === 'report' && decision === 'reject' && falseReport) payload.false_report = true
  if (t === 'promo_link' && decision === 'reject' && suspendPlan) payload.suspend_plan = true
  if (t === 'promo_name' && (decision === 'approve' || decision === 'reject')) payload.plain_text_match = plainText
  const ready = !!decision && reason.length >= 4 && (!needsIdDetails || (verifiedName.trim().length > 1 && !!verifiedDob))

  const decide = async () => {
    setBusy(true)
    try { await api.post(`/admin/queue-items/${item.id}/decide`, { decision, reason, payload }); toast(`${cap(decision!)} — logged`, 'The account is notified of the outcome.'); onChanged() } catch (e) { toast('Couldn’t decide', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const label = (d: Decision) => d === 'escalate' ? 'Escalate to Super Admin'
    : t === 'duplicate_identity' && d === 'approve' ? 'Allow (same person)'
      : t === 'duplicate_identity' && d === 'reject' ? 'Reject' : cap(d)
  return (
    <Modal open onClose={onClose} size="lg" title={item.summary} subtitle={`${cap(item.queue)} · due ${dateTime(item.due_at)}`}
      footer={!claimedBy ? (claimBlock ? <Badge tone="neutral" icon={<Lock className="size-3" />}>{claimBlock}</Badge> : <Button icon={<Hand className="size-4" />} loading={busy} onClick={() => claim()}>Claim item</Button>)
        : !mine ? <Badge tone="neutral">Claimed by another admin</Badge>
          : isDispute ? <><Button variant="ghost" onClick={() => claim(true)}>Release</Button><Button to={`/admin/disputes/${item.target_id}`}>{t === 'dispute_appeal' ? 'Open appeal' : 'Open dispute'}</Button></>
            : <><Button variant="ghost" onClick={() => claim(true)}>Release</Button><Button disabled={!ready} loading={busy} onClick={decide}>Submit decision</Button></>}>
      <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
        <div>
          <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">Context</div>
          <div className="rounded-2xl bg-surface-2 p-4 text-[14px] text-ink">{item.summary}</div>
          {target && <TargetView type={t} target={target} />}
          {mine && !target && !isDispute && busy && <Spinner />}
          {(t === 'post' || t === 'comment') && <EditHistory type={t} id={item.target_id} />}
          {mine && !isDispute && (
            <div className="mt-5">
              <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">Decision</div>
              <div className="grid grid-cols-2 gap-2">
                {(['approve', 'reject', 'request_info', ...(!superA ? ['escalate'] : [])] as Decision[]).map((d) => (
                  <button key={d} onClick={() => setDecision(d)} className={cn('rounded-xl border px-3 py-2.5 text-[13px] font-semibold', decision === d ? 'border-brand bg-brand-soft text-ink' : 'border-line hover:bg-wash')}>{label(d)}</button>
                ))}
              </div>
              {needsIdDetails && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Name exactly as on the document"><Input value={verifiedName} onChange={(e) => setVerifiedName(e.target.value)} /></Field>
                  <Field label="Date of birth"><Input type="date" value={verifiedDob} onChange={(e) => setVerifiedDob(e.target.value)} /></Field>
                </div>
              )}
              <div className="mt-3 space-y-3">
                {(t === 'report' || t === 'off_platform') && decision === 'approve' && <Switch checked={suspend} onChange={setSuspend} disabled={!canSuspend} label="Also suspend the account" description={canSuspend ? 'They can appeal once within 14 days.' : 'Needs the suspend permission.'} />}
                {t === 'report' && decision === 'reject' && <Switch checked={falseReport} onChange={setFalseReport} label="Mark as a false report" description="Repeated false reports lower the reporter’s weight and can lead to a warning." />}
                {t === 'promo_link' && decision === 'reject' && <Switch checked={suspendPlan} onChange={setSuspendPlan} label="Also suspend the plan" description="The link is removed either way." />}
                {t === 'promo_name' && (decision === 'approve' || decision === 'reject') && <Switch checked={plainText} onChange={setPlainText} label="Match in plain text" description="Also match the name when it appears without a tag." />}
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

const SectionTitle = ({ children }: { children: ReactNode }) => <div className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">{children}</div>

/** A record under review, laid out for its type rather than dumped as JSON. */
function TargetView({ type, target: x }: { type: string; target: QueueTarget }) {
  const rows = (r: [ReactNode, ReactNode | null | undefined][]) => <KV className="rounded-2xl border border-line px-4" rows={r.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, v] as [ReactNode, ReactNode])} />
  if (ID_TYPES.includes(type) || type === 'duplicate_identity') {
    const doc = mediaUrl(x.document_ref), selfie = mediaUrl(x.selfie_ref)
    return (
      <>
        {(doc || selfie) && (
          <>
            <SectionTitle>Document and selfie</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {[[doc, 'Document'], [selfie, 'Selfie']].map(([src, alt]) => src ? (
                <a key={alt} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-surface-2">
                  <img src={src} alt={alt} className="max-h-64 w-full object-contain" />
                  <div className="px-3 py-1.5 text-[12px] font-semibold text-ink-2">{alt}</div>
                </a>
              ) : <div key={alt} className="grid place-items-center rounded-2xl border border-dashed border-line p-6 text-[12.5px] text-ink-3">No {alt?.toLowerCase()}</div>)}
            </div>
          </>
        )}
        <SectionTitle>Verification</SectionTitle>
        {rows([['Document type', x.document_type && cap(x.document_type)], ['Liveness', x.liveness_result && cap(x.liveness_result)], ['Name read', x.verified_name], ['Date of birth', x.verified_dob && date(x.verified_dob)], ['Failure reason', x.failure_reason]])}
      </>
    )
  }
  if (type === 'script') {
    const k = x.contract
    return (
      <>
        {k && <><SectionTitle>Contract</SectionTitle>{rows([['Title', k.title], ['Price', usd(k.price_cents / 100)], ['Guardian approval', k.requires_guardian ? 'Required (minor)' : 'Not needed'], ['Script version', x.version], ['Status', x.status && cap(x.status)]])}</>}
        <SectionTitle>Script</SectionTitle>
        <p className="max-h-72 overflow-auto rounded-2xl border border-line p-4 text-[13.5px] whitespace-pre-wrap text-ink">{x.text || <i>No text</i>}</p>
        {x.screening_result && Object.keys(x.screening_result).length > 0 && (
          <><SectionTitle>Automatic screening</SectionTitle>{rows(Object.entries(x.screening_result).map(([k2, v]) => [cap(k2), typeof v === 'object' ? (Array.isArray(v) ? v.join(', ') : JSON.stringify(v)) : String(v)]))}</>
        )}
      </>
    )
  }
  if (type === 'report') return (
    <>
      <SectionTitle>Report</SectionTitle>
      {rows([['Reason', x.reason && cap(x.reason)], ['About', x.target_type && `${cap(x.target_type)} …${x.target_id?.slice(-6)}`], ['Status', x.status && cap(x.status)]])}
      {x.details && <p className="mt-3 rounded-2xl bg-surface-2 p-4 text-[13.5px] whitespace-pre-wrap text-ink">{x.details}</p>}
    </>
  )
  if (type === 'payout') return (
    <>
      <SectionTitle>Payout</SectionTitle>
      {rows([['Amount', x.amount !== undefined ? money(x.amount, x.currency) : null], ['Kind', x.manual ? 'Manual' : 'Scheduled'], ['Status', x.status && cap(x.status)], ['Second approval', x.needs_second_approval ? 'Needed' : 'Not needed'], ['Requested because', x.reason]])}
    </>
  )
  if (type === 'promo_link') return (
    <>
      <SectionTitle>Link</SectionTitle>
      {rows([['Label', x.label], ['Keywords', x.keywords?.length ? x.keywords.join(', ') : null], ['Flagged because', x.flag_reason], ['Reports', x.reports]])}
      {x.url && <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 block truncate rounded-2xl bg-surface-2 p-3 font-mono text-[12.5px] text-ink hover:underline">{x.url}</a>}
      <p className="mt-1 text-[12px] text-ink-3">Open with care: this link was flagged as a possible scam.</p>
    </>
  )
  if (type === 'promo_name') return (
    <>
      <SectionTitle>Name</SectionTitle>
      {rows([['Name', x.name], ['Status', x.status && cap(x.status)], ['Matches in plain text', x.plain_text_match ? 'Yes' : 'No']])}
    </>
  )
  return null
}

interface EditHistoryDto { current_text: string; edited_at: string | null; versions: { text: string; replaced_at: string; editor_id: string }[] }

/** FD-08: staff see every earlier version of an edited post or comment, oldest first. Nobody can change it. */
function EditHistory({ type, id }: { type: 'post' | 'comment'; id: string }) {
  const h = useApi((s) => api.get<EditHistoryDto>(`/admin/content/${type}/${id}/edits`, undefined, s), [type, id])
  if (!h.data?.versions.length) return null
  return (
    <div className="mt-5">
      <div className="mb-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">Edited {h.data.versions.length}× · earlier versions</div>
      <ol className="space-y-2">
        {h.data.versions.map((v, i) => (
          <li key={i} className="rounded-2xl border border-line p-3 text-[13.5px]">
            <div className="mb-1 text-[11.5px] font-semibold text-ink-3">Version {i + 1} · replaced {dateTime(v.replaced_at)}</div>
            <p className="whitespace-pre-wrap text-ink-2">{v.text || <i>No text</i>}</p>
          </li>
        ))}
        <li className="rounded-2xl border border-brand/40 bg-brand-soft/40 p-3 text-[13.5px]">
          <div className="mb-1 text-[11.5px] font-semibold text-ink-3">Now{h.data.edited_at ? ` · since ${dateTime(h.data.edited_at)}` : ''}</div>
          <p className="whitespace-pre-wrap text-ink">{h.data.current_text}</p>
        </li>
      </ol>
    </div>
  )
}

/* ── Product feedback (from the "Help us improve Wamiwa" card) ───────────── */

interface TicketRow { id: string; number: string; subject: string; status: string; created_at: string }

/** Feedback arrives as support tickets whose subject starts with FEEDBACK_PREFIX; the API filters and sorts them. */
export function Feedback() {
  const list = usePaged<TicketRow, TicketRow>((cursor, s) => api.page<TicketRow>('/admin/support/tickets', { newest_first: true, subject_prefix: FEEDBACK_PREFIX, cursor, limit: 30 }, s), (t) => t, [])
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div>
      <PageHeader title="Product feedback" subtitle="What people asked Wamiwa to do for them, from the “Help us improve Wamiwa” card. Newest first." />
      <Card className="divide-y divide-line">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} />
          : list.loading ? <RowSkeleton />
            : list.items.map((t) => {
              const [topic, ...rest] = t.subject.slice(FEEDBACK_PREFIX.length).split(' — ')
              return (
                <div key={t.id}>
                  <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <Badge tone="neutral">{topic}</Badge>
                      <div className="mt-1 truncate text-[14px] font-semibold text-ink">{rest.join(' — ')}</div>
                    </div>
                    <div className="shrink-0 text-right text-[12.5px] text-ink-3">{ago(t.created_at)}<div className="font-mono">{t.number}</div></div>
                  </button>
                  {open === t.id && <FeedbackBody id={t.id} />}
                </div>
              )
            })}
        {!list.loading && !list.error && !list.items.length && <Empty icon={<Check />} title="No feedback yet">Ideas people send from the app show up here.</Empty>}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
    </div>
  )
}

function FeedbackBody({ id }: { id: string }) {
  const t = useApi((s) => api.get<{ messages: { body: string }[] }>(`/admin/support/tickets/${id}`, undefined, s), [id])
  return (
    <div className="px-5 pb-4">
      {t.error ? <ErrorState compact error={t.error} onRetry={t.reload} /> : !t.data ? <Spinner /> : (
        <p className="rounded-2xl bg-surface-2 p-4 text-[14px] whitespace-pre-wrap text-ink">{t.data.messages[0]?.body}</p>
      )}
    </div>
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
  const [viewing, setViewing] = useState<AccountRow | null>(null)
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
                  <td className="px-5 py-2.5"><button onClick={() => setViewing(a)} className="flex items-center gap-2.5 text-left"><Avatar name={a.name} kind={a.type === 'company' ? 'company' : a.type === 'agent' ? 'agent' : 'human'} size="sm" /><div className="leading-tight"><div className="font-bold text-ink hover:underline">{a.name}</div><div className="text-[12px] text-ink-2">@{a.handle}{a.email ? ` · ${a.email}` : ''}</div></div></button></td>
                  <td className="px-3 text-ink-2 capitalize">{a.type}</td>
                  <td className="px-3 text-ink-2">{date(a.created_at)}</td>
                  <td className="px-3"><Badge tone={a.status === 'active' ? 'success' : a.status === 'suspended' || a.status === 'removed' ? 'danger' : 'warn'} dot>{cap(a.status)}</Badge></td>
                  <td className="px-5 text-right">{a.type !== 'admin' && <div className="flex justify-end gap-1">
                    {a.status === 'suspended' || a.status === 'frozen' ? <Button size="xs" variant="ghost" disabled={!perms.data?.suspend} onClick={() => setAct({ row: a, kind: 'reinstate' })}>Reinstate</Button> : <Button size="xs" variant="ghost" disabled={!perms.data?.suspend} onClick={() => setAct({ row: a, kind: 'suspend' })}>Suspend</Button>}
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
      {!superA && <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-3"><Lock className="size-3.5" />Permanent removal is Super Admin only. Suspending and reinstating need the suspend permission.</p>}
      {viewing && <AccountDetailModal row={viewing} onClose={() => setViewing(null)} />}
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

/** AD-02: one account's standing, reports against it and every admin action taken on it. */
function AccountDetailModal({ row, onClose }: { row: AccountRow; onClose: () => void }) {
  const res = useApi((s) => api.get<AccountDetailDto>(`/admin/accounts/${row.id}`, undefined, s), [row.id])
  const d = res.data
  return (
    <Modal open onClose={onClose} size="lg" title={row.name} subtitle={`@${row.handle} · ${row.type} · joined ${date(row.created_at)}`}
      footer={<Button variant="ghost" to={`/admin/audit?target=${row.id}`}>Full audit trail</Button>}>
      {res.error ? <ErrorState compact error={res.error} onRetry={res.reload} /> : !d ? <Spinner /> : (
        <>
          <KV rows={[['Status', cap(d.account.status)], ...(d.suspended_reason ? [['Suspended because', d.suspended_reason] as [string, string]] : []), ['Warnings', d.warnings], ['False reports made', d.false_reports], ['Contracts', d.contracts]]} />
          <SectionTitle>Reports against ({d.reports_against.length})</SectionTitle>
          {d.reports_against.length ? (
            <ul className="space-y-2">{d.reports_against.map((r) => <li key={r.id} className="rounded-2xl border border-line p-3 text-[13px]"><div className="flex items-center gap-2"><Badge tone="neutral">{cap(r.reason)}</Badge><Badge tone={r.status === 'upheld' ? 'danger' : 'outline'}>{cap(r.status)}</Badge><span className="ml-auto text-[12px] text-ink-3">{ago(r.created_at)}</span></div>{r.details && <p className="mt-1.5 text-ink-2">{r.details}</p>}</li>)}</ul>
          ) : <p className="text-[13px] text-ink-2">None.</p>}
          <SectionTitle>Admin history</SectionTitle>
          {d.admin_history.length ? (
            <ul className="divide-y divide-line rounded-2xl border border-line">{d.admin_history.map((h, i) => <li key={i} className="px-4 py-2.5 text-[13px]"><div className="flex items-center gap-2"><span className="font-mono font-semibold text-ink">{h.action}</span><span className="ml-auto text-[12px] text-ink-3">{dateTime(h.at)}</span></div>{h.reason && <p className="mt-0.5 text-ink-2">{h.reason}</p>}</li>)}</ul>
          ) : <p className="text-[13px] text-ink-2">No admin actions yet.</p>}
        </>
      )}
    </Modal>
  )
}

/* ── PY-04 Dispute detail ───────────────────────────────────────────────── */

interface AdminDispute {
  id: string; contract_id: string; raised_by: string; reason: string; status: string; evidence_due_at: string | null; decision_due_at: string | null
  decision: string | null; release_pct: number | null; decision_reason: string | null; appealed_by: string[]; appeal_reason: string | null
  evidence: { submitted_by: string; statement: string; attachments: unknown[]; at: string }[]
  /** Roles ('hirer' | 'earner') that sent nothing before the evidence window closed. */
  missing_evidence_from: ('hirer' | 'earner')[]; contract: ContractDto
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
  const sides = [[k.hirer_id, 'Hirer', 'hirer'], [k.earner_id, 'Earner', 'earner']] as const
  return (
    <div>
      <PageHeader back={{ to: '/admin/queues?queue=disputes', label: 'Disputes queue' }} eyebrow={`Dispute · ${cap(k.type)} · ${cap(d.status)}`} title={d.reason} subtitle={`${naira(m.price)} frozen${d.decision_due_at ? ` · decide by ${date(d.decision_due_at)}` : ''}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="p-5"><KV rows={[['Contract', k.deliverables.split('\n')[0] || k.title], ['Hirer', partyName(k.hirer_id, k.title)], ['Raised by', d.raised_by === k.hirer_id ? 'Hirer' : 'Earner'], ['Evidence due', d.evidence_due_at ? dateTime(d.evidence_due_at) : '—'], ['Delivery', k.delivery ?? '—']]} /></Card>
          <div className="grid gap-4 md:grid-cols-2">
            {sides.map(([who, label, side]) => (
              <Card key={who} className="p-5">
                <div className="flex items-center gap-2"><Badge tone="neutral">{label}</Badge>{d.missing_evidence_from.includes(side) && <Badge tone="warn">No evidence sent</Badge>}</div>
                <ul className="mt-4 space-y-2">
                  {d.evidence.filter((e) => e.submitted_by === who).map((e, i) => <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink"><FileText className="mr-1 inline size-3.5 text-ink-3" />{e.statement}{e.attachments.length ? ` · ${e.attachments.length} file(s)` : ''}<div className="mt-0.5 text-[11.5px] text-ink-3">{dateTime(e.at)}</div></li>)}
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
  const list = usePaged<MinorRow, MinorRow>((cursor, s) => api.page<MinorRow>('/admin/minor-contracts', { cursor, limit: 50 }, s), (r) => r, [])
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  return (
    <div>
      <PageHeader title="Minor contracts" subtitle="Every contract for a 13–17 account, with its guardian approvals and call recordings." />
      <Card className="divide-y divide-line">
        {list.loading ? <RowSkeleton /> : list.items.map((c) => (
          <div key={c.contract_id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1"><div className="font-bold text-ink">Contract …{c.contract_id.slice(-6).toUpperCase()}</div><div className="text-[12.5px] text-ink-2">Minor …{c.minor_id.slice(-6)} · guardian …{c.guardian_id.slice(-6)}{c.decided_at ? ` · decided ${date(c.decided_at)}` : ''}</div></div>
            <Badge tone={c.result === 'approved' ? 'success' : c.result === 'declined' || c.result === 'expired' ? 'neutral' : 'warn'}>{cap(c.result)}</Badge>
            <Badge tone="neutral">Calls {c.call_attempts}/3</Badge>
            {c.recording_ref && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <PlayCircle className="size-4 shrink-0 text-ink-3" />
                <audio controls preload="none" src={mediaUrl(c.recording_ref)} className="h-9 w-full sm:w-72" aria-label="Guardian confirmation call recording" />
              </div>
            )}
          </div>
        ))}
        {!list.loading && list.items.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-2">No contracts for minors yet.</p>}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
    </div>
  )
}

/* ── AD-01 Admin management ─────────────────────────────────────────────── */

const PERMS = [['suspend', 'Suspend accounts'], ['approve_payouts', 'Approve payouts (with limit)'], ['b2b_category_map', 'Edit B2B category map'], ['view_dashboard', 'See the dashboard'], ['view_revenue', 'See revenue figures'], ['investigate', 'Investigation team: decide racism and Yoruba-insult reports']] as const
interface AdminRow { id: string; email: string; handle: string; role: 'admin' | 'super_admin'; status: string; two_factor_enabled: boolean; permissions: (string | { permission: string; payout_limit?: number | null })[] }

export function AdminManagement() {
  const res = useApi((s) => api.get<AdminRow[]>('/admin/admins', undefined, s), [])
  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin')
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [removing, setRemoving] = useState<AdminRow | null>(null)
  const [limit, setLimit] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  // The API leaves removed admins out; filter here too so a stale response never shows them.
  const admins = res.data.filter((a) => a.status !== 'removed')
  const supers = admins.filter((a) => a.role === 'super_admin').length
  const permNames = (a: AdminRow) => a.permissions.map((p) => typeof p === 'string' ? p : p.permission)
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); toast(msg, 'Logged in the audit log.'); res.reload(); setReason('') } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const payoutLimit = (a: AdminRow) => a.permissions.find((p): p is { permission: string; payout_limit?: number | null } => typeof p !== 'string' && p.permission === 'approve_payouts')?.payout_limit ?? null
  // The limit is typed in Naira; the API compares it with payouts in kobo (local minor units).
  const limitKobo = Math.round(Number(limit.replace(/[,\s]/g, '')) * 100)
  const limitOk = Number.isFinite(limitKobo) && limitKobo > 0
  const openEditor = (a: AdminRow) => { const l = payoutLimit(a); setLimit(l ? String(l / 100) : ''); setEditing(a) }
  const togglePerm = (a: AdminRow, p: string, on: boolean) => run(() => on
    ? api.put(`/admin/admins/${a.id}/permissions`, { reason: reason || 'Granted by Super Admin', permission: p, payout_limit: p === 'approve_payouts' ? limitKobo : null })
    : api.del(`/admin/admins/${a.id}/permissions/${p}`, { reason: reason || 'Revoked by Super Admin' }), on ? 'Permission granted' : 'Permission removed')
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Admins" subtitle="Admins only get the permissions you grant. There must always be at least two Super Admins." actions={<Button icon={<UserPlus className="size-4" />} onClick={() => setInvite(true)}>Invite admin</Button>} />
      <Card className="divide-y divide-line">
        {admins.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <Avatar name={a.handle} size="md" />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-bold text-ink">@{a.handle}<Badge tone={a.role === 'super_admin' ? 'dark' : 'neutral'}>{cap(a.role)}</Badge>{!a.two_factor_enabled && <Badge tone="warn" icon={<KeyRound className="size-3" />}>2FA not set</Badge>}</div><div className="text-[12.5px] text-ink-2">{a.email}</div></div>
            <div className="flex flex-wrap gap-1">{a.role === 'super_admin' ? <Badge tone="outline">All permissions</Badge> : permNames(a).map((p) => <Badge key={p} tone="outline">{cap(p)}{p === 'approve_payouts' && payoutLimit(a) ? ` up to ${naira(payoutLimit(a)!)}` : ''}</Badge>)}</div>
            {a.role === 'admin' && <Button size="sm" variant="outline" onClick={() => openEditor(a)}>Permissions</Button>}
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
            <Field label="Payout approval limit (₦)" hint="Needed to grant payout approval. Payouts above it need another admin."><Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. 2,000,000" /></Field>
            {PERMS.map(([p, label]) => <Checkbox key={p} checked={permNames(editing).includes(p)} onChange={(on) => {
              if (on && p === 'approve_payouts' && !limitOk) { toast('Set a payout limit first', 'Enter the most this admin may approve, in Naira.', 'warn'); return }
              void togglePerm(editing, p, on).then(() => setEditing(null))
            }}>{label}</Checkbox>)}
            {permNames(editing).includes('approve_payouts') && <Button size="sm" variant="outline" disabled={!limitOk || limitKobo === payoutLimit(editing)} loading={busy} onClick={() => { void togglePerm(editing, 'approve_payouts', true).then(() => setEditing(null)) }}>Update payout limit</Button>}
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

interface AuditRow { id: string; actor_id: string; actor_handle?: string; action: string; target_type?: string | null; target_id?: string | null; target?: string; reason: string | null; details?: Record<string, unknown> | null; at?: string; created_at?: string }

export function AuditLog() {
  const [params] = useSearchParams()
  // `action` matches part of the action name; actor and target are exact ids (click one in the table to filter by it).
  const [action, setAction] = useState('')
  const [actor, setActor] = useState(params.get('actor') ?? '')
  const [target, setTarget] = useState(params.get('target') ?? '')
  const [query, setQuery] = useState({ action: '', actor: actor.trim(), target: target.trim() })
  useEffect(() => { const t = setTimeout(() => setQuery({ action: action.trim(), actor: actor.trim(), target: target.trim() }), 300); return () => clearTimeout(t) }, [action, actor, target])
  const list = usePaged<AuditRow, AuditRow>((cursor, s) => api.page<AuditRow>('/admin/audit-log', { action: query.action || undefined, actor_id: query.actor || undefined, target_id: query.target || undefined, cursor, limit: 50 }, s), (r) => r, [query.action, query.actor, query.target])
  const filtered = !!(query.action || query.actor || query.target)
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every admin action and escrow state change: who, what, when and why. Entries can’t be edited or deleted." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-64"><Input icon={<Search />} placeholder="Action, e.g. suspend" value={action} onChange={(e) => setAction(e.target.value)} className="h-10" /></div>
        <div className="w-56"><Input placeholder="Admin (actor) id" value={actor} onChange={(e) => setActor(e.target.value)} className="h-10 font-mono" suffix={actor ? <button aria-label="Clear" onClick={() => setActor('')}><X className="size-3.5 text-ink-3" /></button> : undefined} /></div>
        <div className="w-56"><Input placeholder="Target id" value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 font-mono" suffix={target ? <button aria-label="Clear" onClick={() => setTarget('')}><X className="size-3.5 text-ink-3" /></button> : undefined} /></div>
        <Badge tone="neutral" icon={<Lock className="size-3" />}>Append-only</Badge>
      </div>
      <Card className="overflow-x-auto">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : (
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">When</th><th className="px-3 font-semibold">Who</th><th className="px-3 font-semibold">Action</th><th className="px-3 font-semibold">Target</th><th className="px-5 font-semibold">Why</th></tr></thead>
            <tbody className="divide-y divide-line font-mono text-[12.5px]">
              {list.items.map((r) => {
                const at = r.at ?? r.created_at ?? ''
                return <tr key={r.id}><td className="px-5 py-2.5 whitespace-nowrap text-ink-2">{at && dateTime(at)}</td><td className="px-3 font-sans font-semibold whitespace-nowrap text-ink"><button className="hover:underline" title="Show only this admin" onClick={() => setActor(r.actor_id)}>{r.actor_handle ? `@${r.actor_handle}` : `…${r.actor_id.slice(-6)}`}</button></td><td className="px-3 text-ink">{r.action}</td><td className="px-3 text-ink-2">{r.target_id ? <button className="hover:underline" title="Show only this target" onClick={() => setTarget(r.target_id!)}>{r.target ?? [r.target_type, r.target_id.slice(-8)].filter(Boolean).join(' …')}</button> : (r.target ?? r.target_type ?? '—')}</td><td className="px-5 font-sans text-ink-2">{r.reason ?? '—'}</td></tr>
              })}
              {!list.loading && list.items.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center font-sans text-ink-2">No entries{filtered ? ' match these filters' : ' yet'}.</td></tr>}
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
  const perms = usePerms()
  const res = useApi((s) => api.get<Record<string, string[]>>('/admin/promotions/keywords', undefined, s), [])
  const [edit, setEdit] = useState<{ category: string; words: string[] } | null>(null)
  const [cat, setCat] = useState('')
  const [word, setWord] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  // Changing keywords needs the category map permission (the API refuses otherwise).
  const can = !!perms.data?.b2b_category_map
  const save = async () => {
    setBusy(true)
    try { await api.put('/admin/promotions/keywords', { category: edit!.category, keywords: edit!.words, reason }); toast('Keywords saved', 'Logged in the audit log.'); setEdit(null); setReason(''); res.reload() } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title="Suggested sellers keywords" subtitle="Words that point a clear wish to buy (“I need…”, “looking for…”) to a category. Past tense and negatives never trigger." actions={can && <div className="flex gap-2"><Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" className="h-10" /><Button icon={<Plus className="size-4" />} disabled={!cat} onClick={() => { setEdit({ category: cat.toLowerCase(), words: [] }); setCat('') }}>Add</Button></div>} />
      {perms.data && !can && <Callout className="mb-3" tone="neutral" icon={<Lock />}>Read-only. Editing keywords needs the category map permission.</Callout>}
      <Callout className="mb-6" tone="neutral" icon={<ShieldCheck />}>Minors’ words are never used to choose a category.</Callout>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(res.data).map(([c, words]) => (
          <Card key={c} className="p-5">
            <div className="flex items-center"><span className="font-extrabold text-ink">{cap(c)}</span>{can && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEdit({ category: c, words })}>Edit</Button>}</div>
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


interface PlatformStatus { test_mode: boolean; launched_at: string | null; test_money_left: Record<string, number> }

/** Super Admin: switch payments from the test keys to the live ones, once and for good. */
export function GoLive() {
  const res = useApi((s) => api.get<PlatformStatus>('/admin/platform', undefined, s), [])
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const s = res.data
  const left = Object.entries(s.test_money_left).filter(([, n]) => n > 0)
  const go = async () => {
    setBusy(true)
    try {
      await api.post('/admin/platform/go-live', { totp_code: code, confirm })
      toast('Wamiwa is live', 'Payments now use the live keys. Logged in the audit log.')
      setCode(''); setConfirm(''); res.reload()
    } catch (e) { toast('Not switched', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Go live" subtitle="Until now, payments use the test keys and no real money moves. Going live switches to the live keys for good." />
      {s.launched_at ? (
        <Callout tone="success" icon={<Check />} title="Wamiwa is live">Since {dateTime(s.launched_at)}. Payments use the live keys. This can’t be undone, and test data can no longer be reset.</Callout>
      ) : (
        <Card className="max-w-2xl p-6">
          <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">
            <li>Make sure the live Flutterwave (and PayPal) keys are set on Render, beside the test ones.</li>
            <li>Clear the test data from a laptop: <code className="rounded bg-wash px-1">python -m app.cli reset-test-data --database-url …</code></li>
            <li>Then go live here. Testers’ accounts and payments will be gone.</li>
          </ol>
          {left.length > 0 ? (
            <Callout tone="warn" icon={<AlertTriangle />} title="Test payments are still recorded">
              {left.map(([k, n]) => `${n} ${n === 1 ? ({ payments: 'payment', payouts: 'payout', refunds: 'refund' } as Record<string, string>)[k] ?? k : k}`).join(', ')}. Run the reset first; going live is refused until they’re gone.
            </Callout>
          ) : (
            <Callout tone="success" icon={<ShieldCheck />} title="No test payments left">Ready to go live.</Callout>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Two-factor code"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Type GO LIVE to confirm"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="GO LIVE" /></Field>
          </div>
          <Button className="mt-5" variant="danger" icon={<Lock className="size-4" />} loading={busy}
                  disabled={left.length > 0 || code.length < 6 || confirm.trim() !== 'GO LIVE'} onClick={go}>Go live for good</Button>
          <p className="mt-3 text-[12.5px] text-ink-3">There’s no way back to test mode afterwards. To test again later, use a separate site with its own database.</p>
        </Card>
      )}
    </div>
  )
}
