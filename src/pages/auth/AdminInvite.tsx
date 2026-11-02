import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AtSign, KeyRound, Lock, ShieldCheck, ShieldX, User } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Field, Input, toast } from '@/components/ui/primitives'
import { AuthFrame, OtpInput, Pane } from './Signup'

interface AcceptDto { setup_token: string; totp_secret: string; otpauth_url: string; next_step?: string }

const errText = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong. Try again.')

/** Admin onboarding from the emailed link {site}/admin/invite?token=…: create the account, then turn on two-factor login. */
export default function AdminInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', handle: '', password: '', confirm: '' })
  const [setup, setSetup] = useState<AcceptDto>()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const accept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('The two passwords don’t match.'); return }
    setBusy(true); setError(undefined)
    try {
      setSetup(await api.post<AcceptDto>('/admin/invites/accept', { token, password: form.password, handle: form.handle.trim(), name: form.name.trim() }))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_invite') setInvalid(true)
      else if (err instanceof ApiError && err.code === 'handle_taken') setError('That handle is taken, or an account already uses this email. Try another handle.')
      else setError(errText(err))
    } finally { setBusy(false) }
  }

  const confirm2fa = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try {
      await api.post('/admin/invites/confirm-2fa', { setup_token: setup!.setup_token, code })
      toast('Your admin account is ready', 'Log in with your email, password and a code from your authenticator app.')
      nav('/login', { replace: true })
    } catch (err) {
      setCode('')
      if (err instanceof ApiError && err.code === '2fa_invalid') setError('That code didn’t match. Check the time on your phone is correct and enter the newest code.')
      else if (err instanceof ApiError && err.status === 401) setError('This setup session has expired (30 minutes). Ask a Super Admin to send a new invite.')
      else setError(errText(err))
    } finally { setBusy(false) }
  }

  if (!token || invalid) {
    return (
      <AuthFrame>
        <Pane icon={<ShieldX />} title="This invite link doesn’t work" sub="It may be incomplete, already used or expired. Ask a Super Admin to send you a new invite.">
          <Button variant="outline" className="w-full" to="/login">Go to log in</Button>
        </Pane>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame progress={setup ? 1 : 0.5}>
      {!setup ? (
        <Pane icon={<ShieldCheck />} title="Join the Wamiwa admin team" sub="Create your admin account. Your email is the one this invite was sent to.">
          <form onSubmit={accept} className="space-y-4">
            <Field label="Full name"><Input icon={<User />} autoComplete="name" maxLength={120} value={form.name} onChange={set('name')} /></Field>
            <Field label="Handle" hint="3 to 30 characters."><Input icon={<AtSign />} autoComplete="username" maxLength={30} value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.replace(/^@/, '') }))} /></Field>
            <Field label="Password" hint="At least 12 characters."><Input icon={<Lock />} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} onChange={set('password')} /></Field>
            <Field label="Confirm password"><Input icon={<Lock />} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></Field>
            {error && <Callout tone="danger">{error}</Callout>}
            <Button type="submit" size="lg" className="w-full" loading={busy}
              disabled={!form.name.trim() || form.handle.trim().length < 3 || form.password.length < 12 || !form.confirm}>Continue</Button>
          </form>
        </Pane>
      ) : (
        <Pane icon={<KeyRound />} title="Turn on two-factor login" sub="Two-factor login is required for admins. Add this key to an authenticator app (Google Authenticator, 1Password, Authy…), then enter the 6-digit code it shows.">
          <form onSubmit={confirm2fa} className="space-y-4">
            <div>
              <div className="mb-1.5 text-[13px] font-semibold text-ink">Setup key</div>
              <div className="rounded-2xl bg-surface-2 p-4 text-center font-mono text-[15px] font-bold tracking-wider break-all text-ink select-all">{setup.totp_secret}</div>
              <p className="mt-2 text-[12.5px] text-ink-2">On a phone with an authenticator app? <a href={setup.otpauth_url} className="link">Open in authenticator app</a></p>
              <p className="mt-1 font-mono text-[11px] break-all text-ink-3 select-all">{setup.otpauth_url}</p>
            </div>
            <div><div className="mb-2 text-[13px] font-semibold text-ink">Code from the app</div><OtpInput value={code} onChange={setCode} /></div>
            {error && <Callout tone="danger">{error}</Callout>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length < 6}>Finish setup</Button>
          </form>
        </Pane>
      )}
    </AuthFrame>
  )
}
