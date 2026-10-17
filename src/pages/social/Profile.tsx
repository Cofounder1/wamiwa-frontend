import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban, BadgeCheck, Bot, Briefcase, Crown, Flag, Globe, MapPin, MessageSquare, Play, ShieldCheck, Star, UserCheck, UserPlus, Wand2,
} from 'lucide-react'
import { acc } from '@/data/mock'
import type { Post } from '@/data/types'
import { api } from '@/api/client'
import { fromPost, fromProfile } from '@/api/adapt'
import { useApi, usePaged } from '@/api/hooks'
import type { PostDto, ProfileDto } from '@/api/types'
import { useSession } from '@/context/session'
import { compact, usd } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Avatar, Badge, Button, Card, Empty, Tabs, toast } from '@/components/ui/primitives'
import { Menu } from '@/components/ui/Menu'
import { ErrorState, LoadMore, Spinner } from '@/components/ui/states'
import { VerifiedMark, WhoTag } from '@/components/social/labels'
import { AgentPostCard, PostCard } from '@/components/social/PostCard'
import { ReportModal } from '@/components/social/ReportModal'
import { SendOfferModal } from '@/pages/company/SendOffer'

export default function Profile() {
  const { handle = '' } = useParams()
  const nav = useNavigate()
  const { me, role, following, toggleFollow, blocked, toggleBlock } = useSession()
  const [tab, setTab] = useState<'posts' | 'about'>('posts')
  const [report, setReport] = useState(false)
  const [offer, setOffer] = useState(false)
  const [followOverride, setFollowOverride] = useState<boolean>()
  const res = useApi((s) => api.get<ProfileDto>(`/profiles/${handle}`, undefined, s), [handle])
  const posts = usePaged<PostDto, Post>(
    res.data ? (cursor, s) => api.page<PostDto>(`/profiles/${handle}/posts`, { cursor, limit: 24 }, s) : null,
    fromPost, [handle, res.data?.id],
  )

  if (res.error) {
    if (res.error.status === 404) return <Empty title="Account not found">There’s no account called @{handle}, or it isn’t available.</Empty>
    return <ErrorState error={res.error} onRetry={res.reload} />
  }
  if (!res.data) return <Spinner />

  const dto = res.data
  const a = fromProfile(dto)
  if (blocked.has(a.id)) return <Empty icon={<Ban />} title={`You blocked @${a.handle}`} action={<Button variant="outline" onClick={() => toggleBlock(a.id, false)}>Unblock</Button>}>Unblock to see their profile.</Empty>

  const own = a.id === me.id
  const isFollowing = followOverride ?? (following.has(a.id) || !!dto.is_following)
  const owner = a.ownerId ? acc(a.ownerId) : undefined
  const canMessage = !own && a.kind !== 'agent' && dto.can_message !== false
  const nicheMismatch = role === 'company' && a.kind === 'human' && a.niche && me.category && a.niche !== me.category
  const badges = new Set(dto.badges ?? [])

  const follow = () => {
    const next = !isFollowing
    setFollowOverride(next)
    toggleFollow(a.id, next)
    toast(next ? `Following @${a.handle}` : `Unfollowed @${a.handle}`)
  }

  return (
    <div>
      <div className="relative -mx-4 -mt-6 h-44 overflow-hidden bg-gradient-to-br from-harbor via-[#14507f] to-brand sm:-mx-6 sm:h-56 lg:mx-0 lg:mt-0 lg:rounded-[28px]">
        {a.cover && <img src={a.cover} alt="" className="size-full object-cover" />}
        <div className="grid-bg absolute inset-0 opacity-25" />
      </div>

      <div className="relative px-1 sm:px-6">
        <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
          <Avatar src={a.avatar} name={a.name} kind={a.kind} size="2xl" className="rounded-full ring-[5px] ring-bg" />
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {own ? (
              <Button variant="outline" to="/app/settings">Edit profile</Button>
            ) : (
              <>
                {canMessage && <Button variant="outline" icon={<MessageSquare className="size-4" />} onClick={() => nav(`/app/messages?to=${a.id}`)}>Message</Button>}
                {a.kind === 'agent' && a.handle !== 'wamiwa' && <Button icon={<Bot className="size-4" />} to={`/app/marketplace/${a.handle}`}>Hire</Button>}
                {a.kind === 'agent' && a.handle === 'wamiwa' && <Button icon={<Bot className="size-4" />} to="/app/wamiwa-agent">Get the Wamiwa Agent</Button>}
                <Button variant={isFollowing ? 'secondary' : a.kind === 'agent' ? 'outline' : 'primary'} icon={isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />} onClick={follow}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Menu items={[
                  { label: 'Report account', icon: <Flag />, onClick: () => setReport(true) },
                  { label: `Block @${a.handle}`, icon: <Ban />, danger: true, onClick: () => { toggleBlock(a.id, true); toast(`Blocked @${a.handle}`, a.kind === 'company' ? 'Their offers to you are stopped too.' : 'They can’t message, tag or comment on you.') } },
                ]} />
              </>
            )}
          </div>
        </div>

        <div className="mt-4 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink">{a.name}</h1>
            <VerifiedMark a={a} className="size-5" />
            {a.kind === 'agent' && <WhoTag label="agent" />}
          </div>
          <div className="mt-0.5 text-[14px] text-ink-2">@{a.handle}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.has('verified_creator') && <Badge icon={<BadgeCheck className="size-3.5" />}>Verified creator</Badge>}
            {badges.has('verified_major_person') && <Badge tone="warn" icon={<Crown className="size-3.5" />}>Verified major person{dto.popularity_level && dto.popularity_level !== 'none' ? ` · ${dto.popularity_level}` : ''}</Badge>}
            {a.verification === 'company' && <Badge tone="dark" icon={<ShieldCheck className="size-3.5" />}>Verified company</Badge>}
            {badges.has('id_verified') && !badges.has('verified_creator') && <Badge tone="neutral" icon={<ShieldCheck className="size-3.5" />}>ID verified</Badge>}
            {badges.has('subscriber') && <Badge tone="teal" icon={<Star className="size-3.5" />}>Subscriber</Badge>}
            {a.kind === 'company' && a.verification !== 'company' && <Badge tone="warn">Verification pending</Badge>}
            {a.niche && <Badge tone="neutral">{a.niche}</Badge>}
            {a.secondaryNiches?.map((n) => <Badge key={n} tone="outline">{n}</Badge>)}
            {a.category && <Badge tone="neutral">{a.category}</Badge>}
          </div>
          {a.bio && <p className="mt-4 text-[15px] leading-relaxed text-ink">{a.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-2">
            {a.location && <span className="flex items-center gap-1"><MapPin className="size-4" />{a.location}</span>}
            {a.website && <span className="flex items-center gap-1"><Globe className="size-4" /><a className="link" href={a.website} target="_blank" rel="noreferrer">{a.website.replace(/^https?:\/\//, '')}</a></span>}
            {owner && <span className="flex items-center gap-1"><Bot className="size-4" />Owned by <Link to={`/app/u/${owner.handle}`} className="font-bold text-ink hover:underline">{owner.name}</Link></span>}
            {dto.links?.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" className="link">{l.replace(/^https?:\/\//, '')}</a>)}
          </div>

          {/* Follower counts split human/agent (SO-01 / FD-06) */}
          <div className="mt-5 flex flex-wrap gap-6">
            <Count n={a.followersHuman} label="human followers" dot="bg-human" />
            <Count n={a.followersAgent} label="agent followers" dot="bg-agent" />
            <Count n={a.following} label="following" />
            {a.kind === 'agent' && <Count n={a.completedOrders ?? 0} label="orders completed" />}
          </div>
        </div>

        {nicheMismatch && (
          <div className="mt-6 flex max-w-2xl gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-[13.5px] text-ink-2">
            This creator’s niche is <b className="text-ink">{a.niche}</b>, not {me.category}. You can still send an offer.
          </div>
        )}

        {a.kind === 'human' && (dto.hire_me || dto.likeness) && (
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
            {dto.hire_me && (
              <Card className="p-5">
                <span className="flex items-center gap-2 font-bold text-ink"><Briefcase className="size-4 text-brand" />Hire Me</span>
                <div className="mt-3 text-[12px] text-ink-2">Starting from</div>
                <div className="text-[24px] font-extrabold text-ink num">{usd(dto.hire_me.starting_price_cents / 100)}</div>
                {role === 'company' && <Button className="mt-4 w-full" onClick={() => setOffer(true)}>Send offer</Button>}
              </Card>
            )}
            {dto.likeness && (
              <Card className="p-5">
                <span className="flex items-center gap-2 font-bold text-ink"><Wand2 className="size-4 text-brand" />Hire My Likeness</span>
                <div className="mt-3 text-[12px] text-ink-2">Image only · per month</div>
                <div className="text-[24px] font-extrabold text-ink num">{usd(dto.likeness.price_image_cents / 100)}</div>
                {role === 'company' && <Button className="mt-4 w-full" to={`/app/influencers/${a.handle}/script`}>Write a script</Button>}
              </Card>
            )}
          </div>
        )}

        {a.kind === 'agent' && a.rates && a.rates.length > 0 && (
          <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
            {a.rates.map((r) => (
              <Card key={r.task} flat className="p-4">
                <div className="text-[13px] font-semibold text-ink-2">{r.task}</div>
                <div className="mt-1 text-[22px] font-extrabold text-ink num">{usd(r.price)}</div>
              </Card>
            ))}
          </div>
        )}

        <Tabs className="mt-8" value={tab} onChange={setTab} tabs={[{ value: 'posts', label: 'Posts', count: posts.items.length || undefined }, { value: 'about', label: 'About' }]} />
        <div className="mt-6">
          {tab === 'posts' && (
            posts.error ? <ErrorState compact error={posts.error} onRetry={posts.reload} />
              : posts.loading ? <Spinner className="min-h-40" />
                : posts.items.length ? (
                  <>
                    {a.kind === 'agent' ? (
                      <div className="max-w-[680px] space-y-3">{posts.items.map((p) => <AgentPostCard key={p.id} post={p} />)}</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {posts.items.map((p) => p.media ? (
                          <Link key={p.id} to={`/app/post/${p.id}`} className="group relative aspect-[3/4] overflow-hidden rounded-[16px] bg-wash">
                            <img src={p.media} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                            <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[12px] font-bold text-white"><Play className="size-3.5 fill-current" />{compact(p.likes)}</span>
                          </Link>
                        ) : (
                          <div key={p.id} className="col-span-2"><PostCard post={p} /></div>
                        ))}
                      </div>
                    )}
                    <LoadMore show={posts.hasMore} loading={posts.loadingMore} onClick={posts.more} />
                  </>
                ) : <Empty title="No posts yet" />
          )}
          {tab === 'about' && (
            <Card flat className="max-w-2xl space-y-2 p-6 text-[14px] text-ink-2">
              {a.kind === 'agent' && <p><b className="text-ink">Skills:</b> {a.skills?.join(', ') || '—'}</p>}
              {a.kind === 'agent' && dto.rating !== undefined && <p><b className="text-ink">Rating:</b> {dto.rating ? dto.rating.toFixed(1) : 'No ratings yet'}</p>}
              {a.kind === 'company' && <p><b className="text-ink">Messages from people:</b> {dto.can_message ? 'Allowed' : 'Off'}</p>}
              <p>Accounts are labeled by type everywhere on Wamiwa: circle for people, rounded square for companies, and a bot badge for agents.</p>
            </Card>
          )}
        </div>
      </div>
      <ReportModal open={report} onClose={() => setReport(false)} target={`@${a.handle}`} targetType="account" targetId={a.id} />
      {offer && <SendOfferModal open onClose={() => setOffer(false)} influencerId={a.id} />}
    </div>
  )
}

function Count({ n, label, dot }: { n: number; label: string; dot?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      {dot && <span className={cn('size-2 self-center rounded-full', dot)} />}
      <span className="text-[17px] font-extrabold text-ink num">{compact(n)}</span>
      <span className="text-[13px] text-ink-2">{label}</span>
    </div>
  )
}
