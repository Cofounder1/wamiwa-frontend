import { useState } from 'react'
import { Check, RotateCcw, ScanFace } from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/primitives'
import { LiveCheck, type LiveCapture } from '@/components/ui/LiveCheck'

/**
 * ON-05 live check. The API decides which one runs: YouVerify's own check (its SDK, in a modal) once YouVerify is
 * connected, or Wamiwa's camera check otherwise. With YouVerify, only the session id comes back here; the API asks
 * YouVerify itself whether the check passed.
 */
export type LiveResult = { kind: 'youverify'; sessionId: string } | { kind: 'camera'; capture: LiveCapture }

type LiveSession =
  | { provider: 'camera' }
  | { provider: 'youverify'; session_id: string; session_token: string; public_merchant_key: string; sandbox: boolean }

export function IdLiveCheck({ value, onChange, firstName }: {
  value?: LiveResult; onChange: (v: LiveResult | undefined) => void; firstName: string
}) {
  const [mode, setMode] = useState<'unknown' | 'camera' | 'youverify'>('unknown')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const start = async () => {
    setBusy(true); setError(undefined); onChange(undefined)
    try {
      const s = await api.post<LiveSession>('/verification/identity/live-check')
      if (s.provider === 'camera') { setMode('camera'); return }
      setMode('youverify')
      const { default: YouverifyLiveness } = await import('youverify-liveness-web')
      const sdk = new YouverifyLiveness({
        sessionId: s.session_id, sessionToken: s.session_token, publicKey: s.public_merchant_key,
        sandboxEnvironment: s.sandbox, presentation: 'modal', user: { firstName },
        branding: { name: 'Wamiwa', color: '#4e9ad9' }, tasks: [{ id: 'complete-the-circle' }],
        onSuccess: () => onChange({ kind: 'youverify', sessionId: s.session_id }),
        onFailure: (d) => setError(d.error?.message ?? 'The live check didn’t pass. Try again in good light.'),
      })
      await sdk.start()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'camera') {
    return <LiveCheck value={value?.kind === 'camera' ? value.capture : undefined}
                      onChange={(c) => onChange(c ? { kind: 'camera', capture: c } : undefined)} />
  }
  const done = value?.kind === 'youverify'
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center text-[13px]',
      done ? 'border-teal bg-teal-soft text-teal' : 'border-line-strong text-ink-2')}>
      {done ? <Check className="size-5" /> : <ScanFace className="size-5 text-brand" />}
      <span className="font-bold text-ink">{done ? 'Live check done' : 'Live check'}</span>
      <span className="text-[11.5px] opacity-70">{done ? 'Your face was captured live.' : 'Uses your camera there and then. A saved photo won’t work.'}</span>
      {error && <span className="text-[12px] text-danger">{error}</span>}
      <Button size="sm" variant={done ? 'ghost' : 'primary'} loading={busy} icon={done ? <RotateCcw className="size-4" /> : undefined}
              onClick={start}>{done ? 'Do it again' : 'Start live check'}</Button>
    </div>
  )
}
