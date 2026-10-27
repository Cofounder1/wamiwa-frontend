import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileText, Lock, PieChart, Plus, ShieldCheck, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { naira, usd } from '@/lib/format'
import { Button, Callout, Checkbox, Field, Input, KV, Modal, Segmented, toast } from '@/components/ui/primitives'
import { pay, REFUND_NOTE } from '@/components/payments/PaymentSheet'
import { isCancelled, paymentMethod } from '@/api/payments'
import { EQUITY_FEE_CENTS } from '@/lib/rules'

interface InfluencerPage { name: string; starting_price_cents: number | null; available: boolean; open_to_equity?: boolean; equity_min_cash_cents?: number | null }
interface Breakdown { price: number; fee: number; net: number; fee_pct: number }
/** POST /contracts/quote: the fee comes out of the price, in US cents and in local minor units at today's rate. */
interface Quote { usd_cents: Breakdown; local: Breakdown & { currency: string }; fx_rate: string; note: string }

/** A date-picker day as the end of that day in UTC, so a deadline of "today" is still in the future. */
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10)

/** HM-03 — brand sends a Hire Me offer and pays escrow at the same time. */
export function SendOfferModal({ open, onClose, influencerId, name, startingCents, nicheWarning, onSent }: {
  open: boolean; onClose: () => void; influencerId: string; name?: string; startingCents?: number; nicheWarning?: string | null; onSent?: () => void
}) {
  const { me } = useSession()
  const [price, setPrice] = useState(startingCents ? startingCents / 100 : 0)
  const [posts, setPosts] = useState(2)
  const [deadline, setDeadline] = useState(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10))
  const [items, setItems] = useState(['1 × 60s video', '1 × story set with link'])
  const [noAi, setNoAi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // HM-06: equity alongside cash, for influencers who opted in.
  const page = useApi((s) => api.get<InfluencerPage>(`/hire-me/influencers/${influencerId}`, undefined, s).catch(() => null), [influencerId])
  const who = name ?? page.data?.name ?? 'this creator'
  // Start from the creator's own starting price unless one was passed in or the brand already typed a price.
  const priceTouched = useRef(!!startingCents)
  useEffect(() => {
    const start = page.data?.starting_price_cents
    if (start && !priceTouched.current) { setPrice(start / 100); priceTouched.current = true }
  }, [page.data])
  const [withEquity, setWithEquity] = useState(false)
  const [eqKind, setEqKind] = useState<'percent' | 'shares'>('percent')
  const [eqAmount, setEqAmount] = useState(0.5)
  const [shareClass, setShareClass] = useState('ordinary')
  const [vesting, setVesting] = useState(12)
  const [cliff, setCliff] = useState(3)
  const [agreement, setAgreement] = useState<{ ref: string; name: string }>()
  const [eqNote, setEqNote] = useState('')
  const [equityOnly, setEquityOnly] = useState(false)  // HM-06: no cash, $5 service fee each
  const cashCents = withEquity && equityOnly ? 0 : Math.round(price * 100)
  const openToEquity = !!page.data?.open_to_equity
  const minCents = (withEquity ? page.data?.equity_min_cash_cents : page.data?.starting_price_cents) ?? undefined
  const cashOnly = !(withEquity && equityOnly)
  const belowMinimum = cashOnly && cashCents < Math.max(100, minCents ?? 0)
  const notTaking = page.data?.available === false
  const equityInvalid = withEquity && (!agreement || eqAmount <= 0 || (eqKind === 'percent' ? eqAmount > 100 : !Number.isInteger(eqAmount))
    || vesting < 0 || vesting > 120 || cliff < 0 || cliff > 60)
  const formInvalid = !items.some((x) => x.trim()) || items.filter(Boolean).join('\n').trim().length < 3 || posts < 1 || posts > 1000
    || !deadline || deadline < tomorrow()
  const uploadAgreement = async (f?: File) => {
    if (!f) return
    const form = new FormData(); form.append('kind', 'document'); form.append('file', f)
    try { const up = await api.upload<{ ref: string }>('/uploads', form); setAgreement({ ref: up.ref, name: f.name }) } catch (e) { toast('Upload failed', e instanceof ApiError ? e.message : undefined, 'danger') }
  }
  const quote = useApi(cashCents > 0 ? (s) => api.call<Quote>('POST', '/contracts/quote', { body: { type: 'hire_me', price_cents: cashCents }, signal: s }) : null, [cashCents])
  const unverified = me.verification !== 'company'
  const method = useApi(() => paymentMethod(), [])

  const send = async () => {
    setBusy(true); setError(undefined)
    let paid = false
    try {
      const payment_method = cashCents
        ? await pay(cashCents, `Offer to ${who} (held in escrow)`)
        : await pay(EQUITY_FEE_CENTS, 'Wamiwa service fee · equity-only offer (refunded if declined)')
      paid = true
      await api.post('/hire-me/offers', {
        influencer_id: influencerId, price_cents: cashCents, deliverables: items.filter(Boolean).join('\n'),
        deadline: `${deadline}T23:59:59Z`, num_posts: posts, no_ai_replies: noAi, payment_method,
        equity: withEquity ? {
          [eqKind]: eqKind === 'shares' ? Math.round(eqAmount) : eqAmount, share_class: shareClass,
          vesting_months: vesting, cliff_months: cliff, agreement_ref: agreement?.ref, description: eqNote || null,
        } : null,
      })
      onClose(); onSent?.()
      toast('Offer sent', cashCents ? `${usd(cashCents / 100)} is held in escrow. ${who.split(' ')[0]} has 7 days to respond.` : `Equity-only offer sent with the $5 service fee (refunded if it’s declined). ${who.split(' ')[0]} has 7 days to respond.`)
    } catch (e) {
      if (isCancelled(e)) return
      const msg = e instanceof ApiError ? e.fieldMessage ?? e.message : 'Couldn’t send the offer'
      setError(paid ? `${msg} ${REFUND_NOTE}` : msg)
    } finally { setBusy(false) }
  }
  const q = quote.data && quote.data.usd_cents.price === cashCents ? quote.data : undefined
  // The quote's local amounts are in Naira; only Naira payers are charged that way (PayPal is always dollars).
  const inNaira = method.data?.currency === 'NGN' && q?.local.currency === 'NGN'

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Offer to ${who}`} subtitle="You pay the full price into escrow now. It’s refunded in full if the offer is declined or expires after 7 days."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={unverified || notTaking || belowMinimum || formInvalid || equityInvalid} loading={busy} icon={<Lock className="size-4" />} onClick={send}>{cashCents ? `Pay ${usd(cashCents / 100)} & send` : 'Pay $5 fee & send'}</Button></>}>
      {unverified && <Callout className="mb-4" tone="danger" title="Verify your business first">Unverified companies can’t send offers or pay.</Callout>}
      {notTaking && <Callout className="mb-4" tone="warn">{who} isn’t taking new orders right now.</Callout>}
      {nicheWarning && <Callout className="mb-4" tone="warn" icon={<AlertTriangle />}>{nicheWarning}. You can still proceed.</Callout>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price (USD)"><Input type="number" min={1} value={price || ''} onChange={(e) => { priceTouched.current = true; setPrice(+e.target.value) }} /></Field>
        <Field label="Number of posts"><Input type="number" min={1} value={posts} onChange={(e) => setPosts(+e.target.value)} /></Field>
        <Field label="Deadline"><Input type="date" min={tomorrow()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
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
      {minCents && cashOnly ? <p className={`mt-2 text-[12px] ${belowMinimum ? 'font-semibold text-danger' : 'text-ink-3'}`}>Minimum cash for this offer: {usd(minCents / 100)}{withEquity ? ' (half the starting price, because equity is included)' : ''}</p> : null}
      {openToEquity && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <Checkbox checked={withEquity} onChange={setWithEquity}><span className="inline-flex items-center gap-1.5 font-semibold"><PieChart className="size-4 text-brand" />Add equity alongside the cash</span></Checkbox>
          {withEquity && (
            <div className="mt-4 space-y-4">
              <Checkbox checked={equityOnly} onChange={setEquityOnly}>Equity only, no cash (you and the influencer each pay Wamiwa a $5 service fee)</Checkbox>
              <Segmented value={eqKind} onChange={setEqKind} options={[{ value: 'percent', label: 'Percentage' }, { value: 'shares', label: 'Number of shares' }]} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={eqKind === 'percent' ? 'Equity (%)' : 'Shares'}><Input type="number" min={0} step={eqKind === 'percent' ? 0.01 : 1} value={eqAmount || ''} onChange={(e) => setEqAmount(+e.target.value)} /></Field>
                <Field label="Share class"><Input value={shareClass} onChange={(e) => setShareClass(e.target.value)} /></Field>
                <Field label="Vesting (months)"><Input type="number" min={0} max={120} value={vesting} onChange={(e) => setVesting(+e.target.value)} /></Field>
                <Field label="Cliff (months)"><Input type="number" min={0} max={60} value={cliff} onChange={(e) => setCliff(+e.target.value)} /></Field>
              </div>
              <Field label="Agreement" hint="Upload the equity agreement (PDF or Word). The influencer reads it before accepting.">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-4 text-[13px] text-ink-2 hover:border-brand"><FileText className="size-4" />{agreement ? agreement.name : 'Upload agreement'}<input type="file" accept=".pdf,.docx" className="sr-only" onChange={(e) => uploadAgreement(e.target.files?.[0])} /></label>
              </Field>
              <Field label="Note" optional><Input value={eqNote} maxLength={1000} onChange={(e) => setEqNote(e.target.value)} placeholder="e.g. Advisor shares for the launch campaign" /></Field>
              <Callout tone="warn">Wamiwa records the equity and the agreement but doesn’t hold, value or transfer it. Escrow and disputes cover only the cash. Issuing and registering the shares is up to your company.</Callout>
            </div>
          )}
        </div>
      )}
      <div className="mt-5 rounded-2xl bg-surface-2 p-4">
        {cashOnly || cashCents ? (
          <KV rows={[
            ['You pay into escrow', q ? `${usd(q.usd_cents.price / 100, { cents: true })}${inNaira ? ` ≈ ${naira(q.local.price)}` : ''}` : usd(cashCents / 100, { cents: true })],
            [`Wamiwa fee (${q?.usd_cents.fee_pct ?? '—'}%, from the price)`, q ? usd(q.usd_cents.fee / 100, { cents: true }) : '—'],
            [`${who.split(' ')[0]} receives`, q ? usd(q.usd_cents.net / 100, { cents: true }) : '—'],
          ]} />
        ) : (
          <KV rows={[['You pay now', `${usd(EQUITY_FEE_CENTS / 100)} service fee (refunded if declined)`]]} />
        )}
        {q?.note && <p className="mt-2 text-[12px] text-ink-3">{q.note}</p>}
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3"><ShieldCheck className="size-3.5" />Under-18s need guardian approval and a confirmation call before it starts.</p>
    </Modal>
  )
}
