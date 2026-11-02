import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Camera, Check, ChevronRight, Download, FileUp, HelpCircle, ImagePlus, KeyRound, Lock, Paperclip, Phone, Plus, Search, Send, ShieldCheck, Ticket, Trash2, X } from 'lucide-react'
import { api, ApiError, errMsg } from '@/api/client'
import { useApi, usePaged } from '@/api/hooks'
import { useSession } from '@/context/session'
import { date, dateTime, naira, usd } from '@/lib/format'
import { NICHES } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Callout, Card, CardHeader, Field, Input, Modal, PageHeader, Segmented, Select, Switch, Tabs, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { OtpInput } from '@/pages/auth/Signup'
import { RegionSelect } from '@/components/ui/RegionPicker'

type Tab = 'profile' | 'media' | 'notifications' | 'privacy' | 'payments' | 'blocked' | 'delete'
export default function Settings() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'profile')
  // Links such as ?tab=payments (sidebar) or ?tab=privacy (phone, two-factor) switch tabs while already on this page.
  useEffect(() => { const t = params.get('tab') as Tab | null; if (t) setTab(t) }, [params])
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'profile', label: 'Profile' }, { value: 'media', label: 'Feed & videos' }, { value: 'notifications', label: 'Notifications' }, { value: 'privacy', label: 'Privacy & security' }, { value: 'payments', label: 'Payments' }, { value: 'blocked', label: 'Blocked' }, { value: 'delete', label: 'Delete account' }]} />
      <div className="mt-6">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'media' && <MediaTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'privacy' && <PrivacyTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'blocked' && <BlockedTab />}
        {tab === 'delete' && <DeleteTab />}
      </div>
    </div>
  )
}

function ProfileTab() {
  const { me, meDto, refreshMe } = useSession()
  const p = meDto?.profile
  const [form, setForm] = useState({ name: '', bio: '', location: '', region: '', primary_niche: '', links: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (p) setForm({ name: p.name, bio: p.bio ?? '', location: p.location ?? '', region: meDto?.region ?? '', primary_niche: p.primary_niche ?? '', links: p.links.join('\n') })
  }, [p, meDto?.region])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async () => {
    setBusy(true)
    try {
      await api.patch('/accounts/me/profile', {
        name: form.name, bio: form.bio, location: form.location, region: form.region, primary_niche: form.primary_niche || null,
        links: form.links.split(/\s+/).filter(Boolean),
      })
      toast('Profile saved'); void refreshMe()
    } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const photo = async (f?: File) => {
    if (!f) return
    try {
      const form = new FormData(); form.append('kind', 'image'); form.append('file', f)
      const up = await api.upload<{ ref: string }>('/uploads', form)
      await api.patch('/accounts/me/profile', { photo: up.ref })
      toast('Photo updated'); void refreshMe()
    } catch (e) { toast('Couldn’t update photo', errMsg(e), 'danger') }
  }
  if (!meDto) return <Spinner />
  if (meDto.type === 'company') return <Callout tone="neutral" title="Company profile" action={<Button size="sm" to="/app/company/settings">Company settings</Button>}>Edit your company details, website and messaging in Company settings.</Callout>
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer"><Avatar src={me.avatar} name={me.name} kind={me.kind} size="xl" /><span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-brand text-white ring-4 ring-surface"><Camera className="size-4" /></span><input type="file" accept="image/*" className="sr-only" onChange={(e) => photo(e.target.files?.[0])} /></label>
        <div><div className="text-[18px] font-extrabold text-ink">{me.name}</div><div className="text-[13px] text-ink-2">@{me.handle}</div></div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Display name"><Input value={form.name} onChange={set('name')} /></Field>
        <Field label="Verified name" hint="Changes only through a new ID check."><Input value={p?.verified_name ?? 'Not verified yet'} disabled icon={<Lock />} /></Field>
        <Field label="Bio" className="sm:col-span-2"><Textarea value={form.bio} onChange={set('bio')} maxLength={2000} /></Field>
        <Field label="Primary niche" hint="Changing niche doesn’t affect active contracts."><Select value={form.primary_niche} onChange={set('primary_niche')}><option value="">—</option>{NICHES.map((n) => <option key={n} value={n.toLowerCase()}>{n}</option>)}</Select></Field>
        <Field label="Location" hint="Shown on your profile, e.g. your city."><Input value={form.location} onChange={set('location')} /></Field>
        <Field label="Country" hint="Brands targeting your country see you first."><RegionSelect value={form.region} onChange={(region) => setForm((f) => ({ ...f, region }))} /></Field>
        <Field label="Links" className="sm:col-span-2" hint="One per line, up to 10."><Textarea value={form.links} onChange={set('links')} className="min-h-20" /></Field>
      </div>
      <Button className="mt-6" loading={busy} onClick={save}>Save changes</Button>
    </Card>
  )
}

const OPTIONAL = [['like', 'Likes'], ['comment', 'Comments'], ['message', 'Messages', 'New chats and replies'], ['profile_view', 'Profile views', 'e.g. “A company in Beauty viewed your likeness page”'], ['post_ideas', 'Post ideas'], ['follow', 'New followers']] as const

/** GET /accounts/me now carries these on the profile; declared here until the shared MeDto type has them. */
type NotifyProfile = { notification_prefs?: Record<string, boolean>; daily_digest?: boolean }
interface PrefsDto { optional: Record<string, boolean>; daily_digest: boolean; always_on: string[] }

function NotificationsTab() {
  const { meDto, refreshMe } = useSession()
  const saved = meDto?.profile as NotifyProfile | undefined
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => ({ like: true, comment: true, message: true, profile_view: true, post_ideas: true, follow: true, ...saved?.notification_prefs }))
  const [digest, setDigest] = useState(saved?.daily_digest ?? false)
  // Take the saved values once they've loaded, but don't overwrite toggles made since.
  const inited = useRef(!!saved?.notification_prefs)
  useEffect(() => {
    if (inited.current || !saved?.notification_prefs) return
    inited.current = true
    setPrefs((p) => ({ ...p, ...saved.notification_prefs })); setDigest(saved.daily_digest ?? false)
  }, [saved])
  const save = async (next: Record<string, boolean>, d: boolean) => {
    const before = { prefs, digest }
    setPrefs(next); setDigest(d); inited.current = true
    try {
      const r = await api.put<PrefsDto>('/notifications/preferences', { preferences: next, daily_digest: d })
      setPrefs((p) => ({ ...p, ...r.optional })); setDigest(r.daily_digest)
      void refreshMe() // keep the session's copy current for the next visit
    } catch (e) { setPrefs(before.prefs); setDigest(before.digest); toast('Couldn’t save', errMsg(e), 'danger') }
  }
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="mb-1 text-[15px] font-bold text-ink">Always on</h3>
        <p className="mb-3 text-[13px] text-ink-2">Payments, contracts, disputes, security and legal notices can’t be turned off.</p>
        <div className="flex flex-wrap gap-2">{['Payments', 'Contracts', 'Disputes', 'Security', 'Legal'].map((t) => <Badge key={t} tone="neutral" icon={<Lock className="size-3" />}>{t}</Badge>)}</div>
      </Card>
      <Card className="divide-y divide-line px-5">
        {OPTIONAL.map(([k, label, desc]) => <Switch key={k} checked={prefs[k] ?? true} onChange={(v) => save({ ...prefs, [k]: v }, digest)} label={label} description={desc} />)}
        <Switch checked={digest} onChange={(v) => save(prefs, v)} label="Daily digest instead" description="One summary email a day for the optional types above." />
      </Card>
    </div>
  )
}

function MediaTab() {
  const { autoplay, setAutoplay, feed, setFeed } = useSession()
  return (
    <Card className="divide-y divide-line px-5">
      <Switch checked={autoplay} onChange={(v) => { setAutoplay(v); toast(v ? 'Videos will play by themselves' : 'Autoplay is off') }} label="Autoplay videos"
        description="Videos start playing, muted, when you scroll to them or hover over them, and pause when you move on. Saved on this device. Leave it off to save data." />
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <div><div className="text-sm font-semibold text-ink">Feed you open on</div><div className="text-[13px] text-ink-2">Remembered on all your devices.</div></div>
        <Segmented size="sm" value={feed} onChange={setFeed} options={[{ value: 'people', label: 'People' }, { value: 'agents', label: 'Agents' }]} />
      </div>
    </Card>
  )
}

function PrivacyTab() {
  const { meDto, refreshMe, sponsoredCardsOff, setSponsoredCardsOff, agentComments, setAgentComments } = useSession()
  const [receipts, setReceipts] = useState(meDto?.profile?.read_receipts ?? true)
  const [typing, setTyping] = useState(meDto?.profile?.typing_indicators ?? true)
  const [twofa, setTwofa] = useState<null | { secret: string; otpauth_url?: string }>(null)
  const [code, setCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [busy, setBusy] = useState(false)
  const patch = async (body: Record<string, boolean>) => { try { await api.patch('/accounts/me/settings', body) } catch (e) { toast('Couldn’t save', errMsg(e), 'danger') } }
  const enabled = meDto?.two_factor_enabled

  const start2fa = async () => {
    try { setTwofa(await api.post<{ secret: string; otpauth_url?: string }>('/auth/2fa/setup')) } catch (e) { toast('Couldn’t start setup', errMsg(e), 'danger') }
  }
  const finish = async (path: '/auth/2fa/enable' | '/auth/2fa/disable') => {
    setBusy(true)
    try { await api.post(path, { code }); toast(path.endsWith('enable') ? 'Two-factor login is on' : 'Two-factor login is off'); setTwofa(null); setDisabling(false); setCode(''); void refreshMe() } catch (e) { toast('That code didn’t work', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const exportData = async () => {
    try {
      const data = await api.get<unknown>('/accounts/me/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = `wamiwa-${meDto?.handle}-data.json`; a.click(); URL.revokeObjectURL(url)
    } catch (e) { toast('Couldn’t export', errMsg(e), 'danger') }
  }

  return (
    <div className="space-y-6">
      <Card className="divide-y divide-line px-5">
        <Switch checked={sponsoredCardsOff} onChange={setSponsoredCardsOff} label="Turn off sponsored cards on my posts and comments" description="Paying names you mention won’t become smart mention cards." />
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div><div className="text-sm font-semibold text-ink">Agent comments on my posts</div><div className="text-[13px] text-ink-2">Also applies to Wamiwa Agent replies.</div></div>
          <Segmented size="sm" value={agentComments} onChange={setAgentComments} options={[{ value: 'all', label: 'All' }, { value: 'following', label: 'Followed' }, { value: 'none', label: 'Off' }]} />
        </div>
        <Switch checked={receipts} onChange={(v) => { setReceipts(v); void patch({ read_receipts: v }) }} label="Read receipts" />
        <Switch checked={typing} onChange={(v) => { setTyping(v); void patch({ typing_indicators: v }) }} label="Typing indicators" />
      </Card>
      <PhoneCard />
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <KeyRound className="size-5 text-brand" />
        <div className="flex-1"><div className="font-bold text-ink">Two-factor login</div><div className="text-[13px] text-ink-2">{enabled ? 'On. You’ll be asked for a code from your authenticator app.' : 'Required to change payout details.'}</div></div>
        {enabled ? <Button variant="outline" onClick={() => setDisabling(true)}>Turn off</Button> : <Button onClick={start2fa}>Set up</Button>}
      </Card>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Download className="size-5 text-brand" />
        <div className="flex-1"><div className="font-bold text-ink">Download your data</div><div className="text-[13px] text-ink-2">Under the Nigeria Data Protection Act 2023 you can download and delete your data.</div></div>
        <Button variant="outline" onClick={exportData}>Download</Button>
      </Card>
      <Modal open={!!twofa} onClose={() => setTwofa(null)} size="sm" title="Set up two-factor login" subtitle="Add this key to an authenticator app, then enter the 6-digit code it shows." footer={<Button loading={busy} disabled={code.length < 6} onClick={() => finish('/auth/2fa/enable')}>Turn on</Button>}>
        <div className="rounded-2xl bg-surface-2 p-4 text-center font-mono text-[15px] font-bold tracking-wider break-all text-ink select-all">{twofa?.secret}</div>
        {twofa?.otpauth_url && <p className="mt-2 text-center text-[12.5px] text-ink-2">On your phone? <a href={twofa.otpauth_url} className="link">Open in authenticator app</a></p>}
        <div className="mt-4"><OtpInput value={code} onChange={setCode} /></div>
      </Modal>
      <Modal open={disabling} onClose={() => setDisabling(false)} size="sm" title="Turn off two-factor login" subtitle="Enter a code from your authenticator app." footer={<Button variant="danger" loading={busy} disabled={code.length < 6} onClick={() => finish('/auth/2fa/disable')}>Turn off</Button>}>
        <OtpInput value={code} onChange={setCode} />
      </Modal>
    </div>
  )
}

/** ON-04: a phone number is used for payouts, recovery and guardian confirmation calls once verified by SMS. */
function PhoneCard() {
  const { meDto, refreshMe } = useSession()
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const verified = !!meDto?.phone && meDto.phone_verified
  const open = editing || !verified
  const reset = () => { setEditing(false); setSent(false); setPhone(''); setCode(''); setError(undefined) }
  const send = async () => {
    setBusy(true); setError(undefined)
    try { await api.post('/accounts/me/phone', { phone: phone.replace(/[\s()-]/g, '') }); setSent(true); setCode('') } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  const verify = async () => {
    setBusy(true); setError(undefined)
    try {
      await api.post('/accounts/me/phone/verify', { code })
      toast('Phone verified'); reset(); void refreshMe()
    } catch (e) {
      setCode('')
      if (e instanceof ApiError && e.code === 'otp_incorrect') setError(`That code isn’t right.${typeof e.details.attempts_left === 'number' ? ` ${e.details.attempts_left} tries left.` : ''}`)
      else if (e instanceof ApiError && (e.code === 'otp_expired' || e.code === 'no_pending_phone')) { setError('That code has expired. Send a new one.'); setSent(false) }
      else if (e instanceof ApiError && e.code === 'otp_locked') setError('Too many wrong codes. Wait 15 minutes, then send a new code.')
      else setError(errMsg(e))
    } finally { setBusy(false) }
  }
  return (
    <Card id="phone" className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Phone className="size-5 text-brand" />
        <div className="flex-1">
          <div className="font-bold text-ink">Phone number</div>
          <div className="text-[13px] text-ink-2">{verified ? <>{meDto!.phone} <Badge tone="success" icon={<Check className="size-3" />}>Verified</Badge></> : 'Needed for payouts, account recovery and guardian confirmation calls.'}</div>
        </div>
        {verified && !editing && <Button variant="outline" onClick={() => setEditing(true)}>Change</Button>}
        {verified && editing && <Button variant="ghost" icon={<X className="size-4" />} onClick={reset}>Cancel</Button>}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          {!sent ? (
            <div className="flex flex-wrap gap-2">
              <div className="min-w-56 flex-1"><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+234 801 234 5678" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <Button loading={busy} disabled={phone.replace(/\D/g, '').length < 7} onClick={send}>Send SMS code</Button>
            </div>
          ) : (
            <>
              <div className="text-[13px] text-ink-2">Enter the 6-digit code we texted to {phone}. <button type="button" className="link" onClick={() => { setSent(false); setError(undefined) }}>Change number</button></div>
              <OtpInput value={code} onChange={setCode} />
              <div className="flex gap-2"><Button loading={busy} disabled={code.length < 6} onClick={verify}>Verify phone</Button><Button variant="ghost" disabled={busy} onClick={send}>Send a new code</Button></div>
            </>
          )}
          {error && <Callout tone="danger">{error}</Callout>}
        </div>
      )}
    </Card>
  )
}

interface PaymentDto { id: string; purpose: string; amount_cents: number; amount_local: number; currency: string; status: string; refunded_local: number; created_at: string }
const PURPOSE: Record<string, string> = {
  escrow: 'Escrow for a hire', subscription: 'Subscription', ai_video: 'AI video', ai_video_plan: 'AI video plan', video_production: 'Video production',
  video_plan: 'Video plan', extra_render: 'Extra final render', arcon_filing: 'ARCON filing', promotion: 'Wamiwa Agent', equity_fee: 'Equity deal fee',
}

/** Everything this account has paid for, with refunds (GET /payments works for every account type). */
function PaymentsTab() {
  const list = usePaged((cursor, signal) => api.page<PaymentDto>('/payments', { cursor, limit: 25 }, signal), (p: PaymentDto) => p, [])
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (list.loading && !list.items.length) return <Spinner />
  return (
    <Card>
      <CardHeader title="Payments & refunds" subtitle="Charged in Naira at the day’s rate. Escrow for each hire is shown on the contract." />
      <ul className="mt-2 divide-y divide-line">
        {list.items.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-[13.5px]">
            <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{PURPOSE[p.purpose] ?? p.purpose.replace(/_/g, ' ')}</div><div className="text-[12px] text-ink-3">{date(p.created_at)}</div></div>
            <div className="text-right"><div className="font-bold text-ink num">{naira(p.amount_local)}</div><div className="text-[12px] text-ink-3 num">{usd(p.amount_cents / 100)}</div></div>
            <Badge tone={p.refunded_local ? 'warn' : p.status === 'succeeded' ? 'success' : 'neutral'}>{p.refunded_local ? `Refunded ${naira(p.refunded_local)}` : p.status.replace(/_/g, ' ')}</Badge>
          </li>
        ))}
        {list.items.length === 0 && <li className="px-5 py-10 text-center text-[13.5px] text-ink-2">No payments yet.</li>}
      </ul>
      <div className="pb-4"><LoadMore show={list.hasMore} loading={list.loadingMore} onClick={() => void list.more()} /></div>
    </Card>
  )
}

function BlockedTab() {
  const { toggleBlock } = useSession()
  const res = useApi((s) => api.get<{ id: string; handle: string; type: string; blocked_at: string }[]>('/blocks', undefined, s), [])
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  return (
    <Card>
      <CardHeader title="Blocked accounts" subtitle="They can’t message you, comment on your posts, tag you or view your profile. Blocking a company stops its offers. Active contracts continue." />
      <ul className="mt-3 divide-y divide-line">
        {(res.data ?? []).map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-5 py-3.5"><Avatar name={b.handle} kind={b.type === 'company' ? 'company' : b.type === 'agent' ? 'agent' : 'human'} size="sm" /><span className="flex-1 font-semibold text-ink">@{b.handle}<span className="block text-[12px] font-normal text-ink-3">Blocked {date(b.blocked_at)}</span></span><Button size="sm" variant="outline" onClick={() => { toggleBlock(b.id, false); setTimeout(res.reload, 400) }}>Unblock</Button></li>
        ))}
        {res.data && res.data.length === 0 && <li className="px-5 py-10 text-center text-[13.5px] text-ink-2">You haven’t blocked anyone. Block from any profile, post, comment or chat.</li>}
      </ul>
    </Card>
  )
}

interface Deletion { blockers: { code: string; message: string }[]; status: string; delete_on?: string | null }

function DeleteTab() {
  const res = useApi((s) => api.get<Deletion>('/accounts/me/deletion', undefined, s), [])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!res.data) return <Spinner />
  const d = res.data
  const scheduled = d.status === 'pending_deletion'
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); toast(msg); setConfirm(false); res.reload() } catch (e) { toast('Couldn’t update', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      {scheduled ? (
        <Callout tone="warn" icon={<AlertTriangle />} title={`Account will be deleted${d.delete_on ? ` on ${date(d.delete_on)}` : ' in 30 days'}`} action={<Button size="sm" variant="outline" loading={busy} onClick={() => run(() => api.del('/accounts/me/deletion'), 'Deletion cancelled')}>Cancel deletion</Button>}>You can cancel any time during the 30-day grace period.</Callout>
      ) : (
        <Card className="p-6">
          <h3 className="text-[16px] font-bold text-ink">Delete my account</h3>
          <p className="mt-1 text-[13.5px] text-ink-2">After a 30-day grace period, your personal data, photos and voice samples are deleted. Financial records are kept as the law requires.</p>
          {d.blockers.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[13px] font-bold text-danger">Fix these first</div>
              {d.blockers.map((b) => <div key={b.code} className="flex gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" /><div className="text-[13.5px] font-bold text-ink">{b.message}</div></div>)}
            </div>
          )}
          <Button className="mt-6" variant="danger" icon={<Trash2 className="size-4" />} disabled={d.blockers.length > 0} onClick={() => setConfirm(true)}>Delete account</Button>
        </Card>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} size="sm" title="Delete your account?" footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Keep account</Button><Button variant="danger" loading={busy} onClick={() => run(() => api.post('/accounts/me/deletion'), 'Deletion scheduled')}>Start 30-day deletion</Button></>}>
        <p className="text-[14px] text-ink-2">You can cancel within 30 days by logging in.</p>
      </Modal>
    </div>
  )
}

/* ── SP-01 / SP-02 Support ──────────────────────────────────────────────── */

const ticketStatus = (s: string) => (s === 'waiting_on_me' ? 'waiting on you' : s.replace(/_/g, ' '))

interface TicketDto { id: string; number: string; category: string; subject: string; status: string; first_response_due_at: string; created_at: string; messages?: { from_staff: boolean; body: string; attachments?: string[]; at: string }[] }
const CATEGORIES = [['account', 'Account'], ['payments', 'Payments'], ['contracts', 'Contracts'], ['verification', 'Verification'], ['report_a_problem', 'Report a problem'], ['other', 'Other']] as const

export function Support() {
  const { role } = useSession()
  const help = useApi((s) => api.get<{ faq: { q: string; a: string }[] }>('/support/help-centre', undefined, s), [])
  const tickets = useApi((s) => api.page<TicketDto>('/support/tickets', { limit: 20 }, s), [])
  const [q, setQ] = useState('')
  const [faq, setFaq] = useState<number | null>(0)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [form, setForm] = useState({ category: 'account', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true)
    try {
      const t = await api.post<TicketDto>('/support/tickets', { ...form, attachments: [] })
      toast(`Ticket ${t.number} created`, 'We’ve emailed you a confirmation.'); setOpen(false); setForm({ category: 'account', subject: '', body: '' }); tickets.reload()
    } catch (e) { toast('Couldn’t create ticket', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  const faqs = (help.data?.faq ?? []).filter((f) => !q || (f.q + f.a).toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-10 rounded-[28px] bg-harbor px-6 py-12 text-center text-white">
        <h1 className="display text-[40px] sm:text-[52px]">How can we help?</h1>
        <div className="mx-auto mt-6 max-w-xl"><Input icon={<Search />} placeholder="Search help articles" value={q} onChange={(e) => setQ(e.target.value)} className="h-14 rounded-pill border-0 text-[15px]" /></div>
        <p className="mt-5 text-[13.5px] text-white/70">Read our <Link to="/terms" className="font-semibold text-white underline underline-offset-2">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-white underline underline-offset-2">Privacy Policy</Link>.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Common questions" />
          {help.error ? <ErrorState compact error={help.error} onRetry={help.reload} /> : (
            <ul className="mt-2 divide-y divide-line">
              {faqs.map((f, i) => (
                <li key={f.q}>
                  <button onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left"><HelpCircle className="size-4 shrink-0 text-brand" /><span className="flex-1 text-[14.5px] font-semibold text-ink">{f.q}</span><ChevronRight className={cn('size-4 text-ink-3 transition', faq === i && 'rotate-90')} /></button>
                  {faq === i && <p className="px-12 pb-4 text-[14px] text-ink-2">{f.a}</p>}
                </li>
              ))}
              {help.data && faqs.length === 0 && <li className="px-5 py-8 text-center text-[13.5px] text-ink-2">No articles match. Contact support below.</li>}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between"><h3 className="font-bold text-ink">Your tickets</h3><Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Contact support</Button></div>
            <ul className="mt-4 space-y-2">
              {(tickets.data?.data ?? []).map((t) => (
                <li key={t.id}>
                  <button onClick={() => setView(t.id)} className="w-full rounded-2xl border border-line p-3 text-left hover:bg-surface-2">
                    <div className="flex items-center justify-between"><span className="font-mono text-[12px] text-ink-3">{t.number}</span><Badge tone={t.status === 'resolved' ? 'success' : t.status === 'waiting_on_me' ? 'warn' : 'brand'}>{ticketStatus(t.status)}</Badge></div>
                    <div className="mt-1 text-[14px] font-bold text-ink">{t.subject}</div>
                    <div className="text-[12px] text-ink-2">{CATEGORIES.find(([c]) => c === t.category)?.[1]} · {date(t.created_at)}</div>
                  </button>
                </li>
              ))}
              {tickets.data && tickets.data.data.length === 0 && <li className="text-[13px] text-ink-2">No tickets yet.</li>}
            </ul>
          </Card>
          <Callout tone="neutral" icon={<ShieldCheck />}>First response within 24 hours. Payment and safety issues: within 4 hours.{role === 'guardian' && ' Guardians can open tickets for their minors, including asking for a confirmation call.'}</Callout>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Contact support" footer={<Button icon={<Ticket className="size-4" />} loading={busy} disabled={form.subject.length < 3 || form.body.length < 5} onClick={create}>Send</Button>}>
        <div className="space-y-4">
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Subject"><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></Field>
          <Field label="What’s going on?"><Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></Field>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3"><FileUp className="size-3.5" />You can add screenshots in a reply once the ticket is open.</p>
        </div>
      </Modal>
      {view && <TicketView id={view} onClose={() => { setView(null); tickets.reload() }} />}
    </div>
  )
}

function TicketView({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useApi((s) => api.get<TicketDto>(`/support/tickets/${id}`, undefined, s), [id])
  const [reply, setReply] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!reply.trim() || busy) return
    setBusy(true)
    try {
      // Screenshots are uploaded first; the reply carries their refs (up to 5).
      const attachments = await Promise.all(files.map(async (f) => {
        const form = new FormData(); form.append('kind', 'image'); form.append('file', f)
        return (await api.upload<{ ref: string }>('/uploads', form)).ref
      }))
      await api.post(`/support/tickets/${id}/replies`, { body: reply, attachments })
      setReply(''); setFiles([]); t.reload()
    } catch (e) { toast('Not sent', errMsg(e), 'danger') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={t.data?.subject ?? 'Ticket'} subtitle={t.data ? `${t.data.number} · ${ticketStatus(t.data.status)}` : undefined}>
      {!t.data ? <Spinner className="min-h-32" /> : (
        <>
          <div className="space-y-3">
            {(t.data.messages ?? []).map((m, i) => (
              <div key={i} className={cn('rounded-2xl p-3 text-[14px]', m.from_staff ? 'bg-brand-soft text-ink' : 'bg-surface-2 text-ink')}>
                <div className="mb-1 text-[11.5px] font-bold text-ink-2">{m.from_staff ? 'Wamiwa support' : 'You'} · {dateTime(m.at)}</div>
                <span className="whitespace-pre-wrap">{m.body}</span>
                {!!m.attachments?.length && <div className="mt-1.5 flex items-center gap-1 text-[12px] text-ink-2"><Paperclip className="size-3.5" />{m.attachments.length} {m.attachments.length === 1 ? 'screenshot' : 'screenshots'} attached</div>}
              </div>
            ))}
          </div>
          {t.data.status !== 'resolved' && (
            <div className="mt-4">
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {files.map((f, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-2.5 text-[12px] text-ink-2">{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="grid size-5 place-items-center rounded-full hover:bg-wash"><X className="size-3" /></button></span>)}
                </div>
              )}
              <div className="flex gap-2">
                <label className={cn('grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-line text-ink-2 hover:bg-wash', files.length >= 5 && 'pointer-events-none opacity-40')} aria-label="Attach screenshots" title="Attach screenshots (up to 5)">
                  <ImagePlus className="size-4" />
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const picked = Array.from(e.target.files ?? []); setFiles((x) => [...x, ...picked].slice(0, 5)); e.target.value = '' }} />
                </label>
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reply && send()} className="h-10 flex-1 rounded-full border border-line px-4 text-[14px] focus:border-brand focus:outline-none" placeholder="Reply…" />
                <button onClick={send} disabled={!reply.trim() || busy} className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40" aria-label="Send"><Send className="size-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
