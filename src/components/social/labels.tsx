import { BadgeCheck, Bot, Crown, ShieldCheck, Sparkles, User, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { acc } from '@/data/mock'
import type { Account, CommentLabel, Label } from '@/data/types'
import { Avatar } from '@/components/ui/primitives'

/**
 * Epic 2 labeling. Labels are system-set and never editable by users.
 * Company API replies deliberately render no tag (API-02).
 */
export function WhoTag({ label, onBehalfOf, className }: { label: Label | CommentLabel; onBehalfOf?: string; className?: string }) {
  const base = 'inline-flex items-center gap-1 rounded-badge px-1.5 text-[10.5px] leading-[18px] font-bold uppercase tracking-[0.04em] whitespace-nowrap'
  switch (label) {
    case 'human':
      return <span className={cn(base, 'bg-brand-soft text-human', className)} title="Made by a human"><User className="size-3" strokeWidth={2.75} />Human</span>
    case 'agent':
      return <span className={cn(base, 'bg-agent-soft text-agent', className)} title="Made by an AI agent"><Bot className="size-3" strokeWidth={2.75} />Agent</span>
    case 'autoreply':
      return (
        <span className={cn(base, 'bg-agent-soft text-agent normal-case tracking-normal', className)} title="Auto-reply agent">
          <Bot className="size-3" strokeWidth={2.75} />Agent — replying for @{onBehalfOf ? acc(onBehalfOf).handle : ''}
        </span>
      )
    case 'wamiwa':
      return <span className={cn(base, 'bg-agent-soft text-agent', className)}><Bot className="size-3" strokeWidth={2.75} />Agent — Sponsored</span>
    case 'sponsored':
      return <span className={cn(base, 'border border-line-strong text-ink-2', className)}>Sponsored</span>
    case 'api':
      return null
  }
}

export function AiBadge({ kind }: { kind: 'generated' | 'likeness' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-badge bg-ink/80 px-1.5 text-[10.5px] leading-[18px] font-bold text-white backdrop-blur">
      {kind === 'generated' ? <Sparkles className="size-3" /> : <Wand2 className="size-3" />}
      {kind === 'generated' ? 'AI-generated' : 'AI likeness'}
    </span>
  )
}

export function VerifiedMark({ a, className }: { a: Account; className?: string }) {
  const c = cn('size-4 shrink-0', className)
  switch (a.verification) {
    case 'creator':
      return <span title="Verified creator — 5,000+ followers proven by login"><BadgeCheck className={cn(c, 'text-brand')} /></span>
    case 'major':
      return <span title="Verified major person"><Crown className={cn(c, 'text-warn')} /></span>
    case 'company':
      return <span title="Verified company"><BadgeCheck className={cn(c, 'text-ink')} /></span>
    case 'wamiwa':
      return <span title="Owned by Wamiwa"><ShieldCheck className={cn(c, 'text-brand')} /></span>
    default:
      return null
  }
}

export function AccountLine({ a, size = 'md', sub, link = true, className }: {
  a: Account; size?: 'sm' | 'md' | 'lg'; sub?: React.ReactNode; link?: boolean; className?: string
}) {
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'
  const name = (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className={cn('truncate font-bold text-ink', size === 'lg' ? 'text-base' : 'text-[14px]')}>{a.name}</span>
      <VerifiedMark a={a} />
    </span>
  )
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar src={a.avatar} name={a.name} kind={a.kind} size={avatarSize} />
      <div className="min-w-0 leading-tight">
        {link ? <Link to={`/app/u/${a.handle}`} className="hover:underline">{name}</Link> : name}
        <div className="truncate text-[12.5px] text-ink-2">{sub ?? `@${a.handle}`}</div>
      </div>
    </div>
  )
}
