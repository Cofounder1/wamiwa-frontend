export const usd = (n: number, opts: { cents?: boolean } = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : n % 1 === 0 ? 0 : 2,
  }).format(n)

export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const int = (n: number) => new Intl.NumberFormat('en-US').format(n)

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** ISO timestamp relative to now. Negative = past. */
export const rel = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()
export const relDays = (days: number) => rel(days * 1440)

/** Naira from the API's minor units (kobo). */
export const naira = (kobo: number, opts: { compact?: boolean } = {}) =>
  '₦' + new Intl.NumberFormat('en-NG', opts.compact
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(kobo / 100)

/** What to send to /search: people type "@handle", but handles are stored without the @. */
export function searchTerm(q: string) {
  return q.trim().replace(/^@+/, '').trim()
}
