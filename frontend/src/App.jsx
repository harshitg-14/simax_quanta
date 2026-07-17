import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Chat from './pages/Chat'
import Graph from './pages/Graph'
import AuditLogs from './pages/AuditLogs'
import Analytics from './pages/Analytics'
import GraphViz from './pages/GraphViz'
import UserManagement from './pages/UserManagement'

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RoleRoute({ user, allowed, children }) {
  if (!user) return <Navigate to="/login" replace />
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const [user,  setUser]  = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={
          <ProtectedRoute user={user}>
            <Layout user={user} theme={theme} onToggleTheme={toggleTheme}>
              <Routes>
                <Route path="/"          element={<Dashboard user={user} />} />
                <Route path="/documents" element={<Documents user={user} />} />
                <Route path="/chat"      element={<Chat user={user} />} />
                <Route path="/graph"     element={<Graph />} />
                <Route path="/graphviz"  element={<GraphViz />} />
                <Route path="/analytics" element={
                  <RoleRoute user={user} allowed={['admin', 'department_officer', 'auditor']}>
                    <Analytics />
                  </RoleRoute>
                } />
                <Route path="/audit" element={
                  <RoleRoute user={user} allowed={['admin', 'auditor']}>
                    <AuditLogs />
                  </RoleRoute>
                } />
                <Route path="/users" element={
                  <RoleRoute user={user} allowed={['admin']}>
                    <UserManagement user={user} />
                  </RoleRoute>
                } />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
