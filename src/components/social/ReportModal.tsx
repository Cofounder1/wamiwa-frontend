import { useState } from 'react'
import { Check } from 'lucide-react'
import { REPORT_REASONS, REPORT_REASON_VALUE } from '@/lib/rules'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Modal, Textarea, toast } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

/** RP-01 — any account can report any account, post, comment, message or script. */
export type ReportTarget = 'account' | 'post' | 'comment' | 'script' | 'message' | 'conversation'

export function ReportModal({ open, onClose, target, targetType, targetId }: {
  open: boolean; onClose: () => void; target: string; targetType: ReportTarget; targetId: string
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async () => {
    setBusy(true)
    setError(undefined)
    try {
      await api.post('/reports', {
        target_type: targetType, target_id: targetId, details: note,
        reason: REPORT_REASON_VALUE[reason!] ?? reason!.toLowerCase().replace(/ /g, '_'),
      })
      onClose()
      setReason(null)
      setNote('')
      toast('Report sent', REPORT_REASON_VALUE[reason!] ? 'It’s hidden while our investigation team looks into it. You’ll hear back on the outcome.' : 'Our team reviews reports within 24 hours. You’ll hear back on the outcome.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t send the report.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Report ${target}`}
      subtitle="Reports are private. The account won’t know who reported it."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!reason} loading={busy} onClick={submit}>Send report</Button></>}
    >
      <div className="space-y-1.5">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold transition',
              reason === r ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink hover:bg-wash',
            )}
          >
            {r}
            {reason === r && <Check className="size-4 text-brand" />}
          </button>
        ))}
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      {reason && <Textarea className="mt-4" placeholder="Anything else we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
      <p className="mt-4 text-xs text-ink-3">Repeated false reports lower an account’s report weight.</p>
    </Modal>
  )
}
