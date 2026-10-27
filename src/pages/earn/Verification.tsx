import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Award, BadgeCheck, BookOpen, Briefcase, Camera, Check, Clock, CreditCard, Crown, HeartHandshake, IdCard, Landmark, Link2, Mic2, Newspaper, Plane, RotateCcw, ShieldCheck, Upload, X,
} from 'lucide-react'
import { api, ApiError, errMsg } from '@/api/client'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { compact, date } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge, Button, Callout, Card, CardHeader, Field, Input, Modal, PageHeader, Progress, Segmented, Select, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { IdLiveCheck, type LiveResult } from '@/components/ui/IdLiveCheck'
import { RegionSelect } from '@/components/ui/RegionPicker'

type Tab = 'id' | 'bank' | 'social' | 'public'
async function upload(kind: string, f: File) {
  const form = new FormData(); form.append('kind', kind); form.append('file', f)
  return (await api.upload<{ ref: string }>('/uploads', form)).ref
}

export default function Verification() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'id')
  return (
    <div>
      <PageHeader title="Verification" subtitle="Required before you can earn, rent your likeness, deploy agents or receive payouts." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'id', label: 'Identity' }, { value: 'bank', label: 'Bank account' }, { value: 'social', label: 'Verified creator' }, { value: 'public', label: 'Public figure' }]} />
      <div className="mt-6">
        {tab === 'id' && <IdentityTab />}
        {tab === 'bank' && <BankTab />}
        {tab === 'social' && <SocialTab />}
        {tab === 'public' && <PublicFigureTab />}
      </div>
    </div>
  )
}

interface IdStatus { id_verified: boolean; retries_left?: number; latest: { status: string; reason: string | null; submitted_at: string } | null }

/** Under-18s don't verify their own ID or add a bank account: their guardian does (ON-03). */
function MinorNotice({ what }: { what: 'id' | 'bank' }) {
  return (
    <Callout tone="brand" icon={<HeartHandshake />} title={what === 'id' ? 'Your guardian provides the ID' : 'Payouts go to your guardian'}
      action={<Button size="sm" variant="outline" to="/app/guardian-link">My guardian</Button>}>
      {what === 'id'
        ? 'Because you’re under 18, your parent or guardian verifies their ID for your account. There’s nothing for you to upload here.'
        : 'Because you’re under 18, your earnings are paid to your guardian’s bank account, in their name. You can always see what you’ve earned.'}
    </Callout>
  )
}

function IdentityTab() {
  const { role, refreshMe, me, meDto } = useSession()
  const minor = role === 'minor' || !!meDto?.profile?.is_minor
  const res = useApi(minor ? null : (s) => api.get<IdStatus>('/verification/identity', undefined, s), [minor])
  const [doc, setDoc] = useState<'national_id' | 'drivers_licence' | 'passport'>('national_id')
  const [docFile, setDocFile] = useState<File>()
  const [idNumber, setIdNumber] = useState('')
  const [live, setLive] = useState<LiveResult>()
  const [busy, setBusy] = useState(false)
  if (minor) return <div className="max-w-2xl"><MinorNotice what="id" /></div>
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const s = res.data
  // In Nigeria a NIN or driver's licence is looked up by its number; a passport or a foreign ID is sent as a photo.
  const lookup = (!meDto?.region || meDto.region === 'nigeria') && doc !== 'passport'
  const ready = !!live && (lookup ? idNumber.replace(/\s/g, '').length >= 6 : !!docFile)
  const submit = async () => {
    setBusy(true)
    try {
      const body: Record<string, string> = { document_type: doc }
      if (lookup) body.id_number = idNumber.replace(/\s/g, '')
      else body.document_ref = await upload('id_document', docFile!)
      if (live!.kind === 'youverify') body.liveness_session_id = live!.sessionId
      else {
        // Wamiwa's own camera check is uploaded as private files: never shown back to anyone.
        const [selfie_ref, liveness_ref] = await Promise.all([upload('liveness', live!.capture.frame), upload('liveness', live!.capture.clip)])
        Object.assign(body, { selfie_ref, liveness_ref })
      }
      const r = await api.post<{ status: string; reason?: string }>('/verification/identity', body)
      toast(r.status === 'passed' ? 'Identity verified' : r.status === 'manual_review' ? 'We’re checking your document' : 'Not verified',
        r.status === 'passed' ? 'You can now earn on Wamiwa.' : r.status === 'manual_review' ? 'Our team usually replies within 24 hours.' : r.reason ?? 'Try again.',
        r.status === 'failed' ? 'danger' : undefined)
      setDocFile(undefined); setIdNumber(''); setLive(undefined); res.reload(); void refreshMe()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'live_check_expired') {
        setLive(undefined) // the live check can be used once, within 30 minutes: start a fresh one
        toast('Do the live check again', 'Your live check expired or was already used. Start a new one, then submit.', 'warn')
      } else if (e instanceof ApiError && e.code === 'manual_review') {
        toast('Already with our team', 'Your last submission is being checked. We’ll let you know the result.', 'warn'); res.reload()
      } else if (e instanceof ApiError && e.code === 'guardian_provides_id') {
        toast('Your guardian provides the ID', 'Under-18s don’t verify their own ID.', 'warn')
      } else toast('Verification failed', errMsg(e), 'danger')
    } finally { setBusy(false) }
  }
  const inReview = !s.id_verified && s.latest?.status === 'manual_review'
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-ink">Verify your identity</h3>
          <Badge tone={s.id_verified ? 'success' : s.latest?.status === 'failed' || s.latest?.status === 'rejected' ? 'danger' : 'warn'}>{s.id_verified ? 'Verified' : s.latest ? (s.latest.status === 'manual_review' ? 'With our team' : s.latest.status) : 'Not started'}</Badge>
        </div>
        {s.id_verified ? (
          <Callout tone="success" icon={<ShieldCheck />} title="You’re verified">Verified {s.latest ? date(s.latest.submitted_at) : ''}. Your verified name can only change through a new ID check.</Callout>
        ) : inReview ? (
          <Callout tone="brand" icon={<Clock />} title="With our team">You submitted your ID on {date(s.latest!.submitted_at)}. Our team is checking it, usually within 24 hours. We’ll notify you of the result; you don’t need to submit again.</Callout>
        ) : (
          <>
            {(s.latest?.status === 'failed' || s.latest?.status === 'rejected') && <Callout className="mb-5" tone="warn" title={`Last attempt failed${s.latest.reason ? `: ${s.latest.reason}` : ''}`}>{s.retries_left !== undefined ? `${s.retries_left} ${s.retries_left === 1 ? 'retry' : 'retries'} left before manual review.` : 'You can retry up to 3 times before manual review.'}</Callout>}
            <div className="grid gap-2 sm:grid-cols-3">
              {([['national_id', 'National ID card', IdCard], ['drivers_licence', 'Driver’s licence', CreditCard], ['passport', 'International passport', Plane]] as const).map(([v, l, I]) => (
                <button key={v} onClick={() => setDoc(v)} className={cn('flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition', doc === v ? 'border-brand bg-brand-soft' : 'border-line hover:bg-wash')}>
                  <I className="size-5 text-brand" /><span className="text-[13.5px] font-bold text-ink">{l}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {lookup ? (
                <Field label={doc === 'national_id' ? 'Your NIN' : 'Your driver’s licence number'}
                       hint={doc === 'national_id' ? 'The 11-digit number on your NIN slip or card. We check it with the government record.' : 'As printed on your licence. We check it with the government record.'}>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} inputMode={doc === 'national_id' ? 'numeric' : 'text'}
                         autoComplete="off" placeholder={doc === 'national_id' ? '12345678901' : 'ABC12345AA12'} />
                </Field>
              ) : (
                <label className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed py-6 text-[13px]', docFile ? 'border-teal bg-teal-soft text-teal' : 'border-line-strong text-ink-2 hover:border-brand')}><Upload className="size-5" />{docFile ? docFile.name : `Photo of your ${doc === 'passport' ? 'passport photo page' : 'ID'}`}<span className="text-[11.5px] opacity-70">Clear, no glare, under 1 MB if you can. Our team confirms it.</span><input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => setDocFile(e.target.files?.[0])} /></label>
              )}
              <IdLiveCheck value={live} onChange={setLive} firstName={(me.name || 'there').split(' ')[0]} />
            </div>
            <Button className="mt-5" icon={<Camera className="size-4" />} disabled={!ready} loading={busy} onClick={submit}>Submit for verification</Button>
          </>
        )}
      </Card>
      <Card flat className="h-fit p-5 text-[13px] text-ink-2">
        <div className="mb-2 flex items-center gap-2 font-bold text-ink"><ShieldCheck className="size-4 text-brand" />How we protect your ID</div>
        Documents are encrypted at rest and in transit, and only the services and admins that need them can see them. ID documents are never shown back to anyone.
      </Card>
    </div>
  )
}

interface Bank { bank_code: string; account_number: string; account_name: string; bank_name?: string | null; currency?: 'NGN' | 'USD'; name_matches_id?: boolean; hold_until?: string | null }
const BANKS = [['044', 'Access Bank'], ['058', 'GTBank'], ['057', 'Zenith Bank'], ['033', 'UBA'], ['011', 'First Bank'], ['50211', 'Kuda'], ['999992', 'OPay']]

function BankTab() {
  const { role, meDto } = useSession()
  const minor = role === 'minor' || !!meDto?.profile?.is_minor
  const res = useApi(minor ? null : (s) => api.get<Bank | null>('/verification/bank-account', undefined, s), [minor])
  const [code, setCode] = useState('058')
  const [num, setNum] = useState('')
  const [name, setName] = useState('')
  const [totp, setTotp] = useState('')
  const [busy, setBusy] = useState(false)
  // PY-05: outside Nigeria, payouts go to your own bank in US dollars, with the details a foreign transfer needs.
  const abroad = !!meDto?.region && meDto.region !== 'nigeria'
  const [intl, setIntl] = useState({ bank_name: '', swift_code: '', routing_number: '', beneficiary_address: '', beneficiary_country: meDto?.region ?? '' })
  const setI = (k: keyof typeof intl) => (e: { target: { value: string } }) => setIntl((x) => ({ ...x, [k]: e.target.value }))
  useEffect(() => { if (res.data) { setCode(res.data.bank_code); setName(res.data.account_name) } }, [res.data])
  if (minor) return <div className="max-w-2xl"><MinorNotice what="bank" /></div>
  if (res.error && res.error.status !== 404) return <ErrorState error={res.error} onRetry={res.reload} />
  const save = async () => {
    setBusy(true)
    try {
      await api.put('/verification/bank-account', abroad
        ? { bank_code: 'intl', account_number: num, account_name: name, totp_code: totp || null,
          details: Object.fromEntries(Object.entries(intl).filter(([, v]) => v.trim())) }
        : { bank_code: code, account_number: num, account_name: name, totp_code: totp || null })
      toast('Bank account saved', 'Payouts are held for 48 hours after a change, and we’ve sent email + SMS alerts.')
      setNum(''); setTotp(''); res.reload()
    } catch (e) {
      if (e instanceof ApiError && e.code === '2fa_setup_required') toast('Turn on two-factor login first', 'Changing payout details needs a code from an authenticator app. Set it up in Settings › Privacy & security.', 'warn')
      else if (e instanceof ApiError && e.code === 'guardian_account_required') toast('Payouts go to your guardian', 'Under-18s are paid to their guardian’s bank account.', 'warn')
      else toast('Couldn’t save', errMsg(e), 'danger')
    } finally { setBusy(false) }
  }
  const cur = res.data
  // An existing payout account can only be changed with an authenticator code (2fa_setup_required otherwise).
  const needs2fa = !!cur && !meDto?.two_factor_enabled
  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-center gap-3"><Landmark className="size-6 text-brand" /><h3 className="text-[16px] font-bold text-ink">Payout account</h3></div>
      {cur && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-4 text-[14px]">
          <span className="font-bold text-ink">{cur.bank_name ?? BANKS.find(([c]) => c === cur.bank_code)?.[1] ?? cur.bank_code} · {cur.account_number}{cur.currency === 'USD' ? ' · paid in US dollars' : ''}</span>
          <span className="text-ink-2">{cur.account_name}</span>
          {cur.name_matches_id === false ? <Badge tone="danger">Name doesn’t match your ID — payouts blocked</Badge> : <Badge tone="success" icon={<Check className="size-3" />}>Matches your ID</Badge>}
          {cur.hold_until && <Badge tone="warn">Payouts held until {date(cur.hold_until)}</Badge>}
        </div>
      )}
      {abroad && <Callout className="mt-4" tone="neutral">You’re outside Nigeria, so you’re paid in US dollars to your own bank. The account name can’t be looked up abroad, so it’s matched to your ID as you type it.</Callout>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {abroad ? (
          <>
            <Field label="Bank name"><Input value={intl.bank_name} onChange={setI('bank_name')} placeholder="e.g. Barclays" /></Field>
            <Field label="Account number or IBAN"><Input maxLength={34} value={num} onChange={(e) => setNum(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder={cur ? 'New account number' : 'GB29NWBK60161331926819'} /></Field>
            <Field label="SWIFT / BIC" hint="Or give a routing number."><Input maxLength={11} value={intl.swift_code} onChange={(e) => setIntl((x) => ({ ...x, swift_code: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Routing number" optional hint="US banks: the 9-digit ABA number."><Input inputMode="numeric" maxLength={9} value={intl.routing_number} onChange={(e) => setIntl((x) => ({ ...x, routing_number: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="Your address" className="sm:col-span-2" hint="The address your bank has for you."><Input value={intl.beneficiary_address} onChange={setI('beneficiary_address')} /></Field>
            <Field label="Country of the account"><RegionSelect value={intl.beneficiary_country} onChange={(beneficiary_country) => setIntl((x) => ({ ...x, beneficiary_country }))} /></Field>
          </>
        ) : (
          <>
            <Field label="Bank"><Select value={code} onChange={(e) => setCode(e.target.value)}>{BANKS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
            <Field label="Account number"><Input inputMode="numeric" maxLength={10} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} placeholder={cur ? 'New account number' : '0123456789'} /></Field>
          </>
        )}
        <Field label="Account name" className="sm:col-span-2" hint="Must match your verified ID name."><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {meDto?.two_factor_enabled && <Field label="Authenticator code" hint="Required to change payout details."><Input inputMode="numeric" maxLength={6} value={totp} onChange={(e) => setTotp(e.target.value)} /></Field>}
      </div>
      {needs2fa
        ? <Callout className="mt-5" tone="warn" title="Turn on two-factor login first" action={<Button size="sm" to="/app/settings?tab=privacy">Set up</Button>}>Changing payout details needs a code from an authenticator app, so nobody else can redirect your money.</Callout>
        : <Callout className="mt-5" tone="neutral">Changing bank details holds payouts for 48 hours and sends email + SMS alerts.</Callout>}
      <Button className="mt-5" loading={busy} disabled={needs2fa || !name || (abroad
        ? num.length < 5 || !intl.bank_name.trim() || !intl.beneficiary_address.trim() || !intl.beneficiary_country || !(intl.swift_code.trim() || intl.routing_number.trim())
        : num.length !== 10)} onClick={save}>{cur ? 'Change account' : 'Save account'}</Button>
    </Card>
  )
}

interface Social { verified_creator: boolean; combined_followers: number; threshold: number; accounts: { platform: string; handle: string; followers: number; connected: boolean; under_review: boolean; last_checked_at: string }[] }
const PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X'], ['youtube', 'YouTube'], ['facebook', 'Facebook']] as const

function SocialTab() {
  const res = useApi((s) => api.get<Social>('/verification/social', undefined, s), [])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [followers, setFollowers] = useState(5000)
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const s = res.data
  const connect = async () => {
    setBusy(true)
    try {
      // Real platforms return an OAuth code after login; the local sandbox accepts "<handle>:<followers>".
      await api.post('/verification/social', { platform: connecting, auth_code: `${handle}:${followers}` })
      toast('Account connected'); setConnecting(null); setHandle(''); res.reload()
    } catch (e) { toast('Couldn’t connect', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Connect your accounts" subtitle="Log in to each platform. Screenshots aren’t accepted." />
        <ul className="divide-y divide-line">
          {PLATFORMS.map(([id, name]) => {
            const a = s.accounts.find((x) => x.platform === id)
            return (
              <li key={id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid size-10 place-items-center rounded-xl bg-wash text-[13px] font-extrabold text-ink">{name.slice(0, 2)}</span>
                <div className="flex-1"><div className="text-[14px] font-bold text-ink">{name}</div><div className="text-[12.5px] text-ink-2">{a?.connected ? `@${a.handle} · ${compact(a.followers)} followers · checked ${date(a.last_checked_at)}` : 'Not connected'}</div></div>
                {a?.under_review ? <Badge tone="warn">In review</Badge> : a?.connected ? <Badge tone="success" icon={<Check className="size-3" />}>Connected</Badge> : <Button size="sm" variant="outline" icon={<Link2 className="size-3.5" />} onClick={() => setConnecting(id)}>Connect</Button>}
              </li>
            )
          })}
        </ul>
      </Card>
      <Card className="h-fit p-6">
        <div className="flex items-center gap-2 text-[14px] font-bold text-ink"><BadgeCheck className="size-5 text-brand" />Verified creator</div>
        <div className="mt-3 text-[36px] leading-none font-extrabold tracking-[-0.03em] text-ink num">{compact(s.combined_followers)}</div>
        <div className="text-[13px] text-ink-2">combined followers · {s.threshold.toLocaleString()} needed</div>
        <Progress className="mt-4" value={s.combined_followers} max={s.threshold} tone={s.verified_creator ? 'success' : 'brand'} />
        {s.verified_creator && <Callout className="mt-4" tone="success" icon={<Check />}>You have the Verified creator badge and can receive orders right away. External followers count toward pricing and the 500-follower likeness threshold.</Callout>}
        <p className="mt-4 text-[12px] text-ink-3">Flagged follower counts go to admin review. Connections are rechecked every 90 days; if one drops or you fall below the threshold, new orders pause and active contracts continue.</p>
      </Card>
      <Modal open={!!connecting} onClose={() => setConnecting(null)} size="sm" title={`Connect ${PLATFORMS.find(([i]) => i === connecting)?.[1]}`} subtitle={import.meta.env.DEV ? 'Local sandbox: enter the account you’d log in with.' : 'You’ll be taken to the platform to log in.'}
        footer={<Button loading={busy} disabled={!handle} onClick={connect}>Connect</Button>}>
        <div className="space-y-4">
          <Field label="Handle"><Input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ''))} placeholder="yourhandle" /></Field>
          {import.meta.env.DEV && <Field label="Followers (sandbox)"><Input type="number" value={followers} onChange={(e) => setFollowers(+e.target.value)} /></Field>}
        </div>
      </Modal>
    </div>
  )
}

const CATS = [
  { c: 'media_popularity', label: 'Media popularity', icon: Newspaper, eg: 'Features or interviews in credible outlets' },
  { c: 'position', label: 'Position', icon: Briefcase, eg: 'Founder, CEO or senior executive' },
  { c: 'speaking', label: 'Speaking', icon: Mic2, eg: 'TEDx, keynotes at major conferences' },
  { c: 'recognition', label: 'Recognition', icon: Award, eg: 'Industry awards, notable lists' },
  { c: 'public_work', label: 'Public work', icon: BookOpen, eg: 'Books, notable creative or sporting work' },
] as const
interface Signal { id: string; category: string; title: string; status: 'pending' | 'passed' | 'rejected' | string }

const isLink = (v: string) => /^https:\/\/\S+\.\S+/.test(v.trim())
/** Evidence is an uploaded file (PDF → document, screenshot → image) or an https link. */
const uploadEvidence = (f: File) => upload(f.type.startsWith('image/') ? 'image' : 'document', f)

function SignalRow({ s, onAppeal, appealing }: { s: Signal; onAppeal: () => void; appealing: boolean }) {
  const tone = s.status === 'passed' ? 'text-teal' : s.status === 'rejected' ? 'text-danger' : 'text-warn'
  const label = s.status === 'passed' ? 'verified' : s.status === 'rejected' ? 'not verified' : 'in review'
  return (
    <li className="flex items-center gap-2 text-[12.5px] text-ink-2">
      {s.status === 'passed' ? <Check className="size-3.5 shrink-0 text-teal" /> : s.status === 'rejected' ? <X className="size-3.5 shrink-0 text-danger" /> : <span className="size-1.5 shrink-0 rounded-full bg-warn" />}
      <span className="min-w-0 truncate">{s.title}</span><span className={cn('shrink-0', tone)}>· {label}</span>
      {s.status === 'rejected' && <button disabled={appealing} onClick={onAppeal} className="ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-brand hover:underline disabled:opacity-50"><RotateCcw className="size-3" />Appeal</button>}
    </li>
  )
}

function PublicFigureTab() {
  const { meDto, refreshMe } = useSession()
  const res = useApi((s) => api.get<Signal[]>('/verification/popularity/signals', undefined, s), [])
  const [adding, setAdding] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [file, setFile] = useState<File>()
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [appealing, setAppealing] = useState<string>()
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const level = meDto?.profile?.popularity_level && meDto.profile.popularity_level !== 'none' ? meDto.profile.popularity_level : null
  const levels = ['notable', 'prominent', 'major']
  const close = () => { setAdding(null); setTitle(''); setFile(undefined); setLink(''); setMode('file') }
  const add = async () => {
    setBusy(true)
    try {
      const evidence_ref = mode === 'link' ? link.trim() : await uploadEvidence(file!)
      await api.post('/verification/popularity/signals', { category: adding, title, evidence_ref })
      toast('Evidence submitted', 'An admin checks it against the source within 3 working days.'); close(); res.reload()
    } catch (e) { toast('Couldn’t submit', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const appeal = async (id: string) => {
    setAppealing(id)
    try {
      await api.post(`/verification/popularity/signals/${id}/appeal`)
      toast('Appeal sent', 'A different admin will review this signal again.'); res.reload(); void refreshMe()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'appeal_too_soon') {
        const next = e.details.next_appeal_at as string | undefined
        toast('You can appeal once every 30 days', next ? `Your next appeal is possible from ${date(next)}. You can still add new evidence any time.` : 'You can still add new evidence any time.', 'warn')
      } else toast('Couldn’t appeal', errMsg(e), 'danger')
    } finally { setAppealing(undefined) }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Popularity rating card" subtitle="Submit evidence for each signal. An admin checks every item against its source." />
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {CATS.map(({ c, label, icon: I, eg }) => {
              const items = res.data!.filter((s) => s.category === c)
              return (
                <div key={c} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[13.5px] font-bold text-ink"><I className="size-4 text-brand" />{label}</span><button onClick={() => setAdding(c)} className="text-[12px] font-semibold text-brand hover:underline">Add</button></div>
                  <div className="text-[12px] text-ink-3">{eg}</div>
                  <ul className="mt-2 space-y-1">
                    {items.map((s) => <SignalRow key={s.id} s={s} appealing={appealing === s.id} onAppeal={() => appeal(s.id)} />)}
                  </ul>
                </div>
              )
            })}
          </div>
        </Card>
        <PublicFigureRequest />
      </div>
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-harbor to-[#1b5b8f] p-6 text-white">
            <div className="flex items-center gap-2 text-[13px] font-bold text-white/70"><Crown className="size-4" />Popularity rating</div>
            <div className="mt-2 text-[40px] leading-none font-extrabold tracking-[-0.03em] capitalize">{level ?? '—'}</div>
            <div className="mt-4 flex gap-1.5">{levels.map((l) => <div key={l} className={cn('h-1.5 flex-1 rounded-full', level && levels.indexOf(level) >= levels.indexOf(l) ? 'bg-brand' : 'bg-white/15')} />)}</div>
            <div className="mt-1.5 flex justify-between text-[11px] text-white/60 capitalize">{levels.map((l) => <span key={l}>{l}</span>)}</div>
          </div>
          <div className="p-5 text-[12.5px] text-ink-2">Notable = 1 verified signal · Prominent = 2 · Major = 3+ from at least two categories. <b className="text-ink">Prominent or Major</b> unlocks Verified major person, and you name your own likeness price.</div>
        </Card>
        <Card flat className="p-5 text-[12.5px] text-ink-2">Brands see your level and the verified signals, never your documents. Cards are reviewed every 12 months. If a signal isn’t verified you can appeal once every 30 days for a second review by a different admin, or add new evidence any time.</Card>
      </div>
      <Modal open={!!adding} onClose={close} size="sm" title={`Add evidence · ${CATS.find((x) => x.c === adding)?.label}`}
        footer={<Button loading={busy} disabled={title.trim().length < 3 || (mode === 'link' ? !isLink(link) : !file)} onClick={add}>Submit</Button>}>
        <div className="space-y-4">
          <Field label="What is it?"><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. TEDx Lagos 2025 talk" /></Field>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'file', label: 'Upload proof' }, { value: 'link', label: 'Link' }]} />
          {mode === 'file'
            ? <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-5 text-[13px] text-ink-2 hover:border-brand"><Upload className="size-4" />{file ? file.name : 'Upload proof (PDF or screenshot)'}<input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0])} /></label>
            : <Field label="Link to the source" hint="An https link to the article, talk, award page or listing." error={link && !isLink(link) ? 'Use a full https:// link' : undefined}><Input icon={<Link2 />} type="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></Field>}
        </div>
      </Modal>
    </div>
  )
}

/** ON-07: Verified major person without a popularity card: a well-known name online, or proof sent to our team. */
function PublicFigureRequest() {
  const { meDto } = useSession()
  const [method, setMethod] = useState<'known_name' | 'proof'>('known_name')
  const [links, setLinks] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  if (meDto?.profile?.verified_major_person) {
    return <Callout tone="success" icon={<BadgeCheck />} title="You’re a Verified major person">Brands see the badge on your profile and likeness page.</Callout>
  }
  const urls = links.split(/\s+/).map((l) => l.trim()).filter(Boolean)
  const badLink = urls.find((u) => !isLink(u))
  const count = urls.length + files.length
  const submit = async () => {
    setBusy(true)
    try {
      const refs = await Promise.all(files.map(uploadEvidence))
      await api.post('/verification/public-figure', { method, evidence: [...urls, ...refs] })
      toast('Request sent', 'Our team reviews it and lets you know the result.'); setSent(true); setLinks(''); setFiles([])
    } catch (e) {
      if (e instanceof ApiError && e.code === 'request_pending') { setSent(true); toast('Already under review', 'You already have a request with our team.', 'warn') }
      else toast('Couldn’t send', errMsg(e), 'danger')
    } finally { setBusy(false) }
  }
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-bold text-ink">Request Verified major person without a card</h3>
      <p className="mt-1 text-[13px] text-ink-2">If you’re widely known by name, or can prove who you are another way, our team can verify you directly.</p>
      {sent ? (
        <Callout className="mt-4" tone="brand" icon={<Clock />} title="With our team">Your request is being reviewed. We’ll notify you of the result.</Callout>
      ) : (
        <div className="mt-4 space-y-4">
          <Segmented size="sm" value={method} onChange={setMethod} options={[{ value: 'known_name', label: 'My name is well known' }, { value: 'proof', label: 'I have proof' }]} />
          <Field label={method === 'known_name' ? 'Links that show who you are' : 'Links to your proof'} optional={files.length > 0}
            hint={method === 'known_name' ? 'e.g. a Wikipedia page, news coverage or an official site. One https link per line.' : 'One https link per line, or upload documents below.'}
            error={badLink ? `Not an https link: ${badLink}` : undefined}>
            <Textarea className="min-h-20" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://" />
          </Field>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-4 text-[13px] text-ink-2 hover:border-brand">
            <Upload className="size-4" />{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} chosen` : 'Upload documents (PDF, images)'}
            <input type="file" multiple accept="image/*,.pdf" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 20))} />
          </label>
          <Button loading={busy} disabled={!count || count > 20 || !!badLink} onClick={submit}>Send for review</Button>
        </div>
      )}
    </Card>
  )
}
