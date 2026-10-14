import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './context/ToastContext'
import { RulesProvider } from './context/RulesContext'
import { DataProvider } from './context/DataContext'
import DashboardPage from './pages/DashboardPage'
import './App.css'

// HashRouter so every screen has its own URL and a browser refresh works
// under `vite preview` (a static server with no SPA fallback rewrite).
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <RulesProvider>
          <DataProvider>
            <AppRoutes />
          </DataProvider>
        </RulesProvider>
      </ToastProvider>
    </HashRouter>
  )
}
