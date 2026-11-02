/**
 * Maps API responses onto the frontend's domain types (`src/data/types.ts`), so the existing UI
 * components render live data unchanged. Every account seen is registered for `acc()` lookups.
 */
import { byId, upsertAccount } from '@/data/mock'
import { agentArt } from '@/data/art'
import type { Account, Comment, CommentLabel, Contract, Post, Verification } from '@/data/types'
import { cents, mediaUrl } from './client'
import type { AuthorDto, CommentDto, ContractDto, MarketAgentDto, MeDto, PostDto, ProfileDto, SearchHitDto } from './types'

const kindOf = (t: string): Account['kind'] => (t === 'company' ? 'company' : t === 'agent' ? 'agent' : 'human')
const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined)

function avatarFor(id: string, kind: Account['kind'], photo?: string | null) {
  return mediaUrl(photo) ?? (kind === 'agent' ? agentArt(id) : '')
}

/** Minimal account from an embedded author; keeps richer data already registered. */
export function fromAuthor(a: AuthorDto): Account {
  const existing = byId[a.id]
  const kind = kindOf(a.type)
  return upsertAccount({
    id: a.id, handle: a.handle, name: a.name ?? existing?.name ?? '@' + a.handle, kind,
    avatar: existing?.avatar || avatarFor(a.id, kind),
    bio: existing?.bio ?? '', verification: existing?.verification ?? 'none',
    followersHuman: existing?.followersHuman ?? 0, followersAgent: existing?.followersAgent ?? 0, following: existing?.following ?? 0,
  })
}

export function fromMe(m: MeDto): Account {
  const kind = kindOf(m.type)
  const p = m.profile
  const verification: Verification = m.type === 'company'
    ? (m.company?.verified ? 'company' : 'none')
    : p?.verified_major_person ? 'major' : p?.verified_creator ? 'creator' : p?.id_verified ? 'id' : 'none'
  return upsertAccount({
    id: m.id, handle: m.handle, name: p?.name ?? m.company?.business_name ?? m.handle, kind,
    avatar: avatarFor(m.id, kind, p?.photo), bio: p?.bio ?? '', verification,
    followersHuman: m.followers.human, followersAgent: m.followers.agent, following: m.following,
    location: p?.location ?? undefined, niche: cap(p?.primary_niche), secondaryNiches: p?.secondary_niches?.map((n) => cap(n)!),
    minor: p?.is_minor, category: cap(m.company?.category), website: m.company?.website ?? undefined,
    allowsMessages: m.company?.allow_user_messages,
  })
}

export function fromProfile(p: ProfileDto): Account {
  const kind = p.account_kind === 'company' ? 'company' : p.account_kind === 'agent' ? 'agent' : 'human'
  const badges = new Set(p.badges ?? [])
  const verification: Verification = kind === 'company'
    ? (p.verified || badges.has('verified_company') ? 'company' : 'none')
    : kind === 'agent' ? 'id'
      : badges.has('verified_major_person') ? 'major' : badges.has('verified_creator') ? 'creator' : badges.has('id_verified') ? 'id' : 'none'
  const rates = p.rates ? Object.entries(p.rates).map(([task, c]) => ({ task: cap(task)!, price: cents(c), eta: '' })) : undefined
  return upsertAccount({
    id: p.id, handle: p.handle, name: p.name, kind, avatar: avatarFor(p.id, kind, p.photo),
    bio: p.bio ?? p.description ?? '', verification,
    followersHuman: p.followers.human, followersAgent: p.followers.agent, following: p.following,
    niche: cap(p.niche), secondaryNiches: p.secondary_niches?.map((n) => cap(n)!), category: cap(p.category),
    website: p.website ?? undefined, allowsMessages: p.can_message,
    hireMe: p.hire_me ? { from: cents(p.hire_me.starting_price_cents), available: true, hires: 0, rating: 0 } : undefined,
    likeness: p.likeness ? { imageOnly: cents(p.likeness.price_image_cents), hires: 0, voice: false } : undefined,
    ownerId: p.owner ? fromAuthor({ ...p.owner, type: 'user' }).id : undefined,
    skills: p.skills?.map((s) => cap(s)!), rates, rating: p.rating, completedOrders: p.completed_orders, status: 'active',
  })
}

export function fromMarketAgent(a: MarketAgentDto): Account {
  return upsertAccount({
    id: a.id, handle: a.handle, name: a.name, kind: 'agent', avatar: agentArt(a.id), bio: a.description, verification: a.handle === 'wamiwa' ? 'wamiwa' : 'id',
    followersHuman: byId[a.id]?.followersHuman ?? 0, followersAgent: byId[a.id]?.followersAgent ?? 0, following: 0,
    ownerId: fromAuthor({ ...a.owner, type: 'user' }).id,
    skills: a.skills.map((s) => cap(s)!), rates: Object.entries(a.rates).map(([task, c]) => ({ task: cap(task)!, price: cents(c), eta: '' })),
    rating: a.rating, completedOrders: a.completed_orders, freeTagCap: a.free_tag_daily_cap,
    freeTagsUsed: a.free_tags_left !== undefined ? a.free_tag_daily_cap - a.free_tags_left : 0,
    status: a.status === 'suspended' ? 'suspended' : a.paused ? 'paused' : 'active',
  })
}

export function fromSearchHit(h: SearchHitDto, tab: 'people' | 'companies' | 'agents'): Account {
  const kind = tab === 'companies' ? 'company' : tab === 'agents' ? 'agent' : 'human'
  return upsertAccount({
    ...byId[h.id],
    id: h.id, handle: h.handle, name: h.name, kind, avatar: avatarFor(h.id, kind, h.photo), bio: byId[h.id]?.bio ?? '',
    verification: h.verified ? (kind === 'company' ? 'company' : 'id') : byId[h.id]?.verification ?? 'none',
    followersHuman: byId[h.id]?.followersHuman ?? 0, followersAgent: byId[h.id]?.followersAgent ?? 0, following: byId[h.id]?.following ?? 0,
    niche: cap(h.niche) ?? byId[h.id]?.niche, location: h.location ?? undefined, category: cap(h.category),
    skills: h.skills?.map((s) => cap(s)!), rating: h.rating,
    rates: h.rates ? Object.entries(h.rates).map(([task, c]) => ({ task: cap(task)!, price: cents(c), eta: '' })) : undefined,
  })
}

/** Agent posts have no title on the API; the first sentence becomes the Moltbook-style headline. */
function splitTitle(text: string) {
  const m = text.match(/^(.{12,140}?[.!?:])\s+(.*)$/s)
  return m ? { title: m[1], body: m[2] } : { title: text.length > 140 ? text.slice(0, 137) + '…' : text, body: text.length > 140 ? text : '' }
}

export function fromPost(p: PostDto): Post {
  if (p.author) fromAuthor(p.author)
  // Likeness posts are made for a brand (always a company), shown as "with @brand".
  const brand = p.sponsored_by ? fromAuthor({ ...p.sponsored_by, type: 'company' }) : undefined
  const agent = p.label === 'agent'
  const t = agent ? splitTitle(p.text) : null
  const d = p.duration_seconds
  return {
    id: p.id, authorId: p.author_id, kind: p.type, label: p.label,
    aiBadge: p.ai_badge === 'ai_generated', likenessBadge: p.ai_badge === 'ai_likeness',
    text: t ? t.body : p.text, title: t?.title,
    media: mediaUrl(p.media), duration: d ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` : undefined,
    likes: p.likes.human + p.likes.agent, comments: p.comments.human + p.comments.agent, shares: 0,
    createdAt: p.created_at, score: agent ? p.likes.human + p.likes.agent : undefined, liked: p.liked, sponsoredBy: brand?.id,
    editedAt: p.edited_at ?? undefined, removed: p.moderation_status === 'removed',
    hidden: p.moderation_status !== 'visible' && p.moderation_status !== 'removed',
    // Mention ranges index the full text; agent posts split off a title, so mentions only apply to people posts.
    mentions: agent ? undefined : p.promotions?.map((m) => ({ start: m.start, end: m.end, cardUrl: m.card_url })),
    suggestUrl: p.suggested_sellers?.url,
  }
}

const tagState: Record<string, Comment['tagState']> = {
  pending: 'pending', replied: 'replied', cap_reached: 'capped', unavailable: 'unavailable', no_response: 'pending',
}

function commentLabel(c: CommentDto): CommentLabel {
  if (c.sponsored) return 'wamiwa'
  if (c.on_behalf_of) return 'autoreply'
  if (c.label === 'human' || c.label === 'agent') return c.label
  return 'api' // company replies through the API carry no tag (API-02)
}

/** Flattens the API's nested reply tree, and turns pending agent tags into placeholder replies. */
export function fromComments(list: CommentDto[]): Comment[] {
  const out: Comment[] = []
  const walk = (c: CommentDto) => {
    if (c.author) fromAuthor(c.author)
    if (c.on_behalf_of) fromAuthor({ ...c.on_behalf_of, type: 'user' })
    out.push({
      id: c.id, postId: c.post_id, parentId: c.parent_id ?? undefined, authorId: c.author?.id ?? 'deleted',
      label: commentLabel(c), onBehalfOf: c.on_behalf_of?.id, text: c.text, createdAt: c.created_at,
      likes: c.helpful.yes, hidden: c.moderation_status !== 'visible',
      mentions: c.promotions?.map((m) => ({ start: m.start, end: m.end, cardUrl: m.card_url })),
      suggest: c.suggested_sellers?.category, suggestUrl: c.suggested_sellers?.url, editedAt: c.edited_at ?? undefined,
    })
    const replied = new Set(c.replies.map((r) => r.author?.id))
    for (const tag of c.agent_tags ?? []) {
      if (tag.status === 'replied' && replied.has(tag.agent_id)) continue
      fromAuthor({ id: tag.agent_id, handle: tag.handle, type: 'agent' })
      out.push({
        id: `${c.id}:tag:${tag.agent_id}`, postId: c.post_id, parentId: c.id, authorId: tag.agent_id, label: 'agent',
        text: tag.message ?? '', createdAt: c.created_at, likes: 0,
        tagState: tag.status === 'no_response' ? 'pending' : tagState[tag.status], late: tag.status === 'no_response',
      })
    }
    c.replies.forEach(walk)
  }
  list.forEach(walk)
  return out
}

const escrowState: Record<string, Contract['state']> = {
  funded: 'Funded', active: 'Active', delivered: 'Delivered', cleared: 'Cleared', paid: 'Paid', frozen: 'Frozen', refunded: 'Refunded',
}

/** Contract status → escrow state when the escrow record isn't embedded (list views). */
const statusState: Record<string, Contract['state']> = {
  admin_review: 'Funded', offered: 'Funded', changes_requested: 'Funded', pending_guardian: 'Funded',
  active: 'Active', delivered: 'Delivered', completed: 'Cleared', paid: 'Paid', disputed: 'Frozen',
  declined: 'Refunded', expired: 'Refunded', cancelled: 'Refunded', refunded: 'Refunded', withdrawn: 'Refunded',
}

export function fromContract(c: ContractDto): Contract {
  for (const x of [c.hirer, c.earner, c.agent]) if (x) fromAuthor(x)
  return {
    id: c.id, type: c.type, hirerId: c.hirer_id, earnerId: c.type === 'agent' && c.agent_id ? c.agent_id : c.earner_id,
    title: c.title, price: c.price.usd_cents.price / 100,
    state: (c.escrow && escrowState[c.escrow.state]) ?? statusState[c.status] ?? 'Funded',
    stage: statusText(c), createdAt: c.created_at, deadline: c.deadline ?? undefined,
    deliverables: c.deliverables ? c.deliverables.split(/\n+/).filter(Boolean) : [], posts: c.num_posts,
    voice: c.with_voice, exclusivity: c.exclusivity, noAiReplies: c.no_ai_replies, scriptRound: c.change_rounds + 1,
    reviewEndsAt: c.review_ends_at ?? undefined, termEndsAt: c.end ?? undefined,
  }
}

/** Display name for the other party of a contract when the API returns only ids. */
export function partyName(id: string, title?: string, role: 'hirer' | 'earner' = 'hirer') {
  const known = byId[id]
  if (known) return known.name
  const fromTitle = title?.match(/(?:from|by) (.+)$/)?.[1]
  if (role === 'hirer' && fromTitle) return fromTitle
  return role === 'hirer' ? 'The brand' : 'The creator'
}

const STATUS_TEXT: Record<string, string> = {
  admin_review: 'In admin review', offered: 'Offer sent', changes_requested: 'Changes requested', pending_guardian: 'Waiting for guardian',
  active: 'In progress', delivered: 'Delivered — in review', completed: 'Completed', disputed: 'In dispute',
  cancelled: 'Cancelled', declined: 'Declined', expired: 'Expired',
}

/** Human status for a contract; agent orders carry `display_status`, the others don't. */
export const statusText = (c: { status: string; display_status?: string }) => c.display_status || STATUS_TEXT[c.status] || c.status.replace(/_/g, ' ')
