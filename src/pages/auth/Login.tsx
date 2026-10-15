import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, Lock, Mail } from 'lucide-react'
import { DEMO_PASSWORD, HOME, ROLES, useSession } from '@/context/session'
import { ApiError } from '@/api/client'
import { Button, Callout, Divider, Field, Input } from '@/components/ui/primitives'
import { AuthFrame, OtpInput, Pane } from './Signup'
import { cn } from '@/lib/cn'

export default function Login() {
  const [params] = useSearchParams()
  const { login } = useSession()
  const nav = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (e?: React.FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault()
    const creds = override ?? { email, password }
    setBusy(true)
    setError(undefined)
    try {
      const role = await login(creds.email, creds.password, needs2fa ? totp : undefined)
      nav(from && !from.startsWith('/login') ? from : HOME[role], { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === '2fa_required') {
        setEmail(creds.email)
        setPassword(creds.password)
        setNeeds2fa(true)
      } else setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <Pane title={needs2fa ? 'Two-factor code' : 'Welcome back'} sub={needs2fa ? 'Enter the 6-digit code from your authenticator app.' : 'Log in to Wamiwa.'}>
        <form onSubmit={submit} className="space-y-4">
          {!needs2fa ? (
            <>
              <Field label="Email"><Input icon={<Mail />} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Password"><Input icon={<Lock />} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </>
          ) : (
            <OtpInput value={totp} onChange={setTotp} />
          )}
          {error && <Callout tone="danger">{error}</Callout>}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={needs2fa && totp.length < 6} icon={needs2fa ? <KeyRound className="size-4" /> : undefined}>
            {needs2fa ? 'Verify & log in' : 'Log in'}
          </Button>
          {needs2fa && <button type="button" className="w-full text-center text-[13px] font-semibold text-ink-2 hover:text-ink" onClick={() => { setNeeds2fa(false); setTotp('') }}>Use a different account</button>}
        </form>

        {import.meta.env.DEV && !needs2fa && (
          <>
            <Divider className="my-7" label="Demo accounts (local backend)" />
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(undefined, { email: r.email, password: DEMO_PASSWORD })}
                  className={cn('rounded-2xl border border-line px-3 py-2.5 text-left transition hover:border-brand hover:bg-brand-soft disabled:opacity-50')}
                >
                  <div className="text-[13px] font-bold text-ink">{r.label}</div>
                  <div className="truncate text-[11.5px] text-ink-2">{r.blurb}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-ink-3">Shown in development only. Admin accounts ask for a code from the authenticator secret printed by <code>seed-demo</code>.</p>
          </>
        )}
        <p className="mt-6 text-center text-[13.5px] text-ink-2">New here? <Link to="/signup" className="link">Create an account</Link></p>
      </Pane>
    </AuthFrame>
  )
}
