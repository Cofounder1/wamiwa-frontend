import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Lock, Mail } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { Button, Callout, Field, Input, toast } from '@/components/ui/primitives'
import { AuthFrame, OtpInput, Pane } from './Signup'

const errText = (e: unknown) => (e instanceof ApiError ? e.fieldMessage ?? e.message : 'Something went wrong. Try again.')

/** Password reset: a 6-digit code is emailed, then the code and a new password are sent together. */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError(undefined); setLocked(false)
    try {
      await api.post('/auth/password/reset-request', { email: email.trim() })
      setSent(true); setCode('')
      toast('Check your email', 'If that email is registered, we’ve sent a reset code.')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_locked') setLocked(true)
      setError(errText(err))
    } finally { setBusy(false) }
  }

  const reset = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (password !== confirm) { setError('The two passwords don’t match.'); return }
    setBusy(true); setError(undefined)
    try {
      await api.post('/auth/password/reset', { email: email.trim(), code, new_password: password })
      toast('Password changed', 'Log in with your new password.')
      nav(`/login?email=${encodeURIComponent(email.trim())}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_incorrect') {
        const left = err.details.attempts_left as number | undefined
        setError(left !== undefined ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code isn’t right.')
        setCode('')
      } else if (err instanceof ApiError && err.code === 'otp_locked') {
        setLocked(true)
        setError('Too many wrong codes. Wait 15 minutes, then request a new code.')
      } else if (err instanceof ApiError && err.code === 'otp_expired') {
        setError('This code has expired. Send a new one.')
        setCode('')
      } else setError(errText(err))
    } finally { setBusy(false) }
  }

  return (
    <AuthFrame onBack={sent ? () => { setSent(false); setError(undefined) } : undefined}>
      {!sent ? (
        <Pane icon={<KeyRound />} title="Reset your password" sub="Enter the email you signed up with. We’ll send you a 6-digit code.">
          <form onSubmit={request} className="space-y-4">
            <Field label="Email"><Input icon={<Mail />} type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {error && <Callout tone={locked ? 'warn' : 'danger'}>{error}</Callout>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>Send code</Button>
          </form>
          <p className="mt-6 text-center text-[13.5px] text-ink-2">Remembered it? <Link to="/login" className="link">Log in</Link></p>
        </Pane>
      ) : (
        <Pane icon={<Lock />} title="Choose a new password" sub={`Enter the code we sent to ${email.trim()} and a new password.`}>
          <form onSubmit={reset} className="space-y-4">
            <div><div className="mb-2 text-[13px] font-semibold text-ink">Reset code</div><OtpInput value={code} onChange={setCode} disabled={locked} /></div>
            <Field label="New password" hint="At least 10 characters."><Input icon={<Lock />} type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Confirm new password"><Input icon={<Lock />} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
            {error && <Callout tone={locked ? 'warn' : 'danger'}>{error}</Callout>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={locked || code.length < 6 || password.length < 10 || !confirm}>Change password</Button>
            <button type="button" disabled={busy} className="w-full text-center text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50" onClick={() => request()}>Send a new code</button>
          </form>
        </Pane>
      )}
    </AuthFrame>
  )
}
