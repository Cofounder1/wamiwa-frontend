import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, CircleCheck, Crown, ImagePlus, Lock, Mic, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { api, mediaUrl, errMsg } from '@/api/client'
import { fromContract, partyName, statusText } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { ContractDto, ProfileDto } from '@/api/types'
import { useSession } from '@/context/session'
import { usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, CardHeader, Checkbox, Field, Input, Modal, PageHeader, Switch, Tabs, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'

/** GET /likeness/pricing-guide: a follower-based cap, or (verified major people) a recommended [min, max] range. */
interface Guide { type: 'follower_based' | 'verified_major_person'; names_own_price: boolean; max_price_cents?: number; recommended_range_cents?: [number, number]; note?: string }
interface Asset { asset_id: string; kind: 'photo' | 'voice'; file: string; duration_seconds: number }
/** The public listing (GET /likeness/influencers/{id}); the voice price is `price_image_voice_cents` there. */
interface PageDto { price_image_cents?: number | null; price_image_voice_cents?: number | null; exclusivity_price_cents?: number | null; voice_available?: boolean }

export default function Likeness() {
  const { me } = useSession()
  const guide = useApi((s) => api.get<Guide>('/likeness/pricing-guide', undefined, s), [])
  const assets = useApi((s) => api.get<Asset[]>('/likeness/assets', undefined, s), [])
  const profile = useApi((s) => api.get<ProfileDto>(`/profiles/${me.handle}`, undefined, s), [me.handle])
  const page = useApi((s) => api.get<PageDto>(`/likeness/influencers/${me.id}`, undefined, s).catch(() => null), [me.id])
  const contracts = useApi((s) => api.page<ContractDto>('/contracts', { role: 'earner', type: 'likeness', limit: 20 }, s), [])
  const [imageOnly, setImageOnly] = useState(0)
  const [imageVoice, setImageVoice] = useState(0)
  const [excl, setExcl] = useState(0)
  const [exclOn, setExclOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<null | 'photo' | 'voice'>(null)

  useEffect(() => {
    const p = page.data
    const img = p?.price_image_cents ?? profile.data?.likeness?.price_image_cents
    if (img) setImageOnly(img / 100)
    if (p?.price_image_voice_cents) setImageVoice(p.price_image_voice_cents / 100)
    if (p?.exclusivity_price_cents) { setExcl(p.exclusivity_price_cents / 100); setExclOn(true) }
  }, [page.data, profile.data])

  if (guide.error && guide.error.status !== 403) return <ErrorState error={guide.error} onRetry={guide.reload} />
  if (guide.loading || assets.loading || profile.loading) return <Spinner />

  const photos = (assets.data ?? []).filter((a) => a.kind === 'photo')
  const voices = (assets.data ?? []).filter((a) => a.kind === 'voice')
  const voiceReady = voices.length >= 3
  const cap = guide.data?.max_price_cents ? guide.data.max_price_cents / 100 : undefined
  const over = cap !== undefined && imageOnly > cap
  const eligible = !guide.error

  const save = async () => {
    setBusy(true)
    try {
      await api.put('/likeness/page', {
        price_image_cents: Math.round(imageOnly * 100),
        price_voice_cents: voiceReady && imageVoice ? Math.round(imageVoice * 100) : null,
        exclusivity_price_cents: exclOn && excl ? Math.round(excl * 100) : null,
      })
      toast('Likeness page saved', 'Price changes apply to new contracts only.')
      page.reload(); profile.reload()
    } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    try { await api.del(`/likeness/assets/${id}`); toast('Removed', 'This stops new use. Contracts you already signed are unaffected.'); assets.reload() } catch (e) { toast('Couldn’t remove', errMsg(e), 'danger') }
  }

  return (
    <div>
      <PageHeader title="My likeness" subtitle="Brands rent your AI face (and voice, if you allow it) for one month at a time. You approve every script and every final video." actions={<Button loading={busy} disabled={!eligible || over || imageOnly <= 0} onClick={save}>Save</Button>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ['ID + liveness verified', me.verification !== 'none'],
          [`${me.followersHuman.toLocaleString()} human followers, or Verified creator`, me.verification === 'creator' || me.verification === 'major' || me.followersHuman >= 500],
          ['Not a minor account', !me.minor],
        ].map(([t, ok]) => (
          <div key={t as string} className={cn('flex items-center gap-2 rounded-2xl border px-4 py-3 text-[13px] font-semibold', ok ? 'border-teal/30 bg-teal-soft/60 text-ink' : 'border-danger/30 bg-danger-soft text-danger')}>
            {ok ? <CircleCheck className="size-4 text-teal" /> : <X className="size-4" />}{t as string}
          </div>
        ))}
      </div>
      {!eligible && <Callout className="mb-6" tone="warn" icon={<Lock />} title="Not eligible yet">{guide.error?.message}</Callout>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Photos" subtitle="Must match your verified face. Non-matching photos are rejected." action={<Button size="sm" variant="outline" icon={<ImagePlus className="size-4" />} onClick={() => setModal('photo')}>Upload</Button>} />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {photos.map((p) => (
                <div key={p.asset_id} className="group relative aspect-square overflow-hidden rounded-2xl bg-wash">
                  <img src={mediaUrl(p.file)} alt="" className="size-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }} />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-badge bg-teal px-1.5 text-[10.5px] leading-[18px] font-bold text-white"><Check className="size-3" />Face match</span>
                  <button aria-label="Remove photo" onClick={() => remove(p.asset_id)} className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
              {photos.length === 0 && <p className="col-span-full text-[13px] text-ink-2">No photos yet. Add at least one to be listed.</p>}
            </div>
            <p className="px-5 pb-5 text-[12px] text-ink-3">Celebrity names and faces are blocked unless that person verifies the account themselves.</p>
          </Card>

          <Card>
            <CardHeader title="Voice samples" subtitle="Optional. At least 3 clips of 30–60 seconds, recorded in the app while reading the on-screen prompt." action={<Badge tone={voiceReady ? 'teal' : 'neutral'}>{voices.length} of 3 recorded</Badge>} />
            <div className="space-y-2 p-5">
              {voices.map((v, i) => (
                <div key={v.asset_id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <span className="grid size-10 place-items-center rounded-full bg-wash text-ink"><Mic className="size-4" /></span>
                  <div className="min-w-0 flex-1"><div className="text-[13.5px] text-ink">Clip {i + 1}</div><div className="text-[12px] text-ink-3">{v.duration_seconds}s</div></div>
                  <button aria-label="Delete clip" onClick={() => remove(v.asset_id)} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <Button variant="outline" size="sm" icon={<Mic className="size-4" />} onClick={() => setModal('voice')}>Add a clip</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Likeness contracts" />
            <ul className="mt-2 divide-y divide-line">
              {(contracts.data?.data ?? []).map((dto) => {
                const c = fromContract(dto)
                return (
                  <li key={c.id}><Link to={`/app/contracts/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
                    <Building2 className="size-4 text-ink-3" /><span className="flex-1 text-[14px] font-semibold text-ink">{partyName(c.hirerId, dto.title)}<span className="block text-[12px] font-normal text-ink-2">{statusText(dto)}</span></span><Badge tone="brand">{c.state}</Badge>
                  </Link></li>
                )
              })}
              {contracts.data && contracts.data.data.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-2">No likeness contracts yet.</li>}
            </ul>
          </Card>
        </div>

        <aside>
          <Card className="p-5 lg:sticky lg:top-10">
            <h3 className="text-[15px] font-bold text-ink">Pricing per month</h3>
            {guide.data?.type === 'verified_major_person' ? (
              <Callout className="mt-3" tone="warn" icon={<Crown />}>As a Verified major person you name your own price{guide.data.recommended_range_cents ? `. Recommended: ${usd(guide.data.recommended_range_cents[0] / 100)}–${usd(guide.data.recommended_range_cents[1] / 100)}` : ''}.</Callout>
            ) : cap !== undefined && (
              <div className="mt-3 rounded-2xl bg-surface-2 p-4">
                <div className="flex items-baseline justify-between"><span className="text-[12.5px] text-ink-2">Your image-only limit</span><span className="text-[24px] font-extrabold text-ink num">{usd(cap)}</span></div>
                <div className="mt-2 text-[12px] leading-relaxed text-ink-2">$50 plus $10 per 1,000 human followers, adjusted for how much your human viewers engage. {guide.data?.note}</div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <Field label="Image only" error={over ? `Above your limit of ${usd(cap!)}` : undefined}><Input type="number" min={1} value={imageOnly || ''} onChange={(e) => setImageOnly(+e.target.value)} suffix="USD" /></Field>
              <Field label="Image + voice" hint={voiceReady ? 'Must be higher than image only.' : 'Record 3 voice clips to offer voice.'}><Input type="number" value={imageVoice || ''} disabled={!voiceReady} onChange={(e) => setImageVoice(+e.target.value)} suffix="USD" /></Field>
              <Switch checked={exclOn} onChange={setExclOn} label="Offer category exclusivity" description="One brand per category for the month." />
              {exclOn && <Field label="Exclusive price" hint="Must be higher than your other prices."><Input type="number" value={excl || ''} onChange={(e) => setExcl(+e.target.value)} suffix="USD" /></Field>}
            </div>
            <ul className="mt-5 space-y-1.5 text-[12px] text-ink-2">
              <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-teal" />You receive 80%{imageOnly ? ` — ${usd(imageOnly * 0.8)} on image-only` : ''}.</li>
              <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-ink-3" />Price changes apply only to new contracts.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-3" />Converted to Naira on the day the brand pays, then locked.</li>
            </ul>
          </Card>
        </aside>
      </div>
      {modal === 'photo' && <PhotoUpload onClose={() => setModal(null)} onDone={() => { setModal(null); assets.reload() }} />}
      {modal === 'voice' && <VoiceUpload onClose={() => setModal(null)} onDone={() => { setModal(null); assets.reload() }} />}
    </div>
  )
}

async function uploadFile(kind: string, f: File) {
  const form = new FormData(); form.append('kind', kind); form.append('file', f)
  return (await api.upload<{ ref: string }>('/uploads', form)).ref
}

function PhotoUpload({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [photo, setPhoto] = useState<File>()
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await api.post('/likeness/assets/photos', { file_ref: await uploadFile('image', photo!) }); toast('Photo added', 'It matched your verified face.'); onDone() } catch (e) { toast('Photo not added', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="sm" title="Add a likeness photo" subtitle="A clear, front-facing photo of you. It’s checked against your verified face." footer={<Button disabled={!photo} loading={busy} onClick={submit}>Upload</Button>}>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-8 text-[13.5px] text-ink-2 hover:border-brand"><Upload className="size-5 text-brand" />{photo ? photo.name : 'Choose a photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0])} /></label>
    </Modal>
  )
}

const PROMPT = '“The best thing about Lagos in December is… and here’s my honest take after two weeks of trying it.”'
const MIN_SECONDS = 30
const MAX_SECONDS = 60

function recorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
}

/** LK-01: a voice clip, recorded here while reading the prompt, or uploaded. 30–60 seconds either way. */
function VoiceUpload({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!recorderType()
  const [mode, setMode] = useState<'record' | 'upload'>(canRecord ? 'record' : 'upload')
  const [clip, setClip] = useState<File>()
  const [duration, setDuration] = useState(0)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [micError, setMicError] = useState<string>()
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<number>()
  const started = useRef(0)

  useEffect(() => () => { window.clearInterval(timer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()) }, [])

  const pick = (f?: File) => {
    setClip(f); setDuration(0)
    if (!f) return
    const a = document.createElement('audio')
    a.preload = 'metadata'
    a.onloadedmetadata = () => setDuration(Math.round(a.duration || 0))
    a.src = URL.createObjectURL(f)
  }
  const start = async () => {
    setMicError(undefined); setClip(undefined); setDuration(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = recorderType()!
      const rec = new MediaRecorder(stream, { mimeType: type })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const seconds = Math.round((Date.now() - started.current) / 1000)
        const base = type.split(';')[0]
        setClip(new File(parts, `voice-${Date.now()}.${base === 'audio/mp4' ? 'm4a' : 'weba'}`, { type: base }))
        setDuration(seconds)
        setRecording(false)
        window.clearInterval(timer.current)
      }
      recorder.current = rec
      started.current = Date.now()
      setElapsed(0); setRecording(true)
      rec.start()
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - started.current) / 1000)
        setElapsed(s)
        if (s >= MAX_SECONDS) rec.stop()  // stop at the maximum
      }, 250)
    } catch {
      setMicError('We couldn’t open your microphone. Allow microphone access, or upload a clip instead.')
    }
  }
  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop()

  const submit = async () => {
    setBusy(true)
    try {
      await api.post('/likeness/assets/voice', { file_ref: await uploadFile('likeness_voice', clip!), duration_seconds: duration,
        recorded_in_app: mode === 'record', voice_consent: consent })
      toast('Voice clip added'); onDone()
    } catch (e) { toast('Clip not added', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const lengthOk = duration >= MIN_SECONDS && duration <= MAX_SECONDS
  return (
    <Modal open onClose={onClose} size="sm" title="Add a voice clip" subtitle="Read the prompt aloud for 30–60 seconds."
      footer={<Button disabled={!clip || !consent || !lengthOk || recording} loading={busy} onClick={submit}>Add clip</Button>}>
      <Tabs value={mode} onChange={(m) => { stop(); setMode(m); setClip(undefined); setDuration(0) }}
        tabs={[{ value: 'record', label: 'Record now' }, { value: 'upload', label: 'Upload a file' }]} />
      <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[14px] text-ink">{PROMPT}</div>
      {mode === 'record' ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-5 text-[13px] text-ink-2">
          {!canRecord && <span>This browser can’t record here. Use “Upload a file”, or another browser such as Chrome or Safari.</span>}
          {canRecord && !recording && (
            <Button variant={clip ? 'outline' : 'primary'} icon={<Mic className="size-4" />} onClick={start}>{clip ? 'Record again' : 'Start recording'}</Button>
          )}
          {recording && (
            <>
              <span className="flex items-center gap-2 font-semibold text-danger"><span className="size-2.5 animate-pulse rounded-full bg-danger" />Recording · {elapsed}s of {MAX_SECONDS}s</span>
              <Button variant="outline" disabled={elapsed < MIN_SECONDS} onClick={stop}>{elapsed < MIN_SECONDS ? `Keep reading (${MIN_SECONDS - elapsed}s)` : 'Stop'}</Button>
            </>
          )}
          {clip && !recording && <span>Recorded {duration}s{lengthOk ? '' : ' — too short, record again'}</span>}
          {clip && !recording && <audio controls src={URL.createObjectURL(clip)} className="mt-1 w-full max-w-[280px]" />}
          {micError && <span className="text-danger">{micError}</span>}
        </div>
      ) : (
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-5 text-[13px] text-ink-2 hover:border-brand">
          <Upload className="size-4" />{clip ? `${clip.name}${duration ? ` · ${duration}s` : ''}` : 'Choose an audio file (MP3, M4A, WAV)'}
          <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}
      {mode === 'upload' && duration > 0 && !lengthOk && <p className="mt-2 text-[12.5px] text-danger">Clips must be 30–60 seconds.</p>}
      <div className="mt-4"><Checkbox checked={consent} onChange={setConsent}>I consent to my voice being used in likeness videos, only for scripts I approve. I can delete samples any time; that stops new use but not contracts I’ve already signed.</Checkbox></div>
    </Modal>
  )
}
