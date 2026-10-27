import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { api } from '@/api/client'

/** Shown on every page until Wamiwa goes live: payments use test keys, so no real money moves. */
const KEY = 'wamiwa.test_mode'
const KEEP_MS = 10 * 60_000  // the status changes once, at launch: no need to ask on every page load

function remembered(): boolean | undefined {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { on: boolean; at: number } | null
    return saved && Date.now() - saved.at < KEEP_MS ? saved.on : undefined
  } catch { return undefined }
}

export function TestModeBanner() {
  const [testMode, setTestMode] = useState(remembered)
  useEffect(() => {
    if (testMode !== undefined) return
    api.get<{ test_mode: boolean }>('/platform/status')
      .then((s) => {
        setTestMode(s.test_mode)
        try { sessionStorage.setItem(KEY, JSON.stringify({ on: s.test_mode, at: Date.now() })) } catch { /* storage unavailable */ }
      })
      .catch(() => undefined)
  }, [testMode])
  if (!testMode) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-[12.5px] font-semibold text-warn">
      <FlaskConical className="size-4 shrink-0" />
      Test mode: no real money moves. Pay with a test card, never your own.
    </div>
  )
}
