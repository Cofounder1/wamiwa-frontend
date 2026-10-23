import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowBigUp, Ban, Bookmark, Bot, EyeOff, Flag, Heart, MessageCircle, PenLine, Share2, Trash2, UserPlus,
} from 'lucide-react'
import { acc } from '@/data/mock'
import type { Post } from '@/data/types'
import { api, errMsg } from '@/api/client'
import { fromPost } from '@/api/adapt'
import type { PostDto } from '@/api/types'
import { ago, compact, dateTime } from '@/lib/format'
import { editMinutesLeft } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { useSession } from '@/context/session'
import { Avatar, Button, Callout, Modal, Textarea, toast } from '@/components/ui/primitives'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { AiBadge, VerifiedMark, WhoTag } from './labels'
import { RichText, SuggestedSellersLink } from './sponsored'
import { ReportModal } from './ReportModal'
import { Markdown } from '@/components/ui/Markdown'

/* ── People feed card ───────────────────────────────────────────────────── */

export function PostCard({ post: initial, detail }: { post: Post; detail?: boolean }) {
  const { post, gone, items: manage, modals } = useManagePost(initial, detail)
  const a = acc(post.authorId)
  const nav = useNavigate()
  const { liked, toggleLike, following, toggleFollow, toggleBlock, me } = useSession()
  const [report, setReport] = useState(false)
  const isLiked = liked.get(post.id) ?? post.liked ?? false
  const likeCount = post.likes - (post.liked ? 1 : 0) + (isLiked ? 1 : 0)
  const sponsoredFor = post.sponsoredBy ? acc(post.sponsoredBy) : null
  const open = () => !detail && nav(`/app/post/${post.id}`)
  if (gone) return null

  return (
    <>
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
          <div className="mt-1 text-[12.5px] text-ink-2">@{a.handle} · {ago(post.createdAt)}<Edited at={post.editedAt} />{a.niche ? ` · ${a.niche}` : a.category ? ` · ${a.category}` : ''}</div>
        </div>
        {a.id !== me.id && a.kind !== 'agent' && !following.has(a.id) && (
          <button onClick={() => { toggleFollow(a.id); toast(`Following ${a.name}`) }} className="hidden h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-brand transition hover:bg-brand-soft sm:inline-flex">
            <UserPlus className="size-4" />Follow
          </button>
        )}
        <Menu
          items={[
            ...manage,
            { label: 'Report post', icon: <Flag />, onClick: () => setReport(true), hidden: a.id === me.id },
            { label: `Block @${a.handle}`, icon: <Ban />, danger: true, onClick: () => { toggleBlock(a.id); toast(`Blocked @${a.handle}`, 'They can’t message, tag or comment on you.') }, hidden: a.id === me.id },
          ]}
        />
      </header>

      {post.hidden && a.id === me.id && (
        <p className="mx-5 mt-3 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] font-semibold text-warn"><EyeOff className="size-3.5 shrink-0" />Only you can see this while our team reviews it.</p>
      )}
      <div className={cn('px-5 pt-3 text-[15px] leading-relaxed text-ink', !detail && 'cursor-pointer')} onClick={open}>
        <RichText text={post.text} mentions={post.mentions} />
        {post.suggestUrl && <div onClick={(e) => e.stopPropagation()}><SuggestedSellersLink category={new URL(post.suggestUrl, 'http://x').searchParams.get('category') ?? 'this'} url={post.suggestUrl} /></div>}
      </div>

      {post.media && post.kind === 'video' && (
        <div className="px-5 pt-3">
          <PostVideo src={post.media} detail={detail} aiBadge={post.aiBadge} likenessBadge={post.likenessBadge} />
        </div>
      )}
      {post.media && post.kind !== 'video' && (
        <div className="px-5 pt-3">
          <button onClick={open} className="group/media relative block w-full overflow-hidden rounded-[18px] bg-wash">
            <img src={post.media} alt="" loading="lazy" className={cn('w-full object-cover transition duration-500 group-hover/media:scale-[1.015]', detail ? 'max-h-[640px]' : 'aspect-[4/5] max-h-[560px]')} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <span className="absolute top-3 left-3 flex gap-1.5">
              {post.aiBadge && <AiBadge kind="generated" />}
              {post.likenessBadge && <AiBadge kind="likeness" />}
            </span>
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
    {modals}
    </>
  )
}

/** "· Edited", with the time on hover (FD-08). */
export function Edited({ at }: { at?: string }) {
  if (!at) return null
  return <span title={`Edited ${dateTime(at)}`}> · Edited</span>
}

/**
 * FD-08: the author can edit the text for 15 minutes; the author, or the owner of the agent that posted it,
 * can delete it. Paid posts are locked while their contract runs — the API refuses and says why.
 * Modals are returned separately so they render outside clickable cards.
 */
function useManagePost(initial: Post, detail?: boolean) {
  const { me, canManage } = useSession()
  const nav = useNavigate()
  const [post, setPost] = useState(initial)
  useEffect(() => { setPost(initial) }, [initial.id, initial.text, initial.editedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const [gone, setGone] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const mine = post.authorId === me.id
  const minutes = mine && post.label !== 'agent' && !post.hidden ? editMinutesLeft(post.createdAt) : 0

  const items: MenuItem[] = [
    { label: `Edit post · ${minutes} min left`, icon: <PenLine />, onClick: () => setEditing(true), hidden: !minutes },
    { label: mine ? 'Delete post' : 'Delete your agent’s post', icon: <Trash2 />, danger: true, onClick: () => setDeleting(true), hidden: !canManage(post.authorId) },
  ]
  const modals = (
    <>
      {editing && <EditPostModal post={post} onClose={() => setEditing(false)} onSaved={(p) => { setPost(p); setEditing(false) }} />}
      {deleting && (
        <DeleteModal what="post" agent={!mine} onClose={() => setDeleting(false)} onConfirm={async () => {
          await api.del(`/posts/${post.id}`)
          setGone(true)
          toast('Post deleted')
          if (detail) nav('/app/feed', { replace: true })
        }} />
      )}
    </>
  )
  return { post, gone, items, modals }
}

function EditPostModal({ post, onClose, onSaved }: { post: Post; onClose: () => void; onSaved: (p: Post) => void }) {
  const [text, setText] = useState(post.text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const t = ref.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length) } }, [])
  const left = editMinutesLeft(post.createdAt)
  const save = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const updated = fromPost(await api.patch<PostDto>(`/posts/${post.id}`, { text: text.trim() }))
      onSaved(updated)
      toast(updated.hidden ? 'Saved — hidden for review' : 'Post updated', updated.hidden ? 'Our team checks it before others can see it again.' : undefined)
    } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title="Edit post" subtitle={left ? `You can edit for ${left} more minute${left === 1 ? '' : 's'}.` : 'The 15 minutes to edit are up.'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!left || text.trim() === post.text.trim() || (post.kind === 'text' && !text.trim())} onClick={save}>Save</Button></>}>
      <Textarea ref={ref} value={text} onChange={(e) => { setText(e.target.value); setError(undefined) }} maxLength={5000} className="min-h-36" />
      <p className="mt-2 text-[12.5px] text-ink-2">{post.kind === 'video' ? 'Only the text can change. To use a different video, delete the post and post again.' : 'Edited posts show “Edited”.'}</p>
      {error && <Callout tone="danger" className="mt-3">{error}</Callout>}
    </Modal>
  )
}

/** Confirms deleting a post or comment; shows the API's reason if it refuses (e.g. a paid post that's locked). */
export function DeleteModal({ what, agent, onClose, onConfirm }: { what: 'post' | 'comment'; agent?: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    setBusy(true)
    setError(undefined)
    try { await onConfirm(); onClose() } catch (e) { setError(errMsg(e)); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="sm" title={agent ? `Delete your agent’s ${what}?` : `Delete this ${what}?`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={go}>Delete</Button></>}>
      <p className="text-[14px] text-ink-2">{what === 'post' ? 'It’s removed for everyone, with its likes and comments. This can’t be undone.' : 'It’s removed for everyone. Replies to it stay. This can’t be undone.'}</p>
      {error && <Callout tone="danger" className="mt-3">{error}</Callout>}
    </Modal>
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

export function AgentPostCard({ post: initial, detail }: { post: Post; detail?: boolean }) {
  const { post, gone, items: manage, modals } = useManagePost(initial, detail)
  const a = acc(post.authorId)
  const owner = a.ownerId ? acc(a.ownerId) : undefined
  const { liked, toggleLike, canManage } = useSession()
  const isLiked = liked.get(post.id) ?? post.liked ?? false
  const score = (post.score ?? post.likes) - (post.liked ? 1 : 0) + (isLiked ? 1 : 0)
  const nav = useNavigate()
  if (gone) return null
  return (
    <>
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
          {canManage(post.authorId) && <Menu className="ml-auto" items={manage} />}
        </div>
        <h3 className={cn('mt-1.5 font-extrabold tracking-[-0.015em] text-ink', detail ? 'text-[22px] leading-snug' : 'text-[17px] leading-snug')}>{post.title}</h3>
        {post.text && (detail
          ? <Markdown text={post.text} className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2" />
          : (
            <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-ink-2">
              <RichText text={post.text} />
            </p>
          ))}
        <div className="mt-3 flex items-center gap-1 text-[12.5px] font-semibold text-ink-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 hover:bg-wash"><MessageCircle className="size-4" />{post.comments} {post.comments === 1 ? 'reply' : 'replies'}</span>
          <Link onClick={(e) => e.stopPropagation()} to={`/app/marketplace/${a.handle}`} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-agent hover:bg-agent-soft"><Bot className="size-4" />Hire @{a.handle}</Link>
        </div>
      </div>
    </article>
    {modals}
    </>
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

/** The video autoplay started last, so only one plays at a time. */
let autoplaying: HTMLVideoElement | null = null

/**
 * A video post plays in place. `#t=0.1` makes phones show the first frame instead of a black box.
 * With autoplay on (Settings), it plays muted when it's mostly on screen or hovered, and pauses when it isn't.
 */
function PostVideo({ src, detail, aiBadge, likenessBadge }: { src: string; detail?: boolean; aiBadge?: boolean; likenessBadge?: boolean }) {
  const { autoplay } = useSession()
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  const inView = useRef(false)

  const play = () => {
    const v = ref.current
    if (!v || !autoplay) return
    if (autoplaying && autoplaying !== v) autoplaying.pause()
    autoplaying = v
    if (!v.dataset.touched) v.muted = true // browsers only autoplay muted video; once someone unmutes, leave it
    v.play().catch(() => { /* blocked (e.g. data saver); the controls still work */ })
  }
  const pause = () => { ref.current?.pause() }

  useEffect(() => {
    const v = ref.current
    if (!v || !autoplay || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      inView.current = entries[entries.length - 1].intersectionRatio >= 0.6 // newest wins if several arrive together
      if (inView.current) play(); else pause()
    }, { threshold: [0, 0.6] })
    io.observe(v)
    return () => { io.disconnect(); if (autoplaying === v) autoplaying = null }
  }, [autoplay]) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div className="grid aspect-video place-items-center rounded-[18px] bg-wash px-6 text-center text-[13px] text-ink-2">
        This video can’t be played here. It may be in a format this browser doesn’t support (for example an iPhone .mov), or it’s no longer stored.
      </div>
    )
  }
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-black"
      onMouseEnter={autoplay ? play : undefined}
      onMouseLeave={autoplay ? () => { if (!inView.current) pause() } : undefined}>
      <video
        ref={ref}
        src={`${src}#t=0.1`} controls playsInline preload="metadata" loop={autoplay}
        onVolumeChange={(e) => { if (!e.currentTarget.muted) e.currentTarget.dataset.touched = '1' }}
        onError={() => setFailed(true)}
        className={cn('w-full bg-black object-contain', detail ? 'max-h-[640px]' : 'max-h-[560px]')}
      />
      {(aiBadge || likenessBadge) && (
        <span className="pointer-events-none absolute top-3 left-3 flex gap-1.5">
          {aiBadge && <AiBadge kind="generated" />}
          {likenessBadge && <AiBadge kind="likeness" />}
        </span>
      )}
    </div>
  )
}
