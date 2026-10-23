import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, Bot, Check, Clock, Flag, Info, PenLine, Send, Store, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react'
import { acc } from '@/data/mock'
import type { Comment } from '@/data/types'
import { api, errMsg } from '@/api/client'
import { fromComments, fromMarketAgent } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { CommentDto, MarketAgentDto } from '@/api/types'
import { ago } from '@/lib/format'
import { editMinutesLeft, LIMITS } from '@/lib/rules'
import { cn } from '@/lib/cn'
import { useSession } from '@/context/session'
import { Avatar, Button, toast } from '@/components/ui/primitives'
import { Menu } from '@/components/ui/Menu'
import { ErrorState, LoadMore, RowSkeleton } from '@/components/ui/states'
import { VerifiedMark, WhoTag } from './labels'
import { RichText, SuggestedSellersLink } from './sponsored'
import { ReportModal } from './ReportModal'
import { Edited, VoteRail } from './PostCard'
import { Markdown } from '@/components/ui/Markdown'

export function CommentThread({ postId, postAuthorId, variant = 'people', onCountChange }: {
  postId: string; postAuthorId: string; variant?: 'people' | 'agents'
  /** Called with +1 or -1 as visible comments are added or deleted here, so the count above stays right. */
  onCountChange?: (delta: number) => void
}) {
  const list = usePaged<CommentDto, CommentDto>(
    (cursor, signal) => api.page<CommentDto>(`/posts/${postId}/comments`, { cursor, limit: 30 }, signal),
    (c) => c,
    [postId],
  )
  const [added, setAdded] = useState<CommentDto[]>([])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [edited, setEdited] = useState<Map<string, Comment>>(new Map())

  // Merge server pages with comments posted in this session (replies are nested by parent).
  // A deleted comment with replies stays as "[deleted]" so its replies keep their place, as after a reload.
  const merged = mergeTree(list.items, added)
  const all = fromComments(merged)
  const hasReplies = (id: string) => all.some((c) => c.parentId === id && !removed.has(c.id))
  const items = all
    .filter((c) => !removed.has(c.id) || hasReplies(c.id))
    .map((c) => (removed.has(c.id) ? { ...c, text: '[deleted]', mentions: undefined, suggest: undefined, editedAt: undefined } : edited.get(c.id) ?? c))
  const roots = items.filter((c) => !c.parentId)
  const childrenOf = (id: string) => items.filter((c) => c.parentId === id)

  // FD-04: while a tagged agent hasn't answered, check back every few seconds.
  const pending = items.some((c) => c.tagState === 'pending' && !c.late)
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => { list.reload(); setAdded([]) }, 6000)
    return () => clearInterval(t)
  }, [pending, list.reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (text: string, parentId?: string) => {
    const created = await api.post<CommentDto>(`/posts/${postId}/comments`, { text, parent_id: parentId ?? null })
    setAdded((x) => [...x, created])
    if (created.moderation_status === 'visible') onCountChange?.(1) // a comment hidden for review isn't counted
  }
  const remove = async (id: string) => {
    try {
      await api.del(`/comments/${id}`)
      const wasCounted = !removed.has(id) && !items.find((c) => c.id === id)?.hidden
      setRemoved((s) => new Set(s).add(id))
      if (wasCounted) onCountChange?.(-1)
      toast('Comment deleted')
    } catch (e) { toast('Couldn’t delete', errMsg(e), 'danger') }
  }
  /** FD-08: the new text is moderated again; if it's flagged the comment is hidden (and uncounted) while reviewed. */
  const edit = async (id: string, text: string) => {
    const before = items.find((c) => c.id === id)
    const dto = await api.patch<CommentDto>(`/comments/${id}`, { text })
    const after = fromComments([{ ...dto, replies: [], agent_tags: [] }])[0]
    setEdited((m) => new Map(m).set(id, { ...after, parentId: before?.parentId }))
    if (after.hidden && !before?.hidden) { onCountChange?.(-1); toast('Saved — hidden for review', 'Our team checks it before others can see it again.') }
  }

  return (
    <div>
      <Composer onSubmit={(t) => add(t)} />
      <div className={cn('mt-5', variant === 'people' ? 'space-y-1' : 'space-y-3')}>
        {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} />
          : list.loading && !items.length ? <RowSkeleton rows={3} />
            : roots.map((c) => <CommentNode key={c.id} c={c} childrenOf={childrenOf} postAuthorId={postAuthorId} onReply={add} onDelete={remove} onEdit={edit} variant={variant} depth={0} />)}
        {!list.loading && !list.error && roots.length === 0 && <p className="py-8 text-center text-sm text-ink-2">No comments yet. Start the conversation.</p>}
        <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
      </div>
    </div>
  )
}

/** Inserts session-created comments into the fetched tree (as roots or as replies). */
function mergeTree(server: CommentDto[], added: CommentDto[]): CommentDto[] {
  const ids = new Set<string>()
  const walk = (c: CommentDto) => { ids.add(c.id); c.replies.forEach(walk) }
  server.forEach(walk)
  const extra = added.filter((a) => !ids.has(a.id))
  const attach = (list: CommentDto[]): CommentDto[] => list.map((c) => ({
    ...c, replies: attach([...c.replies, ...extra.filter((e) => e.parent_id === c.id)]),
  }))
  return [...extra.filter((e) => !e.parent_id).reverse(), ...attach(server)]
}

function CommentNode({ c, childrenOf, postAuthorId, onReply, onDelete, onEdit, variant, depth }: {
  c: Comment; childrenOf: (id: string) => Comment[]; postAuthorId: string
  onReply: (t: string, parent: string) => Promise<void>; onDelete: (id: string) => void; onEdit: (id: string, text: string) => Promise<void>
  variant: 'people' | 'agents'; depth: number
}) {
  const a = acc(c.authorId)
  const { me, canManage } = useSession()
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [report, setReport] = useState(false)
  const [rating, setRating] = useState<boolean | null>(null)
  const kids = childrenOf(c.id)
  const isTag = c.id.includes(':tag:')
  // Delete: your own comments, replies made on your behalf, and anything your agents wrote (FD-08).
  const mine = canManage(c.authorId) || (c.label === 'autoreply' && c.onBehalfOf === me.id)
  // Edit: only comments you typed yourself, for 15 minutes, and not while under review.
  const minutesLeft = c.authorId === me.id && c.label === 'human' && !c.hidden && c.text !== '[deleted]' ? editMinutesLeft(c.createdAt) : 0

  const rate = async (helpful: boolean) => {
    const prev = rating
    setRating(helpful)
    try { await api.put(`/comments/${c.id}/rating`, { helpful }) } catch (e) { setRating(prev); toast('Couldn’t save rating', errMsg(e), 'danger') }
  }

  return (
    <div className={cn('relative', depth > 0 && 'mt-1 pl-5 sm:pl-8')}>
      {depth > 0 && <span className="absolute top-0 bottom-3 left-2 w-px bg-line sm:left-3.5" />}
      <div className={cn('group flex gap-3 rounded-2xl py-2.5 pr-2', variant === 'agents' && depth === 0 && 'bg-surface px-3 ring-1 ring-line/70')}>
        {variant === 'agents' && <VoteRail compact score={c.likes + (rating ? 1 : 0)} vote={rating ? 1 : 0} setVote={(v) => rate(v === 1)} />}
        <Link to={`/app/u/${a.handle}`} className="shrink-0"><Avatar src={a.avatar} name={a.name} kind={a.kind} size="sm" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-tight">
            <Link to={`/app/u/${a.handle}`} className="text-[13.5px] font-bold text-ink hover:underline">{a.name}</Link>
            <VerifiedMark a={a} className="size-3.5" />
            <WhoTag label={c.label} onBehalfOf={c.onBehalfOf} />
            {a.kind === 'agent' && a.ownerId && <span className="text-[11.5px] text-ink-3">by {acc(a.ownerId).name}</span>}
            {!isTag && <span className="text-[12px] text-ink-3">· {ago(c.createdAt)}<Edited at={c.editedAt} /></span>}
          </div>

          {editing ? <EditBox initial={c.text} onCancel={() => setEditing(false)} onSave={async (t) => { await onEdit(c.id, t); setEditing(false) }} />
            : c.hidden ? <p className="mt-1 text-[13px] text-ink-3 italic">Hidden while our team reviews it.</p> : <TagBody c={c} postAuthorId={postAuthorId} />}
          {c.suggest && <SuggestedSellersLink category={c.suggest} url={c.suggestUrl} />}

          {!isTag && !editing && (
            <div className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-ink-3">
              {a.kind === 'agent' && c.authorId !== me.id && variant === 'people' && (
                <span className="mr-1 inline-flex items-center gap-0.5">
                  <span className="mr-1">Helpful?</span>
                  <button aria-label="Helpful" aria-pressed={rating === true} onClick={() => rate(true)} className={cn('grid size-7 place-items-center rounded-full hover:bg-wash', rating === true && 'text-success')}><ThumbsUp className="size-3.5" /></button>
                  <button aria-label="Not helpful" aria-pressed={rating === false} onClick={() => rate(false)} className={cn('grid size-7 place-items-center rounded-full hover:bg-wash', rating === false && 'text-danger')}><ThumbsDown className="size-3.5" /></button>
                </span>
              )}
              <button onClick={() => setReplying(!replying)} className="inline-flex h-7 items-center rounded-full px-2 hover:bg-wash hover:text-ink">Reply</button>
              {minutesLeft > 0 && (
                <button onClick={() => setEditing(true)} title={`You can edit for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}`} className="inline-flex h-7 items-center gap-1 rounded-full px-2 opacity-0 transition group-hover:opacity-100 hover:bg-wash hover:text-ink focus:opacity-100"><PenLine className="size-3" />Edit</button>
              )}
              {mine ? (
                <button onClick={() => onDelete(c.id)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-danger opacity-0 transition group-hover:opacity-100 hover:bg-danger-soft focus:opacity-100"><Trash2 className="size-3" />Delete</button>
              ) : (
                <button onClick={() => setReport(true)} className="inline-flex h-7 items-center gap-1 rounded-full px-2 opacity-0 transition group-hover:opacity-100 hover:bg-wash hover:text-ink focus:opacity-100"><Flag className="size-3" />Report</button>
              )}
            </div>
          )}
          {replying && <div className="mt-2"><Composer compact autoFocus onSubmit={async (t) => { await onReply(t, c.id); setReplying(false) }} /></div>}
        </div>
        {!isTag && !mine && <Menu className="opacity-0 transition group-hover:opacity-100" items={[{ label: 'Report comment', icon: <Flag />, onClick: () => setReport(true) }]} />}
      </div>
      {kids.map((k) => <CommentNode key={k.id} c={k} childrenOf={childrenOf} postAuthorId={postAuthorId} onReply={onReply} onDelete={onDelete} onEdit={onEdit} variant={variant} depth={depth + 1} />)}
      <ReportModal open={report} onClose={() => setReport(false)} target="comment" targetType="comment" targetId={c.id} />
    </div>
  )
}

/** Inline comment editor: Enter saves, Escape cancels; the API's message shows if it refuses. */
function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const save = async () => {
    const t = text.trim()
    if (!t || busy) return
    if (t === initial.trim()) { onCancel(); return }
    setBusy(true)
    setError(undefined)
    try { await onSave(t) } catch (e) { setError(errMsg(e)); setBusy(false) }
  }
  return (
    <div className="mt-1.5">
      <div className={cn('flex items-center gap-1 rounded-pill border bg-surface pr-1 pl-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15', error ? 'border-danger' : 'border-line')}>
        <input autoFocus value={text} maxLength={2000} aria-label="Edit comment"
          onChange={(e) => { setText(e.target.value); setError(undefined) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onCancel() }}
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] focus:outline-none" />
        <button onClick={onCancel} aria-label="Cancel edit" className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-wash"><X className="size-3.5" /></button>
        <button onClick={save} disabled={!text.trim() || busy} aria-label="Save edit" className="grid size-7 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"><Check className="size-3.5" /></button>
      </div>
      {error && <p className="mt-1.5 pl-3 text-xs text-danger">{error}</p>}
    </div>
  )
}

/** FD-04 tag outcomes: replied, capped, unavailable, or still waiting. */
function TagBody({ c }: { c: Comment; postAuthorId?: string }) {
  const a = acc(c.authorId)
  if (c.tagState === 'capped') {
    return (
      <div className="mt-1.5 rounded-2xl border border-line bg-surface-2 p-3 text-[13.5px] text-ink-2">
        <p>{c.text || 'I am currently not available for free tag, you can check me out in the marketplace to see how I can help you with this and more'}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="xs" to={`/app/marketplace/${a.handle}`} icon={<Store className="size-3.5" />}>See @{a.handle} in marketplace</Button>
          <Button size="xs" variant="outline" to="/app/marketplace">Check other agents</Button>
        </div>
      </div>
    )
  }
  if (c.tagState === 'unavailable') {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line-strong p-3 text-[13.5px] text-ink-2">
        <Info className="size-4 text-ink-3" /> {c.text || 'This agent is no longer available.'}
        <Link to="/app/marketplace" className="link">See similar agents</Link>
      </div>
    )
  }
  if (c.tagState === 'pending') {
    return c.late ? (
      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-3"><Clock className="size-3.5" />No response yet</div>
    ) : (
      <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-agent">
        <Bot className="size-3.5" /> @{a.handle} is writing
        <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="size-1 animate-typing rounded-full bg-current" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
      </div>
    )
  }
  if (c.label === 'agent' || c.label === 'autoreply') {  // agents may answer in plain text or with structure
    return <Markdown text={c.text} className="mt-1 text-[14px] leading-relaxed text-ink" />
  }
  return (
    <p className="mt-1 text-[14px] leading-relaxed text-ink">
      <RichText text={c.text} mentions={c.mentions} />
    </p>
  )
}

/** Comment composer with @agent autocomplete from the live marketplace; max 3 agents per comment (FD-04). */
export function Composer({ onSubmit, compact: small, autoFocus }: { onSubmit: (t: string) => Promise<void>; compact?: boolean; autoFocus?: boolean }) {
  const { me } = useSession()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const ref = useRef<HTMLInputElement>(null)
  const query = text.match(/@([a-z0-9_]*)$/i)?.[1]
  const agents = useApi(query !== undefined ? (s) => api.page<MarketAgentDto>('/marketplace/agents', { q: query || undefined, limit: 6 }, s) : null, [query])
  const suggestions = query !== undefined ? (agents.data?.data ?? []).filter((a) => a.handle !== 'wamiwa' && a.handle.startsWith(query.toLowerCase())).map((a) => ({ dto: a, acc: fromMarketAgent(a) })) : []
  // The 3-agents-per-comment limit (FD-04) is enforced by the API; its message is shown below the box.

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit(text.trim())
      setText('')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <div className={cn('flex items-center gap-2 rounded-pill border bg-surface pr-1.5 pl-1.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15', error ? 'border-danger' : 'border-line')}>
        {!small && <Avatar src={me.avatar} name={me.name} kind={me.kind} size="sm" />}
        <input
          ref={ref}
          autoFocus={autoFocus}
          value={text}
          maxLength={2000}
          onChange={(e) => { setText(e.target.value); setError(undefined) }}
          onKeyDown={(e) => e.key === 'Enter' && !suggestions.length && submit()}
          placeholder={small ? 'Write a reply…' : 'Add a comment — type @ to ask an agent'}
          className={cn('min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-ink-3 focus:outline-none', small ? 'h-9 pl-3' : 'h-11')}
        />
        <button onClick={() => { setText((t) => t + (t.endsWith(' ') || !t ? '@' : ' @')); ref.current?.focus() }} aria-label="Tag an agent" className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-wash hover:text-agent">
          <AtSign className="size-4" />
        </button>
        <button onClick={submit} disabled={!text.trim() || busy} aria-label="Send" className="grid size-8 place-items-center rounded-full bg-brand text-on-brand transition disabled:opacity-40">
          <Send className="size-3.5" />
        </button>
      </div>
      {error && <p className="mt-1.5 pl-4 text-xs text-danger">{error}</p>}
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-30 mt-2 w-72 animate-pop rounded-2xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
          <div className="px-3 pt-1.5 pb-1 text-[11px] font-bold tracking-wide text-ink-3 uppercase">Tag an agent · up to {LIMITS.agentsPerComment}</div>
          {suggestions.map(({ dto, acc: a }) => (
            <button
              key={a.id}
              onClick={() => { setText((t) => t.replace(/@([a-z0-9_]*)$/i, `@${a.handle} `)); ref.current?.focus() }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-wash"
            >
              <Avatar src={a.avatar} name={a.name} kind="agent" size="sm" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-bold text-ink">{a.name}</div>
                <div className="truncate text-[11.5px] text-ink-2">{a.skills?.slice(0, 2).join(' · ')}</div>
              </div>
              {dto.paused ? <span className="text-[11px] font-semibold text-ink-3">Paused</span>
                : <span className="text-[11px] font-semibold text-teal num">{dto.free_tags_left ?? dto.free_tag_daily_cap} free/day</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
