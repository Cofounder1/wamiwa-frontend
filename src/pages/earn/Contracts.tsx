import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  AlertOctagon, Bot, Briefcase, CalendarClock, Check, Clapperboard, FileSignature, Gavel, HeartHandshake, MessageSquare, Play, PenLine, Percent, Snowflake, Wand2, XCircle,
} from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { fromContract, partyName, statusText } from '@/api/adapt'
import { useApi, usePaged, useParties } from '@/api/hooks'
import type { ContractDto } from '@/api/types'
import type { Contract } from '@/data/types'
import { useSession } from '@/context/session'
import { date, naira } from '@/lib/format'
import { ESCROW_STATES } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, CardHeader, Checkbox, Empty, Field, Input, KV, Modal, PageHeader, Progress, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { DisputeModal } from './Disputes'
import { EquityTerms } from '@/components/social/EquityTerms'

const typeMeta = {
  hire_me: { label: 'Hire Me', icon: Briefcase, tone: 'brand' as const },
  likeness: { label: 'Likeness', icon: Wand2, tone: 'agent' as const },
  agent: { label: 'Agent order', icon: Bot, tone: 'neutral' as const },
}
const stateTone = { Funded: 'neutral', Active: 'brand', Delivered: 'warn', Cleared: 'success', Paid: 'teal', Frozen: 'danger', Refunded: 'neutral' } as const
const DONE = ['completed', 'cancelled', 'declined', 'expired']
export function ContractsList() {
  const { role } = useSession()
  const brand = role === 'company'
  const [tab, setTab] = useState<'active' | 'done'>('active')
  // People can be both earner and hirer (e.g. hiring an agent), so load both sides.
  const earner = usePaged<ContractDto, ContractDto>(brand ? null : (cursor, s) => api.page<ContractDto>('/contracts', { role: 'earner', cursor, limit: 50 }, s), (c) => c, [brand])
  const hirer = usePaged<ContractDto, ContractDto>((cursor, s) => api.page<ContractDto>('/contracts', { role: 'hirer', cursor, limit: 50 }, s), (c) => c, [])
  const all = [...earner.items, ...hirer.items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  useParties(hirer.items.filter((c) => c.type !== 'agent').map((c) => c.earner_id), hirer.items.map((c) => c.agent_id))
  const shown = all.filter((c) => (tab === 'active') !== DONE.includes(c.status))
  const error = earner.error ?? hirer.error

  return (
    <div>
      <PageHeader title="Contracts" subtitle={brand ? 'Every hire you’ve made: review deliveries, disengage, or dispute.' : 'Your hires, likeness contracts and agent orders.'} actions={brand && <Button to="/app/influencers">Hire someone</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'In progress', count: all.filter((c) => !DONE.includes(c.status)).length || undefined }, { value: 'done', label: 'Finished' }]} />
      <div className="mt-5 space-y-3">
        {error ? <ErrorState error={error} onRetry={() => { earner.reload(); hirer.reload() }} />
          : earner.loading || hirer.loading ? <Spinner className="min-h-40" />
            : shown.map((c) => <ContractRow key={c.id} dto={c} />)}
        {!earner.loading && !hirer.loading && !error && shown.length === 0 && <Empty icon={<FileSignature />} title="Nothing here yet" />}
        <LoadMore show={earner.hasMore || hirer.hasMore} loading={earner.loadingMore || hirer.loadingMore} onClick={() => { if (earner.hasMore) earner.more(); if (hirer.hasMore) hirer.more() }} />
      </div>
    </div>
  )
}

function ContractRow({ dto }: { dto: ContractDto }) {
  const { me } = useSession()
  const c = fromContract(dto)
  const M = typeMeta[c.type]
  const iHire = dto.hirer_id === me.id
  const other = iHire ? partyName(dto.agent_id ?? dto.earner_id, undefined, 'earner') : partyName(dto.hirer_id, dto.title)
  const to = c.type === 'agent' ? `/app/orders/${c.id}` : `/app/contracts/${c.id}`
  return (
    <Link to={to}>
      <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:shadow-pop sm:flex-nowrap">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', c.type === 'likeness' ? 'bg-agent-soft text-agent' : c.type === 'agent' ? 'bg-wash text-ink-2' : 'bg-brand-soft text-brand')}><M.icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-ink">{c.type === 'agent' ? dto.title.charAt(0).toUpperCase() + dto.title.slice(1) : c.deliverables?.[0] ?? dto.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            <Badge tone={M.tone}>{M.label}</Badge>
            {iHire ? 'You hired' : 'From'} {other} · {statusText(dto)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-extrabold text-ink num">{naira(dto.price.local.price, { compact: true })}</div>
          <Badge tone={stateTone[c.state]} dot>{c.state}</Badge>
        </div>
      </Card>
    </Link>
  )
}

export function EscrowTrack({ state }: { state: Contract['state'] }) {
  const idx = ESCROW_STATES.indexOf(state as (typeof ESCROW_STATES)[number])
  const frozen = state === 'Frozen'
  const refunded = state === 'Refunded'
  return (
    <div>
      <div className="flex gap-1">
        {ESCROW_STATES.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={cn('h-1.5 rounded-full', refunded ? 'bg-mist' : frozen ? (i <= 2 ? 'bg-danger/70' : 'bg-wash') : i <= idx ? 'bg-brand' : 'bg-wash')} />
            <div className={cn('mt-1.5 text-[11px] font-semibold', i === idx ? 'text-ink' : 'text-ink-3')}>{s}</div>
          </div>
        ))}
      </div>
      {frozen && <div className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold text-danger"><Snowflake className="size-4" />Frozen by a dispute — ends in release, refund or split</div>}
      {refunded && <div className="mt-3 text-[12.5px] font-semibold text-ink-2">Refunded to the hirer</div>}
    </div>
  )
}

type ModalKind = null | 'deliver' | 'cancel' | 'extend' | 'partial' | 'dispute' | 'misuse' | 'disengage'

export default function ContractDetail() {
  const { id = '' } = useParams()
  const { me } = useSession()
  const res = useApi((s) => api.get<ContractDto>(`/contracts/${id}`, undefined, s), [id])
  const [modal, setModal] = useState<ModalKind>(null)
  const [text, setText] = useState('')
  const [partial, setPartial] = useState(false)
  const [pct, setPct] = useState(50)
  const [newDeadline, setNewDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  useParties([res.data?.earner_id])

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const dto = res.data
  if (dto.type === 'agent') return <Navigate to={`/app/orders/${dto.id}`} replace />
  const c = fromContract(dto)
  const isHirer = dto.hirer_id === me.id
  const isEarner = dto.earner_id === me.id
  const M = typeMeta[c.type]
  const m = dto.price.local
  const st = dto.status
  const daysToDeadline = dto.deadline ? Math.ceil((+new Date(dto.deadline) - Date.now()) / 864e5) : null

  const act = async (path: string, body: unknown, done: string, sub?: string) => {
    setBusy(true)
    try { await api.post(path, body); toast(done, sub); setModal(null); setText(''); res.reload() } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const hm = (a: string) => `/hire-me/contracts/${id}/${a}`
  const lk = (a: string) => `/likeness/contracts/${id}/${a}`

  return (
    <div>
      <PageHeader back={{ to: '/app/contracts', label: 'Contracts' }} eyebrow={<span className="flex items-center gap-2"><M.icon className="size-3.5" />{M.label} · {statusText(dto)}</span>} title={dto.deliverables?.split('\n')[0] || (dto.type === 'likeness' ? (isHirer ? `Likeness · ${partyName(dto.earner_id, undefined, 'earner')}` : `Likeness for ${partyName(dto.hirer_id, dto.title)}`) : dto.title)}
        actions={<>
          {dto.conversation_id && <Button variant="outline" icon={<MessageSquare className="size-4" />} to={`/app/messages/${dto.conversation_id}`}>Contract thread</Button>}
          {['active', 'delivered'].includes(st) && <Button variant="ghost" className="text-danger" icon={<Gavel className="size-4" />} onClick={() => setModal('dispute')}>Dispute</Button>}
        </>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between"><h3 className="text-[15px] font-bold text-ink">Escrow</h3><Badge tone={stateTone[c.state]} dot>{c.state}</Badge></div>
            <EscrowTrack state={c.state} />
          </Card>

          {st === 'pending_guardian' && <Callout tone="brand" icon={<HeartHandshake />} title="Waiting for the guardian">The guardian approves in the app, then confirms on an automated call. The contract becomes active only after both.</Callout>}
          {st === 'admin_review' && <Callout tone="neutral" icon={<CalendarClock />} title="In admin review">Scripts for under-18s, and scripts flagged by screening, are reviewed before the creator sees them.</Callout>}
          {st === 'disputed' && <Callout tone="warn" icon={<Gavel />} title="In dispute" action={<Button size="sm" variant="outline" to="/app/disputes">View dispute</Button>}>Funds are frozen while an admin reviews the evidence.</Callout>}
          {dto.cancel_reason && <Callout tone="neutral" title="Cancelled">{dto.cancel_reason}</Callout>}

          {c.type === 'hire_me' && (
            <Card>
              <CardHeader title="Deliverables" subtitle={dto.deadline ? `Due ${date(dto.deadline)}${daysToDeadline !== null && daysToDeadline >= 0 ? ` · ${daysToDeadline} days left` : daysToDeadline !== null ? ' · deadline passed' : ''}${dto.deadline_extended ? ' · extended once' : ''} · ${dto.num_posts} ${dto.num_posts === 1 ? 'post' : 'posts'}` : undefined} />
              <ul className="space-y-2 p-5">
                {dto.deliverables.split('\n').filter(Boolean).map((d) => (
                  <li key={d} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-[14px]">
                    {['delivered', 'completed'].includes(st) ? <Check className="size-5 text-teal" /> : <span className="size-5 rounded-full border-2 border-line-strong" />}
                    <span className="text-ink">{d}</span>
                  </li>
                ))}
              </ul>
              {dto.delivery && <div className="mx-5 mb-5 rounded-2xl bg-surface-2 p-4 text-[14px] whitespace-pre-wrap text-ink"><div className="mb-1 text-[12px] font-bold text-ink-2">Delivery{dto.partial_delivery ? ' (partial)' : ''}</div>{dto.delivery}</div>}
              {dto.equity && <div className="mx-5 mb-5"><EquityTerms equity={dto.equity} contractId={dto.id} onChanged={res.reload} /></div>}
              {dto.no_ai_replies && <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2"><Bot className="size-4" />“No AI replies”: auto-replies are off on this contract’s sponsored posts only.</div>}
              <div className="flex flex-wrap gap-2 border-t border-line p-5">
                {isEarner && st === 'offered' && <Button to="/app/offers">Respond in Offers</Button>}
                {isEarner && st === 'active' && !dto.work_started_at && <Button variant="outline" icon={<Play className="size-4" />} loading={busy} onClick={() => act(hm('start'), {}, 'Marked as started')}>Start work</Button>}
                {isEarner && st === 'active' && <Button icon={<Check className="size-4" />} onClick={() => setModal('deliver')}>Mark delivered</Button>}
                {isHirer && st === 'delivered' && <Button icon={<Check className="size-4" />} loading={busy} onClick={() => act(hm('approve'), {}, 'Delivery approved', 'Funds clear for the next payout.')}>Approve delivery</Button>}
                {isHirer && st === 'delivered' && <Button variant="outline" icon={<Percent className="size-4" />} onClick={() => setModal('partial')}>Release part</Button>}
                {isHirer && st === 'active' && !dto.deadline_extended && <Button variant="outline" icon={<CalendarClock className="size-4" />} onClick={() => setModal('extend')}>Extend deadline (once)</Button>}
                {['offered', 'active', 'delivered'].includes(st) && <Button variant="ghost" className="text-danger" icon={<XCircle className="size-4" />} onClick={() => setModal('cancel')}>Cancel contract</Button>}
              </div>
            </Card>
          )}

          {c.type === 'likeness' && <LikenessPanel dto={dto} isHirer={isHirer} isEarner={isEarner} onMisuse={() => setModal('misuse')} onDisengage={() => setModal('disengage')} onWithdraw={() => act(lk('withdraw'), {}, 'Offer withdrawn', 'You’re refunded in full.')} />}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <KV rows={[
              [isHirer ? 'Creator' : 'Brand', isHirer ? partyName(dto.earner_id, undefined, 'earner') : partyName(dto.hirer_id, dto.title)],
              ['Price', naira(m.price)],
              [`Wamiwa fee (${m.fee_pct}%)`, `−${naira(m.fee)}`],
              [isHirer ? 'Creator receives' : 'You receive', naira(m.net)],
              ['USD at contract', `$${(dto.price.usd_cents.price / 100).toLocaleString()} @ ${dto.price.fx_rate.replace(/\.0+$/, '')}`],
              ['Started', dto.start ? date(dto.start) : '—'],
            ]} />
          </Card>
          <Card flat className="p-5">
            <h4 className="mb-3 text-[13px] font-bold text-ink">If plans change</h4>
            <ul className="space-y-2 text-[12.5px] text-ink-2">
              {c.type === 'hire_me' ? (
                <>
                  <li>• Creator cancels before starting → full refund. 3 cancellations in 90 days lowers ranking.</li>
                  <li>• Missed deadline → brand can extend once or cancel for a full refund.</li>
                  <li>• Brand cancels after work started → creator keeps 25% of net.</li>
                  <li>• Brand cancels after delivery → creator keeps 100% of net.</li>
                </>
              ) : (
                <>
                  <li>• Fee stays in escrow for the month, then a 7-day review window.</li>
                  <li>• Brand disengages early → pro-rata refund; 25% non-refundable once a video is generated.</li>
                  <li>• After the term, posted videos stay up 60 days, then come down.</li>
                  <li>• Creator can withdraw consent mid-term only for misuse.</li>
                </>
              )}
            </ul>
          </Card>
        </aside>
      </div>

      <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Mark as delivered" subtitle="The brand then has 7 days to approve or dispute; after that, funds clear."
        footer={<Button loading={busy} disabled={text.length < 3} onClick={() => act(hm('deliver'), { delivery: text, partial }, 'Marked as delivered', 'The brand has 7 days to review.')}>Deliver</Button>}>
        <Textarea className="min-h-32" value={text} onChange={(e) => setText(e.target.value)} placeholder="Links to the posts, files, anything the brand needs to review." />
        <div className="mt-3"><Checkbox checked={partial} onChange={setPartial}>This is a partial delivery</Checkbox></div>
      </Modal>
      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} size="sm" title="Cancel contract?"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Keep contract</Button><Button variant="danger" loading={busy} onClick={() => act(hm('cancel'), { reason: text }, 'Contract cancelled', 'Refunds return within 5 working days.')}>Cancel contract</Button></>}>
        <p className="text-[14px] text-ink-2">
          {isHirer ? (st === 'delivered' ? <>Work was delivered, so the creator keeps <b className="text-ink">100% of net ({naira(m.net)})</b>.</> : dto.work_started_at ? <>Work has started, so the creator keeps <b className="text-ink">25% of net ({naira(m.net * 0.25)})</b>.</> : 'You’ll get a full refund.')
            : 'The brand gets a full refund. Three cancellations in 90 days lowers your ranking.'}
        </p>
        <Textarea className="mt-4" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason (shared with the other side)" />
      </Modal>
      <Modal open={modal === 'extend'} onClose={() => setModal(null)} size="sm" title="Extend the deadline" subtitle="You can extend once."
        footer={<Button loading={busy} disabled={!newDeadline} onClick={() => act(hm('extend-deadline'), { new_deadline: newDeadline }, 'Deadline extended')}>Extend</Button>}>
        <Field label="New deadline"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} /></Field>
      </Modal>
      <Modal open={modal === 'partial'} onClose={() => setModal(null)} size="sm" title="Release part of the payment" subtitle="The rest is refunded to you."
        footer={<Button loading={busy} onClick={() => act(hm('release-partial'), { release_pct: pct }, `${pct}% released`)}>Release {pct}%</Button>}>
        <input type="range" min={5} max={95} step={5} value={pct} onChange={(e) => setPct(+e.target.value)} className="w-full accent-[var(--brand)]" />
        <div className="mt-2 flex justify-between text-[13px]"><span>Creator gets <b className="num">{naira(m.net * pct / 100)}</b></span><span>Refund <b className="num">{naira(m.price * (100 - pct) / 100)}</b></span></div>
      </Modal>
      <Modal open={modal === 'misuse'} onClose={() => setModal(null)} title="Report misuse of your likeness" subtitle="Use this if your likeness was used outside the script you signed."
        footer={<Button variant="danger" loading={busy} disabled={text.length < 10} onClick={() => act(lk('misuse'), { details: text }, 'Takedown requested', 'Wamiwa removes the content on-platform within 24 hours.')}>Request takedown</Button>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Where did you see it, and what’s different from the signed script?" />
        <p className="mt-3 text-[12.5px] text-ink-3">You can withdraw consent for misuse, and the brand can be suspended. Copies off Wamiwa can be traced by watermark but aren’t enforced by Wamiwa.</p>
      </Modal>
      <Modal open={modal === 'disengage'} onClose={() => setModal(null)} size="sm" title="Disengage early?"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Keep contract</Button><Button variant="danger" loading={busy} onClick={() => act(lk('disengage'), {}, 'Disengaged', 'Your pro-rata refund is on its way.')}>Disengage</Button></>}>
        <p className="text-[14px] text-ink-2">You get a pro-rata refund for unused days. Once a video has been generated, <b className="text-ink">25%</b> is non-refundable.</p>
      </Modal>
      <DisputeModal open={modal === 'dispute'} onClose={() => setModal(null)} contractId={id} contractTitle={dto.title} onOpened={res.reload} />
    </div>
  )
}

function LikenessPanel({ dto, isHirer, isEarner, onMisuse, onDisengage, onWithdraw }: {
  dto: ContractDto; isHirer: boolean; isEarner: boolean; onMisuse: () => void; onDisengage: () => void; onWithdraw: () => void
}) {
  const videos = useApi(dto.status === 'active' ? (s) => api.get<{ videos: { kind: string; influencer_decision: string; status: string }[]; counter: { drafts_left: number; finals_left: number; display: string } }>(`/likeness/contracts/${dto.id}/videos`, undefined, s) : null, [dto.id, dto.status])
  const pendingFinal = videos.data?.videos.some((v) => v.kind === 'final' && v.influencer_decision === 'pending')
  const approved = videos.data?.videos.some((v) => v.kind === 'final' && v.influencer_decision === 'approved')
  const stages = ['Script', 'Consent', 'Generate', 'Approve', 'Live']
  const current = ['offered', 'changes_requested', 'admin_review'].includes(dto.status) ? 0 : dto.status === 'active' ? (approved ? 4 : pendingFinal ? 3 : 2) : 4
  const daysLeft = dto.end ? Math.max(0, Math.ceil((+new Date(dto.end) - Date.now()) / 864e5)) : null
  const counter = videos.data?.counter

  return (
    <Card>
      <CardHeader title="Likeness pipeline" subtitle={`${dto.with_voice ? 'Image + voice' : 'Image only'}${dto.exclusivity ? ' · category exclusive' : ''} · 1-month term`} />
      <div className="grid grid-cols-5 gap-2 p-5">
        {stages.map((s, i) => (
          <div key={s} className={cn('rounded-xl border p-3 text-center', i < current ? 'border-brand/30 bg-brand-soft' : i === current ? 'border-ink bg-surface' : 'border-line bg-surface-2')}>
            <div className={cn('text-[11px] font-bold', i <= current ? 'text-ink' : 'text-ink-3')}>{s}</div>
            <div className="mt-0.5 text-[10.5px] text-ink-3">{i < current ? 'Done' : i === current ? 'Now' : '—'}</div>
          </div>
        ))}
      </div>
      {counter && (
        <div className="grid gap-4 px-5 sm:grid-cols-2">
          <div><div className="mb-1 flex justify-between text-[12.5px] text-ink-2"><span>Draft previews</span><b className="text-ink num">{counter.drafts_left} left</b></div><Progress value={4 - counter.drafts_left} max={4} /></div>
          <div><div className="mb-1 flex justify-between text-[12.5px] text-ink-2"><span>Final renders</span><b className="text-ink num">{counter.finals_left} left</b></div><Progress value={2 - Math.min(2, counter.finals_left)} max={2} tone="teal" /></div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line p-5">
        {isEarner && ['offered', 'changes_requested'].includes(dto.status) && <Button icon={<PenLine className="size-4" />} to={`/app/likeness/script/${dto.id}`}>Review script</Button>}
        {isEarner && pendingFinal && <Button icon={<Clapperboard className="size-4" />} to={`/app/likeness/video/${dto.id}`}>Approve video</Button>}
        {isHirer && dto.status === 'changes_requested' && <Button icon={<PenLine className="size-4" />} to={`/app/likeness/script/${dto.id}`}>Respond to changes</Button>}
        {isHirer && dto.status === 'active' && <Button icon={<Clapperboard className="size-4" />} to={`/app/video/${dto.id}`}>Open video studio</Button>}
        {isHirer && ['offered', 'changes_requested'].includes(dto.status) && <Button variant="ghost" className="text-danger" onClick={onWithdraw}>Withdraw offer</Button>}
        {isEarner && dto.status === 'active' && <Button variant="ghost" className="text-danger" icon={<AlertOctagon className="size-4" />} onClick={onMisuse}>Report misuse</Button>}
        {isHirer && dto.status === 'active' && <Button variant="ghost" className="text-danger" onClick={onDisengage}>Disengage early</Button>}
        {daysLeft !== null && <span className="ml-auto text-[12.5px] text-ink-2">{daysLeft} days left in term</span>}
      </div>
    </Card>
  )
}
