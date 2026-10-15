import { AlertTriangle, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import type { ApiError } from '@/api/client'
import { cn } from '@/lib/cn'
import { Button } from './primitives'

/** Loading / error / pagination states shared by every screen that reads from the API. */

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('grid min-h-[40vh] place-items-center text-ink-3', className)}><Loader2 className="size-6 animate-spin" /></div>
}

export function ErrorState({ error, onRetry, compact }: { error: ApiError; onRetry?: () => void; compact?: boolean }) {
  const offline = error.code === 'network'
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-6' : 'py-14')}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">{offline ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}</div>
      <div className="text-[15px] font-bold text-ink">{offline ? 'Can’t reach Wamiwa' : error.status === 403 ? 'You don’t have access to this' : error.status === 404 ? 'Not found' : 'Something went wrong'}</div>
      <p className="mt-1 max-w-sm text-[13.5px] text-ink-2">{error.message}{error.hint && !error.hint.startsWith('/') ? ` ${error.hint}` : ''}</p>
      {onRetry && error.status !== 403 && error.status !== 404 && <Button className="mt-4" size="sm" variant="outline" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function LoadMore({ show, loading, onClick }: { show: boolean; loading: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <div className="flex justify-center pt-2">
      <Button variant="outline" size="sm" loading={loading} onClick={onClick}>Load more</Button>
    </div>
  )
}

export function PostSkeleton() {
  return (
    <div className="animate-pulse rounded-card bg-surface p-5 ring-1 ring-line/70">
      <div className="flex items-center gap-3"><div className="size-10 rounded-full bg-wash" /><div className="space-y-2"><div className="h-3 w-32 rounded bg-wash" /><div className="h-2.5 w-20 rounded bg-wash" /></div></div>
      <div className="mt-4 space-y-2"><div className="h-3 w-full rounded bg-wash" /><div className="h-3 w-4/5 rounded bg-wash" /></div>
    </div>
  )
}

export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-5 py-4"><div className="size-10 rounded-full bg-wash" /><div className="flex-1 space-y-2"><div className="h-3 w-2/5 rounded bg-wash" /><div className="h-2.5 w-3/5 rounded bg-wash" /></div></div>
      ))}
    </div>
  )
}
