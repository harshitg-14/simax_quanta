import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Mail, Lock, ArrowRight, Shield } from 'lucide-react'
import api from '../api'

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
      setError(err.response?.data?.detail || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{
        position: 'absolute', top: -180, left: -180,
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -200, right: -120,
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px', position: 'relative', zIndex: 1 }}>

        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16, marginBottom: 16,
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
          }}>
            <Zap size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Simax Quanta
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Government Knowledge Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 4px' }}>Sign in</h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Access your secure workspace</p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, color: '#FCA5A5',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-premium"
                  style={{ paddingLeft: 38 }}
                  placeholder="you@department.gov.in" />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="password" required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-premium"
                  style={{ paddingLeft: 38 }}
                  placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 20, marginBottom: 0 }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#93C5FD', fontWeight: 600, textDecoration: 'none' }}>
              Register here
            </Link>
          </p>
        </div>

        {/* Trust bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, fontSize: 11, color: 'var(--text-3)' }}>
          <Shield size={12} />
          End-to-end encrypted · Powered by Simax Systems
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
