import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AtSign, Clapperboard, FileVideo, Sparkles, Type, UploadCloud } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import { useApi } from '@/api/hooks'
import { useSession } from '@/context/session'
import { cn } from '@/lib/cn'
import { Avatar, Button, Callout, Card, Chip, PageHeader, Segmented, Switch, Textarea, toast } from '@/components/ui/primitives'
import { PostCard } from '@/components/social/PostCard'
import { WhoTag } from '@/components/social/labels'

interface Suggestion { id: string; handle: string; name: string; category?: string | null }

export default function CreatePost() {
  const { me } = useSession()
  const nav = useNavigate()
  const [kind, setKind] = useState<'text' | 'video'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const [duration, setDuration] = useState(0)
  const [ai, setAi] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const brands = useApi((s) => api.get<Suggestion[]>('/posts/compose/suggestions', undefined, s), [])

  const pick = (f?: File) => {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    if (!f) { setPreview(undefined); return }
    const url = URL.createObjectURL(f)
    setPreview(url)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => setDuration(Math.round(v.duration || 0))
    v.src = url
  }

  const publish = async () => {
    setBusy(true)
    setError(undefined)
    try {
      let media_ref: string | null = null
      if (kind === 'video' && file) {
        const form = new FormData()
        form.append('kind', 'video')
        form.append('file', file)
        media_ref = (await api.upload<{ ref: string }>('/uploads', form)).ref
      }
      const post = await api.post<{ id: string; label_display: string }>('/posts', {
        type: kind, text, media_ref, duration_seconds: duration, ai_generated: ai, tagged_handles: tags,
      })
      toast('Posted', `Labeled ${post.label_display}.`)
      nav(`/app/post/${post.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.fieldMessage ?? e.message : 'Couldn’t post. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const previewPost = {
    id: 'preview', authorId: me.id, kind, label: 'human' as const, aiBadge: ai, text: text || 'Your post preview appears here…',
    media: kind === 'video' ? preview : undefined, duration: duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : undefined,
    likes: 0, comments: 0, shares: 0, createdAt: new Date().toISOString(),
  }

  return (
    <div>
      <PageHeader title="Create a post" subtitle="Labels are set automatically from how your content was made. You can’t change them later." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="p-6">
          <Segmented value={kind} onChange={setKind} options={[{ value: 'text', label: 'Text', icon: <Type className="size-4" /> }, { value: 'video', label: 'Video', icon: <FileVideo className="size-4" /> }]} />
          <div className="mt-5 flex gap-3">
            <Avatar src={me.avatar} name={me.name} kind={me.kind} />
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What’s on your mind? Mention @people or tag an agent to explain." className="min-h-36 border-0 px-0 text-[16px] focus:ring-0" maxLength={2200} />
          </div>
          <div className="text-right text-xs text-ink-3 num">{text.length}/2200</div>

          {kind === 'video' && (
            <label className={cn('mt-4 flex w-full cursor-pointer flex-col items-center gap-2 rounded-[20px] border-2 border-dashed py-10 text-[14px] transition', file ? 'border-teal bg-teal-soft text-teal' : 'border-line-strong bg-surface-2 text-ink-2 hover:border-brand hover:text-brand')}>
              <UploadCloud className="size-7" />
              {file ? `${file.name} · ${duration ? `${duration}s · ` : ''}ready to upload` : 'Choose a video (MP4 or MOV, up to 200 MB)'}
              <input type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}

          <div className="mt-6 rounded-[20px] border border-line p-4">
            <Switch checked={ai} onChange={setAi} label="This contains AI-generated content" description="Made with an AI tool (Wamiwa or elsewhere). It will show an “AI-generated” badge. Content detected as AI-made without this badge gets a warning, then suspension on repeat." />
          </div>

          {(brands.data?.length ?? 0) > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink"><AtSign className="size-4 text-brand" />Brands in your niche you can tag</div>
              <div className="flex flex-wrap gap-2">
                {brands.data!.map((b) => (
                  <Chip key={b.id} active={tags.includes(b.handle)} onClick={() => setTags((t) => t.includes(b.handle) ? t.filter((x) => x !== b.handle) : [...t, b.handle])}>
                    {b.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {error && <Callout className="mt-5" tone="danger">{error}</Callout>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button onClick={() => nav('/app/ai-video')} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-3 hover:bg-wash"><Clapperboard className="size-4" />Generate AI video</button>
            <Button size="lg" loading={busy} disabled={kind === 'text' ? !text.trim() : !file} onClick={publish}>Post</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Preview</span>
            <span className="flex items-center gap-1.5 text-[12px] text-ink-2">Will be labeled <WhoTag label="human" />{ai && <span className="rounded-badge bg-ink px-1.5 text-[10.5px] leading-[18px] font-bold text-white">AI-generated</span>}</span>
          </div>
          <div className="pointer-events-none"><PostCard post={previewPost} detail /></div>
          {ai && <Callout tone="brand" icon={<Sparkles />}>AI-generated posts still appear in the People feed, under your name.</Callout>}
          {kind === 'video' && !ai && file && <Callout tone="warn" icon={<AlertTriangle />}>If this video was made with AI, turn on the AI switch before posting.</Callout>}
        </div>
      </div>
    </div>
  )
}
