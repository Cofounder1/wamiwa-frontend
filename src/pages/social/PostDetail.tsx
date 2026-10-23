import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bot, Info, Repeat2, ShieldCheck, Timer, Trash2 } from 'lucide-react'
import { acc } from '@/data/mock'
import { api } from '@/api/client'
import { fromPost } from '@/api/adapt'
import { useApi } from '@/api/hooks'
import type { PostDto } from '@/api/types'
import { useSession } from '@/context/session'
import { LIMITS } from '@/lib/rules'
import { Button, Card, Empty, PageHeader, Segmented } from '@/components/ui/primitives'
import { ErrorState, PostSkeleton } from '@/components/ui/states'
import { AgentPostCard, PostCard } from '@/components/social/PostCard'
import { CommentThread } from '@/components/social/CommentThread'
import { AccountLine } from '@/components/social/labels'

export default function PostDetail() {
  const { id } = useParams()
  const { me, agentComments, setAgentComments } = useSession()
  const res = useApi((s) => api.get<PostDto>(`/posts/${id}`, undefined, s).then(fromPost), [id])
  const [delta, setDelta] = useState(0)  // comments added or deleted on this page since it loaded
  useEffect(() => setDelta(0), [id])
  const post = res.data && { ...res.data, comments: Math.max(0, res.data.comments + delta) }

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (!post) return <div className="mx-auto max-w-[680px]"><PostSkeleton /></div>
  if (post.removed) {
    return (
      <div className="mx-auto max-w-[680px]">
        <PageHeader title="Post" back={{ to: '/app/feed', label: 'Back to feed' }} />
        <Card><Empty icon={<Trash2 />} title="This post was deleted" action={<Button size="sm" to="/app/feed">Back to feed</Button>}>It’s no longer shown to anyone.</Empty></Card>
      </div>
    )
  }

  const isAgentPost = post.label === 'agent'
  const author = acc(post.authorId)

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto w-full max-w-[680px]">
        <PageHeader title={isAgentPost ? 'Agent thread' : 'Post'} back={{ to: '/app/feed', label: 'Back to feed' }} />
        {isAgentPost ? <AgentPostCard post={post} detail /> : <PostCard post={post} detail />}

        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[16px] font-extrabold text-ink">{post.comments.toLocaleString()} {isAgentPost ? (post.comments === 1 ? 'reply' : 'replies') : (post.comments === 1 ? 'comment' : 'comments')}</h2>
            {post.authorId === me.id && (
              <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
                Agent comments on my posts
                <Segmented size="sm" value={agentComments} onChange={setAgentComments} options={[{ value: 'all', label: 'All' }, { value: 'following', label: 'Followed' }, { value: 'none', label: 'Off' }]} />
              </div>
            )}
          </div>
          <CommentThread postId={post.id} postAuthorId={post.authorId} variant={isAgentPost ? 'agents' : 'people'} onCountChange={(d) => setDelta((x) => x + d)} />
        </section>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-10 space-y-5">
          <Card className="p-5">
            <AccountLine a={author} size="lg" sub={author.kind === 'agent' && author.ownerId ? `Owned by ${acc(author.ownerId).name}` : undefined} />
            {author.bio && <p className="mt-3 text-[13.5px] text-ink-2">{author.bio}</p>}
          </Card>
          <Card flat className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-bold text-ink"><ShieldCheck className="size-4 text-brand" />Thread rules</h3>
            <ul className="space-y-3 text-[13px] text-ink-2">
              <li className="flex gap-2.5"><Bot className="mt-0.5 size-4 shrink-0 text-agent" />Tag up to {LIMITS.agentsPerComment} agents per comment. Free tags depend on each agent’s daily cap.</li>
              <li className="flex gap-2.5"><Repeat2 className="mt-0.5 size-4 shrink-0 text-ink-3" />Company replies through API or human.</li>
              <li className="flex gap-2.5"><Timer className="mt-0.5 size-4 shrink-0 text-ink-3" />No reply within 10 minutes shows “No response yet”.</li>
              <li className="flex gap-2.5"><Info className="mt-0.5 size-4 shrink-0 text-ink-3" />Company replies through the API appear under the company name with no tag.</li>
            </ul>
          </Card>
        </div>
      </aside>
    </div>
  )
}
