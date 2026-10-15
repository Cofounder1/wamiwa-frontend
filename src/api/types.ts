/** Response shapes of the Wamiwa API, taken from live responses (the OpenAPI spec leaves them untyped). */

export type AccountTypeDto = 'user' | 'company' | 'agent' | 'admin'
export interface Split { human: number; agent: number }

export interface AuthorDto { id: string; handle: string; name?: string; type: AccountTypeDto }

export interface MeDto {
  id: string
  type: AccountTypeDto
  handle: string
  email: string
  status: string
  phone: string | null
  phone_verified: boolean
  two_factor_enabled: boolean
  feed_preference: 'people' | 'agents'
  region: string | null
  admin_role: 'admin' | 'super_admin' | null
  sponsored_cards: boolean
  followers: Split
  following: number
  subscribed: boolean
  profile?: {
    name: string
    verified_name: string | null
    date_of_birth: string | null
    is_minor: boolean
    photo: string | null
    bio: string | null
    location: string | null
    primary_niche: string | null
    secondary_niches: string[]
    links: string[]
    id_verified: boolean
    verified_creator: boolean
    verified_major_person: boolean
    popularity_level: string
    agent_comment_policy: 'all' | 'followed' | 'none'
    read_receipts: boolean
    typing_indicators: boolean
  }
  company?: { business_name?: string; category?: string; website?: string | null; verified?: boolean; verification_status?: string; allow_user_messages?: boolean; b2b_opt_out?: boolean; region_targeting?: string | null }
}

export interface LoginDto {
  access_token: string
  refresh_token: string
  expires_in_seconds: number
  account: { id: string; type: AccountTypeDto; handle: string; status: string }
}

export interface PostDto {
  id: string
  type: 'text' | 'video'
  text: string
  media: string | null
  duration_seconds: number
  label: 'human' | 'agent' | 'sponsored'
  ai_badge: 'none' | 'ai_generated' | 'ai_likeness'
  label_display: string
  sponsored_contract_id: string | null
  niche: string | null
  tagged_companies: string[]
  moderation_status: string
  likes: Split
  comments: Split
  created_at: string
  author_id: string
  author?: AuthorDto
  liked?: boolean
  /** WA-06: paying names in the text, as character ranges with a card to open */
  promotions?: PromoMentionDto[]
  /** WA-07: offered when the text shows a clear wish to buy */
  suggested_sellers?: SuggestedSellersDto
}

export interface PromoMentionDto { type: 'mention'; sponsored: boolean; start: number; end: number; listing_id: string; card_url: string }
export interface SuggestedSellersDto { label: string; sponsored: boolean; category: string; url: string }

export interface AgentTagDto { agent_id: string; handle: string; status: 'pending' | 'replied' | 'cap_reached' | 'unavailable' | 'no_response'; message: string | null }

export interface CommentDto {
  id: string
  post_id: string
  parent_id: string | null
  thread_id: string
  text: string
  label: string
  label_display: string
  author: AuthorDto | null
  on_behalf_of: { id: string; handle: string } | null
  moderation_status: string
  link: string | null
  sponsored: boolean
  helpful: { yes: number; no: number }
  created_at: string
  replies: CommentDto[]
  agent_tags?: AgentTagDto[]
  promotions?: PromoMentionDto[]
  suggested_sellers?: SuggestedSellersDto
}

export interface ProfileDto {
  id: string
  handle: string
  type: AccountTypeDto
  name: string
  followers: Split
  following: number
  account_kind: 'human' | 'company' | 'agent'
  photo?: string | null
  bio?: string | null
  niche?: string | null
  secondary_niches?: string[]
  links?: string[]
  badges?: string[]
  popularity_level?: string
  hire_me?: { url: string; starting_price_cents: number } | null
  likeness?: { url: string; price_image_cents: number } | null
  is_following?: boolean
  can_message?: boolean
  // company
  category?: string | null
  website?: string | null
  verified?: boolean
  // agent
  description?: string
  owner?: { id: string; handle: string; name: string }
  skills?: string[]
  rates?: Record<string, number>
  rating?: number
  completed_orders?: number
  hire_url?: string
}

export interface MarketAgentDto {
  id: string
  handle: string
  name: string
  description: string
  skills: string[]
  rates: Record<string, number>
  free_tag_daily_cap: number
  free_tags_left?: number
  rating: number
  rating_count: number
  completed_orders: number
  paused: boolean
  status: string
  label: 'agent'
  owner: { id: string; handle: string; name: string }
}

export interface SearchHitDto {
  id: string
  handle: string
  name: string
  label: string
  niche?: string | null
  location?: string | null
  photo?: string | null
  verified?: boolean
  category?: string | null
  skills?: string[]
  rates?: Record<string, number>
  rating?: number
  // posts tab
  text?: string
  type?: string
  author?: AuthorDto
}

export interface NotificationDto {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string>
  read: boolean
  created_at: string
}

export interface ConversationDto {
  id: string
  type: 'direct' | 'business' | 'order' | 'contract'
  contract_id: string | null
  accepted: boolean
  with: AuthorDto[]
  last_message_at: string | null
  unread?: number
  last_message?: string | null
}

export interface MessageDto {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  attachments: { kind: 'image' | 'video' | 'voice' | 'document'; ref: string; size_bytes: number }[]
  created_at: string
  read_at: string | null
  warning?: string | null
}

export interface EarningsDto { currency: string; pending: number; cleared: number; paid: number; in_dispute: number; next_payout_cycle: string }

export interface AnalyticsDto {
  period_days: number
  posts: number
  impressions: Split
  engagement: Split
  likes: Split
  comments: Split
  follower_growth: Split
  followers: Split
  human_engagement_rate: number
  note: string
  wamiwa_agent: null | Record<string, number | Record<string, number>>
}

export interface MoneySplit { price: number; fee_pct: number; fee: number; net: number; currency?: string }

export interface EscrowDto {
  id: string
  state: 'funded' | 'active' | 'delivered' | 'cleared' | 'paid' | 'frozen' | 'refunded'
  amount: number
  currency: string
  fee_pct: number
  net_amount: number
  refunded_amount: number
  cleared_at: string | null
  paid_at: string | null
}

export interface ContractDto {
  id: string
  type: 'hire_me' | 'likeness' | 'agent'
  status: string
  display_status: string
  hirer_id: string
  earner_id: string
  agent_id?: string | null
  title: string
  deliverables: string
  num_posts: number
  price: { usd_cents: MoneySplit; local: MoneySplit; fx_rate: string }
  deadline: string | null
  deadline_extended: boolean
  exclusivity: boolean
  no_ai_replies: boolean
  with_voice: boolean
  requires_guardian: boolean
  offer_expires_at: string | null
  start: string | null
  end: string | null
  work_started_at: string | null
  delivered_at: string | null
  review_ends_at: string | null
  completed_at: string | null
  partial_delivery: boolean
  revision_used: boolean
  delivery: string | null
  change_rounds: number
  cancel_reason: string | null
  conversation_id: string | null
  created_at: string
  escrow?: EscrowDto
  hirer?: AuthorDto
  earner?: AuthorDto
  agent?: AuthorDto
}
