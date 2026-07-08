import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, MessageSquare, GitBranch, Shield, LogOut, Zap, BarChart2, Network, Users, ChevronRight } from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',         group: 'Overview' },
  { to: '/documents', icon: FileText,        label: 'Documents',         group: 'Knowledge' },
  { to: '/chat',      icon: MessageSquare,   label: 'Document Q&A',      group: 'Knowledge' },
  { to: '/graph',     icon: GitBranch,       label: 'Knowledge Graph',   group: 'Knowledge' },
  { to: '/graphviz',  icon: Network,         label: 'Graph Visualization',group: 'Knowledge' },
  { to: '/analytics', icon: BarChart2,       label: 'Analytics',         group: 'Insights' },
  { to: '/audit',     icon: Shield,          label: 'Audit Logs',        group: 'Admin', roles: ['admin', 'auditor'] },
  { to: '/users',     icon: Users,           label: 'User Management',   group: 'Admin', roles: ['admin'] },
]

const PAGE_TITLES = {
  '/':          'Dashboard',
  '/documents': 'Documents',
  '/chat':      'Document Q&A',
  '/graph':     'Knowledge Graph',
  '/graphviz':  'Graph Visualization',
  '/analytics': 'Analytics',
  '/audit':     'Audit Logs',
  '/users':     'User Management',
}

function Initials({ name }) {
  const parts = (name || 'U').split(' ')
  const ini = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return ini.toUpperCase()
}

export default function Layout({ user, children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(user?.role))
  const groups = [...new Set(visibleNav.map(n => n.group))]
  const pageTitle = PAGE_TITLES[pathname] || 'Simax Quanta'

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>Simax Quanta</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Gov Intelligence v4.0</div>
            </div>
          </div>
        </div>

        {/* Nav Groups */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                color: 'var(--text-3)', textTransform: 'uppercase',
                padding: '6px 10px 4px',
              }}>{group}</div>
              {visibleNav.filter(n => n.group === group).map(({ to, icon: Icon, label }) => {
                const active = pathname === to
                return (
                  <Link key={to} to={to} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10, marginBottom: 2,
                    textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                    background: active ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.18))' : 'transparent',
                    color: active ? '#93C5FD' : 'var(--text-2)',
                    borderLeft: active ? '2px solid #6366F1' : '2px solid transparent',
                  }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-1)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' } }}
                  >
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    {label}
                    {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.05em',
            }}>
              <Initials name={user?.name} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{
                display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 600,
                padding: '1px 6px', borderRadius: 99,
                background: 'rgba(99,102,241,0.2)', color: '#A5B4FC',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>

          <button onClick={logout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 10, border: 'none',
            background: 'transparent', cursor: 'pointer', fontSize: 13,
            color: 'var(--text-3)', transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top header bar */}
        <header style={{
          height: 56, flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 28px', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Simax Quanta</span>
          <ChevronRight size={12} color="var(--text-3)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{pageTitle}</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 99,
              border: '1px solid var(--border-hi)', color: 'var(--text-3)',
            }}>
              🇮🇳 Secure Gov Platform
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
