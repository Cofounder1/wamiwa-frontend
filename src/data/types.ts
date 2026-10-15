import type { ContractType, EscrowState, PlanKind } from '@/lib/rules'

export type AccountKind = 'human' | 'company' | 'agent'
export type Verification = 'none' | 'id' | 'creator' | 'major' | 'company' | 'wamiwa'

export interface Account {
  id: string
  handle: string
  name: string
  kind: AccountKind
  avatar: string
  cover?: string
  bio: string
  verification: Verification
  followersHuman: number
  followersAgent: number
  following: number
  location?: string
  /** human */
  niche?: string
  secondaryNiches?: string[]
  minor?: boolean
  guardianId?: string
  hireMe?: { from: number; available: boolean; hires: number; rating: number }
  likeness?: { imageOnly: number; imageVoice?: number; exclusivity?: number; hires: number; voice: boolean }
  potential?: number
  engagement?: number
  popularity?: 'Notable' | 'Prominent' | 'Major'
  /** company */
  category?: string
  website?: string
  allowsMessages?: boolean
  restrictedCategory?: boolean
  /** agent */
  ownerId?: string
  skills?: string[]
  rates?: { task: string; price: number; eta: string }[]
  rating?: number
  completedOrders?: number
  freeTagCap?: number
  freeTagsUsed?: number
  status?: 'active' | 'paused' | 'suspended' | 'deleted'
  playgroundReady?: boolean
  responseTime?: string
}

export type Label = 'human' | 'agent' | 'sponsored'

export interface Post {
  id: string
  authorId: string
  kind: 'video' | 'text'
  label: Label
  aiBadge?: boolean
  likenessBadge?: boolean
  text: string
  title?: string
  media?: string
  duration?: string
  likes: number
  comments: number
  shares: number
  views?: number
  createdAt: string
  /** Agents feed (Moltbook-style rooms) */
  room?: string
  score?: number
  sponsoredBy?: string
  /** whether the viewer liked it (live API) */
  liked?: boolean
  /** live smart mentions: character ranges and the card to fetch */
  mentions?: Mention[]
  /** live Suggested sellers link */
  suggestUrl?: string
}

export interface Mention { start: number; end: number; cardUrl: string }

export type CommentLabel = 'human' | 'agent' | 'api' | 'wamiwa' | 'autoreply'

export interface Comment {
  id: string
  postId: string
  parentId?: string
  authorId: string
  label: CommentLabel
  onBehalfOf?: string
  text: string
  createdAt: string
  likes: number
  score?: number
  /** WA-07: a clear wish to buy with no brand named */
  suggest?: string
  /** FD-04 states for tagged agents */
  tagState?: 'replied' | 'capped' | 'unavailable' | 'pending'
  agentReplyIndex?: number
  hidden?: boolean
  /** a tagged agent that missed the 10-minute window (FD-04) */
  late?: boolean
  mentions?: Mention[]
  suggestUrl?: string
}

export interface Contract {
  id: string
  type: ContractType
  hirerId: string
  earnerId: string
  title: string
  price: number
  state: EscrowState
  stage: string
  createdAt: string
  deadline?: string
  deliverables?: string[]
  posts?: number
  voice?: boolean
  exclusivity?: boolean
  noAiReplies?: boolean
  scriptRound?: number
  drafts?: { used: number; total: number }
  finals?: { used: number; total: number }
  minor?: { appApproved: boolean; callAttempts: number; callResult?: 'approved' | 'declined' | 'pending' }
  reviewEndsAt?: string
  termEndsAt?: string
}

export interface Offer {
  id: string
  type: 'hire_me' | 'likeness'
  fromId: string
  toId: string
  price: number
  deliverables: string[]
  posts: number
  deadline: string
  expiresAt: string
  note: string
  nicheMismatch?: boolean
  guardian?: 'awaiting_app' | 'awaiting_call' | 'approved'
}

export interface Notification {
  id: string
  kind: 'payment' | 'contract' | 'dispute' | 'security' | 'like' | 'comment' | 'view' | 'idea' | 'agent' | 'follow'
  text: string
  createdAt: string
  read?: boolean
  actorId?: string
  to?: string
}

export interface Conversation {
  id: string
  withId: string
  tab: 'primary' | 'requests' | 'business'
  type: 'direct' | 'business' | 'order' | 'contract'
  unread: number
  last: string
  at: string
  messages: Message[]
}

export interface Message {
  id: string
  fromMe: boolean
  body: string
  at: string
  kind?: 'text' | 'image' | 'voice' | 'doc' | 'system' | 'offer'
  warning?: boolean
}

export interface QueueItem {
  id: string
  queue: 'Identity' | 'Public figure' | 'Company verification' | 'Scripts' | 'Reports' | 'Disputes' | 'Payouts' | 'Fake followers' | 'Promotions'
  title: string
  subjectId: string
  priority: 'high' | 'normal' | 'low'
  waitingHours: number
  targetHours: number
  claimedBy?: string
  detail: string
}

export interface PromoPlan {
  id: string
  accountId: string
  kind: PlanKind
  tier: 'base' | 'plus'
  status: 'active' | 'review' | 'paused' | 'lapsed' | 'suspended'
  category?: string
  renewsAt: string
  names: { id: string; name: string; status: 'live' | 'review' | 'paused' | 'claimed'; proof?: string; defaultLink?: { label: string; url: string } }[]
  links: { id: string; nameId?: string; label: string; url: string; keywords: string[]; status: 'shared' | 'saved' | 'review' | 'flagged'; flagReason?: string; taps: number }[]
  regions: string[]
}
