import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Clock, Film, ShieldCheck, Wand2, X } from 'lucide-react'
import { api, ApiError, mediaUrl } from '@/api/client'
import { partyName } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { ContractDto } from '@/api/types'
import { cn } from '@/lib/cn'
import { Button, Callout, Card, Empty, Modal, PageHeader, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'

export interface VideoDto {
  id: string; kind: 'draft' | 'final'; version: number; status: string; seconds: number; file: string | null
  influencer_decision: 'pending' | 'approved' | 'rejected' | null; rejection_reason: string | null; decision_due_at: string | null; ai_label: string; created_at: string
}
interface Bundle { contract: ContractDto & { scripts: { version: number; text: string; status: string }[] }; videos: VideoDto[] }

const REASONS = [
  { value: 'script_mismatch', label: 'Doesn’t match the signed script' },
  { value: 'technical_defect', label: 'Technical defect (lip-sync, distorted face, audio)' },
] as const

export default function VideoApproval() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const res = useApi(async (s) => {
    const [contract, v] = await Promise.all([
      api.get<Bundle['contract']>(`/likeness/contracts/${id}`, undefined, s),
      api.get<{ videos: VideoDto[] }>(`/likeness/contracts/${id}/videos`, undefined, s),
    ])
    return { contract, videos: v.videos }
  }, [id])
  const [reject, setReject] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number]['value'] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const { contract, videos } = res.data
  const video = videos.filter((v) => v.kind === 'final').sort((a, b) => b.version - a.version).find((v) => v.influencer_decision === 'pending')
  const script = [...contract.scripts].sort((a, b) => b.version - a.version).find((s) => s.status === 'approved') ?? contract.scripts[0]
  const brand = partyName(contract.hirer_id, contract.title)
  if (!video) return <Empty icon={<Film />} title="No video waiting for you" action={<Button variant="outline" to={`/app/contracts/${id}`}>Back to contract</Button>}>When {brand} submits a final render, it shows up here for your approval.</Empty>
  const hours = video.decision_due_at ? Math.max(0, Math.round((+new Date(video.decision_due_at) - Date.now()) / 36e5)) : 72
  const src = mediaUrl(video.file)

  const decide = async (approve: boolean) => {
    setBusy(true)
    try {
      await api.post(`/videos/${video.id}/decision`, { approve, reason: approve ? null : reason, note })
      toast(approve ? 'Video approved' : 'Sent back for a re-render', approve ? `${brand} can now post it with the AI likeness label.` : 'This re-render is free for the brand.')
      nav(`/app/contracts/${id}`)
    } catch (e) {
      toast('Couldn’t save your decision', e instanceof ApiError ? e.message : undefined, 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader back={{ to: `/app/contracts/${id}`, label: 'Contract' }} eyebrow="Final video approval" title={`${brand} · final render ${video.version}`} />
      <Callout tone="warn" icon={<Clock />} className="mb-6" title={`${hours} hours left to decide`}>If you don’t respond within 72 hours the video is approved automatically. We’ll warn you before that happens.</Callout>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden p-3">
          <div className="relative mx-auto aspect-[9/16] max-h-[640px] overflow-hidden rounded-[20px] bg-gradient-to-br from-harbor to-[#14507f]">
            {src && <video src={src} controls playsInline className="size-full object-cover" onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }} />}
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center text-white/70"><div><Film className="mx-auto mb-2 size-8" />{video.seconds}s render<div className="mt-1 text-[12px]">Preview plays here once the video provider is connected.</div></div></div>
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-badge bg-black/60 px-2 text-[11px] leading-5 font-bold text-white backdrop-blur"><Wand2 className="size-3" />{video.ai_label}</span>
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[15px] font-bold text-ink">Signed script (v{script?.version})</h3>
            <pre className="mt-3 max-h-64 overflow-auto font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{script?.text}</pre>
          </Card>
          <Card flat className="p-5 text-[12.5px] text-ink-2">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink"><ShieldCheck className="size-4 text-teal" />Free fix guarantee</div>
            Technical defects and videos that don’t match the signed script are re-rendered free and don’t count against {brand}.
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" icon={<X className="size-4" />} onClick={() => setReject(true)}>Reject</Button>
            <Button icon={<Check className="size-4" />} loading={busy} onClick={() => decide(true)}>Approve</Button>
          </div>
        </div>
      </div>
      <Modal open={reject} onClose={() => setReject(false)} size="sm" title="Why are you rejecting it?" footer={<Button disabled={!reason} loading={busy} onClick={() => decide(false)}>Send back</Button>}>
        <div className="space-y-1.5">
          {REASONS.map((r) => <button key={r.value} onClick={() => setReason(r.value)} className={cn('w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-semibold', reason === r.value ? 'border-brand bg-brand-soft' : 'border-line hover:bg-wash')}>{r.label}</button>)}
        </div>
        <Textarea className="mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change? (optional)" />
      </Modal>
    </div>
  )
}
