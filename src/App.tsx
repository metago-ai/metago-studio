import { HashRouter, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Dashboard } from './pages/Dashboard'
import { SkillsPage } from './pages/SkillsPage'
import { DecisionLockPage } from './pages/DecisionLockPage'
import { EvolutionPage } from './pages/EvolutionPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { KitPage } from './pages/KitPage'

export default function App() {
  return (
    <HashRouter>
      <div className="h-screen flex flex-col bg-atmosphere overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/decision-lock" element={<DecisionLockPage />} />
            <Route path="/evolution" element={<EvolutionPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/kit" element={<KitPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
