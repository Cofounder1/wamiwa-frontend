import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, CheckCheck, FileText, Flag, Image as ImageIcon, Loader2, Paperclip, Send, ShieldCheck } from 'lucide-react'
import { acc } from '@/data/mock'
import { api, ApiError, mediaUrl } from '@/api/client'
import { fromAuthor } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { ConversationDto, MessageDto, ProfileDto } from '@/api/types'
import { ago } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useSession } from '@/context/session'
import { Avatar, Badge, Button, Callout, Tabs, toast } from '@/components/ui/primitives'
import { Menu } from '@/components/ui/Menu'
import { ErrorState, LoadMore, RowSkeleton } from '@/components/ui/states'
import { VerifiedMark, WhoTag } from '@/components/social/labels'
import { ReportModal } from '@/components/social/ReportModal'

type ChatTab = 'primary' | 'requests' | 'business'
interface Attachment { kind: 'image' | 'video' | 'voice' | 'document'; ref: string; size_bytes: number; name?: string }
interface ThreadDto { conversation: { id: string; type: string; accepted: boolean }; messages: (MessageDto & { attachments: Attachment[] })[]; typing: string[] }

export default function Messages() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const to = params.get('to')
  const nav = useNavigate()
  const [tab, setTab] = useState<ChatTab>('primary')
  const list = usePaged<ConversationDto, ConversationDto>((cursor, s) => api.page<ConversationDto>('/conversations', { tab, cursor, limit: 30 }, s), (c) => {
    c.with.forEach(fromAuthor)
    return c
  }, [tab])
  const active = list.items.find((c) => c.id === id)

  return (
    <div className="-mx-4 -mt-6 -mb-28 flex h-[calc(100dvh-56px)] overflow-hidden border-line bg-surface sm:-mx-6 lg:m-0 lg:h-[calc(100dvh-80px)] lg:rounded-[24px] lg:border lg:shadow-card">
      <aside className={cn('flex w-full flex-col border-r border-line md:w-[340px] md:shrink-0', (id || to) && 'hidden md:flex')}>
        <div className="px-5 pt-5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-ink">Messages</h1>
          <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[{ value: 'primary', label: 'Primary' }, { value: 'requests', label: 'Requests' }, { value: 'business', label: 'Business' }]} />
        </div>
        {tab === 'requests' && <p className="px-5 pt-3 text-[12px] text-ink-3">First messages from accounts you don’t follow. Accept or delete.</p>}
        <ul className="scroll-thin flex-1 overflow-y-auto p-2">
          {list.error ? <ErrorState compact error={list.error} onRetry={list.reload} /> : list.loading ? <RowSkeleton /> : list.items.map((c) => {
            const other = c.with[0] ? acc(c.with[0].id) : undefined
            return (
              <li key={c.id}>
                <Link to={`/app/messages/${c.id}`} className={cn('flex items-center gap-3 rounded-2xl px-3 py-3 transition', c.id === id ? 'bg-brand-soft' : 'hover:bg-wash')}>
                  {other && <Avatar src={other.avatar} name={other.name} kind={other.kind} />}
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1">
                      <span className={cn('truncate text-[14px] text-ink', c.unread ? 'font-extrabold' : 'font-semibold')}>{other?.name ?? 'Conversation'}</span>
                      <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-ink-3">{c.last_message_at ? ago(c.last_message_at) : ''}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {c.type !== 'direct' && <Badge tone={c.type === 'order' ? 'agent' : 'neutral'} className="!text-[10px] !leading-4">{c.type === 'order' ? 'Order' : c.type === 'contract' ? 'Contract' : 'Business'}</Badge>}
                      <span className="truncate text-[13px] text-ink-2">{c.last_message ?? '@' + (other?.handle ?? '')}</span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
          {!list.loading && !list.error && list.items.length === 0 && <li className="py-12 text-center text-sm text-ink-2">No conversations here.</li>}
          <LoadMore show={list.hasMore} loading={list.loadingMore} onClick={list.more} />
        </ul>
      </aside>

      {id ? (
        <Thread key={id} conversationId={id} meta={active} onBack={() => nav('/app/messages')} onChanged={list.reload} />
      ) : to ? (
        <NewThread recipientId={to} onBack={() => nav('/app/messages')} onCreated={(cid) => { list.reload(); nav(`/app/messages/${cid}`, { replace: true }) }} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center text-center md:flex">
          <div className="grid size-16 place-items-center rounded-2xl bg-wash text-brand"><Send className="size-7" /></div>
          <h2 className="mt-4 text-lg font-bold text-ink">Your messages</h2>
          <p className="mt-1 max-w-xs text-[13.5px] text-ink-2">Chat with people and companies. Agents only talk to hirers inside order threads.</p>
        </div>
      )}
    </div>
  )
}

function Thread({ conversationId, meta, onBack, onChanged }: { conversationId: string; meta?: ConversationDto; onBack: () => void; onChanged: () => void }) {
  const { me, blocked, toggleBlock } = useSession()
  const res = useApi((s) => api.get<ThreadDto>(`/conversations/${conversationId}/messages`, { limit: 50 }, s), [conversationId])
  const [sent, setSent] = useState<(MessageDto & { attachments: Attachment[] })[]>([])
  const [report, setReport] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const other = meta?.with[0] ? acc(meta.with[0].id) : undefined

  // Poll for new messages and typing while the thread is open.
  useEffect(() => { const t = setInterval(() => { res.reload() }, 5000); return () => clearInterval(t) }, [res.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  const serverMsgs = res.data?.messages ?? []
  const messages = [...serverMsgs, ...sent.filter((m) => !serverMsgs.some((s) => s.id === m.id))].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const isRequest = res.data ? !res.data.conversation.accepted : meta ? !meta.accepted : false
  const typing = (res.data?.typing ?? []).filter((t) => t !== me.id)
  const isBlocked = other ? blocked.has(other.id) : false
  const send = async (body: string, attachments: Attachment[]) => {
    const m = await api.post<MessageDto & { attachments: Attachment[] }>(`/conversations/${conversationId}/messages`, { body, attachments })
    setSent((x) => [...x, m])
  }
  const respond = async (action: 'accept' | 'delete') => {
    try { await api.post(`/conversations/${conversationId}/request/${action}`); toast(action === 'accept' ? 'Request accepted' : 'Request deleted'); onChanged(); if (action === 'delete') onBack(); else res.reload() } catch (e) { toast('Couldn’t update', (e as ApiError).message, 'danger') }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={onBack} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-wash md:hidden"><ArrowLeft className="size-5" /></button>
        {other && <Avatar src={other.avatar} name={other.name} kind={other.kind} />}
        <div className="min-w-0 flex-1 leading-tight">
          {other && <Link to={`/app/u/${other.handle}`} className="flex items-center gap-1 font-bold text-ink hover:underline">{other.name}<VerifiedMark a={other} />{other.kind === 'agent' && <WhoTag label="agent" className="ml-1" />}</Link>}
          <div className="text-[12px] text-ink-2">{typing.length ? <span className="text-teal">typing…</span> : meta?.type === 'order' ? 'Order thread · visible to the agent owner and admins in a dispute' : meta?.type === 'contract' ? 'Contract thread · admins can see this' : other ? '@' + other.handle : ''}</div>
        </div>
        {meta?.contract_id && <Button size="sm" variant="outline" to={meta.type === 'order' ? `/app/orders/${meta.contract_id}` : `/app/contracts/${meta.contract_id}`}>View {meta.type === 'order' ? 'order' : 'contract'}</Button>}
        <Menu items={[
          { label: 'Report chat', icon: <Flag />, onClick: () => setReport(true) },
          { label: isBlocked ? 'Unblock' : 'Block', icon: <Ban />, danger: !isBlocked, hidden: !other, onClick: () => { toggleBlock(other!.id, !isBlocked); toast(isBlocked ? 'Unblocked' : 'Blocked', isBlocked ? undefined : 'Active contracts continue; their messages move to the contract thread.') } },
        ]} />
      </header>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-bg-2 px-4 py-6 sm:px-8">
        {meta?.type === 'business' && other?.kind === 'company' && (
          <Callout tone="neutral" icon={<ShieldCheck />} className="mx-auto max-w-md">Business chat with a company. Keep payments and contact details on Wamiwa so you’re covered by escrow and disputes.</Callout>
        )}
        {res.error && <ErrorState compact error={res.error} onRetry={res.reload} />}
        {!res.data && !res.error && <div className="grid place-items-center py-10 text-ink-3"><Loader2 className="size-5 animate-spin" /></div>}
        {messages.map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === me.id} />)}
        {typing.length > 0 && other && (
          <div className="flex items-center gap-2">
            <Avatar src={other.avatar} name={other.name} kind={other.kind} size="xs" />
            <span className="flex gap-1 rounded-full bg-surface px-3 py-2.5 ring-1 ring-line">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-typing rounded-full bg-ink-3" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
          </div>
        )}
        <div ref={end} />
      </div>

      {isRequest ? (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line p-4">
          <p className="w-full text-center text-[13px] text-ink-2">{other?.name ?? 'This account'} wants to message you. They won’t know you’ve seen this until you accept.</p>
          <Button onClick={() => respond('accept')}>Accept</Button>
          <Button variant="outline" onClick={() => respond('delete')}>Delete</Button>
          {other && <Button variant="ghost" className="text-danger" onClick={() => { toggleBlock(other.id, true); respond('delete') }}>Block</Button>}
        </div>
      ) : isBlocked ? (
        <div className="border-t border-line p-4 text-center text-[13.5px] text-ink-2">You can’t message this account. <button className="link" onClick={() => toggleBlock(other!.id, false)}>Unblock</button></div>
      ) : (
        <ChatComposer conversationId={conversationId} onSend={send} />
      )}
      <ReportModal open={report} onClose={() => setReport(false)} target="chat" targetType="conversation" targetId={conversationId} />
    </section>
  )
}

function NewThread({ recipientId, onBack, onCreated }: { recipientId: string; onBack: () => void; onCreated: (conversationId: string) => void }) {
  const known = acc(recipientId)
  const profile = useApi(known.handle === 'unknown' ? null : (s) => api.get<ProfileDto>(`/profiles/${known.handle}`, undefined, s), [recipientId])
  const send = async (body: string, attachments: Attachment[]) => {
    const m = await api.post<MessageDto>('/messages', { recipient_id: recipientId, body, attachments })
    onCreated(m.conversation_id)
  }
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={onBack} aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-wash md:hidden"><ArrowLeft className="size-5" /></button>
        <Avatar src={known.avatar} name={known.name} kind={known.kind} />
        <div className="leading-tight"><div className="font-bold text-ink">{known.name}</div><div className="text-[12px] text-ink-2">New message</div></div>
      </header>
      <div className="flex flex-1 items-center justify-center bg-bg-2 p-6 text-center text-[13.5px] text-ink-2">
        {profile.data?.can_message === false ? 'You can’t message this account.' : `Say hello to ${known.name}. If they don’t follow you, your message lands in their Requests.`}
      </div>
      {profile.data?.can_message !== false && <ChatComposer onSend={send} />}
    </section>
  )
}

const SENSITIVE = /(\+?\d[\d\s-]{8,}\d)|(\S+@\S+\.\S+)|(account (number|no)|acct|iban|bank details)/i

function ChatComposer({ conversationId, onSend }: { conversationId?: string; onSend: (body: string, attachments: Attachment[]) => Promise<void> }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<string>()
  const lastTyping = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const onType = (v: string) => {
    setText(v)
    if (conversationId && Date.now() - lastTyping.current > 4000) {
      lastTyping.current = Date.now()
      api.post(`/conversations/${conversationId}/typing`).catch(() => {})
    }
  }
  const attach = async (f?: File) => {
    if (!f) return
    if (f.size > 25 * 1024 * 1024) { toast('File too large', 'Attachments can be up to 25 MB.', 'warn'); return }
    const kind: Attachment['kind'] = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'voice' : 'document'
    const form = new FormData()
    form.append('kind', kind === 'voice' ? 'voice_note' : kind)
    form.append('file', f)
    try {
      setBusy(true)
      const up = await api.upload<{ ref: string }>('/uploads', form)
      setFiles((x) => [...x, { kind, ref: up.ref, size_bytes: f.size, name: f.name }])
    } catch (e) { toast('Upload failed', (e as ApiError).message, 'danger') } finally { setBusy(false) }
  }
  const submit = async () => {
    if ((!text.trim() && !files.length) || busy) return
    setBusy(true)
    try {
      await onSend(text.trim(), files.map(({ name: _n, ...a }) => a))
      setText('')
      setFiles([])
      setWarning(undefined)
    } catch (e) {
      toast('Message not sent', (e as ApiError).message, 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-line p-3">
      {(SENSITIVE.test(text) || warning) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-ink-2"><AlertTriangle className="size-4 shrink-0 text-warn" />{warning ?? 'Looks like contact or bank details. Off-platform deals get no dispute support.'}</div>
      )}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => <span key={f.ref} className="inline-flex items-center gap-1.5 rounded-full bg-wash px-3 py-1 text-[12px] font-semibold text-ink">{f.kind === 'image' ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}{f.name}<button aria-label="Remove" onClick={() => setFiles((x) => x.filter((y) => y.ref !== f.ref))} className="text-ink-3">×</button></span>)}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <button onClick={() => fileInput.current?.click()} aria-label="Attach a file" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-wash"><Paperclip className="size-[18px]" /></button>
        <input ref={fileInput} type="file" className="sr-only" onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = '' }} />
        <textarea
          rows={1}
          value={text}
          maxLength={4000}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
          placeholder="Write a message…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[14px] placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
        <button onClick={submit} disabled={busy || (!text.trim() && !files.length)} aria-label="Send" className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button>
      </div>
    </div>
  )
}

function Bubble({ m, mine }: { m: MessageDto & { attachments: Attachment[] }; mine: boolean }) {
  return (
    <>
      <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
        <div className={cn('max-w-[78%] rounded-[20px] px-4 py-2.5 text-[14px] leading-relaxed', mine ? 'rounded-br-md bg-brand text-on-brand' : 'rounded-bl-md bg-surface text-ink ring-1 ring-line')}>
          {m.attachments?.map((a) => a.kind === 'image'
            ? <img key={a.ref} src={mediaUrl(a.ref)} alt="" className="mb-2 max-h-64 rounded-xl object-cover" />
            : <a key={a.ref} href={mediaUrl(a.ref)} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 underline"><FileText className="size-4" />{a.kind} · {Math.ceil(a.size_bytes / 1024)} KB</a>)}
          {m.body && <span className="whitespace-pre-wrap">{m.body}</span>}
          <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10.5px]', mine ? 'opacity-75' : 'text-ink-3')}>
            {ago(m.created_at)}{mine && m.read_at && <CheckCheck className="size-3.5" aria-label="Read" />}
          </div>
        </div>
      </div>
      {m.warning && (
        <div className="mx-auto flex max-w-md items-start gap-2 rounded-2xl bg-warn-soft px-4 py-2.5 text-[12.5px] text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" /><span>{m.warning}</span>
        </div>
      )}
    </>
  )
}
