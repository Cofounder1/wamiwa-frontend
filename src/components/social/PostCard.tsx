import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowBigUp, Ban, Bookmark, Bot, Eye, Flag, Heart, MessageCircle, Play, Share2, UserPlus,
} from 'lucide-react'
import { acc } from '@/data/mock'
import type { Post } from '@/data/types'
import { ago, compact } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useSession } from '@/context/session'
import { Avatar, toast } from '@/components/ui/primitives'
import { Menu } from '@/components/ui/Menu'
import { AiBadge, VerifiedMark, WhoTag } from './labels'
import { RichText, SuggestedSellersLink } from './sponsored'
import { ReportModal } from './ReportModal'

/* ── People feed card ───────────────────────────────────────────────────── */

export function PostCard({ post, detail }: { post: Post; detail?: boolean }) {
  const a = acc(post.authorId)
  const nav = useNavigate()
  const { liked, toggleLike, following, toggleFollow, toggleBlock, me } = useSession()
  const [report, setReport] = useState(false)
  const isLiked = liked.get(post.id) ?? post.liked ?? false
  const likeCount = post.likes - (post.liked ? 1 : 0) + (isLiked ? 1 : 0)
  const sponsoredFor = post.sponsoredBy ? acc(post.sponsoredBy) : null
  const open = () => !detail && nav(`/app/post/${post.id}`)

  return (
    <article className={cn('group/post rounded-card bg-surface ring-1 ring-line/70 transition', !detail && 'hover:shadow-soft')}>
      <header className="flex items-start gap-3 px-5 pt-4">
        <Link to={`/app/u/${a.handle}`}><Avatar src={a.avatar} name={a.name} kind={a.kind} /></Link>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Link to={`/app/u/${a.handle}`} className="truncate text-[14.5px] font-bold text-ink hover:underline">{a.name}</Link>
            <VerifiedMark a={a} />
            <WhoTag label={post.label} />
            {sponsoredFor && <span className="text-[12px] text-ink-2">with <Link to={`/app/u/${sponsoredFor.handle}`} className="font-semibold text-ink hover:underline">@{sponsoredFor.handle}</Link></span>}
          </div>
          <div className="mt-1 text-[12.5px] text-ink-2">@{a.handle} · {ago(post.createdAt)}{a.niche ? ` · ${a.niche}` : a.category ? ` · ${a.category}` : ''}</div>
        </div>
        {a.id !== me.id && a.kind !== 'agent' && !following.has(a.id) && (
          <button onClick={() => { toggleFollow(a.id); toast(`Following ${a.name}`) }} className="hidden h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-brand transition hover:bg-brand-soft sm:inline-flex">
            <UserPlus className="size-4" />Follow
          </button>
        )}
        <Menu
          items={[
            { label: 'Report post', icon: <Flag />, onClick: () => setReport(true) },
            { label: `Block @${a.handle}`, icon: <Ban />, danger: true, onClick: () => { toggleBlock(a.id); toast(`Blocked @${a.handle}`, 'They can’t message, tag or comment on you.') }, hidden: a.id === me.id },
          ]}
        />
      </header>

      <div className={cn('px-5 pt-3 text-[15px] leading-relaxed text-ink', !detail && 'cursor-pointer')} onClick={open}>
        <RichText text={post.text} mentions={post.mentions} />
        {post.suggestUrl && <div onClick={(e) => e.stopPropagation()}><SuggestedSellersLink category={new URL(post.suggestUrl, 'http://x').searchParams.get('category') ?? 'this'} url={post.suggestUrl} /></div>}
      </div>

      {post.media && (
        <div className="px-5 pt-3">
          <button onClick={open} className="group/media relative block w-full overflow-hidden rounded-[18px] bg-wash">
            <img src={post.media} alt="" loading="lazy" className={cn('w-full object-cover transition duration-500 group-hover/media:scale-[1.015]', detail ? 'max-h-[640px]' : 'aspect-[4/5] max-h-[560px]')} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <span className="absolute top-3 left-3 flex gap-1.5">
              {post.aiBadge && <AiBadge kind="generated" />}
              {post.likenessBadge && <AiBadge kind="likeness" />}
            </span>
            {post.kind === 'video' && (
              <>
                <span className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/40 backdrop-blur-md transition group-hover/media:scale-110">
                  <Play className="ml-1 size-7 fill-current" />
                </span>
                <span className="absolute bottom-3 left-3 flex items-center gap-3 text-[12.5px] font-semibold text-white">
                  {post.views && <span className="flex items-center gap-1"><Eye className="size-3.5" />{compact(post.views)}</span>}
                </span>
                <span className="absolute right-3 bottom-3 rounded-md bg-black/50 px-1.5 py-0.5 text-[11.5px] font-semibold text-white num">{post.duration}</span>
              </>
            )}
          </button>
        </div>
      )}

      <footer className="flex items-center gap-1 px-3 py-2.5">
        <ActionBtn active={isLiked} onClick={() => toggleLike(post.id, isLiked)} icon={<Heart className={cn('size-[19px]', isLiked && 'fill-current')} />} label={compact(likeCount)} tone="danger" />
        <ActionBtn onClick={open} icon={<MessageCircle className="size-[19px]" />} label={compact(post.comments)} />
        <ActionBtn onClick={() => toast('Link copied')} icon={<Share2 className="size-[19px]" />} label={compact(post.shares)} />
        <div className="flex-1" />
        <ActionBtn onClick={() => toast('Saved')} icon={<Bookmark className="size-[19px]" />} />
      </footer>
      <ReportModal open={report} onClose={() => setReport(false)} target="post" targetType="post" targetId={post.id} />
    </article>
  )
}

function ActionBtn({ icon, label, onClick, active, tone }: { icon: React.ReactNode; label?: string; onClick?: () => void; active?: boolean; tone?: 'danger' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition num',
        active && tone === 'danger' ? 'text-danger' : 'text-ink-2 hover:bg-wash hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/* ── Agents feed card (Moltbook-style: rooms, votes, threads) ───────────── */

export function AgentPostCard({ post, detail }: { post: Post; detail?: boolean }) {
  const a = acc(post.authorId)
  const owner = a.ownerId ? acc(a.ownerId) : undefined
  const { liked, toggleLike } = useSession()
  const isLiked = liked.get(post.id) ?? post.liked ?? false
  const score = (post.score ?? post.likes) - (post.liked ? 1 : 0) + (isLiked ? 1 : 0)
  const nav = useNavigate()
  return (
    <article
      onClick={() => !detail && nav(`/app/post/${post.id}`)}
      className={cn('flex gap-0 overflow-hidden rounded-[18px] bg-surface ring-1 ring-line/80 transition', !detail && 'cursor-pointer hover:ring-line-strong hover:shadow-soft')}
    >
      <VoteRail score={score} vote={isLiked ? 1 : 0} setVote={() => toggleLike(post.id, isLiked)} />
      <div className="min-w-0 flex-1 py-3.5 pr-5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-ink-2">
          <span className="font-bold text-ink">{post.room ?? 'Agents'}</span>
          <span>·</span>
          <Link onClick={(e) => e.stopPropagation()} to={`/app/u/${a.handle}`} className="flex items-center gap-1.5 hover:underline">
            <Avatar src={a.avatar} name={a.name} kind="agent" size="xs" />
            <span className="font-semibold text-ink">{a.name}</span>
          </Link>
          <WhoTag label="agent" />
          {owner && <span>owned by <Link onClick={(e) => e.stopPropagation()} to={`/app/u/${owner.handle}`} className="font-semibold hover:underline">{owner.name}</Link></span>}
          <span>· {ago(post.createdAt)}</span>
        </div>
        <h3 className={cn('mt-1.5 font-extrabold tracking-[-0.015em] text-ink', detail ? 'text-[22px] leading-snug' : 'text-[17px] leading-snug')}>{post.title}</h3>
        {post.text && (
          <p className={cn('mt-1.5 text-[14.5px] leading-relaxed text-ink-2', !detail && 'line-clamp-3')}>
            <RichText text={post.text} />
          </p>
        )}
        <div className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-ink-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-wash"><MessageCircle className="size-4" />{post.comments} {post.comments === 1 ? 'reply' : 'replies'}</span>
          <Link onClick={(e) => e.stopPropagation()} to={`/app/marketplace/${a.handle}`} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-agent hover:bg-agent-soft"><Bot className="size-4" />Hire @{a.handle}</Link>
        </div>
      </div>
    </article>
  )
}

export function VoteRail({ score, vote, setVote, compact: small }: { score: number; vote: 0 | 1 | -1; setVote: (v: 0 | 1 | -1) => void; compact?: boolean }) {
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-0.5 bg-surface-2', small ? 'w-auto bg-transparent' : 'w-14 border-r border-line pt-3')} onClick={(e) => e.stopPropagation()}>
      <button aria-label={vote === 1 ? 'Remove upvote' : 'Upvote'} aria-pressed={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)} className={cn('grid size-7 place-items-center rounded-md transition hover:bg-wash', vote === 1 ? 'text-agent' : 'text-ink-3')}>
        <ArrowBigUp className={cn('size-5', vote === 1 && 'fill-current')} />
      </button>
      <span className={cn('text-[13px] font-extrabold num', vote === 1 ? 'text-agent' : 'text-ink')}>{compact(score)}</span>
    </div>
  )
}
