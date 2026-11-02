import { Link } from 'react-router-dom'
import { ArrowUpRight, Banknote, CalendarClock, CircleDollarSign, Clock, Eye, Gavel, Hourglass, Landmark } from 'lucide-react'
import { api } from '@/api/client'
import { fromContract, partyName, statusText } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { ContractDto, EarningsDto } from '@/api/types'
import { useSession } from '@/context/session'
import { date, naira, usd } from '@/lib/format'
import { Badge, Button, Callout, Card, CardHeader, PageHeader, Stat } from '@/components/ui/primitives'
import { ErrorState, LoadMore, RowSkeleton } from '@/components/ui/states'

const stateTone = { Funded: 'neutral', Active: 'brand', Delivered: 'warn', Cleared: 'success', Paid: 'teal', Frozen: 'danger', Refunded: 'neutral' } as const
interface PayoutDto { id: string; cycle_date?: string; created_at?: string; amount: number; currency?: string; status: string; items?: number; failure_reason?: string | null }

export default function Earnings() {
  const { role } = useSession()
  const minor = role === 'minor'
  const owner = role === 'agent_owner'
  const e = useApi((s) => api.get<EarningsDto>('/earnings', undefined, s), [])
  const contracts = usePaged<ContractDto, ContractDto>((cursor, s) => api.page<ContractDto>('/contracts', { role: 'earner', cursor, limit: 20 }, s), (c) => c, [])
  const payouts = usePaged<PayoutDto, PayoutDto>((cursor, s) => api.page<PayoutDto>('/payouts', { cursor, limit: 10 }, s), (p) => p, [])

  return (
    <div>
      <PageHeader
        title={owner ? 'Agent earnings' : minor ? 'My earnings' : 'Earnings'}
        subtitle={minor ? 'You can see what you’ve earned. Payouts go to your guardian’s bank account, in their name.' : 'Cleared funds are paid every 2 weeks to your verified bank account.'}
        actions={!minor && <Button variant="secondary" icon={<Landmark className="size-4" />} to="/app/verify?tab=bank">Bank account</Button>}
      />

      {e.error ? <ErrorState error={e.error} onRetry={e.reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="In escrow (pending)" value={e.data ? naira(e.data.pending) : '—'} icon={<Hourglass />} sub="Held until delivery is approved" />
          <Stat label="Cleared" value={e.data ? naira(e.data.cleared) : '—'} icon={<CircleDollarSign />} sub="Paid on the next cycle" />
          <Stat label="Paid out" value={e.data ? naira(e.data.paid) : '—'} icon={<Banknote />} sub="All time" />
          <Card className="relative overflow-hidden bg-harbor p-5 !ring-0 text-white">
            <div className="flex items-center justify-between text-[13px] font-semibold text-white/70"><span>Next payout</span><CalendarClock className="size-4" /></div>
            <div className="mt-2 text-[28px] leading-none font-extrabold tracking-[-0.03em] num">{e.data ? date(e.data.next_payout_cycle) : '—'}</div>
            <div className="mt-2 text-[12.5px] text-white/70">{minor ? 'to your guardian’s account' : 'to your verified bank account'}</div>
          </Card>
        </div>
      )}
      {e.data && e.data.in_dispute > 0 && <Callout className="mt-4" tone="warn" icon={<Gavel />} title={`${naira(e.data.in_dispute)} is frozen in a dispute`} action={<Button size="sm" variant="outline" to="/app/disputes">View</Button>}>It’s released, refunded or split once an admin decides.</Callout>}
      {minor && <Callout className="mt-6" tone="brand" icon={<Eye />} title="View only">Your guardian receives payouts and can see your contracts and company chats.</Callout>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title={owner ? 'Agent orders' : 'Contracts'} subtitle={owner ? 'Wamiwa takes 10% on agent hires' : 'Wamiwa takes 20% on Hire Me and likeness'} />
          <div className="mt-4 overflow-x-auto">
            {contracts.error ? <ErrorState compact error={contracts.error} onRetry={contracts.reload} /> : contracts.loading ? <RowSkeleton /> : (
              <table className="w-full min-w-[620px] text-[13.5px]">
                <thead><tr className="border-y border-line bg-surface-2 text-left text-[12px] text-ink-2"><th className="px-5 py-2.5 font-semibold">Contract</th><th className="px-3 font-semibold">Type</th><th className="px-3 text-right font-semibold">Price</th><th className="px-3 text-right font-semibold">Fee</th><th className="px-3 text-right font-semibold">You get</th><th className="px-5 text-right font-semibold">State</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {contracts.items.map((dto) => {
                    const c = fromContract(dto)
                    const m = dto.price.local
                    return (
                      <tr key={c.id} className="hover:bg-surface-2">
                        <td className="px-5 py-3"><Link to={c.type === 'agent' ? `/app/orders/${c.id}` : `/app/contracts/${c.id}`} className="font-semibold text-ink hover:underline">{c.deliverables?.[0] ?? c.title}</Link><div className="text-[12px] text-ink-2">{partyName(c.hirerId, dto.title)} · {statusText(dto)}</div></td>
                        <td className="px-3 text-ink-2">{{ hire_me: 'Hire Me', likeness: 'Likeness', agent: 'Agent' }[c.type]}</td>
                        <td className="px-3 text-right num">{naira(m.price)}</td>
                        <td className="px-3 text-right text-ink-2 num">−{naira(m.fee)} <span className="text-[11px]">({m.fee_pct}%)</span></td>
                        <td className="px-3 text-right font-bold num">{naira(m.net)}</td>
                        <td className="px-5 text-right"><Badge tone={stateTone[c.state]}>{c.state}</Badge></td>
                      </tr>
                    )
                  })}
                  {contracts.items.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-2">No contracts yet.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-5 pb-4"><LoadMore show={contracts.hasMore} loading={contracts.loadingMore} onClick={contracts.more} /></div>
        </Card>

        <Card>
          <CardHeader title="Payout history" />
          <ul className="mt-3 divide-y divide-line">
            {payouts.items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-9 place-items-center rounded-full bg-success-soft text-success"><ArrowUpRight className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-ink num">{p.currency === 'USD' ? usd(p.amount / 100, { cents: true }) : naira(p.amount)}</div>
                  <div className="text-[12px] text-ink-2">{date(p.cycle_date ?? p.created_at ?? '')}</div>
                  {(p.status === 'held' || p.status === 'failed' || p.status === 'rejected') && p.failure_reason && <div className="mt-0.5 text-[12px] text-danger">{p.failure_reason}</div>}
                </div>
                <Badge tone={p.status === 'paid' ? 'success' : p.status === 'held' ? 'warn' : p.status === 'failed' || p.status === 'rejected' ? 'danger' : 'neutral'}>{p.status.replace('_', ' ')}</Badge>
              </li>
            ))}
            {!payouts.loading && payouts.items.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-ink-2">No payouts yet. Cleared funds are paid every 2 weeks.</li>}
          </ul>
          <div className="m-5 mt-2 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-[12px] text-ink-2"><Clock className="mt-0.5 size-3.5 shrink-0" />Changing bank details holds payouts for 48 hours and sends email + SMS alerts.</div>
        </Card>
      </div>
    </div>
  )
}
