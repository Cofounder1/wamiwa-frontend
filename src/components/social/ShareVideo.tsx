import { useState } from 'react'
import { Check, Copy, Search, Send, Share2 } from 'lucide-react'
import { api, errMsg, mediaUrl } from '@/api/client'
import { useApi } from '@/api/hooks'
import type { ConversationDto, SearchHitDto } from '@/api/types'
import { useSession } from '@/context/session'
import { Avatar, Button, Input, Modal, Textarea, toast } from '@/components/ui/primitives'

interface Person { id: string; handle: string; name: string; photo?: string | null }

/** Send a video to someone in Messages, or share it to other apps and social platforms. */
export function ShareVideo({ open, onClose, file, title }: { open: boolean; onClose: () => void; file: string; title: string }) {
  const { me } = useSession()
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const link = mediaUrl(file)!
  const recent = useApi(open ? (s) => api.page<ConversationDto>('/conversations', { tab: 'primary', limit: 8 }, s) : null, [open])
  const found = useApi(open && q.trim().length >= 2 ? (s) => api.page<SearchHitDto>('/search', { q: q.trim(), tab: 'people', limit: 8 }, s) : null, [open, q])

  const recentPeople: Person[] = (recent.data?.data ?? [])
    .filter((c) => c.type === 'direct')
    .flatMap((c) => c.with.filter((a) => a.id !== me.id).map((a) => ({ id: a.id, handle: a.handle, name: a.name ?? a.handle })))
  const people: Person[] = q.trim().length >= 2
    ? (found.data?.data ?? []).filter((h) => h.id !== me.id).map((h) => ({ id: h.id, handle: h.handle, name: h.name, photo: h.photo }))
    : recentPeople

  const send = async (p: Person) => {
    setSending(p.id)
    try {
      await api.post('/messages', { recipient_id: p.id, body: note.trim(), attachments: [{ kind: 'video', ref: file, size_bytes: 0 }] })
      setSent((s) => [...s, p.id])
      toast('Sent', `Your video is in your chat with @${p.handle}.`)
    } catch (e) { toast('Couldn’t send', errMsg(e), 'danger') } finally { setSending(null) }
  }

  // On phones this opens the share sheet with the video itself, for WhatsApp, Instagram, TikTok and the rest.
  const shareToApps = async () => {
    try {
      const blob = await (await fetch(link)).blob()
      const video = new File([blob], 'wamiwa-video.mp4', { type: 'video/mp4' })
      if (navigator.canShare?.({ files: [video] })) {
        await navigator.share({ files: [video], title, text: 'Made on Wamiwa' })
        return
      }
      if (navigator.share) { await navigator.share({ title, text: 'Made on Wamiwa', url: link }); return }
      await copy()
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Couldn’t open sharing', 'Copy the link instead.', 'warn')
    }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied') } catch { toast('Couldn’t copy the link', link, 'warn') }
  }
  const text = encodeURIComponent('Made on Wamiwa')
  const url = encodeURIComponent(link)
  const platforms = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${text}%20${url}` },
    { name: 'X', href: `https://x.com/intent/post?text=${text}&url=${url}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Share video" subtitle="It keeps its AI-generated label wherever it goes.">
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Send in a message</h3>
          <Input icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" />
          <Textarea className="mt-2 min-h-16" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Add a note (optional)" />
          <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Avatar src={mediaUrl(p.photo)} name={p.name} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div><div className="truncate text-[12px] text-ink-3">@{p.handle}</div></div>
                {sent.includes(p.id)
                  ? <span className="flex items-center gap-1 text-[12px] font-semibold text-teal"><Check className="size-3.5" />Sent</span>
                  : <Button size="xs" loading={sending === p.id} icon={<Send className="size-3.5" />} onClick={() => send(p)}>Send</Button>}
              </li>
            ))}
            {people.length === 0 && <li className="py-4 text-center text-[12.5px] text-ink-3">{q.trim().length >= 2 ? 'No one found.' : 'Search for someone to send it to.'}</li>}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Share elsewhere</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Share2 className="size-3.5" />} onClick={shareToApps}>Share to apps</Button>
            {platforms.map((p) => <Button key={p.name} size="sm" variant="outline" onClick={() => window.open(p.href, '_blank', 'noopener')}>{p.name}</Button>)}
            <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={copy}>Copy link</Button>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">“Share to apps” sends the video file itself on phones, for Instagram, TikTok, WhatsApp and others. Anyone with the link can watch the video.</p>
        </section>
      </div>
    </Modal>
  )
}
