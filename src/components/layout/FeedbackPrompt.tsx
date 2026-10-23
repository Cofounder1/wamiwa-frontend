import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, Lightbulb, X } from 'lucide-react'
import { api, errMsg } from '@/api/client'
import { cn } from '@/lib/cn'
import { Button, Textarea } from '@/components/ui/primitives'

/** Subject prefix that marks a support ticket as product feedback (the admin Feedback page filters on it). */
export const FEEDBACK_PREFIX = 'Product feedback: '

const KEY = 'wamiwa.feedbackPrompt'
const DAY = 86_400_000
const SHOW_AFTER_MS = 45_000 // let people use the app first
const SNOOZE_DAYS = { dismissed: 30, sent: 90 }
const TOPICS = ['A new feature', 'Something’s hard to use', 'Something’s broken', 'Other'] as const
// Pages where a corner card would sit on top of what people are typing or watching.
const QUIET = ['/app/messages', '/app/create', '/app/orders', '/app/likeness/video']

function snoozedUntil(): number {
  try { return Number(localStorage.getItem(KEY) ?? 0) } catch { return 0 }
}
function snooze(days: number) {
  try { localStorage.setItem(KEY, String(Date.now() + days * DAY)) } catch { /* storage unavailable: it may show again */ }
}

/** A small corner card asking what Wamiwa should do next. Cancel hides it for 30 days; sending, for 90. */
export function FeedbackPrompt() {
  const { pathname } = useLocation()
  const [due, setDue] = useState(false)
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('A new feature')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (snoozedUntil() > Date.now()) return
    const t = setTimeout(() => setDue(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setDue(false), 2600)
    return () => clearTimeout(t)
  }, [sent])

  if (!due || (!open && QUIET.some((p) => pathname.startsWith(p)))) return null

  const dismiss = () => { snooze(SNOOZE_DAYS.dismissed); setDue(false) }
  const submit = async () => {
    const body = text.trim()
    if (body.length < 10 || busy) return
    setBusy(true)
    setError(undefined)
    try {
      const summary = body.replace(/\s+/g, ' ').slice(0, 80)
      await api.post('/support/tickets', {
        category: 'other',
        subject: `${FEEDBACK_PREFIX}${topic} — ${summary}`.slice(0, 200),
        body: `${body}\n\n— Topic: ${topic}. Sent from ${pathname}.`,
      })
      snooze(SNOOZE_DAYS.sent)
      setSent(true)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <aside
      role="dialog" aria-label="Help us improve Wamiwa"
      className={cn(
        'fixed inset-x-4 bottom-24 z-40 animate-pop rounded-[20px] bg-surface p-4 shadow-pop ring-1 ring-line',
        'sm:inset-x-auto sm:right-5 sm:w-[360px] lg:bottom-5',
      )}
    >
      {sent ? (
        <div className="flex items-center gap-3 py-1">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success"><Check className="size-4.5" /></span>
          <div><div className="text-[14px] font-bold text-ink">Thank you!</div><div className="text-[13px] text-ink-2">The team reads every idea.</div></div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Lightbulb className="size-4.5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-ink">Help us improve Wamiwa</div>
              <div className="text-[13px] leading-snug text-ink-2">What else should Wamiwa do for you?</div>
            </div>
            <button onClick={dismiss} aria-label="Not now" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-wash hover:text-ink"><X className="size-4" /></button>
          </div>
          {open ? (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {TOPICS.map((t) => (
                  <button key={t} onClick={() => setTopic(t)} aria-pressed={topic === t}
                    className={cn('h-7 rounded-chip border px-2.5 text-[12px] font-semibold transition', topic === t ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-2 hover:bg-wash')}>
                    {t}
                  </button>
                ))}
              </div>
              <Textarea autoFocus value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); setError(undefined) }}
                placeholder="Tell us what you need, or what would make Wamiwa better for you." className="mt-3 min-h-24 text-[14px]" />
              {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={dismiss}>Cancel</Button>
                <Button size="sm" loading={busy} disabled={text.trim().length < 10} onClick={submit}>Send</Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
              <Button size="sm" onClick={() => setOpen(true)}>Share an idea</Button>
            </div>
          )}
        </>
      )}
    </aside>
  )
}
