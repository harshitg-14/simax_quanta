import { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { FileText, GitBranch, MessageSquare, Database, Activity } from 'lucide-react'
import api from '../api'

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316']

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0D1A2E', border: '1px solid #1C2F4E', borderRadius: 10, fontSize: 12 },
  labelStyle:   { color: '#E4EEFF' },
  itemStyle:    { color: '#93C5FD' },
}

function StatCard({ icon: Icon, label, value, accentColor }) {
  return (
    <div className="card" style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        opacity: 0.7,
      }} />
      <div style={{
        width: 36, height: 36, borderRadius: 10, marginBottom: 14,
        background: accentColor + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} style={{ color: accentColor }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-1px', lineHeight: 1 }}>
        {value?.toLocaleString() ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{label}</div>
      <div style={{
        position: 'absolute', bottom: -30, right: -30,
        width: 80, height: 80, borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

function ChartCard({ title, subtitle, children, minHeight = 240 }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 3px' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{subtitle}</p>}
      </div>
      <div style={{ minHeight }}>{children}</div>
    </div>
  )
}

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [queries, setQueries] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/queries'),
    ]).then(([s, q]) => {
      setSummary(s.data)
      setQueries(q.data)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid var(--border)', borderTopColor: '#3B82F6',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div className="fade-up" style={{ maxWidth: 1100 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Activity size={18} style={{ color: '#3B82F6' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.4px' }}>Analytics</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Platform-wide intelligence metrics and usage insights</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon={FileText}      label="Documents"      value={summary?.total_documents} accentColor="#3B82F6" />
        <StatCard icon={Database}      label="Total Chunks"   value={summary?.total_chunks}    accentColor="#8B5CF6" />
        <StatCard icon={MessageSquare} label="Queries Run"    value={summary?.total_queries}   accentColor="#10B981" />
        <StatCard icon={GitBranch}     label="Graph Entities" value={summary?.total_entities}  accentColor="#F59E0B" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        <ChartCard title="Chunks per Document" subtitle="Top documents by indexed content">
          {(summary?.doc_chunks || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.doc_chunks} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" tick={{ fill: '#3D5270', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#7A96BE', fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="chunks" fill="url(#blueGrad)" radius={[0, 6, 6, 0]} />
                <defs>
                  <linearGradient id="blueGrad" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>No documents yet.</div>}
        </ChartCard>

        <ChartCard title="Documents by Type" subtitle="Distribution across document categories">
          {summary?.by_type?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={summary.by_type} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={78} innerRadius={40}
                  paddingAngle={3}
                >
                  {summary.by_type.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend
                  formatter={v => <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{v}</span>}
                  iconType="circle" iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>No data yet.</div>}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        <ChartCard title="Query Activity" subtitle="Daily query volume over time">
          {queries?.daily?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={queries.daily} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="date" tick={{ fill: '#3D5270', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3D5270', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#6366F1" />
                  </linearGradient>
                </defs>
                <Line type="monotone" dataKey="queries" stroke="url(#lineGrad)" strokeWidth={2.5}
                  dot={{ fill: '#3B82F6', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>No query history yet.</div>}
        </ChartCard>

        <ChartCard title="Query Mode Split" subtitle="RAG vs Multi-Agent breakdown">
          <div style={{ marginBottom: 12 }}>
            {queries && (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={[
                  { mode: 'RAG (Simple)', count: queries.rag_queries },
                  { mode: 'Multi-Agent',  count: queries.agent_queries },
                ]} barSize={40}>
                  <XAxis dataKey="mode" tick={{ fill: '#7A96BE', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3D5270', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    <Cell fill="#3B82F6" />
                    <Cell fill="#F59E0B" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {queries?.recent?.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{
                  padding: '1px 7px', borderRadius: 99, fontWeight: 700,
                  background: q.mode === 'agent' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                  color: q.mode === 'agent' ? '#FCD34D' : '#93C5FD',
                }}>
                  {q.mode}
                </span>
                <span style={{ color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.query.replace('[AGENT] ', '')}
                </span>
                <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{q.timestamp?.slice(5)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

    </div>
  )
}
