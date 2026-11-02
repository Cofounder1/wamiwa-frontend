import {
  Activity, BadgeCheck, BarChart3, Bell, Bot, Briefcase, Building2, CircleDollarSign, Clapperboard,   Compass, CreditCard, FileSignature, Gauge, Gavel, HandCoins, HeartHandshake, Home, Inbox, KeyRound, Lightbulb,
  ListChecks, Map, Megaphone, Receipt, MessageSquare, Mic2, Network, PhoneCall, Plus, ScrollText, Settings, Shield,
  ShieldCheck, Smile, Sparkles, Store, Tags, TrendingUp, Upload, UserCog, Users, Rocket, Wallet, Wand2, LifeBuoy, Eye,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/context/session'

export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: number | string }
export interface NavGroup { title?: string; items: NavItem[] }

const social: NavGroup = {
  items: [
    { to: '/app/feed', label: 'Home', icon: Home },
    { to: '/app/search', label: 'Explore', icon: Compass },
    { to: '/app/marketplace', label: 'Agent marketplace', icon: Store },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/notifications', label: 'Notifications', icon: Bell },
  ],
}

const footer: NavGroup = {
  title: 'Account',
  items: [
    { to: '/app/settings', label: 'Settings', icon: Settings },
    // Payment history and refunds for people (companies have Billing). GET /payments works for every account.
    { to: '/app/settings?tab=payments', label: 'Payments', icon: Receipt },
    { to: '/app/support', label: 'Help & support', icon: LifeBuoy },
  ],
}

export const NAV: Record<Role, NavGroup[]> = {
  influencer: [
    social,
    {
      title: 'Earn',
      items: [
        { to: '/app/earnings', label: 'Earnings', icon: Wallet },
        { to: '/app/offers', label: 'Offers', icon: Inbox },
        { to: '/app/contracts', label: 'Contracts', icon: FileSignature },
        { to: '/app/hire-me', label: 'Hire Me page', icon: Briefcase },
        { to: '/app/likeness', label: 'My likeness', icon: Wand2 },
        { to: '/app/disputes', label: 'Disputes', icon: Gavel },
      ],
    },
    {
      title: 'Create & grow',
      items: [
        { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/app/ideas', label: 'Daily post ideas', icon: Lightbulb },
        { to: '/app/grow', label: 'Grow with Pro', icon: TrendingUp },
        { to: '/app/ai-video', label: 'AI video', icon: Clapperboard },
        { to: '/app/autoreply', label: 'Auto-reply agent', icon: Bot },
        { to: '/app/wamiwa-agent', label: 'Wamiwa Agent', icon: Megaphone },
        { to: '/app/verify', label: 'Verification', icon: BadgeCheck },
        { to: '/app/subscription', label: 'Subscription', icon: Sparkles },
      ],
    },
    footer,
  ],
  minor: [
    { items: social.items.filter((i) => i.to !== '/app/marketplace') },
    {
      title: 'Earn (with guardian)',
      items: [
        { to: '/app/offers', label: 'Offers', icon: Inbox },
        { to: '/app/earnings', label: 'My earnings', icon: Wallet },
        { to: '/app/guardian-link', label: 'My guardian', icon: HeartHandshake },
      ],
    },
    {
      title: 'Grow',
      items: [
        { to: '/app/grow', label: 'Grow with Pro', icon: TrendingUp },
        { to: '/app/subscription', label: 'Subscription', icon: Sparkles },
      ],
    },
    footer,
  ],
  guardian: [
    {
      title: 'Guardian',
      items: [
        { to: '/app/guardian', label: 'Minors overview', icon: Users },
        { to: '/app/guardian/contracts', label: 'Contract approvals', icon: FileSignature },
        { to: '/app/guardian/companies', label: 'Company approvals', icon: Building2 },
        { to: '/app/guardian/calls', label: 'Confirmation calls', icon: PhoneCall },
        { to: '/app/guardian/uploads', label: 'Likeness uploads', icon: Upload },
        { to: '/app/guardian/chats', label: 'Company chats', icon: Eye },
        { to: '/app/guardian/payouts', label: 'Payouts', icon: HandCoins },
      ],
    },
    social,
    footer,
  ],
  company: [
    social,
    {
      title: 'Brand',
      items: [
        { to: '/app/studio', label: 'Content studio', icon: Clapperboard },
        { to: '/app/influencers', label: 'Find influencers', icon: Users },
        { to: '/app/contracts', label: 'Contracts', icon: FileSignature },
        { to: '/app/b2b', label: 'B2B discovery', icon: Network },
        { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/app/sentiment', label: 'Sentiment', icon: Smile },
      ],
    },
    {
      title: 'Business',
      items: [
        { to: '/app/wamiwa-agent', label: 'Wamiwa Agent', icon: Megaphone },
        { to: '/app/roster', label: 'Label roster', icon: Mic2 },
        { to: '/app/api', label: 'API keys', icon: KeyRound },
        { to: '/app/billing', label: 'Billing', icon: CreditCard },
        { to: '/app/company/verify', label: 'Verification', icon: ShieldCheck },
        { to: '/app/company/settings', label: 'Company settings', icon: Building2 },
      ],
    },
    { title: 'Help', items: [{ to: '/app/support', label: 'Help & support', icon: LifeBuoy }] },
  ],
  agent_owner: [
    social,
    {
      title: 'My agents',
      items: [
        { to: '/app/agents', label: 'Agents', icon: Bot },
        { to: '/app/agents/new', label: 'Deploy an agent', icon: Plus },
        { to: '/app/earnings', label: 'Agent earnings', icon: CircleDollarSign },
      ],
    },
    footer,
  ],
  admin: [],
  super_admin: [],
}

export const ADMIN_NAV = (superAdmin: boolean): NavGroup[] => [
  {
    items: [
      { to: '/admin', label: 'Overview', icon: Gauge },
      { to: '/admin/queues', label: 'Review queues', icon: ListChecks },
      { to: '/admin/accounts', label: 'Accounts', icon: Users },
      { to: '/admin/queues?queue=disputes', label: 'Disputes', icon: Gavel },
      { to: '/admin/payouts', label: 'Payout approvals', icon: HandCoins },
      { to: '/admin/minors', label: 'Minor contracts', icon: Shield },
    ],
  },
  {
    title: 'Wamiwa Agent',
    items: [
      { to: '/admin/wamiwa-agent', label: 'Plans & links', icon: Megaphone },
      { to: '/admin/keywords', label: 'Seller keywords', icon: Tags },
      { to: '/admin/category-map', label: 'B2B category map', icon: Map },
    ],
  },
  {
    title: 'Oversight',
    items: [
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
      { to: '/admin/feedback', label: 'Product feedback', icon: Lightbulb },
      ...(superAdmin
        ? [
          { to: '/admin/health', label: 'Queue health', icon: Activity },
          { to: '/admin/admins', label: 'Admins', icon: UserCog },
          { to: '/admin/go-live', label: 'Go live', icon: Rocket },
        ]
        : []),
    ],
  },
]

