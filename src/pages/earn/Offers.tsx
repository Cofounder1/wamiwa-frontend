import { useState } from 'react'
import { Briefcase, Check, Clock, FileText, HeartHandshake, PieChart, ShieldCheck, Wand2, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { partyName, statusText } from '@/api/adapt'
import { usePaged } from '@/api/hooks'
import type { ContractDto } from '@/api/types'
import { useSession } from '@/context/session'
import { date, naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, Checkbox, Empty, KV, Modal, PageHeader, Tabs, toast } from '@/components/ui/primitives'
import { EquityTerms, equitySummary } from '@/components/social/EquityTerms'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { pay } from '@/components/payments/PaymentSheet'
import { isCancelled } from '@/api/payments'
import { EQUITY_FEE_CENTS } from '@/lib/rules'

export default function Offers() {
  const { role } = useSession()
  const minor = role === 'minor'
  const [tab, setTab] = useState<'all' | 'hire_me' | 'likeness'>('all')
  const [open, setOpen] = useState<ContractDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [ack, setAck] = useState(false)  // HM-06: equity acknowledged
  const list = usePaged<ContractDto, ContractDto>(
    (cursor, s) => api.page<ContractDto>('/contracts', { role: 'earner', cursor, limit: 50 }, s),
    (c) => c, [],
  )
  const offers = list.items.filter((c) => ['offered', 'changes_requested', 'admin_review', 'pending_guardian'].includes(c.status) && c.type !== 'agent')
  const shown = offers.filter((o) => tab === 'all' || o.type === tab)

  const decide = async (o: ContractDto, accept: boolean) => {
    setBusy(true)
    try {
      const payment_method = accept && o.equity?.equity_only ? await pay(EQUITY_FEE_CENTS, 'Wamiwa service fee · equity-only deal') : null
      await api.post(`/hire-me/contracts/${o.id}/${accept ? 'accept' : 'decline'}`, accept ? { equity_acknowledged: ack, payment_method } : undefined)
      setOpen(null)
      toast(accept ? 'Offer accepted' : 'Offer declined', accept ? (o.requires_guardian ? 'Waiting for your guardian’s approval and confirmation call.' : 'The contract is active. Funds are held in escrow.') : 'The brand is refunded in full.')
      list.reload()
    } catch (e) {
      if (!isCancelled(e)) toast('Couldn’t update the offer', e instanceof ApiError ? e.message : undefined, 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Offers" subtitle={minor ? 'Every offer you accept needs your guardian’s approval in the app, then on a confirmation call.' : 'Offers expire after 7 days with a full refund to the brand.'} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All', count: offers.length || undefined }, { value: 'hire_me', label: 'Hire Me' }, { value: 'likeness', label: 'Likeness' }]} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Spinner /> : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {shown.map((o) => {
            const m = o.price.local
            const days = o.offer_expires_at ? Math.ceil((+new Date(o.offer_expires_at) - Date.now()) / 864e5) : null
            const brand = partyName(o.hirer_id, o.title)
            return (
              <Card key={o.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[28%] bg-wash text-[13px] font-bold text-ink-2">{brand.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink">{brand}</div>
                    <div className="text-[12.5px] text-ink-2">{statusText(o)}</div>
                  </div>
                  <Badge tone={o.type === 'likeness' ? 'agent' : 'brand'} icon={o.type === 'likeness' ? <Wand2 className="size-3" /> : <Briefcase className="size-3" />}>{o.type === 'likeness' ? 'Likeness' : 'Hire Me'}</Badge>
                </div>
                {o.deliverables && <ul className="mt-4 space-y-1 text-[13px] text-ink-2">{o.deliverables.split('\n').filter(Boolean).map((d) => <li key={d} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-teal" />{d}</li>)}</ul>}
                {o.equity && <div className="mt-3"><Badge tone="brand" icon={<PieChart className="size-3" />}>Plus {equitySummary(o.equity)}</Badge></div>}
                {o.type === 'likeness' && <p className="mt-4 text-[13.5px] text-ink-2">{o.with_voice ? 'Image + voice' : 'Image only'} · 1-month term{o.exclusivity ? ' · category exclusive' : ''}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
                  <div><div className="text-[11px] text-ink-3">Price</div><div className="font-bold text-ink num">{naira(m.price, { compact: true })}</div></div>
                  <div><div className="text-[11px] text-ink-3">Fee {m.fee_pct}%</div><div className="font-bold text-ink-2 num">−{naira(m.fee, { compact: true })}</div></div>
                  <div><div className="text-[11px] text-ink-3">You get</div><div className="font-extrabold text-teal num">{naira(m.net, { compact: true })}</div></div>
                </div>
                {o.status === 'pending_guardian' && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-teal/30 bg-teal-soft/60 p-3 text-[12.5px] font-semibold text-teal"><HeartHandshake className="size-4" />Waiting for your guardian: approval in the app, then a confirmation call.</div>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className={cn('flex items-center gap-1 text-[12.5px]', days !== null && days <= 2 ? 'text-danger' : 'text-ink-2')}>{days !== null && <><Clock className="size-3.5" />Expires in {Math.max(0, days)} {days === 1 ? 'day' : 'days'}</>}</span>
                  <div className="flex gap-2">
                    {o.type === 'likeness' ? (
                      <Button size="sm" to={`/app/likeness/script/${o.id}`} icon={<FileText className="size-3.5" />}>Review script</Button>
                    ) : o.status === 'offered' ? (
                      <Button size="sm" onClick={() => { setAck(false); setOpen(o) }}>Review</Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
      {!list.loading && !list.error && shown.length === 0 && <Empty icon={<Briefcase />} title="No open offers">When a verified brand sends you an offer, it shows up here with the money already in escrow.</Empty>}

      {open && (
        <Modal open onClose={() => setOpen(null)} title={partyName(open.hirer_id, open.title)} subtitle={`Hire Me · ${open.num_posts} ${open.num_posts === 1 ? 'post' : 'posts'}`}
          footer={<><Button variant="ghost" icon={<X className="size-4" />} loading={busy} onClick={() => decide(open, false)}>Decline</Button><Button icon={<Check className="size-4" />} loading={busy} disabled={!!open.equity && !ack} onClick={() => decide(open, true)}>{open.equity?.equity_only ? 'Accept · pay $5 fee' : `Accept ${naira(open.price.local.net)} net`}</Button></>}>
          <KV rows={[
            ...(open.equity?.equity_only ? [
              ['Cash', 'None, equity only'] as [string, string],
              ['Wamiwa service fee', '$5 each (you and the brand)'] as [string, string],
            ] : [
              ['Price (in escrow)', naira(open.price.local.price)] as [string, string],
              [`Wamiwa fee (${open.price.local.fee_pct}%)`, `−${naira(open.price.local.fee)}`] as [string, string],
              ['You receive', naira(open.price.local.net)] as [string, string],
            ]),
            ['Posts', open.num_posts],
            ['Deadline', open.deadline ? date(open.deadline) : '—'],
            ['Offer expires', open.offer_expires_at ? date(open.offer_expires_at) : '—'],
          ]} />
          {open.equity && (
            <>
              <EquityTerms equity={open.equity} />
              <div className="mt-3"><Checkbox checked={ack} onChange={setAck}>I’ve read the agreement and understand Wamiwa doesn’t hold or guarantee this equity; escrow covers only the cash.</Checkbox></div>
            </>
          )}
          {open.no_ai_replies && <Callout className="mt-4" tone="neutral">This brand asked for no AI replies on its sponsored posts. Auto-replies stay off on those posts only.</Callout>}
          {minor && <Callout className="mt-4" tone="brand" icon={<HeartHandshake />}>After you accept, your guardian approves in the app and on a confirmation call before anything starts.</Callout>}
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-3"><ShieldCheck className="size-3.5" />The fee comes out of the price, never added on top. Converted at {open.price.fx_rate.replace(/\.0+$/, '')} NGN/USD, locked for this contract.</p>
        </Modal>
      )}
    </div>
  )
}
