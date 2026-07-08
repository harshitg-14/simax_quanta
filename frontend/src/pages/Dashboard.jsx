import { useEffect, useState } from 'react'
import { FileText, MessageSquare, GitBranch, Database, ArrowUpRight, CheckCircle2, AlertCircle, Loader2, Network, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../api'

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name?.split(' ')[0] || 'Officer'}`
}

const STATUS_CFG = {
  ready:      { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Ready',      icon: CheckCircle2 },
  processing: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Processing', icon: Loader2 },
  error:      { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Error',      icon: AlertCircle },
}

const QUICK_ACTIONS = [
  { to: '/documents', icon: FileText,    label: 'Upload Document',    desc: 'Add PDF, DOCX, XLSX, CSV',   color: '#3B82F6' },
  { to: '/chat',      icon: MessageSquare, label: 'Ask a Question',   desc: 'Query across documents',     color: '#6366F1' },
  { to: '/graph',     icon: GitBranch,   label: 'Knowledge Graph',   desc: 'Explore entity relationships', color: '#8B5CF6' },
  { to: '/graphviz',  icon: Network,     label: 'Graph Visualization', desc: 'Interactive graph explorer', color: '#06B6D4' },
]

export default function Dashboard({ user }) {
  const [docs, setDocs]       = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    api.get('/documents/').then(r => setDocs(r.data)).catch(() => {})
    api.get('/analytics/summary').then(r => setSummary(r.data)).catch(() => {})
  }, [])

  const totalChunks = docs.reduce((a, d) => a + (d.chunk_count || 0), 0)

  const stats = [
    { label: 'Documents',      value: docs.length,                    icon: FileText,      accentColor: '#3B82F6', change: '+' + docs.length },
    { label: 'Total Chunks',   value: totalChunks,                    icon: Database,      accentColor: '#8B5CF6', change: 'indexed' },
    { label: 'Graph Entities', value: summary?.total_entities ?? '—', icon: GitBranch,     accentColor: '#06B6D4', change: 'in Neo4j' },
    { label: 'Queries Run',    value: summary?.total_queries   ?? '—', icon: MessageSquare, accentColor: '#10B981', change: 'total' },
  ]

  return (
    <div className="fade-up" style={{ maxWidth: 1100 }}>

      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.12) 50%, rgba(139,92,246,0.08) 100%)',
        border: '1px solid var(--border-hi)',
        borderRadius: 18, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={15} color="#fff" />
            </div>
            <span className="gradient-text" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Simax Quanta v4.0
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            {greeting(user?.name)}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Government Knowledge Intelligence Platform · {user?.role?.replace('_', ' ')}
          </p>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 99, padding: '6px 14px',
          flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
          System Operational
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{
            padding: '20px 22px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${s.accentColor}, transparent)`,
              opacity: 0.7,
            }} />
            <div style={{
              width: 36, height: 36, borderRadius: 10, marginBottom: 14,
              background: `${s.accentColor}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <s.icon size={17} style={{ color: s.accentColor }} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-1px', lineHeight: 1 }}>
              {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: s.accentColor, marginTop: 4, fontWeight: 600 }}>{s.change}</div>

            {/* ambient glow */}
            <div style={{
              position: 'absolute', bottom: -30, right: -30,
              width: 80, height: 80, borderRadius: '50%',
              background: `radial-gradient(circle, ${s.accentColor}18 0%, transparent 70%)`,
              pointerEvents: 'none',
            }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* Recent documents */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 3px' }}>Recent Documents</h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{docs.length} document{docs.length !== 1 ? 's' : ''} uploaded</p>
            </div>
            <Link to="/documents" style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              color: '#93C5FD', textDecoration: 'none', fontWeight: 600,
            }}>
              View all <ArrowUpRight size={13} />
            </Link>
          </div>

          {docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ margin: 0, fontSize: 14 }}>No documents yet.</p>
              <Link to="/documents" style={{ color: '#93C5FD', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                Upload your first document →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.slice(0, 6).map(d => {
                const cfg = STATUS_CFG[d.processing_status] || STATUS_CFG.error
                return (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(59,130,246,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileText size={14} color="#60A5FA" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.file_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {d.chunk_count} chunks · {d.doc_type || 'document'}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 99, flexShrink: 0,
                      background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600,
                    }}>
                      <cfg.icon size={11} />
                      {cfg.label}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {QUICK_ACTIONS.map(a => (
              <Link key={a.to} to={a.to} style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = a.color + '44'; e.currentTarget.style.background = a.color + '08' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: a.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <a.icon size={16} style={{ color: a.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{a.desc}</div>
                  </div>
                  <ArrowUpRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </div>
              </Link>
            ))}
          </div>

          {/* System info box */}
          <div className="card" style={{ padding: '14px 16px', marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Platform Info
            </div>
            {[
              ['AI Model',   'Gemini 2.5 Flash'],
              ['Embeddings', 'BGE-Large-EN v1.5'],
              ['Graph DB',   'Neo4j 5'],
              ['Vector DB',  'pgvector 1024-dim'],
              ['Version',    'v4.0.0'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-3)' }}>{k}</span>
                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  )
}
