import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { api } from '@/api/client'

/** Shown on every page until Wamiwa goes live: payments use test keys, so no real money moves. */
let known: boolean | undefined

export function TestModeBanner() {
  const [testMode, setTestMode] = useState(known)
  useEffect(() => {
    if (known !== undefined) return
    api.get<{ test_mode: boolean }>('/platform/status')
      .then((s) => { known = s.test_mode; setTestMode(s.test_mode) })
      .catch(() => undefined)
  }, [])
  if (!testMode) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-[12.5px] font-semibold text-warn">
      <FlaskConical className="size-4 shrink-0" />
      Test mode: no real money moves. Pay with a test card, never your own.
    </div>
  )
}
