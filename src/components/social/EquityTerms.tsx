import { useState } from 'react'
import { FileText, PieChart, ShieldAlert } from 'lucide-react'
import { api, errMsg, mediaUrl } from '@/api/client'
import type { EquityDto } from '@/api/types'
import { Badge, Button, Callout, Field, KV, Modal, Textarea, toast } from '@/components/ui/primitives'
import { date } from '@/lib/format'

/** HM-06: equity offered alongside the cash. Recorded by Wamiwa, never held or guaranteed by it. */
export function equitySummary(e: EquityDto) {
  const amount = e.percent ? `${e.percent}% equity` : `${(e.shares ?? 0).toLocaleString()} ${e.share_class} shares`
  return e.vesting_months ? `${amount}, vesting over ${e.vesting_months} months` : amount
}

const STATUS: Record<EquityDto['status'], [string, 'neutral' | 'teal' | 'warn' | 'danger']> = {
  offered: ['Offered', 'neutral'], active: ['Active', 'teal'],
  cancellation_requested: ['Cancellation with Wamiwa', 'warn'], cancelled: ['Cancelled', 'danger'],
}

export function EquityTerms({ equity, contractId, onChanged }: { equity: EquityDto; contractId?: string; onChanged?: () => void }) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const request = async () => {
    setBusy(true)
    try {
      await api.post(`/contracts/${contractId}/equity/cancel`, { reason })
      toast('Request sent to Wamiwa', 'We’ll review it and tell you both the outcome.'); setAsking(false); onChanged?.()
    } catch (e) { toast('Couldn’t send the request', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const [label, tone] = STATUS[equity.status] ?? STATUS.offered
  return (
    <div className="mt-4 rounded-2xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[14px] font-bold text-ink"><PieChart className="size-4 text-brand" />{equity.equity_only ? 'Equity only' : 'Plus equity'}: {equitySummary(equity)}<Badge tone={tone}>{label}</Badge></div>
      <KV rows={[
        ['Amount', equity.percent ? `${equity.percent}%` : `${(equity.shares ?? 0).toLocaleString()} shares`],
        ['Share class', equity.share_class],
        ['Vesting', equity.vesting_months ? `${equity.vesting_months} months${equity.cliff_months ? `, ${equity.cliff_months}-month cliff` : ''}` : 'None'],
        ['Company registration', equity.company_registration_no ?? '—'],
        ...(equity.vesting_dates?.cliff ? [['First shares vest', date(equity.vesting_dates.cliff)] as [string, string]] : []),
        ...(equity.vesting_dates?.vested ? [['Fully vested', date(equity.vesting_dates.vested)] as [string, string]] : []),
        ...(equity.equity_only ? [['Wamiwa service fee', '$5 each'] as [string, string]] : []),
      ]} />
      {equity.description && <p className="mt-3 text-[13px] text-ink-2">{equity.description}</p>}
      <a href={mediaUrl(equity.agreement_ref)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline"><FileText className="size-4" />Read the agreement</a>
      <Callout className="mt-3" tone="warn" icon={<ShieldAlert />}>{equity.notice}</Callout>
      {equity.status === 'active' && <p className="mt-3 text-[12.5px] text-ink-2">We’ll email you both when shares vest.</p>}
      {contractId && equity.status === 'active' && <Button className="mt-3" size="sm" variant="ghost" onClick={() => setAsking(true)}>Request cancellation</Button>}
      <Modal open={asking} onClose={() => setAsking(false)} size="sm" title="Cancel the equity agreement?" subtitle="Wamiwa reviews every request and tells you both the outcome. Vesting reminders pause while it’s reviewed."
        footer={<Button loading={busy} disabled={reason.trim().length < 3} onClick={request}>Send to Wamiwa</Button>}>
        <Field label="Why?"><Textarea value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} placeholder="e.g. We agreed to end it, or the company has closed" /></Field>
      </Modal>
    </div>
  )
}
