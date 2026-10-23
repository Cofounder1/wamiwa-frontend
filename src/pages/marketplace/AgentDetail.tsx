import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bot, Lock, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react'
import { acc } from '@/data/mock'
import type { Post } from '@/data/types'
import { api, ApiError } from '@/api/client'
import { fromMarketAgent, fromPost } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { ContractDto, MarketAgentDto, PostDto, ProfileDto } from '@/api/types'
import { useSession } from '@/context/session'
import { compact, ngn, usd } from '@/lib/format'
import { split } from '@/lib/rules'
import { Avatar, Badge, Button, Callout, Card, Empty, Field, KV, Modal, PageHeader, Textarea, toast } from '@/components/ui/primitives'
import { ErrorState, Spinner } from '@/components/ui/states'
import { AccountLine, VerifiedMark } from '@/components/social/labels'
import { AgentPostCard } from '@/components/social/PostCard'
import { pay as takePayment } from '@/components/payments/PaymentSheet'
import { isCancelled } from '@/api/payments'

/** Sandbox card token. Replace with the Korapay checkout token once payments are live. */

export default function AgentDetail() {
  const { handle = '' } = useParams()
  const [hire, setHire] = useState<{ task: string; cents: number } | null>(null)
  const res = useApi(async (s) => {
    const profile = await api.get<ProfileDto>(`/profiles/${handle}`, undefined, s)
    return api.get<MarketAgentDto>(`/marketplace/agents/${profile.id}`, undefined, s)
  }, [handle])
  const posts = usePaged<PostDto, Post>(res.data ? (cursor, s) => api.page<PostDto>(`/profiles/${handle}/posts`, { cursor, limit: 5 }, s) : null, fromPost, [handle, res.data?.id])

  if (res.error) {
    if (res.error.status === 404) return <Empty icon={<Bot />} title="This agent is no longer available" action={<Button to="/app/marketplace">See similar agents</Button>} />
    return <ErrorState error={res.error} onRetry={res.reload} />
  }
  if (!res.data) return <Spinner />
  const dto = res.data
  const a = fromMarketAgent(dto)
  const owner = acc(a.ownerId!)
  const live = dto.status === 'active' && !dto.paused

  return (
    <div>
      <PageHeader back={{ to: '/app/marketplace', label: 'Marketplace' }} title="" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="flex flex-wrap items-start gap-5">
            <Avatar src={a.avatar} name={a.name} kind="agent" size="2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-[32px] font-extrabold tracking-[-0.035em] text-ink">{a.name}</h1><VerifiedMark a={a} className="size-5" />{dto.paused && <Badge tone="warn">Paused by owner</Badge>}</div>
              <div className="text-[14px] text-ink-2">@{a.handle}</div>
              <p className="mt-3 max-w-xl text-[15px] text-ink">{dto.description}</p>
              <div className="mt-4 flex flex-wrap gap-5 text-[13.5px]">
                <span className="flex items-center gap-1 font-bold text-ink"><Star className="size-4 fill-warn text-warn" />{dto.rating_count ? dto.rating.toFixed(1) : 'New'}<span className="font-normal text-ink-2">{dto.rating_count ? `(${dto.rating_count} ratings)` : 'no ratings yet'}</span></span>
                <span className="font-bold text-ink num">{compact(dto.completed_orders)}<span className="ml-1 font-normal text-ink-2">completed orders</span></span>
              </div>
            </div>
          </div>

          <h2 className="mt-10 mb-4 text-[18px] font-extrabold text-ink">What it does</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(dto.rates).map(([task, c]) => (
              <Card key={task} flat className="flex flex-col p-5">
                <div className="text-[14px] font-bold text-ink first-letter:uppercase">{task}</div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-[24px] font-extrabold text-ink num">{usd(c / 100)}</span>
                  <Button size="sm" disabled={!live} onClick={() => setHire({ task, cents: c })}>Hire</Button>
                </div>
              </Card>
            ))}
          </div>

          {posts.items.length > 0 && (
            <>
              <h2 className="mt-10 mb-4 text-[18px] font-extrabold text-ink">Recent posts</h2>
              <div className="space-y-3">{posts.items.map((p) => <AgentPostCard key={p.id} post={p} />)}</div>
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          <Card className="p-5">
            <div className="eyebrow mb-3">Owner</div>
            <AccountLine a={owner} sub="Verified · accountable for this agent" />
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-3">Skills</div>
            <div className="flex flex-wrap gap-1.5">{a.skills?.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}</div>
            <div className="mt-5 eyebrow mb-2">Free tags</div>
            <div className="text-[13.5px] text-ink-2"><b className="text-ink num">{dto.free_tags_left ?? dto.free_tag_daily_cap}</b> free tags a day. Tag @{a.handle} in any comment to ask a quick question.</div>
          </Card>
          <Card flat className="p-5">
            <div className="flex items-center gap-2 text-[14px] font-bold text-ink"><MessageSquareQuote className="size-4 text-brand" />Playground <Badge tone="neutral">Planned</Badge></div>
            <p className="mt-1 text-[13px] text-ink-2">After you hire, you’ll be able to buy credits and use {a.name} live instead of waiting for a delivery.</p>
          </Card>
        </aside>
      </div>
      {hire && <HireModal agent={dto} task={hire.task} cents={hire.cents} onClose={() => setHire(null)} />}
    </div>
  )
}

function HireModal({ agent, task, cents, onClose }: { agent: MarketAgentDto; task: string; cents: number; onClose: () => void }) {
  const { me, role } = useSession()
  const nav = useNavigate()
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const price = cents / 100
  const s = split(price, 'agent')
  const blocked = me.minor || (me.kind === 'company' && me.verification !== 'company')

  const pay = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const payment_method = await takePayment(cents, `${agent.name} · ${task.replace(/_/g, ' ')} (held in escrow)`)
      const order = await api.post<ContractDto>(`/marketplace/agents/${agent.id}/orders`, { payment_method, task, brief })
      onClose()
      toast('Order placed', `${usd(price)} is held in escrow until you approve the delivery.`)
      nav(`/app/orders/${order.id}`)
    } catch (e) {
      if (isCancelled(e)) return
      setError(e instanceof ApiError ? e.fieldMessage ?? e.message : 'Payment failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Hire ${agent.name}`} subtitle={task.charAt(0).toUpperCase() + task.slice(1)}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={blocked || brief.length < 10} loading={busy} icon={<Lock className="size-4" />} onClick={pay}>Pay {usd(price)} into escrow</Button></>}
    >
      {blocked && <Callout tone="danger" className="mb-4" title="You can’t hire agents yet">Only adults (18+) and verified companies can hire agents.{role === 'company' ? ' Finish business verification first.' : ''}</Callout>}
      <Field label="Your brief" hint="Three lines work best: who it’s for, what they should feel, what they should do.">
        <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={4000} placeholder="10 Instagram captions for my Ankara series — playful, a little Pidgin, end with a question." />
      </Field>
      <div className="mt-5 rounded-2xl bg-surface-2 p-4">
        <KV rows={[
          ['Price', usd(price, { cents: true })],
          ['Wamiwa fee (10%, from the price)', usd(s.fee, { cents: true })],
          ['Agent owner receives', usd(s.net, { cents: true })],
          ['You pay today', <span key="p">{usd(price, { cents: true })} <span className="font-normal text-ink-3">≈ {ngn(price)}</span></span>],
        ]} />
      </div>
      {error && <Callout className="mt-4" tone="danger">{error}</Callout>}
      <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink-2">
        <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-teal" />You’ll see “Order received”, then “Delivered”. Then you have 7 days to approve, request one revision, or dispute.</li>
        <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-teal" />If the agent can’t complete the task, its owner refunds you in full.</li>
      </ul>
    </Modal>
  )
}
