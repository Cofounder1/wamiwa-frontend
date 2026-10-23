import { useEffect, useRef, useState } from 'react'
import { CreditCard, FlaskConical, Lock, ShieldCheck } from 'lucide-react'
import { errMsg } from '@/api/client'
import {
  flutterwavePay, paymentMethod, PaymentCancelled, renderPayPal, startCheckout, TEST_PAYMENT_METHOD, type PaymentMethodDto,
} from '@/api/payments'
import { usd } from '@/lib/format'
import { Button, Callout, Modal } from '@/components/ui/primitives'
import { Spinner } from '@/components/ui/states'

interface Request { amountCents: number; description: string; resolve: (method: string) => void; reject: (e: unknown) => void }
let show: ((r: Request) => void) | null = null

/**
 * Takes a payment for exactly `amountCents` (US cents; Naira payers are charged at the day's rate) and resolves
 * with the `payment_method` to send with the purchase. Rejects with PaymentCancelled if the person backs out.
 */
export function pay(amountCents: number, description: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!show) { reject(new Error('Payments are not ready')); return }
    show({ amountCents: Math.round(amountCents), description, resolve, reject })
  })
}

/** Mounted once, near the root. Shows the price and the ways to pay. */
export function PaymentHost() {
  const [req, setReq] = useState<Request | null>(null)
  const [method, setMethod] = useState<PaymentMethodDto>()
  const [busy, setBusy] = useState(false)
  const [away, setAway] = useState(false)  // Flutterwave's own window is open on top
  const [error, setError] = useState<string>()
  const paypalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    show = (r) => { setReq(r); setError(undefined); setBusy(false); setAway(false) }
    return () => { show = null }
  }, [])
  useEffect(() => {
    if (!req) return
    paymentMethod().then(setMethod).catch((e) => setError(errMsg(e)))
  }, [req])

  const finish = (m: string) => { req?.resolve(m); setReq(null) }
  const cancel = () => { req?.reject(new PaymentCancelled()); setReq(null) }

  const paypal = method?.paypal.available && method.paypal.client_id ? method.paypal.client_id : null
  useEffect(() => {
    const el = paypalRef.current
    if (!req || !paypal || !el) return
    el.innerHTML = ''
    renderPayPal(el, paypal, req.amountCents, req.description, finish, (e) => setError(errMsg(e))).catch((e) => setError(errMsg(e)))
  }, [req, paypal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return null

  const payByCard = async () => {
    setBusy(true); setError(undefined)
    try {
      const checkout = await startCheckout(req.amountCents, req.description)
      setAway(true)
      finish(await flutterwavePay(checkout, req.description))
    } catch (e) {
      setAway(false)
      if (!(e instanceof PaymentCancelled)) setError(errMsg(e))
    } finally { setBusy(false) }
  }

  const standIn = method?.provider === 'stand_in'
  return (
    <Modal open={!away} onClose={cancel} size="sm" title={`Pay ${usd(req.amountCents / 100)}`} subtitle={req.description}
      footer={<Button variant="ghost" onClick={cancel}>Cancel</Button>}>
      {!method && !error ? <Spinner /> : (
        <div className="space-y-3">
          {method?.available && (
            <Button size="lg" className="w-full" loading={busy} icon={<CreditCard className="size-4" />} onClick={payByCard}>
              {method.currency === 'NGN' ? 'Card, bank transfer or USSD' : 'Pay by card'}
            </Button>
          )}
          {paypal && <div ref={paypalRef} className="min-h-11" aria-label="Pay with PayPal" />}
          {standIn && import.meta.env.DEV && (
            <Button size="lg" variant="outline" className="w-full" icon={<FlaskConical className="size-4" />} onClick={() => finish(TEST_PAYMENT_METHOD)}>
              Test payment (development, no money moves)
            </Button>
          )}
          {method && !method.available && !paypal && !import.meta.env.DEV && (
            <Callout tone="warn" title="Payments aren’t open yet">We’re connecting our payment partner. Please try again soon.</Callout>
          )}
          {error && <Callout tone="danger">{error}</Callout>}
          <p className="flex items-start gap-2 pt-1 text-[12.5px] text-ink-2">
            {method?.currency === 'NGN' ? <><Lock className="mt-0.5 size-3.5 shrink-0" />Charged in Naira at today’s rate through Flutterwave. Wamiwa never sees your card details.</>
              : <><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Charged in US dollars. Wamiwa never sees your card details.</>}
          </p>
        </div>
      )}
    </Modal>
  )
}
