import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import Login from './components/Login'
import SetupNotice from './components/SetupNotice'
import MemberGate from './components/MemberGate'
import GlobalView from './components/GlobalView'
import CategoriesView from './components/CategoriesView'
import CategoryDetail from './components/CategoryDetail'
import ContributionsView from './components/ContributionsView'
import MemberDetail from './components/MemberDetail'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'
import ExpenseModal from './components/ExpenseModal'
import ContributionModal from './components/ContributionModal'

function Loading() {
  return <div className="center-screen"><div className="spinner" /></div>
}

export default function App() {
  const { isSupabaseConfigured, authReady, session, loading, activeMemberId } = useApp()
  const [modal, setModal] = useState(null) // 'expense' | 'contribution' | null
  const [fabOpen, setFabOpen] = useState(false)
  const location = useLocation()

  if (!isSupabaseConfigured) return <SetupNotice />
  if (!authReady) return <Loading />
  if (!session) return <Login />
  if (loading) return <Loading />
  if (!activeMemberId) return <MemberGate />

  const openExpense = () => { setFabOpen(false); setModal('expense') }
  const openContribution = () => { setFabOpen(false); setModal('contribution') }

  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<GlobalView />} />
        <Route path="/categorias" element={<CategoriesView />} />
        <Route path="/categorias/:id" element={<CategoryDetail />} />
        <Route path="/aportaciones" element={<ContributionsView />} />
        <Route path="/aportaciones/:id" element={<MemberDetail />} />
        <Route path="/historial" element={<HistoryView />} />
        <Route path="/ajustes" element={<SettingsView />} />
        <Route path="*" element={<GlobalView />} />
      </Routes>

      {location.pathname !== '/ajustes' && (
        <>
          {fabOpen && (
            <div className="sheet-overlay" style={{ background: 'rgba(0,0,0,.35)' }} onClick={() => setFabOpen(false)}>
              <div style={{ position: 'fixed', right: 'max(16px, calc((100vw - var(--maxw))/2 + 16px))', bottom: 'calc(156px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}
                onClick={(e) => e.stopPropagation()}>
                <button className="btn" style={{ width: 'auto' }} onClick={openContribution}>👥 Aportación</button>
                <button className="btn" style={{ width: 'auto' }} onClick={openExpense}>🧾 Gasto</button>
              </div>
            </div>
          )}
          <button className="fab" onClick={() => setFabOpen((v) => !v)} aria-label="Agregar">
            {fabOpen ? '×' : '+'}
          </button>
        </>
      )}

      <BottomNav />

      {modal === 'expense' && <ExpenseModal onClose={() => setModal(null)} />}
      {modal === 'contribution' && <ContributionModal onClose={() => setModal(null)} />}
    </div>
  )
}
