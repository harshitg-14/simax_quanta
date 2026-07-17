import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Mail, Lock, ArrowRight, Shield, CheckCircle2, Brain, Database } from 'lucide-react'
import api from '../api'

const FEATURES = [
  { icon: Brain,       text: 'Multi-agent AI pipeline for complex queries' },
  { icon: Database,    text: 'Semantic search across all uploaded documents' },
  { icon: Shield,      text: 'Phase 6 validation — grounding & hallucination checks' },
  { icon: CheckCircle2,text: 'Knowledge graph with entity relationships' },
]

export default function Login({ onLogin }) {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.access_token)
      onLogin({ name: data.name, role: data.role })
      nav('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg-base)',
    }}>

      {/* ── Left: Brand panel ─────────────────────────────────────────────── */}
      <div style={{
        width: '42%', flexShrink: 0,
        background: 'linear-gradient(160deg, #020E28 0%, #061535 40%, #0A1D45 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 44px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -120,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -160, right: -100,
          width: 460, height: 460, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto', position: 'relative' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px rgba(99,102,241,0.5)',
          }}>
            <Zap size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>Simax Quanta</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Gov Intelligence v4.0</div>
          </div>
        </div>

        {/* Main heading */}
        <div style={{ position: 'relative', marginTop: 60, marginBottom: 48 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: '#6366F1', marginBottom: 16,
          }}>
            Government Knowledge Intelligence
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: '#fff', margin: '0 0 16px',
            lineHeight: 1.15, letterSpacing: '-0.8px',
          }}>
            Intelligent answers<br />
            <span style={{
              background: 'linear-gradient(135deg, #60A5FA, #818CF8, #A78BFA)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              from your documents
            </span>
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0, maxWidth: 320 }}>
            Upload government documents and query them with AI-powered multi-agent intelligence.
          </p>
        </div>

        {/* Features */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}>
                <Icon size={13} color="#818CF8" />
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          position: 'relative', marginTop: 'auto', paddingTop: 32,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'rgba(255,255,255,0.25)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Shield size={11} />
          Secure · End-to-end encrypted · Powered by Simax Systems
        </div>
      </div>

      {/* ── Right: Login form ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle ambient */}
        <div style={{
          position: 'absolute', top: '30%', right: '-10%',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
              Sign in
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Access your secure workspace
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, padding: '11px 14px', marginBottom: 20,
              fontSize: 13, color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-3)', pointerEvents: 'none',
                }} />
                <input type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-premium"
                  style={{ paddingLeft: 38 }}
                  placeholder="you@department.gov.in"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
                marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-3)', pointerEvents: 'none',
                }} />
                <input type="password" required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-premium"
                  style={{ paddingLeft: 38 }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary"
              style={{ width: '100%', padding: '13px 20px', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Authenticating…
                </>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#93C5FD', fontWeight: 600, textDecoration: 'none' }}>
                Register here
              </Link>
            </p>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 20, fontSize: 11, color: 'var(--text-3)',
          }}>
            <Shield size={11} />
            Secured with JWT · 8-hour session
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
