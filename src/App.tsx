import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
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

const SkillsPage = lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })))
const DecisionLockPage = lazy(() => import('./pages/DecisionLockPage').then(m => ({ default: m.DecisionLockPage })))
const EvolutionPage = lazy(() => import('./pages/EvolutionPage').then(m => ({ default: m.EvolutionPage })))
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
        <div className="h-screen flex flex-col bg-atmosphere overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/decision-lock" element={<DecisionLockPage />} />
                <Route path="/evolution" element={<EvolutionPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/kit" element={<KitPage />} />
                <Route path="/pro" element={<ProUpgradePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/private-skills" element={<PrivateSkillsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/terms" element={<LegalPage type="terms" />} />
                <Route path="/privacy" element={<LegalPage type="privacy" />} />
                <Route path="/refund" element={<LegalPage type="refund" />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/shared/:encoded" element={<SharedPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </Suspense>
          </main>
          <Onboarding />
          <FeedbackButton />
        </div>
      </HashRouter>
    </AuthProvider>
  )
}
