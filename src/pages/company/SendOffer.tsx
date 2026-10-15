import { useState } from 'react'
import { AlertTriangle, Lock, Plus, ShieldCheck, X } from 'lucide-react'
import { acc } from '@/data/mock'
import { api, ApiError } from '@/api/client'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { naira, usd } from '@/lib/format'
import { Button, Callout, Checkbox, Field, Input, KV, Modal, toast } from '@/components/ui/primitives'

interface Quote { type: string; price: { usd_cents: { price: number; fee: number; net: number; fee_pct: number }; local: { price: number; fee: number; net: number } } }

/** HM-03 — brand sends a Hire Me offer and pays escrow at the same time. */
export function SendOfferModal({ open, onClose, influencerId, name, startingCents, nicheWarning, onSent }: {
  open: boolean; onClose: () => void; influencerId: string; name?: string; startingCents?: number; nicheWarning?: string | null; onSent?: () => void
}) {
  const a = acc(influencerId)
  const who = name ?? a.name
  const { me } = useSession()
  const [price, setPrice] = useState((startingCents ?? (a.hireMe?.from ?? 300) * 100) / 100)
  const [posts, setPosts] = useState(2)
  const [deadline, setDeadline] = useState(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10))
  const [items, setItems] = useState(['1 × 60s video', '1 × story set with link'])
  const [noAi, setNoAi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const quote = useApi(price > 0 ? (s) => api.call<Quote>('POST', '/contracts/quote', { body: { type: 'hire_me', price_cents: Math.round(price * 100) }, signal: s }) : null, [price])
  const unverified = me.verification !== 'company'

  const send = async () => {
    setBusy(true); setError(undefined)
    try {
      await api.post('/hire-me/offers', {
        influencer_id: influencerId, price_cents: Math.round(price * 100), deliverables: items.filter(Boolean).join('\n'),
        deadline, num_posts: posts, no_ai_replies: noAi, payment_method: 'tok_visa',
      })
      onClose(); onSent?.()
      toast('Offer sent', `${usd(price)} is held in escrow. ${who.split(' ')[0]} has 7 days to respond.`)
    } catch (e) { setError(e instanceof ApiError ? e.fieldMessage ?? e.message : 'Couldn’t send the offer') } finally { setBusy(false) }
  }
  const q = quote.data?.price.local

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Offer to ${who}`} subtitle="You pay the full price into escrow now. It’s refunded in full if the offer is declined or expires after 7 days."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={unverified || price < 1 || !items.some(Boolean)} loading={busy} icon={<Lock className="size-4" />} onClick={send}>Pay {usd(price)} & send</Button></>}>
      {unverified && <Callout className="mb-4" tone="danger" title="Verify your business first">Unverified companies can’t send offers or pay.</Callout>}
      {nicheWarning && <Callout className="mb-4" tone="warn" icon={<AlertTriangle />}>{nicheWarning}. You can still proceed.</Callout>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price (USD)"><Input type="number" min={1} value={price || ''} onChange={(e) => setPrice(+e.target.value)} /></Field>
        <Field label="Number of posts"><Input type="number" min={1} value={posts} onChange={(e) => setPosts(+e.target.value)} /></Field>
        <Field label="Deadline"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 text-[13px] font-semibold text-ink">Deliverables</div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2"><Input value={it} onChange={(e) => setItems((x) => x.map((y, j) => j === i ? e.target.value : y))} /><button aria-label="Remove" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-2xl text-ink-3 hover:bg-wash"><X className="size-4" /></button></div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setItems((x) => [...x, ''])}>Add deliverable</Button>
        </div>
      </div>
      <div className="mt-4"><Checkbox checked={noAi} onChange={setNoAi}>No AI replies on this contract’s sponsored posts</Checkbox></div>
      <div className="mt-5 rounded-2xl bg-surface-2 p-4">
        <KV rows={[
          ['You pay into escrow', q ? `${usd(price)} ≈ ${naira(q.price)}` : usd(price)],
          [`Wamiwa fee (${quote.data?.price.usd_cents.fee_pct ?? 20}%, from the price)`, q ? naira(q.fee) : '—'],
          [`${who.split(' ')[0]} receives`, q ? naira(q.net) : '—'],
        ]} />
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3"><ShieldCheck className="size-3.5" />Under-18s need guardian approval and a confirmation call before it starts.</p>
    </Modal>
  )
}
