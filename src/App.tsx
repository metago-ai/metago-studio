import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useStore } from './store/useStore'
import { Onboarding } from './components/Onboarding'
import { FeedbackButton } from './components/FeedbackButton'

function CloudSyncBridge() {
  const { user } = useAuth()
  const setCloudUser = useStore(s => s.setCloudUser)
  const refreshFromCloud = useStore(s => s.refreshFromCloud)

  useEffect(() => {
    const uid = user?.uid ?? null
    setCloudUser(uid).catch(() => {})
    if (uid) {
      refreshFromCloud().catch(() => {})
    }
  }, [user?.uid, setCloudUser, refreshFromCloud])

  return null
}

/**
 * 登录门控：未登录用户访问受保护页面时，重定向到 /auth?redirect=<原路径>
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoading />
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth?redirect=${redirect}`} replace />
  }
  return <>{children}</>
}

const SkillsPage = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })))
const AgentPage = lazy(() => import('./pages/Agent').then(m => ({ default: m.AgentPage })))
const DecisionLockPage = lazy(() => import('./pages/DecisionLockPage').then(m => ({ default: m.DecisionLockPage })))
const EvolutionPage = lazy(() => import('./pages/EvolutionPage').then(m => ({ default: m.EvolutionPage })))
const ShieldPage = lazy(() => import('./pages/ShieldPage').then(m => ({ default: m.ShieldPage })))
const MetricsPage = lazy(() => import('./pages/MetricsPage').then(m => ({ default: m.MetricsPage })))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })))
const KitPage = lazy(() => import('./pages/KitPage').then(m => ({ default: m.KitPage })))
const ProUpgradePage = lazy(() => import('./pages/ProUpgradePage').then(m => ({ default: m.ProUpgradePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const PrivateSkillsPage = lazy(() => import('./pages/PrivateSkillsPage').then(m => ({ default: m.PrivateSkillsPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const LegalPage = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })))
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })))
const SharedPage = lazy(() => import('./pages/SharedPage').then(m => ({ default: m.SharedPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const RolesPage = lazy(() => import('./pages/RolesPage').then(m => ({ default: m.RolesPage })))
const BehaviorBankPage = lazy(() => import('./pages/BehaviorBankPage').then(m => ({ default: m.BehaviorBankPage })))
const CertifyPage = lazy(() => import('./pages/CertifyPage').then(m => ({ default: m.CertifyPage })))
const DepthAnalysisPage = lazy(() => import('./pages/DepthAnalysisPage').then(m => ({ default: m.DepthAnalysisPage })))
const FdePage = lazy(() => import('./pages/FdePage').then(m => ({ default: m.FdePage })))

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-zinc-700 border-t-accent-life rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CloudSyncBridge />
      <HashRouter>
        <Routes>
          {/* ========== 管理后台 - 完全独立布局，不渲染 Studio Header/Onboarding/FeedbackButton ========== */}
          <Route path="/admin" element={
            <Suspense fallback={<PageLoading />}>
              <AdminPage />
            </Suspense>
          } />

          {/* ========== 用户系统 - 共享布局 ========== */}
          <Route path="/*" element={
            <div className="h-screen flex flex-col bg-atmosphere overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                <Suspense fallback={<PageLoading />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/agent" element={<AgentPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/skills" element={<SkillsPage />} />
                    <Route path="/decision-lock" element={<DecisionLockPage />} />
                    <Route path="/evolution" element={<EvolutionPage />} />
                    <Route path="/shield" element={<ShieldPage />} />
                    <Route path="/metrics" element={<RequireAuth><MetricsPage /></RequireAuth>} />
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/kit" element={<KitPage />} />
                    <Route path="/pro" element={<RequireAuth><ProUpgradePage /></RequireAuth>} />
                    <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                    <Route path="/private-skills" element={<RequireAuth><PrivateSkillsPage /></RequireAuth>} />
                    <Route path="/terms" element={<LegalPage type="terms" />} />
                    <Route path="/privacy" element={<LegalPage type="privacy" />} />
                    <Route path="/refund" element={<LegalPage type="refund" />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route path="/shared/:encoded" element={<SharedPage />} />
                    <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/behavior-bank" element={<BehaviorBankPage />} />
                    <Route path="/certify" element={<CertifyPage />} />
                    <Route path="/depth-analysis" element={<DepthAnalysisPage />} />
                    <Route path="/fde" element={<FdePage />} />
                  </Routes>
                </Suspense>
              </main>
              <Onboarding />
              <FeedbackButton />
              <footer className="flex-shrink-0 border-t border-border-subtle bg-bg-deep px-4 py-2 text-center">
                <a
                  href="https://beian.miit.gov.cn"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  蜀ICP备2026035958号
                </a>
              </footer>
            </div>
          } />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
