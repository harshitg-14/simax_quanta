import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, MessageSquare, GitBranch, Shield,
  LogOut, Zap, BarChart2, Network, Users, ChevronRight, Activity,
  Sun, Moon,
} from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',           group: 'Overview' },
  { to: '/documents', icon: FileText,        label: 'Documents',           group: 'Knowledge Base' },
  { to: '/chat',      icon: MessageSquare,   label: 'Document Q&A',        group: 'Knowledge Base' },
  { to: '/graph',     icon: GitBranch,       label: 'Knowledge Graph',     group: 'Knowledge Base' },
  { to: '/graphviz',  icon: Network,         label: 'Graph Visualization', group: 'Knowledge Base' },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics',           group: 'Insights' },
  { to: '/audit',     icon: Shield,          label: 'Audit Logs',          group: 'Security', roles: ['admin', 'auditor'] },
  { to: '/users',     icon: Users,           label: 'User Management',     group: 'Security', roles: ['admin'] },
]

function Initials({ name }) {
  const parts = (name || 'U').split(' ')
  const ini = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return ini.toUpperCase()
}

const ROLE_LABELS = {
  admin:              'Admin',
  department_officer: 'Dept. Officer',
  auditor:            'Auditor',
  reviewer:           'Reviewer',
}

export default function Layout({ user, theme, onToggleTheme, children }) {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(user?.role))
  const groups     = [...new Set(visibleNav.map(n => n.group))]

  const currentPage = NAV.find(n => n.to === pathname)?.label || 'Simax Quanta'

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 232,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
      }}>

        {/* Subtle top glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), transparent)',
        }} />

        {/* Logo */}
        <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
            }}>
              <Zap size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>
                Simax Quanta
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                  Operational · v4.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 6 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-3)', padding: '8px 8px 4px',
              }}>
                {group}
              </div>
              {visibleNav.filter(n => n.group === group).map(({ to, icon: Icon, label }) => {
                const active = pathname === to
                return (
                  <Link key={to} to={to} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 9, marginBottom: 1,
                    textDecoration: 'none', fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                    background: active
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.12))'
                      : 'transparent',
                    color: active ? '#93C5FD' : 'var(--text-2)',
                    borderLeft: `2px solid ${active ? '#6366F1' : 'transparent'}`,
                    paddingLeft: active ? 7 : 8,
                  }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.color = 'var(--text-1)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-2)'
                      }
                    }}
                  >
                    <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    {active && <ChevronRight size={11} style={{ opacity: 0.5 }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 10px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            marginBottom: 6,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.04em',
            }}>
              <Initials name={user?.name} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#A5B4FC',
                background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.3)',
                display: 'inline-block', padding: '1px 7px', borderRadius: 99, marginTop: 3,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
          </div>

          <button onClick={logout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 9, border: 'none',
            background: 'transparent', cursor: 'pointer', fontSize: 12,
            color: 'var(--text-3)', transition: 'all 0.15s', fontFamily: 'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top header */}
        <header style={{
          height: 54, flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 28px', gap: 10,
        }}>
          {/* Breadcrumb */}
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Simax Quanta</span>
          <ChevronRight size={12} color="var(--text-3)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{currentPage}</span>

          {/* Right: status + theme toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--green)',
              background: 'rgba(17,199,142,0.1)', border: '1px solid rgba(17,199,142,0.2)',
              borderRadius: 99, padding: '4px 12px',
            }}>
              <Activity size={10} />
              System Operational
            </div>

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)',
                background: 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.15s',
                color: 'var(--text-3)', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text-1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '26px 32px' }}>
          {children}
        </main>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  )
}
