import { api, ApiError } from './client'

/**
 * PY-05 paying. Every purchase is two steps:
 *   1. pay(): the person pays in Flutterwave's window (card, bank transfer, USSD) or PayPal's, for the exact price;
 *   2. the purchase request carries the resulting `payment_method` (`flw:<id>` or `paypal:<order id>`), and the
 *      backend verifies the payment with the provider before acting on it.
 * In development, with no provider connected, the backend's stand-in accepts a test token instead.
 */

export interface PaymentMethodDto {
  provider: 'flutterwave' | 'stand_in'
  currency: string
  public_key: string | null
  available: boolean
  paypal: { available: boolean; currency: 'USD'; client_id: string | null; environment: string | null }
}
export interface CheckoutDto {
  tx_ref: string; amount: string; currency: string; public_key: string | null; description: string
  customer: { email: string | null; name: string }
}

/** The stand-in provider's test card (development only). */
export const TEST_PAYMENT_METHOD = 'tok_visa'

/** Thrown when the person closes the payment window without paying. Callers stay quiet about it. */
export class PaymentCancelled extends Error { constructor() { super('Payment cancelled') } }
export const isCancelled = (e: unknown) => e instanceof PaymentCancelled

let method: Promise<PaymentMethodDto> | null = null
export function paymentMethod() {
  method ??= api.get<PaymentMethodDto>('/payments/method').catch((e) => { method = null; throw e })
  return method
}

export const startCheckout = (amountCents: number, description: string) =>
  api.post<CheckoutDto>('/payments/checkout', { amount_cents: amountCents, description: description.slice(0, 127) })
export const startPayPalOrder = (amountCents: number, description: string) =>
  api.post<{ order_id: string; payment_method: string }>('/payments/paypal/order', { amount_cents: amountCents, description: description.slice(0, 127) })

/* ── Provider scripts, loaded only when someone pays ────────────────────── */

const scripts = new Map<string, Promise<void>>()
function loadScript(src: string) {
  let p = scripts.get(src)
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => { scripts.delete(src); el.remove(); reject(new ApiError(0, 'checkout_unavailable', 'The payment window couldn’t load. Check your connection and try again.')) }
      document.head.appendChild(el)
    })
    scripts.set(src, p)
  }
  return p
}

interface FlutterwaveResult { status: string; transaction_id?: number | string }
interface FlutterwaveModal { close: () => void }
declare global {
  interface Window {
    FlutterwaveCheckout?: (options: Record<string, unknown>) => FlutterwaveModal
    paypal?: { Buttons: (options: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void; isEligible?: () => boolean } }
  }
}

/**
 * Opens Flutterwave's checkout for what /payments/checkout returned. Resolves with `flw:<transaction id>` once paid;
 * rejects with PaymentCancelled if the window is closed first.
 */
export async function flutterwavePay(checkout: CheckoutDto, title: string): Promise<string> {
  await loadScript('https://checkout.flutterwave.com/v3.js')
  if (!window.FlutterwaveCheckout || !checkout.public_key) throw new ApiError(0, 'checkout_unavailable', 'Card payments aren’t available right now.')
  return new Promise<string>((resolve, reject) => {
    let done = false
    const modal = window.FlutterwaveCheckout!({
      public_key: checkout.public_key,
      tx_ref: checkout.tx_ref,
      amount: Number(checkout.amount),
      currency: checkout.currency,
      payment_options: checkout.currency === 'NGN' ? 'card, banktransfer, ussd' : 'card',
      customer: { email: checkout.customer.email ?? '', name: checkout.customer.name },
      customizations: { title: 'Wamiwa', description: title, logo: `${location.origin}/favicon.svg` },
      callback: (r: FlutterwaveResult) => {
        if (done) return
        if ((r.status === 'successful' || r.status === 'completed') && r.transaction_id) {
          done = true
          resolve(`flw:${r.transaction_id}`)
        } else {
          done = true
          reject(new ApiError(402, 'payment_failed', 'The payment didn’t go through. Nothing was charged.'))
        }
        try { modal.close() } catch { /* already closed */ }
      },
      onclose: () => { if (!done) { done = true; reject(new PaymentCancelled()) } },
    })
  })
}

/** Loads PayPal's buttons into `el`. `onPaid` gets `paypal:<order id>` once the payer approves in PayPal's window. */
export async function renderPayPal(el: HTMLElement, clientId: string, amountCents: number, description: string,
  onPaid: (method: string) => void, onError: (e: unknown) => void) {
  await loadScript(`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`)
  if (!window.paypal) throw new ApiError(0, 'checkout_unavailable', 'PayPal isn’t available right now.')
  let orderId = ''
  await window.paypal.Buttons({
    style: { layout: 'horizontal', height: 44, tagline: false, label: 'pay' },
    createOrder: async () => { orderId = (await startPayPalOrder(amountCents, description)).order_id; return orderId },
    onApprove: async (data: { orderID?: string }) => onPaid(`paypal:${data.orderID ?? orderId}`),
    onError,
  }).render(el)
}
