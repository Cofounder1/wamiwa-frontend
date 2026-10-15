import { useState } from 'react'
import { FileUp, Gavel, Scale } from 'lucide-react'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { date } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ErrorState, Spinner } from '@/components/ui/states'
import { Badge, Button, Callout, Card, Empty, Field, Modal, PageHeader, Select, Stepper, Textarea, toast } from '@/components/ui/primitives'
import { api, ApiError } from '@/api/client'

export function DisputeModal({ open, onClose, contractId, contractTitle, onOpened, misuse }: {
  open: boolean; onClose: () => void; contractId: string; contractTitle: string; onOpened?: () => void; misuse?: boolean
}) {
  const [reason, setReason] = useState(misuse ? 'Misuse of likeness' : '')
  const [details, setDetails] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const d = await api.post<{ id: string }>(`/contracts/${contractId}/dispute`, {
        reason: `${reason}${details ? `: ${details}` : ''}`, is_misuse_claim: reason === 'Misuse of likeness',
      })
      if (files.length) {
        const attachments = []
        for (const f of files) {
          const form = new FormData()
          form.append('kind', f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'document')
          form.append('file', f)
          const up = await api.upload<{ ref: string }>('/uploads', form)
          attachments.push({ kind: f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'document', ref: up.ref, size_bytes: f.size })
        }
        await api.post(`/disputes/${d.id}/evidence`, { statement: details || reason, attachments })
      }
      onClose()
      onOpened?.()
      toast('Dispute opened', 'Funds are frozen. Both sides have 5 days to add evidence.', 'warn')
    } catch (e) {
      setError(e instanceof ApiError ? e.fieldMessage ?? e.message : 'Couldn’t open the dispute.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Open a dispute" subtitle={contractTitle}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!reason} loading={busy} onClick={submit}>Open dispute & freeze funds</Button></>}>
      <Callout tone="warn" icon={<Scale />} className="mb-5">Opening a dispute freezes the escrow. An admin decides within 10 working days: release, refund or split.</Callout>
      <div className="space-y-4">
        <Field label="What went wrong?">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option><option>Work not delivered</option><option>Work doesn’t match the brief</option><option>Partial delivery</option><option>Misuse of likeness</option><option>Other</option>
          </Select>
        </Field>
        <Field label="Explain what happened"><Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Be specific — dates, what was agreed, what was delivered." /></Field>
        <Field label="Evidence" hint="Screenshots, files, links. Missing evidence counts against that side.">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-5 text-[13.5px] text-ink-2 hover:border-brand">
            <FileUp className="size-4" />{files.length ? files.map((f) => f.name).join(', ') : 'Add files'}
            <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </label>
        </Field>
        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  )
}

interface DisputeDto {
  id: string; contract_id: string; raised_by: string; reason: string; is_misuse_claim: boolean; status: string
  evidence_due_at: string | null; decision_due_at: string | null; decision: 'release' | 'refund' | 'split' | null; release_pct: number | null
  decision_reason: string | null; decided_at: string | null; appealed_by: string[]; appeal_reason: string | null
  evidence?: { id?: string; submitted_by: string; statement: string; attachments: unknown[]; created_at: string }[]
}

const STAGES = ['Opened', 'Evidence (5 days)', 'Admin decision (≤10 days)', 'Appeal window (3 days)', 'Final']
const stageOf = (d: DisputeDto) => d.status === 'evidence' ? 1 : d.status === 'review' || d.status === 'open' ? 2 : d.status === 'decided' ? 3 : d.status === 'appealed' ? 3 : 4

export default function Disputes() {
  const { me } = useSession()
  const list = useApi((s) => api.get<DisputeDto[]>('/disputes', undefined, s), [])
  const [selected, setSelected] = useState<string>()
  const current = selected ?? list.data?.[0]?.id
  const detail = useApi(current ? (s) => api.get<DisputeDto>(`/disputes/${current}`, undefined, s) : null, [current])
  const [modal, setModal] = useState<null | 'evidence' | 'appeal'>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!current) return
    setBusy(true)
    try {
      if (modal === 'appeal') {
        await api.post(`/disputes/${current}/appeal`, { reason: text })
        toast('Appeal sent', 'A Super Admin decides appeals. Their decision is final on Wamiwa.')
      } else {
        const attachments = []
        for (const f of files) {
          const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'document'
          const form = new FormData()
          form.append('kind', kind)
          form.append('file', f)
          const up = await api.upload<{ ref: string }>('/uploads', form)
          attachments.push({ kind, ref: up.ref, size_bytes: f.size })
        }
        await api.post(`/disputes/${current}/evidence`, { statement: text, attachments })
        toast('Evidence added')
      }
      setModal(null); setText(''); setFiles([]); detail.reload(); list.reload()
    } catch (e) {
      toast('Couldn’t send', e instanceof ApiError ? e.fieldMessage ?? e.message : undefined, 'danger')
    } finally {
      setBusy(false)
    }
  }

  const d = detail.data
  return (
    <div>
      <PageHeader title="Disputes" subtitle="Disputes can be opened during the review window, or up to 30 days after payout for misuse claims." />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Spinner /> : list.data.length === 0 ? (
        <Empty icon={<Scale />} title="No disputes">If a deal goes wrong, open a dispute from the contract. Funds freeze until an admin decides.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit divide-y divide-line">
            {list.data.map((x) => (
              <button key={x.id} onClick={() => setSelected(x.id)} className={cn('block w-full px-5 py-4 text-left transition hover:bg-surface-2', x.id === current && 'bg-brand-soft/50')}>
                <div className="line-clamp-2 text-[14px] font-bold text-ink">{x.reason}</div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-2"><Badge tone={x.decision ? 'success' : 'warn'}>{x.decision ?? x.status}</Badge>{x.raised_by === me.id ? 'You opened' : 'Opened against you'}</div>
              </button>
            ))}
          </Card>
          {detail.error ? <ErrorState error={detail.error} onRetry={detail.reload} /> : !d ? <Spinner className="min-h-40" /> : (
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Gavel className="size-5 text-warn" /><h2 className="text-[18px] font-extrabold text-ink">{d.reason}</h2></div>
                  <p className="mt-1 text-[13.5px] text-ink-2">{d.raised_by === me.id ? 'You opened this dispute' : 'The other side opened this dispute'} · funds frozen{d.is_misuse_claim ? ' · misuse claim' : ''}</p>
                </div>
                <Button size="sm" variant="outline" to={`/app/contracts/${d.contract_id}`}>View contract</Button>
              </div>
              <Stepper className="mt-8" current={stageOf(d)} steps={STAGES} />
              {d.decision ? (
                <Callout className="mt-6" tone="success" title={`Decision: ${d.decision}${d.decision === 'split' && d.release_pct !== null ? ` (${d.release_pct}% to the earner)` : ''}`}>{d.decision_reason}</Callout>
              ) : (
                <div className="mt-6 grid gap-3 text-[13px] sm:grid-cols-2">
                  {d.evidence_due_at && <div className="rounded-xl bg-surface-2 p-3"><div className="text-ink-3">Evidence due</div><div className="font-bold text-ink">{date(d.evidence_due_at)}</div></div>}
                  {d.decision_due_at && <div className="rounded-xl bg-surface-2 p-3"><div className="text-ink-3">Decision by</div><div className="font-bold text-ink">{date(d.decision_due_at)}</div></div>}
                </div>
              )}
              <h3 className="mt-8 mb-3 text-[15px] font-bold text-ink">Evidence</h3>
              <ul className="space-y-2">
                {(d.evidence ?? []).map((e, i) => (
                  <li key={i} className="rounded-2xl border border-line p-4 text-[13.5px]">
                    <div className="text-[12px] font-bold text-ink-2">{e.submitted_by === me.id ? 'You' : 'Other side'} · {date(e.created_at)}{e.attachments.length ? ` · ${e.attachments.length} file${e.attachments.length > 1 ? 's' : ''}` : ''}</div>
                    <p className="mt-1 text-ink">{e.statement}</p>
                  </li>
                ))}
                {(d.evidence ?? []).length === 0 && <li className="text-[13px] text-ink-2">No evidence yet. Missing evidence counts against that side.</li>}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {!d.decision && <Button variant="outline" icon={<FileUp className="size-4" />} onClick={() => setModal('evidence')}>Add evidence</Button>}
                {d.decision && !d.appealed_by.includes(me.id) && <Button variant="outline" onClick={() => setModal('appeal')}>Appeal decision</Button>}
              </div>
              <Callout className="mt-6" tone="neutral" title="If you disagree with the decision">Each side can appeal once, within 3 days. Funds stay frozen for those 3 days. A Super Admin decides the appeal, and that decision is final on Wamiwa.</Callout>
            </Card>
          )}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'appeal' ? 'Appeal decision' : 'Add evidence'} subtitle={modal === 'appeal' ? 'One appeal per side, within 3 days of the decision.' : 'Statements, screenshots and files for the admin.'}
        footer={<Button loading={busy} disabled={text.length < 5} onClick={submit}>{modal === 'appeal' ? 'Send appeal' : 'Submit evidence'}</Button>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={modal === 'appeal' ? 'Why should the decision change? Add anything new.' : 'What happened, with dates.'} />
        {modal === 'evidence' && (
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-4 text-[13px] text-ink-2 hover:border-brand">
            <FileUp className="size-4" />{files.length ? files.map((f) => f.name).join(', ') : 'Attach files'}
            <input type="file" multiple className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </label>
        )}
      </Modal>
    </div>
  )
}
