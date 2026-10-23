import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/primitives'
import Landing from '@/pages/marketing/Landing'

/** Lazy-load a named export so each area ships as its own chunk. */
function lz<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M = 'default') {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })))
}

const Signup = lz(() => import('@/pages/auth/Signup'))
const Login = lz(() => import('@/pages/auth/Login'))
const Developers = lz(() => import('@/pages/marketing/Developers'))
const Terms = lz(() => import('@/pages/legal/Legal'), 'Terms')
const Privacy = lz(() => import('@/pages/legal/Legal'), 'Privacy')
const ProGrowth = lz(() => import('@/pages/earn/ProGrowth'))

const Feed = lz(() => import('@/pages/social/Feed'))
const PostDetail = lz(() => import('@/pages/social/PostDetail'))
const CreatePost = lz(() => import('@/pages/social/CreatePost'))
const Search = lz(() => import('@/pages/social/Search'))
const Profile = lz(() => import('@/pages/social/Profile'))
const Notifications = lz(() => import('@/pages/social/Notifications'))
const Messages = lz(() => import('@/pages/messages/Messages'))

const Marketplace = lz(() => import('@/pages/marketplace/Marketplace'))
const AgentDetail = lz(() => import('@/pages/marketplace/AgentDetail'))
const OrderThread = lz(() => import('@/pages/marketplace/OrderThread'))

const Earnings = lz(() => import('@/pages/earn/Earnings'))
const Offers = lz(() => import('@/pages/earn/Offers'))
const ContractsList = lz(() => import('@/pages/earn/Contracts'), 'ContractsList')
const ContractDetail = lz(() => import('@/pages/earn/Contracts'))
const HireMe = lz(() => import('@/pages/earn/HireMe'))
const Likeness = lz(() => import('@/pages/earn/Likeness'))
const ScriptReview = lz(() => import('@/pages/earn/ScriptReview'))
const VideoApproval = lz(() => import('@/pages/earn/VideoApproval'))
const Disputes = lz(() => import('@/pages/earn/Disputes'))
const Verification = lz(() => import('@/pages/earn/Verification'))
const Analytics = lz(() => import('@/pages/earn/Grow'), 'Analytics')
const PostIdeas = lz(() => import('@/pages/earn/Grow'), 'PostIdeas')
const AIVideo = lz(() => import('@/pages/earn/Grow'), 'AIVideo')
const AutoReply = lz(() => import('@/pages/earn/Grow'), 'AutoReply')
const Subscription = lz(() => import('@/pages/earn/Grow'), 'Subscription')

const WamiwaAgent = lz(() => import('@/pages/wamiwa/WamiwaAgent'))
const ContentIdeas = lz(() => import('@/pages/wamiwa/WamiwaAgent'), 'ContentIdeas')
const ClaimName = lz(() => import('@/pages/wamiwa/WamiwaAgent'), 'ClaimName')

const G = () => import('@/pages/guardian/Guardian')
const GuardianOverview = lz(G, 'GuardianOverview')
const GuardianContracts = lz(G, 'GuardianContracts')
const GuardianCompanies = lz(G, 'GuardianCompanies')
const GuardianCalls = lz(G, 'GuardianCalls')
const GuardianUploads = lz(G, 'GuardianUploads')
const GuardianChats = lz(G, 'GuardianChats')
const GuardianPayouts = lz(G, 'GuardianPayouts')
const MinorGuardian = lz(G, 'MinorGuardian')

const B = () => import('@/pages/company/Brand')
const Studio = lz(B, 'Studio')
const InfluencerBrowser = lz(B, 'InfluencerBrowser')
const ScriptComposer = lz(B, 'ScriptComposer')
const VideoStudio = lz(B, 'VideoStudio')
const Biz = () => import('@/pages/company/Business')
const B2B = lz(Biz, 'B2B')
const Sentiment = lz(Biz, 'Sentiment')
const ApiKeys = lz(Biz, 'ApiKeys')
const Billing = lz(Biz, 'Billing')
const LabelRoster = lz(Biz, 'LabelRoster')
const CompanySettings = lz(Biz, 'CompanySettings')
const CompanyVerify = lz(Biz, 'CompanyVerify')

const Ag = () => import('@/pages/agents/Agents')
const MyAgents = lz(Ag, 'MyAgents')
const DeployAgent = lz(Ag, 'DeployAgent')
const ManageAgent = lz(Ag, 'ManageAgent')

const Settings = lz(() => import('@/pages/settings/Settings'))
const Support = lz(() => import('@/pages/settings/Settings'), 'Support')

const AD = () => import('@/pages/admin/AdminDashboards')
const AdminOverview = lz(AD, 'AdminOverview')
const QueueHealth = lz(AD, 'QueueHealth')
const WamiwaAgentAdmin = lz(AD, 'WamiwaAgentAdmin')
const AO = () => import('@/pages/admin/AdminOps')
const Queues = lz(AO, 'Queues')
const Accounts = lz(AO, 'Accounts')
const DisputeDetail = lz(AO, 'DisputeDetail')
const Payouts = lz(AO, 'Payouts')
const MinorContracts = lz(AO, 'MinorContracts')
const AdminManagement = lz(AO, 'AdminManagement')
const AuditLog = lz(AO, 'AuditLog')
const CategoryMap = lz(AO, 'CategoryMap')
const Keywords = lz(AO, 'Keywords')
const Feedback = lz(AO, 'Feedback')

function Loading() {
  return <div className="grid min-h-[50vh] place-items-center text-ink-3"><Loader2 className="size-6 animate-spin" /></div>
}

export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="feed" replace />} />
            {/* Shared */}
            <Route path="feed" element={<Feed />} />
            <Route path="post/:id" element={<PostDetail />} />
            <Route path="create" element={<CreatePost />} />
            <Route path="search" element={<Search />} />
            <Route path="u/:handle" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:id" element={<Messages />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="marketplace/:handle" element={<AgentDetail />} />
            <Route path="orders/:id" element={<OrderThread />} />
            <Route path="settings" element={<Settings />} />
            <Route path="support" element={<Support />} />
            <Route path="wamiwa-agent" element={<WamiwaAgent />} />
            <Route path="wamiwa-agent/ideas" element={<ContentIdeas />} />
            <Route path="claim-name" element={<ClaimName />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="grow" element={<ProGrowth />} />
            {/* Earn */}
            <Route path="earnings" element={<Earnings />} />
            <Route path="offers" element={<Offers />} />
            <Route path="contracts" element={<ContractsList />} />
            <Route path="contracts/:id" element={<ContractDetail />} />
            <Route path="hire-me" element={<HireMe />} />
            <Route path="likeness" element={<Likeness />} />
            <Route path="likeness/script/:id" element={<ScriptReview />} />
            <Route path="likeness/video/:id" element={<VideoApproval />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="verify" element={<Verification />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="ideas" element={<PostIdeas />} />
            <Route path="ai-video" element={<AIVideo />} />
            <Route path="autoreply" element={<AutoReply />} />
            {/* Minor & guardian */}
            <Route path="guardian-link" element={<MinorGuardian />} />
            <Route path="guardian" element={<GuardianOverview />} />
            <Route path="guardian/contracts" element={<GuardianContracts />} />
            <Route path="guardian/companies" element={<GuardianCompanies />} />
            <Route path="guardian/calls" element={<GuardianCalls />} />
            <Route path="guardian/uploads" element={<GuardianUploads />} />
            <Route path="guardian/chats" element={<GuardianChats />} />
            <Route path="guardian/payouts" element={<GuardianPayouts />} />
            {/* Company */}
            <Route path="studio" element={<Studio />} />
            <Route path="influencers" element={<InfluencerBrowser />} />
            <Route path="influencers/:handle/script" element={<ScriptComposer />} />
            <Route path="video/:id" element={<VideoStudio />} />
            <Route path="b2b" element={<B2B />} />
            <Route path="sentiment" element={<Sentiment />} />
            <Route path="api" element={<ApiKeys />} />
            <Route path="billing" element={<Billing />} />
            <Route path="roster" element={<LabelRoster />} />
            <Route path="company/settings" element={<CompanySettings />} />
            <Route path="company/verify" element={<CompanyVerify />} />
            {/* Agent owner */}
            <Route path="agents" element={<MyAgents />} />
            <Route path="agents/new" element={<DeployAgent />} />
            <Route path="agents/:handle" element={<ManageAgent />} />
          </Route>

          <Route path="/admin" element={<AppShell admin />}>
            <Route index element={<AdminOverview />} />
            <Route path="queues" element={<Queues />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="disputes/:id" element={<DisputeDetail />} />
            <Route path="payouts" element={<Payouts />} />
            <Route path="minors" element={<MinorContracts />} />
            <Route path="health" element={<QueueHealth />} />
            <Route path="admins" element={<AdminManagement />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="category-map" element={<CategoryMap />} />
            <Route path="keywords" element={<Keywords />} />
            <Route path="wamiwa-agent" element={<WamiwaAgentAdmin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </>
  )
}
