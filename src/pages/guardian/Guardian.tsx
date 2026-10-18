import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon, Ban, Building2, Check, CheckCircle2, Eye, FileText, HeartHandshake, Lock, PhoneCall, PhoneMissed, Search, ShieldCheck, Snowflake, Upload, X,
} from 'lucide-react'
import { api, mediaUrl, errMsg } from '@/api/client'
import { partyName, statusText } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { ContractDto, ConversationDto, EarningsDto, SearchHitDto } from '@/api/types'
import { useSession } from '@/context/session'
import { date, dateTime, naira } from '@/lib/format'
import { MINOR_BLOCKED } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Checkbox, Empty, Input, KV, Modal, PageHeader, Stat, Stepper, Switch, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'

interface MinorDto { minor_id: string; handle: string; name: string; link_status: string; account_status: string; frozen: boolean }
interface ConfirmationDto {
  contract_id: string; minor_id: string
  result: string
  app_approved_at: string | null; call_attempts: number; max_call_attempts: number; next_call_at: string | null; expires_at: string; recorded: boolean
}

const CLOSED = ['approved', 'declined', 'expired']

/** Guardian screens work on one minor at a time; most guardians have one. */
function MinorGate({ children }: { children: (m: MinorDto) => React.ReactNode }) {
  const minors = useApi((s) => api.get<MinorDto[]>('/guardians/minors', undefined, s), [])
  const [pick, setPick] = useState(0)
  if (minors.error) return <ErrorState error={minors.error} onRetry={minors.reload} />
  if (!minors.data) return <Spinner />
  if (!minors.data.length) return <Empty icon={<HeartHandshake />} title="No linked minors yet">When your child signs up and sends you an invite, accept it from the email to link your accounts.</Empty>
  const m = minors.data[Math.min(pick, minors.data.length - 1)]
  return (
    <>
      {minors.data.length > 1 && (
        <div className="mb-6 flex gap-2">{minors.data.map((x, i) => <button key={x.minor_id} onClick={() => setPick(i)} className={cn('rounded-full border px-4 py-1.5 text-[13px] font-semibold', i === pick ? 'border-ink bg-ink text-bg' : 'border-line hover:bg-wash')}>{x.name}</button>)}</div>
      )}
      {children(m)}
    </>
  )
}

const first = (name: string) => name.split(' ')[0]

/* ── Overview ───────────────────────────────────────────────────────────── */

export function GuardianOverview() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Your minors" subtitle="You approve contracts and companies, receive payouts, and can freeze an account at any time." />
      <MinorGate>{(m) => <Overview m={m} />}</MinorGate>
    </div>
  )
}

function Overview({ m }: { m: MinorDto }) {
  const [frozen, setFrozen] = useState(m.frozen)
  const conf = useApi((s) => api.get<ConfirmationDto[]>('/guardians/confirmations', undefined, s), [])
  const companies = useApi((s) => api.get<unknown[]>(`/guardians/minors/${m.minor_id}/companies`, undefined, s), [m.minor_id])
  const earnings = useApi((s) => api.get<EarningsDto>(`/guardians/minors/${m.minor_id}/earnings`, undefined, s), [m.minor_id])
  const contracts = useApi((s) => api.page<ContractDto>(`/guardians/minors/${m.minor_id}/contracts`, { limit: 50 }, s), [m.minor_id])
  const pending = (conf.data ?? []).filter((c) => c.minor_id === m.minor_id && !CLOSED.includes(c.result))

  const toggleFreeze = async () => {
    const next = !frozen
    setFrozen(next)
    try {
      await (next ? api.put(`/guardians/minors/${m.minor_id}/freeze`) : api.del(`/guardians/minors/${m.minor_id}/freeze`))
      toast(next ? 'Account frozen' : 'Account unfrozen', next ? `${first(m.name)} can’t post, message or accept offers.` : undefined, next ? 'warn' : 'success')
    } catch (e) { setFrozen(!next); toast('Couldn’t update', errMsg(e), 'danger') }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-6">
          <Avatar name={m.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-extrabold text-ink">{m.name}</h2><Badge tone="teal">Linked</Badge>{frozen && <Badge tone="danger" icon={<Snowflake className="size-3" />}>Frozen</Badge>}</div>
            <div className="text-[13.5px] text-ink-2">@{m.handle}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" to={`/app/u/${m.handle}`}>View profile</Button>
            <Button variant={frozen ? 'primary' : 'danger'} icon={<Snowflake className="size-4" />} onClick={toggleFreeze}>{frozen ? 'Unfreeze' : 'Freeze account'}</Button>
          </div>
        </div>
        <div className="grid border-t border-line sm:grid-cols-4">
          {[
            ['Waiting for you', pending.length, '/app/guardian/contracts'],
            ['Approved companies', companies.data?.length ?? '—', '/app/guardian/companies'],
            ['Contracts', contracts.data?.data.length ?? '—', '/app/guardian/contracts'],
            ['Earnings in escrow', earnings.data ? naira(earnings.data.pending, { compact: true }) : '—', '/app/guardian/payouts'],
          ].map(([l, v, to]) => (
            <Link key={l as string} to={to as string} className="border-line p-5 transition last:border-r-0 hover:bg-surface-2 sm:border-r">
              <div className="text-[12.5px] text-ink-2">{l}</div><div className="mt-1 text-[24px] font-extrabold text-ink num">{v}</div>
            </Link>
          ))}
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Needs your attention" />
          <ul className="mt-2 divide-y divide-line">
            {pending.map((c) => {
              const k = contracts.data?.data.find((x) => x.id === c.contract_id)
              return (
                <li key={c.contract_id}><Link to="/app/guardian/contracts" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
                  <FileText className="size-5 text-brand" />
                  <div className="flex-1"><div className="text-[14px] font-bold text-ink">{k ? `${partyName(k.hirer_id, k.title)} · ${naira(k.price.local.price, { compact: true })}` : 'Contract'}</div><div className="text-[12.5px] text-ink-2">{c.result === 'awaiting_app_approval' ? 'Review & approve in the app' : 'Confirmation call pending'}</div></div>
                  <Badge tone={c.result === 'awaiting_app_approval' ? 'warn' : 'brand'}>{c.result === 'awaiting_app_approval' ? 'Approve' : 'Call'}</Badge>
                </Link></li>
              )
            })}
            {!conf.loading && pending.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-ink-2">Nothing waiting for you.</li>}
          </ul>
        </Card>
        <Card flat className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-ink"><ShieldCheck className="size-4 text-brand" />Always blocked for under-18s</h3>
          <div className="flex flex-wrap gap-1.5">{MINOR_BLOCKED.map((c) => <Badge key={c} tone="neutral" icon={<Ban className="size-3" />}>{c}</Badge>)}</div>
          <p className="mt-4 text-[12.5px] text-ink-2">Minors never see sponsored cards, Suggested sellers or Wamiwa Agent replies, and their data is never used for ad targeting or B2B discovery.</p>
        </Card>
      </div>
    </>
  )
}

/* ── Contract approvals (LK-09) ─────────────────────────────────────────── */

const callStep = (c: ConfirmationDto) => c.result === 'awaiting_app_approval' ? 1 : c.result === 'approved' ? 5 : c.recorded ? 4 : 2

export function GuardianContracts() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Contract approvals" subtitle="Every contract needs two approvals: one here in the app, then one on an automated call to your verified number. A decline at either point refunds the brand in full." />
      <MinorGate>{(m) => <ContractApprovals m={m} />}</MinorGate>
    </div>
  )
}

function ContractApprovals({ m }: { m: MinorDto }) {
  const conf = useApi((s) => api.get<ConfirmationDto[]>('/guardians/confirmations', undefined, s), [])
  const contracts = useApi((s) => api.page<ContractDto>(`/guardians/minors/${m.minor_id}/contracts`, { limit: 50 }, s), [m.minor_id])
  const [review, setReview] = useState<ContractDto | null>(null)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const reload = () => { conf.reload(); contracts.reload() }

  const act = async (path: string, done: string, sub?: string) => {
    setBusy(true)
    try { await api.post(path); toast(done, sub); setReview(null); setOk(false); reload() } catch (e) { toast('Couldn’t do that', errMsg(e), 'danger') } finally { setBusy(false) }
  }

  if (conf.error) return <ErrorState error={conf.error} onRetry={reload} />
  if (contracts.error) return <ErrorState error={contracts.error} onRetry={reload} />
  if (!conf.data || !contracts.data) return <Spinner />
  const all = contracts.data.data
  const items = conf.data.filter((c) => c.minor_id === m.minor_id)
  const others = all.filter((k) => !items.some((c) => c.contract_id === k.id))

  return (
    <>
      <div className="space-y-4">
        {items.map((c) => {
          const k = all.find((x) => x.id === c.contract_id)
          return (
            <Card key={c.contract_id} className="p-6">
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid size-10 place-items-center rounded-[28%] bg-wash text-ink-2"><Building2 className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink">{k ? partyName(k.hirer_id, k.title) : 'Brand'} → {first(m.name)}</div>
                  {k && <div className="text-[13px] text-ink-2">{k.type === 'likeness' ? 'Hire My Likeness' : 'Hire Me'} · {naira(k.price.local.price)} · {k.deliverables.split('\n')[0] || 'Likeness video'}</div>}
                  <div className="mt-1 text-[12px] text-ink-3">Expires {date(c.expires_at)}</div>
                </div>
                <div className="flex gap-2">
                  {c.result === 'awaiting_app_approval' && <><Button variant="ghost" className="text-danger" loading={busy} onClick={() => act(`/guardians/confirmations/${c.contract_id}/decline`, 'Offer declined', 'The brand is refunded in full.')}>Decline</Button><Button disabled={!k} onClick={() => k && setReview(k)}>Review contract</Button></>}
                  {c.app_approved_at && !CLOSED.includes(c.result) && <Button variant="outline" icon={<PhoneCall className="size-4" />} loading={busy} onClick={() => act(`/guardians/confirmations/${c.contract_id}/request-call`, 'Call requested', 'We’ll call your verified number shortly.')}>Call me now</Button>}
                  {c.result === 'approved' && <Badge tone="success" icon={<Check className="size-3" />}>Approved</Badge>}
                  {['declined', 'expired'].includes(c.result) && <Badge tone="neutral">{c.result}</Badge>}
                </div>
              </div>
              <Stepper className="mt-6" current={callStep(c)} steps={['Offer received', 'You approve in app', 'Confirmation call', 'Recorded & linked', 'Contract active']} />
              {c.app_approved_at && !CLOSED.includes(c.result) && (
                <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-2"><PhoneCall className="size-4 shrink-0 text-brand" />Call attempt {c.call_attempts} of {c.max_call_attempts}{c.next_call_at ? ` · next call ${dateTime(c.next_call_at)}` : ''}. Enter the code sent to your phone, then press 1 to approve or 2 to decline.</p>
              )}
            </Card>
          )
        })}
        {items.length === 0 && <Empty icon={<FileText />} title="No contracts waiting for you" />}
      </div>

      {others.length > 0 && (
        <Card className="mt-8">
          <CardHeader title={`${first(m.name)}’s other contracts`} />
          <ul className="mt-2 divide-y divide-line">
            {others.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-[13.5px]">
                <span className="flex-1 font-semibold text-ink">{partyName(k.hirer_id, k.title)} · {k.deliverables.split('\n')[0] || 'Likeness'}</span>
                <Badge tone="neutral">{statusText(k)}</Badge>
                {k.type === 'likeness' && k.status === 'active' && <EndForHarm contractId={k.id} onDone={reload} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!review} onClose={() => setReview(null)} size="lg" title="Review contract" subtitle="Read the full contract before approving."
        footer={<><Button variant="ghost" onClick={() => setReview(null)}>Close</Button><Button disabled={!ok} loading={busy} onClick={() => review && act(`/guardians/confirmations/${review.id}/approve`, 'Approved in the app', 'Next: an automated call to your verified number.')}>Approve</Button></>}>
        {review && (
          <>
            <KV rows={[
              ['Brand', partyName(review.hirer_id, review.title)],
              ['Type', review.type === 'likeness' ? 'Hire My Likeness · 1 month' : `Hire Me · ${review.num_posts} posts`],
              ['Price', naira(review.price.local.price)],
              [`Wamiwa fee (${review.price.local.fee_pct}%)`, naira(review.price.local.fee)],
              ['Paid to you (guardian)', naira(review.price.local.net)],
              ['Deadline', review.deadline ? date(review.deadline) : '—'],
            ]} />
            {review.deliverables && <div className="mt-4 rounded-2xl bg-surface-2 p-4 text-[13.5px] whitespace-pre-wrap text-ink-2">{review.deliverables}</div>}
            <div className="mt-4"><Checkbox checked={ok} onChange={setOk}>I’ve read the full contract and I approve this for my child.</Checkbox></div>
          </>
        )}
      </Modal>
    </>
  )
}

function EndForHarm({ contractId, onDone }: { contractId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const end = async () => {
    try { await api.post(`/likeness/contracts/${contractId}/guardian-end`, { reason }); toast('Contract ended', 'The brand gets a pro-rata refund and the content is taken down.', 'warn'); setOpen(false); onDone() } catch (e) { toast('Couldn’t end it', errMsg(e), 'danger') }
  }
  return (
    <>
      <Button size="xs" variant="ghost" className="text-danger" icon={<AlertOctagon className="size-3.5" />} onClick={() => setOpen(true)}>End (harm)</Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="End this likeness contract?" subtitle="Use this if the content harms your child." footer={<Button variant="danger" onClick={end}>End contract</Button>}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What’s the concern? (shared with our safety team)" />
      </Modal>
    </>
  )
}

/* ── Company approvals (MS-01, HM-02) ───────────────────────────────────── */

export function GuardianCompanies() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Company approvals" subtitle="Companies can only message your child or send offers after you approve them. Blocked categories can never be approved." />
      <MinorGate>{(m) => <Companies m={m} />}</MinorGate>
    </div>
  )
}

function Companies({ m }: { m: MinorDto }) {
  const list = useApi((s) => api.get<{ company_id: string; handle: string; approved_at: string }[]>(`/guardians/minors/${m.minor_id}/companies`, undefined, s), [m.minor_id])
  const [q, setQ] = useState('')
  const found = useApi(q.length > 1 ? (s) => api.page<SearchHitDto>('/search', { tab: 'companies', q, limit: 6 }, s) : null, [q])
  const set = async (companyId: string, approve: boolean) => {
    try {
      await (approve ? api.put(`/guardians/minors/${m.minor_id}/companies/${companyId}`) : api.del(`/guardians/minors/${m.minor_id}/companies/${companyId}`))
      toast(approve ? 'Company approved' : 'Approval removed', approve ? 'They can now message your child. You’ll see those chats.' : undefined)
      list.reload(); setQ('')
    } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') }
  }
  return (
    <>
      <Card className="mb-6 p-5">
        <div className="mb-2 text-[13px] font-semibold text-ink">Approve a company</div>
        <Input icon={<Search />} placeholder="Search companies by name" value={q} onChange={(e) => setQ(e.target.value)} />
        {found.data?.data.map((c) => (
          <div key={c.id} className="mt-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-wash">
            <Avatar name={c.name} kind="company" size="sm" />
            <span className="flex-1 text-[14px] font-semibold text-ink">{c.name} <span className="font-normal text-ink-3">@{c.handle}</span></span>
            <Button size="xs" disabled={list.data?.some((x) => x.company_id === c.id)} onClick={() => set(c.id, true)}>Approve</Button>
          </div>
        ))}
      </Card>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Spinner className="min-h-40" /> : (
        <Card className="divide-y divide-line">
          {list.data.map((c) => (
            <div key={c.company_id} className="flex flex-wrap items-center gap-4 p-5">
              <Avatar name={c.handle} kind="company" />
              <div className="min-w-0 flex-1"><div className="font-bold text-ink">@{c.handle}</div><div className="text-[13px] text-ink-2">Approved {date(c.approved_at)}</div></div>
              <Badge tone="success" icon={<Check className="size-3" />}>Approved</Badge>
              <Button size="sm" variant="ghost" className="text-danger" icon={<X className="size-3.5" />} onClick={() => set(c.company_id, false)}>Remove</Button>
            </div>
          ))}
          {list.data.length === 0 && <div className="p-8 text-center text-[13.5px] text-ink-2">No companies approved yet.</div>}
        </Card>
      )}
    </>
  )
}

/* ── Calls ───────────────────────────────────────────────────────────────── */

export function GuardianCalls() {
  const conf = useApi((s) => api.get<ConfirmationDto[]>('/guardians/confirmations', undefined, s), [])
  const request = async (id: string) => {
    try { await api.post(`/guardians/confirmations/${id}/request-call`); toast('Call requested', 'We’ll call your verified number shortly.'); conf.reload() } catch (e) { toast('Couldn’t request a call', errMsg(e), 'danger') }
  }
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Confirmation calls" subtitle="After you approve in the app, an automated call reads out the brand, fee and contract length. Calls are recorded and linked to the contract." />
      {conf.error ? <ErrorState error={conf.error} onRetry={conf.reload} /> : !conf.data ? <Spinner /> : (
        <Card className="divide-y divide-line">
          {conf.data.map((c) => {
            const missed = c.call_attempts > 0 && c.result !== 'approved'
            return (
              <div key={c.contract_id} className="flex flex-wrap items-center gap-4 p-5">
                <span className={cn('grid size-10 place-items-center rounded-full', c.result === 'approved' ? 'bg-success-soft text-success' : missed ? 'bg-warn-soft text-warn' : 'bg-wash text-ink-2')}>{c.result === 'approved' ? <CheckCircle2 className="size-4" /> : missed ? <PhoneMissed className="size-4" /> : <PhoneCall className="size-4" />}</span>
                <div className="min-w-0 flex-1"><div className="font-bold text-ink">Contract …{c.contract_id.slice(-6).toUpperCase()}</div><div className="text-[12.5px] text-ink-2 first-letter:uppercase">{c.result.replace(/_/g, ' ')} · attempt {c.call_attempts} of {c.max_call_attempts}{c.recorded ? ' · recorded' : ''}</div></div>
                {c.app_approved_at && !CLOSED.includes(c.result) && <Button size="sm" variant="outline" icon={<PhoneCall className="size-3.5" />} onClick={() => request(c.contract_id)}>Call me now</Button>}
                {c.result === 'awaiting_app_approval' && <Button size="sm" to="/app/guardian/contracts">Approve in app first</Button>}
              </div>
            )
          })}
          {conf.data.length === 0 && <div className="p-8 text-center text-[13.5px] text-ink-2">No confirmation calls yet.</div>}
        </Card>
      )}
      <p className="mt-4 text-[12.5px] text-ink-3">Missed calls are retried twice over 48 hours. No confirmation within 7 days and the offer expires with a full refund.</p>
    </div>
  )
}

/* ── Uploads (LK-09) ────────────────────────────────────────────────────── */

export function GuardianUploads() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Likeness uploads" subtitle="A minor’s photos and voice samples are uploaded through your account, with a liveness check of your child." />
      <MinorGate>{(m) => <Uploads m={m} />}</MinorGate>
    </div>
  )
}

function Uploads({ m }: { m: MinorDto }) {
  const assets = useApi((s) => api.get<{ asset_id: string; kind: string; file: string }[]>('/likeness/assets', { minor_id: m.minor_id }, s), [m.minor_id])
  const [photo, setPhoto] = useState<File>()
  const [selfie, setSelfie] = useState<File>()
  const [busy, setBusy] = useState(false)
  const upload = async (f: File) => {
    const form = new FormData(); form.append('kind', 'image'); form.append('file', f)
    return (await api.upload<{ ref: string }>('/uploads', form)).ref
  }
  const submit = async () => {
    setBusy(true)
    try {
      const [file_ref, liveness_selfie_ref] = await Promise.all([upload(photo!), upload(selfie!)])
      await api.post('/likeness/assets/photos', { minor_id: m.minor_id, file_ref, liveness_selfie_ref })
      toast('Photo added'); setPhoto(undefined); setSelfie(undefined); assets.reload()
    } catch (e) { toast('Upload failed', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const photos = assets.data?.filter((a) => a.kind === 'photo') ?? []
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 font-bold text-ink">Photos of {first(m.name)}</h3>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((a) => <img key={a.asset_id} src={mediaUrl(a.file)} alt="" className="aspect-square rounded-xl bg-wash object-cover" />)}
          {assets.data && photos.length === 0 && <p className="col-span-3 text-[13px] text-ink-2">No photos yet.</p>}
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-4 text-[13px] text-ink-2 hover:border-brand"><Upload className="size-4" />{photo ? photo.name : 'Photo'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0])} /></label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-4 text-[13px] text-ink-2 hover:border-brand"><Eye className="size-4" />{selfie ? selfie.name : 'Liveness selfie'}<input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => setSelfie(e.target.files?.[0])} /></label>
        </div>
        <Button className="mt-3" disabled={!photo || !selfie} loading={busy} onClick={submit}>Upload with liveness check</Button>
      </Card>
      <Card flat className="p-5">
        <h3 className="font-bold text-ink">Voice samples</h3>
        <p className="mt-2 text-[13.5px] text-ink-2">Voice is optional. It needs at least 3 clips of 30–60 seconds recorded in the app, plus a separate voice consent. Record them together with your child from the mobile app.</p>
      </Card>
    </div>
  )
}

/* ── Chat oversight (MS-04) ─────────────────────────────────────────────── */

export function GuardianChats() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Company chats" subtitle="Read-only. You see your child’s chats with companies, never their chats with friends." />
      <MinorGate>{(m) => <Chats m={m} />}</MinorGate>
    </div>
  )
}

function Chats({ m }: { m: MinorDto }) {
  const chats = useApi((s) => api.get<(ConversationDto & { messages?: { body: string; sender_id: string; created_at: string }[] })[]>(`/guardians/minors/${m.minor_id}/chats`, undefined, s), [m.minor_id])
  if (chats.error) return <ErrorState error={chats.error} onRetry={chats.reload} />
  if (!chats.data) return <Spinner />
  if (!chats.data.length) return <Empty icon={<Eye />} title="No company chats">When an approved company messages {first(m.name)}, you’ll be able to read it here.</Empty>
  return (
    <div className="space-y-4">
      {chats.data.map((c) => (
        <Card key={c.id} className="p-5">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink"><Building2 className="size-4" />{c.with.map((w) => w.name ?? '@' + w.handle).join(', ')}</div>
          <div className="space-y-2">
            {(c.messages ?? []).map((msg, i) => (
              <div key={i} className={cn('flex', msg.sender_id === m.minor_id ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[75%] rounded-2xl px-4 py-2 text-[14px]', msg.sender_id === m.minor_id ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink')}>{msg.body}</div></div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ── Payouts ─────────────────────────────────────────────────────────────── */

export function GuardianPayouts() {
  return (
    <div>
      <PageHeader eyebrow="Guardian" title="Payouts" subtitle="Your child’s earnings are paid to your bank account, in your name, every 2 weeks." actions={<Button variant="outline" to="/app/verify?tab=bank">Payout account</Button>} />
      <MinorGate>{(m) => <Payouts m={m} />}</MinorGate>
    </div>
  )
}

function Payouts({ m }: { m: MinorDto }) {
  const e = useApi((s) => api.get<EarningsDto>(`/guardians/minors/${m.minor_id}/earnings`, undefined, s), [m.minor_id])
  if (e.error) return <ErrorState error={e.error} onRetry={e.reload} />
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="In escrow" value={e.data ? naira(e.data.pending) : '—'} />
        <Stat label="Cleared" value={e.data ? naira(e.data.cleared) : '—'} />
        <Stat label="Paid to you" value={e.data ? naira(e.data.paid) : '—'} />
        <Stat label="Next payout" value={e.data ? date(e.data.next_payout_cycle) : '—'} />
      </div>
      <Callout className="mt-6" tone="neutral" icon={<Lock />}>{first(m.name)} can see their earnings but can’t change the payout account.</Callout>
    </>
  )
}

/* ── Minor: my guardian (ON-03) ─────────────────────────────────────────── */

export function MinorGuardian() {
  const { meDto } = useSession()
  const [notify, setNotify] = useState(true)
  return (
    <div className="max-w-2xl">
      <PageHeader title="My guardian" subtitle="Your guardian helps keep your earning safe." />
      <Card className="p-6">
        <div className="flex items-center gap-3 text-[14px]"><span className="grid size-10 place-items-center rounded-full bg-teal-soft text-teal"><ShieldCheck className="size-5" /></span><div><div className="font-bold text-ink">{meDto?.status === 'active' ? 'Your guardian is linked and verified' : 'Waiting for your guardian'}</div><div className="text-[13px] text-ink-2">They approve contracts and companies before anything starts.</div></div></div>
        <ul className="mt-6 space-y-3 text-[14px] text-ink-2">
          {[['Approves every contract', 'In the app and on a confirmation call.', Check], ['Approves companies before they can message you', '', Building2], ['Receives your payouts', 'You can always see what you’ve earned.', Check], ['Can see your chats with companies', 'Not your chats with friends.', Eye], ['Can freeze your account', '', X]].map(([t, d, I]) => (
            <li key={t as string} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-wash text-ink-2"><I className="size-3.5" /></span><div><b className="text-ink">{t as string}</b>{d && <div className="text-[13px]">{d as string}</div>}</div></li>
          ))}
        </ul>
        <div className="mt-6 border-t border-line pt-4"><Switch checked={notify} onChange={setNotify} label="Tell me when my guardian approves something" /></div>
      </Card>
      <p className="mt-4 text-[12.5px] text-ink-3">When you turn 18 your account becomes a full account automatically. Active contracts finish under their original terms.</p>
    </div>
  )
}
