import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Clock, MessageSquareDiff, PenLine, ShieldCheck, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { partyName } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { ContractDto } from '@/api/types'
import { useSession } from '@/context/session'
import { naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, Checkbox, Modal, PageHeader, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'

interface LikenessDto extends ContractDto {
  scripts: { version: number; text: string; status: string; approved_at: string | null }[]
  change_requests: { round: number; request: string; response: string | null; resulting_version: number | null }[]
  change_rounds_left: number
  production: { display: string }
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong')

export default function ScriptReview() {
  const { id = '' } = useParams()
  const { me } = useSession()
  const nav = useNavigate()
  const res = useApi((s) => api.get<LikenessDto>(`/likeness/contracts/${id}`, undefined, s), [id])
  const [modal, setModal] = useState<null | 'changes' | 'consent' | 'reject' | 'respond'>(null)
  const [text, setText] = useState('')
  const [img, setImg] = useState(false)
  const [voice, setVoice] = useState(false)
  const [resp, setResp] = useState(false)
  const [busy, setBusy] = useState(false)

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const c = res.data
  const script = [...c.scripts].sort((a, b) => b.version - a.version)[0]
  const isEarner = c.earner_id === me.id
  const isHirer = c.hirer_id === me.id
  const brand = partyName(c.hirer_id, c.title)
  const days = c.offer_expires_at ? Math.max(0, Math.ceil((+new Date(c.offer_expires_at) - Date.now()) / 864e5)) : null
  const openRequest = c.change_requests.find((r) => !r.response)
  const canAct = isEarner && c.status === 'offered'

  const act = async (path: string, body: unknown, done: string, sub?: string, after?: () => void) => {
    setBusy(true)
    try { await api.post(`/likeness/contracts/${id}/${path}`, body); toast(done, sub); setModal(null); setText(''); after ? after() : res.reload() } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader back={{ to: `/app/contracts/${c.id}`, label: 'Contract' }} eyebrow="Script review" title={isEarner ? `Script from ${brand}` : 'Your likeness script'}
        subtitle={isEarner ? 'Accept, reject, or ask for changes. Nothing is generated until you sign consent for this exact script.' : 'The creator reviews your script. You can answer their change requests here.'} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-5 py-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2"><PenLine className="size-4" />Version {script?.version ?? 1}</div>
              <Badge tone={script?.status === 'approved' ? 'success' : 'neutral'} icon={<ShieldCheck className="size-3" />}>{script?.status === 'approved' ? 'Signed' : 'Passed screening'}</Badge>
            </div>
            <pre className="p-6 font-sans text-[15px] leading-[1.9] whitespace-pre-wrap text-ink">{script?.text}</pre>
            {canAct && (
              <div className="flex flex-wrap gap-2 border-t border-line p-5">
                <Button icon={<Check className="size-4" />} onClick={() => setModal('consent')}>Accept & sign consent</Button>
                <Button variant="outline" icon={<MessageSquareDiff className="size-4" />} disabled={c.change_rounds_left <= 0} onClick={() => setModal('changes')}>Request changes ({c.change_rounds_left} left)</Button>
                <Button variant="ghost" className="text-danger" icon={<X className="size-4" />} onClick={() => setModal('reject')}>Reject</Button>
              </div>
            )}
            {isHirer && c.status === 'changes_requested' && openRequest && (
              <div className="border-t border-line p-5">
                <Callout tone="brand" title={`Change request · round ${openRequest.round}`}>{openRequest.request}</Callout>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button loading={busy} onClick={() => act('change-requests/respond', { action: 'accepted' }, 'Changes accepted', 'The creator gets the updated script.')}>Accept changes</Button>
                  <Button variant="outline" onClick={() => { setText(script?.text ?? ''); setModal('respond') }}>Edit the script</Button>
                  <Button variant="ghost" className="text-danger" loading={busy} onClick={() => act('change-requests/respond', { action: 'rejected' }, 'Changes rejected')}>Keep my version</Button>
                </div>
              </div>
            )}
            {isEarner && c.status === 'changes_requested' && <div className="border-t border-line p-5"><Callout tone="neutral" icon={<Clock />}>Waiting for {brand} to answer your change request.</Callout></div>}
          </Card>

          {c.change_requests.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-[15px] font-bold text-ink">Change history</h3>
              <ol className="space-y-3">
                {c.change_requests.map((r) => (
                  <li key={r.round} className="rounded-2xl border border-line p-4 text-[13.5px]">
                    <div className="font-bold text-ink">Round {r.round}</div>
                    <p className="mt-1 text-ink-2">{r.request}</p>
                    <div className="mt-2 text-[12px] text-ink-3">{r.response ? `Brand ${r.response}${r.resulting_version ? ` → version ${r.resulting_version}` : ''}` : 'Waiting for the brand'}</div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="font-bold text-ink">{brand}</div>
            <div className="text-[12.5px] text-ink-2">{naira(c.price.local.price)} in escrow · {c.with_voice ? 'Image + voice' : 'Image only'} · you receive {naira(c.price.local.net)}</div>
            {days !== null && canAct && <div className="mt-4 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-ink"><Clock className="size-4 text-warn" />Respond within {days} {days === 1 ? 'day' : 'days'} or the offer expires.</div>}
          </Card>
          <Card flat className="p-5">
            <h4 className="text-[13px] font-bold text-ink">Change rounds</h4>
            <div className="mt-3 flex gap-1.5">{[1, 2, 3].map((r) => <div key={r} className={cn('h-1.5 flex-1 rounded-full', r <= 3 - c.change_rounds_left ? 'bg-brand' : 'bg-wash')} />)}</div>
            <p className="mt-2 text-[12.5px] text-ink-2">Up to 3 rounds. After that the brand accepts the last version or withdraws with a full refund.</p>
          </Card>
        </aside>
      </div>

      <Modal open={modal === 'changes'} onClose={() => setModal(null)} title="Request changes" subtitle={`${c.change_rounds_left} of 3 rounds left. The brand can accept, edit or reject your changes.`}
        footer={<Button loading={busy} disabled={text.length < 5} onClick={() => act('change-requests', { request: text }, 'Changes sent to the brand')}>Send to {brand}</Button>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Please change the last line — I don’t want to imply I wear it to work." className="min-h-32" />
      </Modal>
      <Modal open={modal === 'respond'} onClose={() => setModal(null)} size="lg" title="Edit the script" subtitle="Your edited version goes back to the creator."
        footer={<Button loading={busy} disabled={text.length < 10} onClick={() => act('change-requests/respond', { action: 'modified', new_script: text }, 'Updated script sent')}>Send new version</Button>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-72 font-mono text-[13.5px]" />
      </Modal>
      <Modal open={modal === 'reject'} onClose={() => setModal(null)} size="sm" title="Reject this script?" subtitle="The brand is refunded in full."
        footer={<Button variant="danger" loading={busy} onClick={() => act('reject', { reason: text }, 'Script rejected', 'The brand is refunded in full.', () => nav('/app/offers'))}>Reject</Button>}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason (optional, shared with the brand)" />
      </Modal>
      <Modal open={modal === 'consent'} onClose={() => setModal(null)} size="lg" title="Sign consent" subtitle={`You’re consenting to script version ${script?.version ?? 1}, and nothing else.`}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Back</Button><Button loading={busy} disabled={!img || (c.with_voice && !voice) || !resp} onClick={() => act('accept', { consent_image: img, consent_voice: c.with_voice && voice, accept_responsibility: resp }, 'Consent signed', `${brand} has been notified by email and in the app.`, () => nav(`/app/contracts/${c.id}`))}>Sign & accept</Button></>}>
        <div className="space-y-4">
          <Checkbox checked={img} onChange={setImg}>I consent to my <b className="text-ink">image</b> being used to generate video from this script version only.</Checkbox>
          {c.with_voice && <Checkbox checked={voice} onChange={setVoice}>I consent to my <b className="text-ink">voice</b> being used for this script.</Checkbox>}
          <Checkbox checked={resp} onChange={setResp}>I understand that by signing I’m responsible for the script I approved. Any claim over its content is between me and {brand}. Wamiwa screens on a best-effort basis and is not a party.</Checkbox>
          <Callout tone="neutral">You’ll approve the final video before it goes live. Every video has an invisible watermark and the “AI likeness” label.</Callout>
        </div>
      </Modal>
    </div>
  )
}
