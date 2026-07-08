import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, User, Mail, Lock, Briefcase, ArrowRight, CheckCircle2 } from 'lucide-react'
import api from '../api'

const ROLES = [
  { value: 'admin',              label: 'Admin' },
  { value: 'department_officer', label: 'Department Officer' },
  { value: 'auditor',            label: 'Auditor' },
  { value: 'reviewer',           label: 'Reviewer' },
]

export default function Register() {
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'department_officer' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      await api.post('/auth/register', form)
      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => nav('/login'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -200, right: -150,
        width: 520, height: 520, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -180, left: -100,
        width: 460, height: 460, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 440, padding: '0 20px', position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14, marginBottom: 14,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            boxShadow: '0 8px 28px rgba(139,92,246,0.4)',
          }}>
            <Zap size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Create Account
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            Simax Quanta · Government Platform
          </p>
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 18, padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, color: '#FCA5A5',
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle2 size={15} /> {success}
            </div>
          )}

          <form onSubmit={submit}>
            {[
              { key: 'name',     type: 'text',     label: 'Full Name',     icon: User,      placeholder: 'Your full name' },
              { key: 'email',    type: 'email',    label: 'Email Address', icon: Mail,      placeholder: 'you@department.gov.in' },
              { key: 'password', type: 'password', label: 'Password',      icon: Lock,      placeholder: '8+ characters' },
            ].map(({ key, type, label, icon: Icon, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {label}
                </label>
                <div style={{ position: 'relative' }}>
                  <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type={type} required value={form[key]}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="input-premium"
                    style={{ paddingLeft: 36 }}
                    placeholder={placeholder} />
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Role
              </label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 1 }} />
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="input-premium"
                  style={{ paddingLeft: 36, appearance: 'none' }}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary"
              style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Creating account…
                </>
              ) : (
                <>Create Account <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 18, marginBottom: 0 }}>
            Have an account?{' '}
            <Link to="/login" style={{ color: '#93C5FD', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #091422; }
      `}</style>
    </div>
  )
}
