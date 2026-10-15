import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Bot, CircleDollarSign, Eye, FileSignature, Gavel, Heart, Lightbulb, MessageCircle, ShieldAlert, UserPlus } from 'lucide-react'
import { api } from '@/api/client'
import { usePaged } from '@/api/hooks'
import type { NotificationDto } from '@/api/types'
import { ago } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, Card, PageHeader, Tabs, toast } from '@/components/ui/primitives'
import { ErrorState, LoadMore, RowSkeleton } from '@/components/ui/states'

const ICONS: Record<string, [React.ReactNode, string]> = {
  payment: [<CircleDollarSign key="1" />, 'bg-success-soft text-success'],
  payout: [<CircleDollarSign key="1b" />, 'bg-success-soft text-success'],
  contract: [<FileSignature key="2" />, 'bg-brand-soft text-brand'],
  offer: [<FileSignature key="2b" />, 'bg-brand-soft text-brand'],
  dispute: [<Gavel key="3" />, 'bg-warn-soft text-warn'],
  security: [<ShieldAlert key="4" />, 'bg-danger-soft text-danger'],
  legal: [<ShieldAlert key="4b" />, 'bg-danger-soft text-danger'],
  like: [<Heart key="5" />, 'bg-danger-soft text-danger'],
  comment: [<MessageCircle key="6" />, 'bg-wash text-ink-2'],
  message: [<MessageCircle key="6b" />, 'bg-wash text-ink-2'],
  profile_view: [<Eye key="7" />, 'bg-wash text-ink-2'],
  post_idea: [<Lightbulb key="8" />, 'bg-warn-soft text-warn'],
  agent: [<Bot key="9" />, 'bg-agent-soft text-agent'],
  order: [<Bot key="9b" />, 'bg-agent-soft text-agent'],
  follow: [<UserPlus key="10" />, 'bg-brand-soft text-brand'],
}
const ALWAYS_ON = new Set(['payment', 'payout', 'contract', 'offer', 'dispute', 'security', 'legal', 'order'])

/** Where a notification should take you, from the ids it carries. */
function target(n: NotificationDto): string | undefined {
  const d = n.data ?? {}
  if (d.post_id) return `/app/post/${d.post_id}`
  if (d.order_id) return `/app/orders/${d.order_id}`
  if (d.contract_id) return `/app/contracts/${d.contract_id}`
  if (d.dispute_id) return '/app/disputes'
  if (d.conversation_id) return `/app/messages/${d.conversation_id}`
  if (n.type === 'payment' || n.type === 'payout') return '/app/earnings'
  if (n.type === 'post_idea') return '/app/ideas'
  return undefined
}

export default function Notifications() {
  const [tab, setTab] = useState<'all' | 'money' | 'social'>('all')
  const list = usePaged<NotificationDto, NotificationDto>((cursor, s) => api.page<NotificationDto>('/notifications', { cursor, limit: 30 }, s), (n) => n, [])
  const [read, setRead] = useState<Set<string>>(new Set())
  const isRead = (n: NotificationDto) => n.read || read.has(n.id)
  const unread = list.items.filter((n) => !isRead(n)).length
  const shown = list.items.filter((n) => tab === 'all' || (tab === 'money' ? ALWAYS_ON.has(n.type) : !ALWAYS_ON.has(n.type)))

  const markRead = async (ids?: string[]) => {
    const prev = read
    setRead(new Set([...read, ...(ids ?? list.items.map((n) => n.id))]))
    try { await api.post('/notifications/read', { notification_ids: ids ?? null }) } catch { setRead(prev); toast('Couldn’t mark as read', undefined, 'danger') }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Notifications" actions={<><Button variant="ghost" size="sm" disabled={!unread} onClick={() => markRead()}>Mark all read</Button><Button variant="outline" size="sm" to="/app/settings?tab=notifications">Settings</Button></>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: 'All', count: unread || undefined }, { value: 'money', label: 'Contracts & money' }, { value: 'social', label: 'Social' }]} />
      <Card className="mt-5 divide-y divide-line overflow-hidden">
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : list.loading ? <RowSkeleton /> : shown.map((n) => {
          const [ic, cls] = ICONS[n.type] ?? [<Bell key="b" />, 'bg-wash text-ink-2']
          const fresh = !isRead(n)
          const to = target(n)
          const body = (
            <div className={cn('flex items-start gap-4 px-5 py-4 transition hover:bg-surface-2', fresh && 'bg-brand-soft/30')}>
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-[18px]', cls)}>{ic}</span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px]', fresh ? 'font-semibold text-ink' : 'text-ink-2')}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-[13px] text-ink-2">{n.body}</p>}
                <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">{ago(n.created_at)}{ALWAYS_ON.has(n.type) && <span className="rounded-badge bg-wash px-1.5 font-semibold">Always on</span>}</div>
              </div>
              {fresh && <span className="mt-2 size-2 rounded-full bg-brand" />}
            </div>
          )
          const onOpen = () => fresh && markRead([n.id])
          return to ? <Link key={n.id} to={to} onClick={onOpen} className="block">{body}</Link> : <button key={n.id} onClick={onOpen} className="block w-full text-left">{body}</button>
        })}
        {!list.loading && !list.error && shown.length === 0 && <div className="flex flex-col items-center py-14 text-ink-2"><Bell className="mb-2 size-6" />You’re all caught up.</div>}
      </Card>
      <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
    </div>
  )
}
