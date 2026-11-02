import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CheckCircle2, HeartHandshake, Loader2, LogIn, ShieldX, UserPlus } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useSession } from '@/context/session'
import { Button, Callout, Checkbox, Chip, Field, Input } from '@/components/ui/primitives'
import { AuthFrame, Pane } from '@/pages/auth/Signup'

interface AcceptDto { link_id: string; status: string; next_step: 'verify_identity' | null }

const RELATIONSHIPS = ['Mother', 'Father', 'Legal guardian', 'Grandparent', 'Aunt or uncle', 'Older sibling']

/** Messages for the errors POST /guardians/accept can return. */
function explain(e: unknown): { title: string; body: string; fatal: boolean } {
  if (!(e instanceof ApiError)) return { title: 'Something went wrong', body: 'Try again.', fatal: false }
  switch (e.code) {
    case 'adults_only': return { title: 'Guardians must be 18 or older', body: 'Only a verified adult account can be a parent or guardian on Wamiwa.', fatal: true }
    case 'invalid_invite': return { title: 'This invite link doesn’t work', body: 'It may have been used already, or the child sent a newer invite. Ask them to send a new one from their account.', fatal: true }
    case 'self_guardian': return { title: 'You can’t be your own guardian', body: 'This invite was sent from the account you’re logged in with. Log out and log in with the parent or guardian’s own account.', fatal: true }
    case 'relationship_unconfirmed': return { title: 'Confirm your relationship', body: 'Tick the box to confirm you’re this child’s parent or legal guardian.', fatal: false }
    default: return { title: 'Couldn’t accept the invite', body: e.fieldMessage ?? e.message, fatal: false }
  }
}

/** Public page for the link emailed or texted to a guardian: {site}/guardian/accept?token=… (ON-03). */
export default function GuardianAccept() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { status, meDto, refreshMe, logout } = useSession()
  const [relationship, setRelationship] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ReturnType<typeof explain>>()
  const [done, setDone] = useState<AcceptDto>()
  const here = `/guardian/accept?token=${encodeURIComponent(token)}`

  const accept = async () => {
    setBusy(true); setError(undefined)
    try {
      const r = await api.post<AcceptDto>('/guardians/accept', { token, relationship: relationship.trim(), confirm_relationship: confirmed })
      setDone(r)
      // The session caches which experience to show; clear it so this account now opens as a guardian.
      try { sessionStorage.removeItem('wamiwa.role') } catch { /* storage unavailable */ }
      void refreshMe()
    } catch (e) { setError(explain(e)) } finally { setBusy(false) }
  }

  if (!token) {
    return (
      <AuthFrame>
        <Pane icon={<ShieldX />} title="This invite link is incomplete" sub="Open the link exactly as it appears in the email or text message, or ask the child to send a new invite.">
          <Button variant="outline" className="w-full" to="/">Back to home</Button>
        </Pane>
      </AuthFrame>
    )
  }

  if (status === 'loading') return <div className="grid min-h-dvh place-items-center text-ink-3"><Loader2 className="size-6 animate-spin" /></div>

  if (status === 'anon') {
    return (
      <AuthFrame>
        <Pane icon={<HeartHandshake />} title="You’ve been asked to be a guardian" sub="A child under 18 wants to link you as their parent or guardian on Wamiwa. Log in or create your own adult account to accept.">
          <div className="grid gap-2">
            <Button size="lg" icon={<LogIn className="size-4" />} to={`/login?next=${encodeURIComponent(here)}`}>Log in to accept</Button>
            <Button size="lg" variant="outline" icon={<UserPlus className="size-4" />} to={`/signup?next=${encodeURIComponent(here)}`}>Create an account</Button>
          </div>
          <Callout className="mt-6" tone="neutral" title="What a guardian does">You approve every contract and company before anything starts, receive the child’s payouts, see their chats with companies (never with friends) and can freeze their account. You’ll need to verify your ID.</Callout>
        </Pane>
      </AuthFrame>
    )
  }

  if (done) {
    const verify = done.next_step === 'verify_identity'
    return (
      <AuthFrame>
        <Pane icon={verify ? <BadgeCheck /> : <CheckCircle2 />} title={verify ? 'One step left: verify your ID' : 'You’re now linked as guardian'}
          sub={verify ? 'You’ve accepted the invite. The link finishes, and the child’s account opens, once you pass ID verification.' : 'The child’s account is ready to use. You’ll approve their contracts and companies from your guardian dashboard.'}>
          {verify
            ? <Button size="lg" className="w-full" to="/app/verify?tab=id">Verify my ID</Button>
            : <Button size="lg" className="w-full" to="/app/guardian">Open guardian dashboard</Button>}
        </Pane>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <Pane icon={<HeartHandshake />} title="Accept guardian invite" sub={`You’re logged in as @${meDto?.handle ?? ''}. Accepting links this account as the child’s parent or guardian.`}>
        <div className="space-y-4">
          <Field label="Your relationship to the child">
            <Input value={relationship} maxLength={40} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Mother" />
          </Field>
          <div className="flex flex-wrap gap-1.5">{RELATIONSHIPS.map((r) => <Chip key={r} active={relationship === r} onClick={() => setRelationship(r)}>{r}</Chip>)}</div>
          <Checkbox checked={confirmed} onChange={setConfirmed}>I confirm I’m this child’s parent or legal guardian, and I’ll approve their contracts and companies on their behalf.</Checkbox>
        </div>
        {error && (
          <Callout className="mt-5" tone={error.fatal ? 'danger' : 'warn'} title={error.title}
            action={error.fatal && error.title.startsWith('You can’t be') ? <Button size="sm" variant="outline" onClick={() => void logout()}>Log out</Button> : undefined}>
            {error.body}
          </Callout>
        )}
        <Button size="lg" className="mt-6 w-full" loading={busy} disabled={!relationship.trim() || !confirmed} onClick={accept}>Accept and link</Button>
        <p className="mt-5 text-center text-[13px] text-ink-2">Not you? <button type="button" className="link" onClick={() => void logout()}>Log out</button> and use your own account. <Link to="/app" className="link">Not now</Link></p>
      </Pane>
    </AuthFrame>
  )
}
