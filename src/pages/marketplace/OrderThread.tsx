import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Coins, Gavel, Loader2, RotateCcw, Send, Sparkles, Star, Undo2 } from 'lucide-react'
import { acc } from '@/data/mock'
import { api, errMsg } from '@/api/client'
import { fromContract, statusText } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { ContractDto, MessageDto } from '@/api/types'
import { useSession } from '@/context/session'
import { ago, date, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, KV, Modal, PageHeader, Progress, Stepper, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { WhoTag } from '@/components/social/labels'
import { DisputeModal } from '@/pages/earn/Disputes'
import { Markdown } from '@/components/ui/Markdown'

export default function OrderThread() {
  const { id = '' } = useParams()
  const { me } = useSession()
  const res = useApi((s) => api.get<ContractDto>(`/contracts/${id}`, undefined, s), [id])
  const [modal, setModal] = useState<null | 'revise' | 'dispute' | 'deliver' | 'refund' | 'playground'>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [stars, setStars] = useState(0)

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const dto = res.data
  const k = fromContract(dto)
  const agent = acc(dto.agent_id ?? k.earnerId)
  const owner = acc(dto.earner_id)
  const isOwner = me.id === dto.earner_id
  const isHirer = me.id === dto.hirer_id
  const money = dto.price.usd_cents
  const step = dto.status === 'active' ? 0 : dto.status === 'delivered' ? 1 : 2
  const daysLeft = dto.review_ends_at ? Math.max(0, Math.ceil((+new Date(dto.review_ends_at) - Date.now()) / 864e5)) : 7

  const act = async (fn: () => Promise<unknown>, done: string, body?: string) => {
    setBusy(true)
    try { await fn(); toast(done, body); setModal(null); setNote(''); res.reload() } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader back={{ to: isOwner ? `/app/agents/${agent.handle}?tab=orders` : '/app/contracts', label: isOwner ? 'Agent orders' : 'Contracts' }} eyebrow={`Order · ${statusText(dto)}`} title={dto.title.charAt(0).toUpperCase() + dto.title.slice(1)}
        actions={isHirer && <Button variant="dark" icon={<Sparkles className="size-4" />} onClick={() => setModal('playground')}>Playground</Button>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="p-6"><Stepper steps={['Order received', 'Delivered', 'Approved']} current={step} /></Card>

          <Card className="p-5">
            <h3 className="text-[15px] font-bold text-ink">Brief</h3>
            <p className="mt-2 text-[14px] whitespace-pre-wrap text-ink-2">{dto.deliverables}</p>
          </Card>

          {dto.status === 'active' && isOwner && (
            <Card className="p-5">
              <CardHeader className="!p-0" title="Deliver this order" subtitle="Paste the work or a link to it. The hirer then has 7 days to review." />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button icon={<Check className="size-4" />} onClick={() => setModal('deliver')}>Mark delivered</Button>
                <Button variant="ghost" className="text-danger" icon={<Undo2 className="size-4" />} onClick={() => setModal('refund')}>Can’t complete · refund</Button>
              </div>
            </Card>
          )}
          {dto.status === 'active' && isHirer && <Callout tone="brand" icon={<Loader2 className="animate-spin" />} title="Order received">{agent.name} passed your order to its owner. You’ll get a notification when it’s delivered.</Callout>}

          {dto.status === 'delivered' && (
            <Card className="overflow-hidden">
              <CardHeader title="Delivery" subtitle={`${dto.delivered_at ? `Delivered ${date(dto.delivered_at)} · ` : ''}review window: ${daysLeft} days left`} action={<Badge tone="brand">{isHirer ? 'Awaiting your review' : 'Waiting for the hirer'}</Badge>} />
              <div className="p-5">
                <Markdown text={dto.delivery ?? ''} className="rounded-2xl border border-line bg-surface-2 p-5 text-[14px] leading-relaxed text-ink" />
                <Progress className="mt-5" value={7 - daysLeft} max={7} />
                <div className="mt-1.5 text-[12px] text-ink-3">Funds clear automatically if there’s no response in {daysLeft} days.</div>
                {isHirer && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button loading={busy} icon={<Check className="size-4" />} onClick={() => act(() => api.post(`/orders/${id}/approve`), 'Delivery approved', `${usd(money.net / 100)} goes to the agent owner on the next payout.`)}>Approve</Button>
                    <Button variant="outline" icon={<RotateCcw className="size-4" />} disabled={dto.revision_used} onClick={() => setModal('revise')}>{dto.revision_used ? 'Revision already used' : 'Request a revision (1)'}</Button>
                    <Button variant="ghost" className="text-danger" icon={<Gavel className="size-4" />} onClick={() => setModal('dispute')}>Open dispute</Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {dto.status === 'completed' && (
            <Card className="p-5">
              <Callout tone="success" icon={<Check />} title="Approved">Funds are cleared and paid to the owner on the next 2-week cycle.</Callout>
              {isHirer && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-[13.5px] font-semibold text-ink">Rate {agent.name}</span>
                  <div className="flex">{[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} aria-label={`${n} stars`} onClick={() => setStars(n)} className="p-0.5"><Star className={cn('size-6', n <= stars ? 'fill-warn text-warn' : 'text-line-strong')} /></button>
                  ))}</div>
                  <Button size="sm" disabled={!stars} loading={busy} onClick={() => act(() => api.post(`/contracts/${id}/rating`, { stars }), 'Thanks for rating')}>Submit</Button>
                </div>
              )}
            </Card>
          )}
          {['disputed', 'cancelled'].includes(dto.status) && <Callout tone={dto.status === 'disputed' ? 'warn' : 'neutral'} title={statusText(dto)}>{dto.status === 'disputed' ? 'Funds are frozen while an admin reviews the dispute.' : dto.cancel_reason ?? 'This order was cancelled and refunded.'}</Callout>}

          {dto.conversation_id && <OrderChat conversationId={dto.conversation_id} />}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3"><Avatar src={agent.avatar} name={agent.name} kind="agent" /><div><div className="font-bold text-ink">{agent.name}</div><div className="text-[12.5px] text-ink-2">by {owner.name}</div></div></div>
            <KV className="mt-4" rows={[
              ['Price', usd(money.price / 100, { cents: true })],
              [`Fee (${money.fee_pct}%)`, usd(money.fee / 100, { cents: true })],
              ['Owner receives', usd(money.net / 100, { cents: true })],
              ['Escrow', <Badge key="e" tone={k.state === 'Cleared' || k.state === 'Paid' ? 'success' : k.state === 'Frozen' ? 'danger' : 'brand'}>{k.state}</Badge>],
              ['Ordered', date(dto.created_at)],
            ]} />
          </Card>
        </aside>
      </div>

      <Modal open={modal === 'revise'} onClose={() => setModal(null)} title="Request a revision" subtitle="You can request one revision per order."
        footer={<Button loading={busy} disabled={note.length < 5} onClick={() => act(() => api.post(`/orders/${id}/revision`, { note }), 'Revision requested', 'The agent has been told what to change.')}>Send request</Button>}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change?" />
      </Modal>
      <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Deliver order" subtitle="The hirer sees this, then has 7 days to approve, request a revision, or dispute."
        footer={<Button loading={busy} disabled={note.length < 3} onClick={() => act(() => api.post(`/orders/${id}/deliver`, { delivery: note }), 'Marked delivered')}>Deliver</Button>}>
        <Textarea className="min-h-40" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste the work, or a link to it." />
      </Modal>
      <Modal open={modal === 'refund'} onClose={() => setModal(null)} size="sm" title="Refund this order?" subtitle="The hirer gets their full payment back through Wamiwa."
        footer={<Button variant="danger" loading={busy} onClick={() => act(() => api.post(`/orders/${id}/refund`, { note }), 'Order refunded', 'The hirer is refunded within 5 working days.')}>Refund in full</Button>}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why can’t the agent complete it? (shared with the hirer)" />
      </Modal>
      <DisputeModal open={modal === 'dispute'} onClose={() => setModal(null)} contractId={id} contractTitle={dto.title} onOpened={res.reload} />
      <PlaygroundModal open={modal === 'playground'} onClose={() => setModal(null)} agentName={agent.name} />
    </div>
  )
}

function OrderChat({ conversationId }: { conversationId: string }) {
  const { me } = useSession()
  const res = useApi((s) => api.get<{ messages: MessageDto[] }>(`/conversations/${conversationId}/messages`, { limit: 50 }, s), [conversationId])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const t = setInterval(res.reload, 8000); return () => clearInterval(t) }, [res.reload])
  const send = async () => {
    if (!text.trim()) return
    setBusy(true)
    try { await api.post(`/conversations/${conversationId}/messages`, { body: text.trim(), attachments: [] }); setText(''); res.reload() } catch (e) { toast('Not sent', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const msgs = [...(res.data?.messages ?? [])].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-[15px] font-bold text-ink">Order thread</h3>
      <div className="space-y-3">
        {msgs.length === 0 && <p className="text-[13px] text-ink-3">No messages yet.</p>}
        {msgs.map((m) => {
          const a = acc(m.sender_id)
          const mine = m.sender_id === me.id
          return (
            <div key={m.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
              <Avatar src={a.avatar} name={a.name} kind={a.kind} size="sm" />
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px]', mine ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink ring-1 ring-line')}>
                {a.kind === 'agent' && <div className="mb-0.5"><WhoTag label="agent" /></div>}
                <span className="whitespace-pre-wrap">{m.body}</span>
                <div className={cn('mt-1 text-[10.5px]', mine ? 'opacity-75' : 'text-ink-3')}>{ago(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} className="h-10 flex-1 rounded-full border border-line bg-surface px-4 text-[14px] focus:border-brand focus:outline-none" placeholder="Message about this order…" />
        <button onClick={send} disabled={busy || !text.trim()} className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40" aria-label="Send"><Send className="size-4" /></button>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">Agents only talk to hirers inside order threads. What you type is passed to the agent as untrusted input.</p>
    </Card>
  )
}

/** Epic 16 — planned, not built. Shown as a clearly labeled preview; nothing is charged. */
function PlaygroundModal({ open, onClose, agentName }: { open: boolean; onClose: () => void; agentName: string }) {
  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2">Playground <Badge tone="neutral">Coming soon</Badge></span>} subtitle={`Use ${agentName} live in a session instead of waiting for a delivery.`}>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-[13.5px] text-ink-2">
        <Coins className="size-5 shrink-0 text-warn" />
        You’ll buy a bundle of credits for this agent. Each message spends credits at the rate its owner sets. If the agent is slow or down, no credits are spent.
      </div>
      <p className="mt-4 text-[12.5px] text-ink-3">The Playground is planned (PRD Epic 16) and isn’t live yet, so there’s nothing to buy today.</p>
    </Modal>
  )
}
