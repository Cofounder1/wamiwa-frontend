import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Sparkles } from 'lucide-react'
import { api } from '@/api/client'
import { fromPost } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { PostDto } from '@/api/types'
import { useSession } from '@/context/session'
import { PostCard } from '@/components/social/PostCard'

/** FD-09: recent posts from businesses and people in your topics, above the latest posts. */
interface ForYouDto {
  items: (PostDto & { why: string; from_business: boolean })[]
  based_on: { topics: string[]; categories: string[] }
  hint?: string
}

export function ForYou() {
  const { blocked } = useSession()
  const res = useApi((s) => api.get<ForYouDto>('/feed/for-you', { limit: 20 }, s), [])
  const [all, setAll] = useState(false)
  const items = (res.data?.items ?? []).filter((i) => !blocked.has(i.author_id))
  if (res.error || !res.data) return null
  if (items.length === 0) {
    return res.data.hint ? (
      <div className="mb-5 flex items-center gap-3 rounded-[20px] border border-dashed border-line px-4 py-3 text-[13px] text-ink-2">
        <Sparkles className="size-4 shrink-0 text-brand" />
        <span>Choose your niches in <Link to="/app/settings" className="font-semibold text-ink hover:underline">Settings</Link>, or post about what you do, to see posts in your topics here.</span>
      </div>
    ) : null
  }
  const shown = all ? items : items.slice(0, 3)
  const topics = [...res.data.based_on.categories.map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase())), ...res.data.based_on.topics.slice(0, 3).map((t) => `#${t}`)]
  return (
    <section className="mb-8" aria-label="For you">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-extrabold text-ink"><Sparkles className="size-4 text-brand" />For you</div>
          <div className="mt-0.5 text-[12.5px] text-ink-2">From businesses and people in {topics.slice(0, 4).join(', ')}</div>
        </div>
      </div>
      <div className="space-y-5">
        {shown.map((item) => (
          <div key={item.id}>
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-ink-2">
              {item.from_business && <Building2 className="size-3.5 text-brand" />}{item.why}
            </div>
            <PostCard post={fromPost(item)} />
          </div>
        ))}
      </div>
      {items.length > 3 && (
        <button onClick={() => setAll((v) => !v)} className="mt-4 w-full rounded-full border border-line py-2.5 text-[13.5px] font-semibold text-ink hover:bg-wash">
          {all ? 'Show fewer' : `Show ${items.length - 3} more for you`}
        </button>
      )}
      <div className="mt-8 flex items-center gap-3 px-1 text-[12px] font-bold tracking-wide text-ink-3 uppercase">
        <span className="h-px flex-1 bg-line" />Latest<span className="h-px flex-1 bg-line" />
      </div>
    </section>
  )
}
