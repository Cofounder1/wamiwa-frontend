import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ShieldCheck } from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { useApi } from '@/api/hooks'
import { usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, Callout, Field, Input, Modal, Segmented, toast } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/states'
import { pay } from '@/components/payments/PaymentSheet'
import { isCancelled } from '@/api/payments'

/** MS-05: hire a marketplace agent to summarize this chat, or draw insights from it. */
interface Offer { id: string; handle: string; name: string; price_cents: number; rating: number | null; completed_orders: number }

export function SummarizeChat({ open, onClose, conversationId }: { open: boolean; onClose: () => void; conversationId: string }) {
  const nav = useNavigate()
  const offers = useApi(open ? (s) => api.get<Offer[]>('/chat-insights/agents', undefined, s) : null, [open])
  const [agentId, setAgentId] = useState<string | null>(null)
  const [kind, setKind] = useState<'summary' | 'insights'>('summary')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const chosen = offers.data?.find((o) => o.id === agentId)
  const code = offers.error?.code

  const hire = async () => {
    if (!chosen) return
    setBusy(true)
    try {
      const payment_method = await pay(chosen.price_cents, `Chat ${kind} by ${chosen.name}`)
      const order = await api.post<{ id: string }>('/chat-insights', {
        conversation_id: conversationId, agent_id: chosen.id, kind, question: question || null, payment_method })
      toast('Order placed', `${chosen.name} will deliver it in the order thread.`)
      onClose()
      nav(`/app/orders/${order.id}`)
    } catch (e) { if (!isCancelled(e)) toast('Couldn’t place the order', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Summarize with an agent" subtitle="Hire a marketplace agent to summarize this chat or tell you what it shows."
      footer={!offers.error && <Button loading={busy} disabled={!chosen} onClick={hire}>{chosen ? `Hire for ${usd(chosen.price_cents / 100)}` : 'Choose an agent'}</Button>}>
      {code === 'pro_required' ? (
        <Callout tone="brand" title="Comes with Pro" action={<Button size="sm" to="/app/subscription">See Pro</Button>}>Chat summaries are for Pro subscribers ($16 a month).</Callout>
      ) : code === 'paying_business_required' ? (
        <Callout tone="neutral" title="For paying businesses">Chat summaries are for businesses that paid for a Wamiwa service in the last 90 days.</Callout>
      ) : offers.error ? (
        <Callout tone="danger">{offers.error.message}</Callout>
      ) : !offers.data ? <Spinner className="min-h-32" /> : offers.data.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-2">No agents offer chat summaries yet.</p>
      ) : (
        <div className="space-y-5">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {offers.data.map((o) => (
              <button key={o.id} onClick={() => setAgentId(o.id)} className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition', agentId === o.id ? 'border-ink bg-surface ring-2 ring-ink/10' : 'border-line hover:bg-wash')}>
                <span className="grid size-9 place-items-center rounded-xl bg-agent-soft text-agent"><Bot className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold text-ink">{o.name}</span><span className="text-[12px] text-ink-2">@{o.handle}{o.rating ? ` · ${o.rating.toFixed(1)}★` : ''} · {o.completed_orders} orders</span></span>
                <span className="font-bold text-ink num">{usd(o.price_cents / 100)}</span>
              </button>
            ))}
          </div>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'summary', label: 'Summary' }, { value: 'insights', label: 'Insights' }]} />
          <Field label="Anything to focus on?" optional><Input value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What did we agree on price and dates?" /></Field>
          <Callout tone="neutral" icon={<ShieldCheck />}>
            The agent gets up to the last 300 messages, shown as “You” and “Them”. Phone numbers, emails and account, ID or card numbers are removed first, attachments aren’t shared, and the agent can’t put personal details in its answer.
          </Callout>
        </div>
      )}
    </Modal>
  )
}
