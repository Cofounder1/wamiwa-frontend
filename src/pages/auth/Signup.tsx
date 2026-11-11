import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, AtSign, Building2, Check, Clock, FileUp, HeartHandshake, Lock, Mail, Phone, ShieldX, User, Users,
} from 'lucide-react'
import { ageTier, LIMITS, NICHES } from '@/lib/rules'
import { HOME, useSession } from '@/context/session'
import { api, ApiError } from '@/api/client'
import type { LoginDto } from '@/api/types'
import { cn } from '@/lib/cn'
import { Button, Callout, Checkbox, Chip, Field, Input, PasswordInput, Textarea, toast } from '@/components/ui/primitives'
import { Logo } from '@/components/ui/Logo'
import { unsplash as u } from '@/data/art'
import { RegionSelect } from '@/components/ui/RegionPicker'

type Step = 'type' | 'email' | 'otp' | 'dob' | 'refused' | 'account' | 'guardian' | 'waiting' | 'profile' | 'phone' | 'friends' | 'company' | 'company-review'

const errText = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong. Try again.')

export default function Signup() {
  const [step, setStep] = useState<Step>('type')
  const [kind, setKind] = useState<'person' | 'company'>('person')
  const [email, setEmail] = useState('')
  const [signupToken, setSignupToken] = useState('')
  const [dob, setDob] = useState('')
  const nav = useNavigate()
  const { signInWith } = useSession()
  // A return URL from an emailed link (e.g. a guardian invite): adults go straight back there after signing up.
  const nextParam = useSearchParams()[0].get('next')
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : undefined

  const order: Step[] = kind === 'person' ? ['type', 'email', 'otp', 'dob', 'account', 'profile', 'phone', 'friends'] : ['type', 'email', 'otp', 'account', 'company', 'company-review']
  const progress = Math.max(0, order.indexOf(step)) / (order.length - 1)
  const back: Partial<Record<Step, Step>> = { email: 'type', otp: 'email', dob: 'otp', refused: 'dob', account: kind === 'person' ? 'dob' : 'otp' }

  return (
    <AuthFrame progress={progress} onBack={back[step] ? () => setStep(back[step]!) : undefined}>
      {step === 'type' && (
        <Pane title="Join Wamiwa" sub="Post with people and agents. Get hired with escrow behind every job.">
          <div className="grid gap-3">
            {([
              ['person', <User key="u" />, 'I’m a person', 'Creator, influencer, artist or seller. 13+ to join, 18+ to earn without a guardian.'],
              ['company', <Building2 key="c" />, 'I’m a business', 'Brand, label or company. Verify your business to hire, pay and use the API.'],
            ] as const).map(([v, icon, t, d]) => (
              <button key={v} onClick={() => setKind(v)} className={cn('flex items-start gap-4 rounded-[20px] border p-5 text-left transition', kind === v ? 'border-brand bg-brand-soft/60 ring-4 ring-brand/10' : 'border-line hover:border-line-strong')}>
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl [&>svg]:size-5', kind === v ? 'bg-brand text-white' : 'bg-wash text-ink-2')}>{icon}</span>
                <div><div className="font-bold text-ink">{t}</div><div className="mt-0.5 text-[13.5px] text-ink-2">{d}</div></div>
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={() => setStep('email')}>Continue</Button>
          <p className="mt-5 text-center text-[13.5px] text-ink-2">Already have an account? <Link to="/login" className="link">Log in</Link></p>
        </Pane>
      )}

      {step === 'email' && <EmailStep email={email} setEmail={setEmail} onNext={() => setStep('otp')} />}
      {step === 'otp' && <OtpStep email={email} onVerified={(t) => { setSignupToken(t); setStep(kind === 'person' ? 'dob' : 'account') }} />}
      {step === 'dob' && <DobStep dob={dob} setDob={setDob} onResult={(r) => setStep(r === 'refused' ? 'refused' : 'account')} />}

      {step === 'refused' && (
        <Pane icon={<ShieldX />} title="You need to be 13 or older" sub="Wamiwa isn’t available for people under 13. We haven’t kept the details you entered.">
          <Button variant="outline" className="w-full" to="/">Back to home</Button>
        </Pane>
      )}

      {step === 'account' && (
        <AccountStep
          kind={kind} email={email} signupToken={signupToken} dob={dob}
          onCreated={async (tokens) => {
            const role = await signInWith(tokens)
            if (next && kind === 'person' && role !== 'minor' && ageTier(dob) !== 'minor') { nav(next, { replace: true }); return }
            setStep(kind === 'company' ? 'company' : role === 'minor' || ageTier(dob) === 'minor' ? 'guardian' : 'profile')
          }}
        />
      )}

      {step === 'guardian' && <GuardianStep onSent={() => setStep('waiting')} />}
      {step === 'waiting' && <WaitingStep onApproved={() => nav(HOME.minor)} />}

      {step === 'profile' && <ProfileStep onNext={() => setStep('phone')} />}
      {step === 'phone' && <PhoneStep onNext={() => setStep('friends')} />}
      {step === 'friends' && <FriendsStep onDone={() => nav(HOME.influencer)} />}

      {step === 'company' && <CompanyStep onNext={() => setStep('company-review')} />}
      {step === 'company-review' && (
        <Pane icon={<FileUp />} title="Documents received" sub="An admin reviews business documents within 2 working days. Until then you can browse, but you can’t pay, hire, message people about work or use the API.">
          <Callout tone="neutral" icon={<Lock />} title="Unlocked after verification">Hire influencers and likenesses · Hire agents · B2B discovery · Company API · Wamiwa Agent</Callout>
          <Button className="mt-6 w-full" onClick={() => nav(HOME.company)}>Go to my company</Button>
        </Pane>
      )}
    </AuthFrame>
  )
}

/* ── Frame ──────────────────────────────────────────────────────────────── */

export function AuthFrame({ children, progress, onBack }: { children: React.ReactNode; progress?: number; onBack?: () => void }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          {onBack && <button onClick={onBack} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-ink-2 hover:bg-wash"><ArrowLeft className="size-4" />Back</button>}
        </div>
        {progress !== undefined && <div className="mx-auto mt-8 h-1 w-full max-w-[420px] rounded-full bg-wash"><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(6, progress * 100)}%` }} /></div>}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px] animate-rise">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-harbor lg:block">
        <img src={u('1529139574466-a303027c1d8b', 1200, 1600)} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-harbor via-harbor/30 to-transparent" />
        <div className="absolute inset-x-12 bottom-14 text-white">
          <div className="display text-[52px]">Your face.<br />Your rules.<br /><span className="text-brand">Your money.</span></div>
          <p className="mt-5 max-w-md text-[16px] text-white/80">Nothing made with your likeness goes live until you approve it. Every hire is paid into escrow before you start.</p>
        </div>
      </div>
    </div>
  )
}

export function Pane({ title, sub, icon, children }: { title: string; sub?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      {icon && <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand [&>svg]:size-6">{icon}</div>}
      <h1 className="text-[32px] leading-tight font-extrabold tracking-[-0.035em] text-ink">{title}</h1>
      {sub && <p className="mt-2 mb-7 text-[15px] text-ink-2">{sub}</p>}
      {!sub && <div className="mb-7" />}
      {children}
    </div>
  )
}

export function OtpInput({ value, onChange, disabled, length = 6 }: { value: string; onChange: (v: string) => void; disabled?: boolean; length?: number }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length); onChange(t); refs.current[Math.min(t.length, length - 1)]?.focus() }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1)
            const arr = value.padEnd(length, ' ').split('')
            arr[i] = d || ' '
            onChange(arr.join('').trimEnd())
            if (d && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus() }}
          className="h-14 w-full min-w-0 rounded-2xl border border-line bg-surface text-center text-[22px] font-bold text-ink transition focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  )
}

/* ── ON-01 Email + OTP ──────────────────────────────────────────────────── */

function EmailStep({ email, setEmail, onNext }: { email: string; setEmail: (v: string) => void; onNext: () => void }) {
  const [error, setError] = useState<ApiError>()
  const [busy, setBusy] = useState(false)
  const valid = /^\S+@\S+\.\S+$/.test(email)
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await api.post('/auth/signup/request-otp', { email })
      onNext()
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'error', 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Pane title="What’s your email?" sub="We’ll send a 6-digit code to confirm it’s you.">
      <form onSubmit={send}>
        <Field label="Email"><Input icon={<Mail />} type="email" autoFocus autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(undefined) }} /></Field>
        {error?.code === 'email_registered' ? (
          <Callout className="mt-4" tone="brand" title="This email is already registered" action={<Button size="sm" to={`/login?email=${encodeURIComponent(email)}`}>Log in instead</Button>}>
            Forgot your password? <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="link">Reset it</Link>.
          </Callout>
        ) : error && <Callout className="mt-4" tone="danger">{error.message}</Callout>}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={!valid} loading={busy}>Send code</Button>
      </form>
    </Pane>
  )
}

function OtpStep({ email, onVerified }: { email: string; onVerified: (signupToken: string) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<ApiError>()
  const [busy, setBusy] = useState(false)
  const [resends, setResends] = useState(0)
  const [seconds, setSeconds] = useState(60)
  const locked = error?.code === 'otp_locked' || error?.status === 423
  useEffect(() => { const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t) }, [])

  const verify = async () => {
    setBusy(true)
    try {
      const res = await api.post<{ signup_token: string }>('/auth/signup/verify-otp', { email, code })
      onVerified(res.signup_token)
    } catch (e) {
      setError(e as ApiError)
      setCode('')
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    try {
      await api.post('/auth/signup/request-otp', { email })
      setResends((r) => r + 1)
      setSeconds(60)
      setError(undefined)
      toast('New code sent')
    } catch (e) {
      setError(e as ApiError)
    }
  }
  const left = error?.details.attempts_left as number | undefined

  return (
    <Pane title="Check your inbox" sub={`Enter the 6-digit code we sent to ${email}. It’s valid for ${LIMITS.otpValidMinutes} minutes.`}>
      <OtpInput value={code} onChange={setCode} disabled={locked} />
      {error && !locked && <p className="mt-3 text-[13px] text-danger">{error.message}{left !== undefined ? ` — ${left} ${left === 1 ? 'try' : 'tries'} left.` : ''}</p>}
      {locked && <Callout className="mt-4" tone="danger" icon={<Lock />} title="Too many wrong codes">{error?.message ?? `This email is locked for ${LIMITS.otpLockMinutes} minutes.`}</Callout>}
      <Button size="lg" className="mt-6 w-full" disabled={code.length < 6 || locked} loading={busy} onClick={verify}>Verify</Button>
      <div className="mt-5 text-center text-[13.5px] text-ink-2">
        {seconds > 0 ? (
          <>Resend in <span className="font-semibold num">0:{String(seconds).padStart(2, '0')}</span></>
        ) : resends >= LIMITS.otpResendsPerHour ? (
          <span>You’ve resent {LIMITS.otpResendsPerHour} times this hour. Try again later.</span>
        ) : (
          <div className="space-y-1">
            <div>Didn’t get it? Check your spam folder.</div>
            <button className="link" onClick={resend}>Resend code</button>
          </div>
        )}
      </div>
      {import.meta.env.DEV && <p className="mt-6 text-center text-xs text-ink-3">Local backend code: <b className="num">123456</b></p>}
    </Pane>
  )
}

/* ── ON-02 Age gate ─────────────────────────────────────────────────────── */

function DobStep({ dob, setDob, onResult }: { dob: string; setDob: (v: string) => void; onResult: (r: 'refused' | 'minor' | 'adult') => void }) {
  return (
    <Pane title="When were you born?" sub="This sets what you can do on Wamiwa. 13–17s need a guardian, and 18+ can earn on their own. Your date of birth is never shown on your profile.">
      <Field label="Date of birth"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
      <Button size="lg" className="mt-6 w-full" disabled={!dob} onClick={() => onResult(ageTier(dob))}>Continue</Button>
    </Pane>
  )
}

/* ── Account details → POST /auth/signup/complete ───────────────────────── */

function AccountStep({ kind, email, signupToken, dob, onCreated }: {
  kind: 'person' | 'company'; email: string; signupToken: string; dob: string; onCreated: (t: LoginDto) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [handle, setHandle] = useState(() => email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30))
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('nigeria')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const handleOk = /^[a-z0-9_]{3,30}$/i.test(handle)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      const res = await api.post<LoginDto>('/auth/signup/complete', {
        signup_token: signupToken, account_type: kind === 'company' ? 'company' : 'user', password, handle, name,
        date_of_birth: kind === 'person' ? dob : null, category: kind === 'company' ? category.toLowerCase() || null : null, region: region || null,
      })
      await onCreated(res)
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Pane title={kind === 'company' ? 'Your business' : 'Create your account'} sub={kind === 'company' ? 'You’ll verify the business on the next step.' : 'Your name and handle are public. You can change them later; your verified name changes only through a new ID check.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={kind === 'company' ? 'Business name' : 'Full name'}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Handle" hint="3–30 letters, numbers or underscores." error={handle && !handleOk ? 'Use only letters, numbers and underscores.' : undefined}>
          <Input icon={<AtSign />} value={handle} onChange={(e) => setHandle(e.target.value)} required />
        </Field>
        {kind === 'company' && <Field label="Category"><Input placeholder="Fashion" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>}
        <Field label="Country" hint={kind === 'company' ? 'Where your business is based.' : 'Where you live. You can change it later.'}><RegionSelect value={region} onChange={setRegion} /></Field>
        <Field label="Password" hint="At least 10 characters."><PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></Field>
        {error && <Callout tone="danger">{error}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!name || !handleOk || password.length < 10}>Create account</Button>
        {/* Terms 1.3: creating an account accepts the Terms. Links open in a new tab so the form isn't lost. */}
        <p className="text-center text-[12.5px] leading-relaxed text-ink-2">
          By creating an account, you agree to Wamiwa’s <a href="/terms" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">Terms of Service</a> and
          confirm you’ve read the <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</a>.
        </p>
      </form>
    </Pane>
  )
}

/* ── ON-03 Guardian ─────────────────────────────────────────────────────── */

function GuardianStep({ onSent }: { onSent: () => void }) {
  const [v, setV] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try { await api.post('/guardians/invite', { contact: v }); onSent() } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Pane icon={<HeartHandshake />} title="Link your parent or guardian" sub="Because you’re under 18, a guardian needs to link their verified adult account before you can finish signing up.">
      <Field label="Guardian’s email or phone"><Input placeholder="mum@example.com or +234…" value={v} onChange={(e) => setV(e.target.value)} /></Field>
      <Callout className="mt-5" tone="neutral" title="What your guardian can see">Your contracts, chats with companies and your earnings. They can also freeze your account. They can’t read your chats with friends.</Callout>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <Button size="lg" className="mt-6 w-full" disabled={v.length < 5} loading={busy} onClick={send}>Send invite</Button>
    </Pane>
  )
}

function WaitingStep({ onApproved }: { onApproved: () => void }) {
  const { refreshMe, meDto } = useSession()
  useEffect(() => { if (meDto?.status === 'active') onApproved() }, [meDto?.status, onApproved])
  return (
    <Pane icon={<Clock />} title="Waiting for your guardian" sub="We sent your guardian an invite. Your account opens once they create or link a verified adult account, pass ID verification and confirm they’re your guardian.">
      <ol className="space-y-3">
        {[['Invite sent', true], ['Guardian accepts invite', false], ['Guardian passes ID verification', false], ['Guardian confirms relationship', false]].map(([t, done]) => (
          <li key={t as string} className="flex items-center gap-3 text-[14px]">
            <span className={cn('grid size-6 place-items-center rounded-full', done ? 'bg-teal text-white' : 'bg-wash text-ink-3')}>{done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}</span>
            <span className={done ? 'font-semibold text-ink' : 'text-ink-2'}>{t}</span>
          </li>
        ))}
      </ol>
      <Button variant="outline" className="mt-6 w-full" onClick={() => refreshMe()}>Check again</Button>
    </Pane>
  )
}

/* ── ON-04 Profile, phone, ON-08 friends ────────────────────────────────── */

function ProfileStep({ onNext }: { onNext: () => void }) {
  const [primary, setPrimary] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const toggle = (n: string) => {
    if (!primary) return setPrimary(n)
    if (primary === n) { setPrimary(null); return }
    setSecondary((s) => s.includes(n) ? s.filter((x) => x !== n) : s.length >= 2 ? s : [...s, n])
  }
  const save = async () => {
    setBusy(true)
    try {
      await api.patch('/accounts/me/profile', { bio, primary_niche: primary!.toLowerCase(), secondary_niches: secondary.map((s) => s.toLowerCase()) })
      onNext()
    } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Pane title="Set up your profile" sub="Brands find you by niche. Choose 1 primary and up to 2 secondary.">
      <Field label="Bio" optional><Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What do you post about?" className="min-h-20" /></Field>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-ink">Niches <span className="font-normal text-ink-3">{primary ? 1 + secondary.length : 0}/3</span></div>
        <div className="flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <Chip key={n} active={primary === n || secondary.includes(n)} onClick={() => toggle(n)} className={cn(primary === n && '!bg-brand !border-brand !text-white')}>
              {n}{primary === n && <span className="ml-1 text-[10px] opacity-80">PRIMARY</span>}
            </Chip>
          ))}
        </div>
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <Button size="lg" className="mt-7 w-full" disabled={!primary} loading={busy} onClick={save}>Continue</Button>
    </Pane>
  )
}

function PhoneStep({ onNext }: { onNext: () => void }) {
  const [phone, setPhone] = useState('+234 ')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true); setError(undefined)
    try { await fn(); after() } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Pane icon={<Phone />} title="Add your phone" sub="Used for payouts and account recovery once it’s verified by SMS. You can skip this for now.">
      <Field label="Phone number"><Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} /></Field>
      {sent && <div className="mt-5"><div className="mb-2 text-[13px] font-semibold text-ink">SMS code</div><OtpInput value={code} onChange={setCode} /></div>}
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <div className="mt-6 grid gap-2">
        {!sent
          ? <Button size="lg" loading={busy} onClick={() => run(() => api.post('/accounts/me/phone', { phone: phone.replace(/\s/g, '') }), () => setSent(true))}>Send SMS code</Button>
          : <Button size="lg" loading={busy} disabled={code.length < 6} onClick={() => run(() => api.post('/accounts/me/phone/verify', { code }), () => { toast('Phone verified'); onNext() })}>Verify phone</Button>}
        <Button variant="ghost" onClick={onNext}>Skip for now</Button>
      </div>
    </Pane>
  )
}

function FriendsStep({ onDone }: { onDone: () => void }) {
  const fb = async () => {
    try {
      const r = await api.get<{ notice: string; friends: { id: string; handle: string; name: string }[] }>('/friends/facebook')
      toast(`${r.friends.length} Facebook ${r.friends.length === 1 ? 'friend' : 'friends'} found`, r.notice)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'facebook_not_connected') toast('Connect Facebook first', 'Connect your Facebook account under Verification › Verified creator, then import your friends.', 'warn')
      else toast('Couldn’t import', errText(e), 'warn')
    }
  }
  return (
    <Pane icon={<Users />} title="Find your friends" sub="See who’s already here.">
      <div className="grid gap-3">
        <button onClick={fb} className="flex items-center gap-4 rounded-[20px] border border-line p-4 text-left hover:bg-wash">
          <span className="grid size-10 place-items-center rounded-xl bg-[#1877f2] text-lg font-bold text-white">f</span>
          <div><div className="font-bold text-ink">Import from Facebook</div><div className="text-[13px] text-ink-2">Only shows friends who have also connected Wamiwa.</div></div>
        </button>
        <div className="flex items-center gap-4 rounded-[20px] border border-line p-4 text-left opacity-80">
          <span className="grid size-10 place-items-center rounded-xl bg-teal text-white"><Phone className="size-5" /></span>
          <div><div className="font-bold text-ink">Match phone contacts</div><div className="text-[13px] text-ink-2">Available in the mobile app. Contacts are matched by hashed number; non-users’ details aren’t stored.</div></div>
        </div>
      </div>
      <Button size="lg" className="mt-7 w-full" onClick={onDone}>Finish & open my feed</Button>
    </Pane>
  )
}

/* ── CO-01 Company verification ─────────────────────────────────────────── */

function CompanyStep({ onNext }: { onNext: () => void }) {
  const [reg, setReg] = useState('')
  const [file, setFile] = useState<File>()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async () => {
    setBusy(true); setError(undefined)
    try {
      const form = new FormData()
      form.append('kind', 'document')
      form.append('file', file!)
      const up = await api.upload<{ ref: string }>('/uploads', form)
      await api.post('/companies/verification', { registration_no: reg, document_ref: up.ref })
      onNext()
    } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }
  return (
    <Pane icon={<Building2 />} title="Verify your business" sub="Unverified companies can browse but cannot pay, hire, message people about work, or use APIs.">
      <div className="space-y-4">
        <Field label="Registration number (CAC RC or equivalent)"><Input placeholder="RC 1234567" value={reg} onChange={(e) => setReg(e.target.value)} /></Field>
        <Field label="Registration document">
          <label className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2 py-6 text-[13.5px] text-ink-2 hover:border-brand">
            <FileUp className="size-5 text-brand" />
            {file ? file.name : 'Upload CAC certificate (PDF, JPG, PNG)'}
            <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0])} />
          </label>
        </Field>
        <Checkbox checked={agree} onChange={setAgree}>I confirm I’m authorised to act for this business.</Checkbox>
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <Button size="lg" className="mt-6 w-full" disabled={!agree || !reg || !file} loading={busy} onClick={submit}>Submit for review</Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={onNext}>Do this later</Button>
    </Pane>
  )
}
