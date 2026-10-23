/**
 * Business rules from the Wamiwa PRD v2, expressed as pure functions so every
 * screen shows the same numbers. Story IDs are noted beside each rule.
 */

export type ContractType = 'hire_me' | 'likeness' | 'agent'

/** PY-01 — fees come out of the price, never on top. */
export const FEE_PCT: Record<ContractType, number> = { hire_me: 0.2, likeness: 0.2, agent: 0.1 }

export function split(price: number, type: ContractType) {
  const fee = +(price * FEE_PCT[type]).toFixed(2)
  return { price, fee, net: +(price - fee).toFixed(2), pct: FEE_PCT[type] }
}

/** LK-02 — image-only likeness limit for follower-based influencers. */
export function likenessLimit(humanFollowers: number, engagementRate: number) {
  const base = 20 + 10 * (humanFollowers / 1000)
  const m = 0.75 + Math.min(engagementRate / 0.15, 1) * 0.75
  return { base, multiplier: m, limit: Math.round(base * m), low: Math.round(base * 0.75), high: Math.round(base * 1.5) }
}

/** ON-07a — popularity rating card levels. */
export type SignalCategory = 'Media popularity' | 'Position' | 'Speaking' | 'Recognition' | 'Public work'
export function popularityLevel(signals: { category: SignalCategory; verified: boolean }[]) {
  const v = signals.filter((s) => s.verified)
  const cats = new Set(v.map((s) => s.category)).size
  if (v.length >= 3 && cats >= 2) return 'Major' as const
  if (v.length >= 2) return 'Prominent' as const
  if (v.length === 1) return 'Notable' as const
  return null
}

/** ON-02 — age gate. */
export function ageTier(dob: string): 'refused' | 'minor' | 'adult' {
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  if (age < 13) return 'refused'
  if (age < 18) return 'minor'
  return 'adult'
}

/** LK-09 — categories blocked for 13–17 accounts. */
export const MINOR_BLOCKED = [
  'Alcohol', 'Tobacco & vaping', 'Betting & gambling', 'Dating', 'Adult products',
  'Weight-loss products', 'Political campaigns', 'Loans & crypto',
]

/** LK-10 — brand video production. */
export const VIDEO_PRICING = {
  perVideo: 45, extraFinal: 15, extraMinute: 25, drafts: 4, finals: 2,
  plans: [
    { id: 'growth', name: 'Growth', price: 199, videos: 5 },
    { id: 'scale', name: 'Scale', price: 499, videos: 14 },
  ],
}

/** SB-01 / AV-01 */
export const SUBSCRIPTION = { monthly: 10, yearly: 100, pro: { monthly: 16, yearly: 160 } }
export const AI_VIDEO = { standard: 3, premium: 25, plan: { monthly: 30, videos: 15, minutesEach: 2 } }

/** WA-01 — Wamiwa Agent plans. */
export type PlanKind = 'business' | 'seller' | 'artist' | 'label'
export const WA_PLANS: Record<PlanKind, { name: string; base: number; plus: number; links: number; plusLinks: number; who: string; perArtist?: boolean }> = {
  business: { name: 'Business', base: 20, plus: 30, links: 5, plusLinks: 10, who: 'Verified companies' },
  seller: { name: 'Individual seller', base: 20, plus: 30, links: 5, plusLinks: 10, who: 'ID-verified adults who sell their own products' },
  artist: { name: 'Artist', base: 20, plus: 30, links: 3, plusLinks: 6, who: 'ID-verified adult artists' },
  label: { name: 'Record label', base: 80, plus: 90, links: 3, plusLinks: 6, who: 'Verified labels, up to 50 artists', perArtist: true },
}

/** Section 20 — rate limits (starting values). */
export const LIMITS = {
  otpResendsPerHour: 3, otpWrongBeforeLock: 5, otpLockMinutes: 15, otpValidMinutes: 10,
  agentsPerComment: 3, agentToAgentPerThread: 3, agentCommentsPerHour: 30,
  editWindowMinutes: 15,
  b2bNewPerDay: 20, apiPostsPerHour: 60, apiRepliesPerHour: 600,
  wamiwaRepliesPerHour: 600, wamiwaRepliesPerPersonDay: 5, cardsPerPost: 3,
}

/** Section 1 */
export const TARGETS = {
  completedContracts: 500, escrowGmv: 100_000, payingSubscribers: 2000, verifiedWithContract: 0.25,
  repeatBrand: 0.4, medianDaysToActive: 3, disputeRate: 0.05, likenessTakedown: 0.01,
  agentHelpful: 0.6, mau: 50_000,
}

/** Epic 6 — escrow lifecycle. */
export const ESCROW_STATES = ['Funded', 'Active', 'Delivered', 'Cleared', 'Paid'] as const
export type EscrowState = (typeof ESCROW_STATES)[number] | 'Frozen' | 'Refunded'

/** RP-01 */
export const REPORT_REASONS = ['Spam', 'Scam', 'Harassment', 'Racism or insulting Yoruba people', 'Impersonation', 'Misuse of likeness', 'Mislabeled AI', 'Other']
/** The API value for each reason above (RP-01, RP-02). */
export const REPORT_REASON_VALUE: Record<string, string> = { 'Racism or insulting Yoruba people': 'racism_ethnic_insult' }

/** ON-04 */
export const NICHES = [
  'Fashion', 'Beauty', 'Food & drinks', 'Music', 'Comedy', 'Tech', 'Fitness', 'Travel', 'Finance',
  'Gaming', 'Art & design', 'Parenting', 'Sports', 'Education', 'Lifestyle', 'Autos', 'Agriculture',
]

/** FD-08: whole minutes left to edit something posted at `createdAt` (0 once the window has closed). */
export function editMinutesLeft(createdAt: string, now = Date.now()) {
  const left = LIMITS.editWindowMinutes * 60_000 - (now - new Date(createdAt).getTime())
  return left > 0 ? Math.max(1, Math.ceil(left / 60_000)) : 0
}
