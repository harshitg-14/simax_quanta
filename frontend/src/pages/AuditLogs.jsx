import { useEffect, useState } from 'react'
import {
  Shield, Search, MessageSquare, XCircle, Upload, Trash2,
  LogIn, RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import api from '../api'

const ACTION_CFG = {
  query:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  label: 'Query',    icon: MessageSquare },
  rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   label: 'Rejected', icon: XCircle },
  upload:   { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  label: 'Upload',   icon: Upload },
  delete:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  label: 'Delete',   icon: Trash2 },
  login:    { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)',  label: 'Login',    icon: LogIn },
}

function getCfg(action) {
  return ACTION_CFG[action] || {
    color: 'var(--text-3)', bg: 'rgba(255,255,255,0.06)', border: 'var(--border)',
    label: action || '—', icon: Shield,
  }
}

function relativeTime(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function ActionBadge({ action }) {
  const cfg  = getCfg(action)
  const Icon = cfg.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

const FILTER_TABS = ['all', 'query', 'rejected', 'upload', 'delete']

export default function AuditLogs() {
  const [logs,    setLogs]    = useState([])
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')
  const [expanded,setExpanded]= useState(null)

  const fetchLogs = () => {
    setLoading(true)
    api.get('/documents/audit/logs')
      .then(r => { setLogs(r.data); setLoading(false) })
      .catch(err => { setError(err.response?.data?.detail || 'Access denied'); setLoading(false) })
  }

  useEffect(() => { fetchLogs() }, [])

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.action !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (l.query || '').toLowerCase().includes(q) ||
             (l.user_id || '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    total:    logs.length,
    query:    logs.filter(l => l.action === 'query').length,
    rejected: logs.filter(l => l.action === 'rejected').length,
    upload:   logs.filter(l => l.action === 'upload').length,
    delete:   logs.filter(l => l.action === 'delete').length,
  }

  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: 320, textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18, marginBottom: 18,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={28} color="#EF4444" />
      </div>
      <p style={{ color: '#FCA5A5', fontWeight: 600, fontSize: 15, margin: '0 0 8px' }}>{error}</p>
      <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
        Audit logs are restricted to Admin and Auditor roles.
      </p>
    </div>
  )

  return (
    <div className="fade-up" style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            Audit Logs
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            {logs.length} system events recorded
          </p>
        </div>
        <button onClick={fetchLogs} className="btn-ghost" style={{ fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',    value: counts.total,    color: 'var(--text-2)' },
          { label: 'Queries',  value: counts.query,    color: '#3B82F6' },
          { label: 'Rejected', value: counts.rejected, color: '#EF4444' },
          { label: 'Uploads',  value: counts.upload,   color: '#10B981' },
          { label: 'Deletes',  value: counts.delete,   color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-3)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search queries or user IDs…"
            style={{
              width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 13,
              color: 'var(--text-1)', outline: 'none', transition: 'border-color 0.2s',
              fontFamily: 'inherit',
            }}
            onFocus={e => e.target.style.borderColor = '#3B82F6'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Action filter tabs */}
        <div style={{
          display: 'flex', gap: 3,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 3,
        }}>
          {FILTER_TABS.map(type => {
            const cfg    = getCfg(type)
            const active = filter === type
            return (
              <button key={type} onClick={() => setFilter(type)} style={{
                padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
                background: active ? (type === 'all' ? 'var(--bg-elevated)' : cfg.bg) : 'transparent',
                color: active ? (type === 'all' ? 'var(--text-1)' : cfg.color) : 'var(--text-3)',
              }}>
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            <RefreshCw size={20} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4, animation: 'spin 1s linear infinite' }} />
            Loading events…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '56px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            <Shield size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
            No events match your filters
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Timestamp', 'Action', 'User ID', 'Query / Event', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '11px 16px',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.015)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => {
                const isLast   = i === filtered.length - 1
                const isExpanded = expanded === l.id
                const borderStyle = isLast && !isExpanded ? 'none' : '1px solid rgba(20,32,56,0.7)'

                return (
                  <>
                    <tr
                      key={l.id}
                      style={{ cursor: l.response ? 'pointer' : 'default', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.018)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => l.response && setExpanded(isExpanded ? null : l.id)}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', borderBottom: borderStyle, whiteSpace: 'nowrap', width: 120 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}
                          title={l.timestamp?.slice(0, 19).replace('T', ' ')}>
                          {relativeTime(l.timestamp)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>
                          {l.timestamp?.slice(0, 10)}
                        </div>
                      </td>

                      {/* Action badge */}
                      <td style={{ padding: '12px 16px', borderBottom: borderStyle, width: 110 }}>
                        <ActionBadge action={l.action} />
                      </td>

                      {/* User */}
                      <td style={{ padding: '12px 16px', borderBottom: borderStyle, width: 120 }}>
                        <code style={{
                          fontSize: 11, color: 'var(--text-3)',
                          background: 'var(--bg-elevated)', padding: '2px 8px',
                          borderRadius: 5, fontFamily: 'monospace',
                        }}>
                          {l.user_id?.slice(0, 10)}…
                        </code>
                      </td>

                      {/* Query text */}
                      <td style={{ padding: '12px 16px', borderBottom: borderStyle }}>
                        <div style={{
                          fontSize: 13, color: 'var(--text-2)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 440,
                        }}>
                          {l.query
                            ? l.query.replace('[AGENT] ', '')
                            : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        </div>
                      </td>

                      {/* Expand toggle */}
                      <td style={{ padding: '12px 16px', borderBottom: borderStyle, width: 36, textAlign: 'center' }}>
                        {l.response && (
                          isExpanded
                            ? <ChevronUp size={14} color="var(--text-3)" />
                            : <ChevronDown size={14} color="var(--text-3)" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded response row */}
                    {isExpanded && (
                      <tr key={l.id + '-exp'}>
                        <td colSpan={5} style={{
                          padding: '0 16px 14px',
                          borderBottom: isLast ? 'none' : '1px solid rgba(20,32,56,0.7)',
                        }}>
                          <div style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '12px 14px',
                          }}>
                            <div style={{
                              fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                            }}>
                              Response Preview
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
                              {l.response || 'No response recorded.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
          Showing {filtered.length} of {logs.length} events
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
