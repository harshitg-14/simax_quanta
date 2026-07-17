import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Bot, User, ShieldCheck, AlertTriangle, Sparkles, Zap, Info, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api from '../api'

const SPECIALIST_AGENTS = new Set(['legal', 'financial', 'graph', 'calculation', 'summarization'])
const API_BASE = import.meta.env.VITE_API_URL || '/api'

function getMode(agentsUsed = []) {
  return agentsUsed.some(a => SPECIALIST_AGENTS.has(a)) ? 'multi-agent' : 'document-search'
}

function cleanAnswer(text = '') {
  return text.replace(/\n?CONFIDENCE:\s*(High|Medium|Low)\s*(\n|$)/gi, '').trim()
}

function Badge({ children, color = '#3B82F6' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: color + '22', color, border: `1px solid ${color}33`,
    }}>
      {children}
    </span>
  )
}

function ValidationPanel({ validation, escalate }) {
  const gk = validation?.gatekeeper || {}
  const au = validation?.auditor    || {}
  const st = validation?.strategist || {}
  const score      = au.grounding_score ?? null
  const scoreColor = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'
  const riskColor  = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' }[au.hallucination_risk] || 'var(--text-3)'

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Validation
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[
          { icon: ShieldCheck, label: 'Gatekeeper', main: gk.recommendation || 'approve', mainColor: gk.recommendation === 'approve' ? '#10B981' : '#F59E0B', sub: gk.flags?.join(', ') },
          { icon: ShieldCheck, label: 'Auditor', main: score !== null ? `Grounding: ${score}/100` : '—', mainColor: scoreColor, sub: `Hallucination: ${au.hallucination_risk || 'low'}`, subColor: riskColor },
          { icon: escalate ? AlertTriangle : ShieldCheck, label: 'Strategist', main: escalate ? 'Escalate' : 'Safe to release', mainColor: escalate ? '#EF4444' : '#10B981', sub: st.sensitivity_type && st.sensitivity_type !== 'none' ? st.sensitivity_type : null },
        ].map(({ icon: Icon, label, main, mainColor, sub, subColor }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Icon size={11} style={{ color: mainColor }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>{label}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: mainColor }}>{main}</div>
            {sub && <div style={{ fontSize: 10, color: subColor || '#F59E0B', marginTop: 2, textTransform: 'capitalize' }}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function MessageMeta({ meta }) {
  if (!meta) return null
  if (meta.out_of_scope) {
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Badge color="#EF4444">out of scope</Badge>
      </div>
    )
  }
  const mode        = getMode(meta.agents)
  const modeColor   = mode === 'multi-agent' ? '#F59E0B' : '#3B82F6'
  const modeLabel   = mode === 'multi-agent' ? 'multi-agent' : 'document search'
  const specialists = (meta.agents || []).filter(a => SPECIALIST_AGENTS.has(a))
  const confColor   = { high: '#10B981', medium: '#F59E0B', low: '#EF4444' }[meta.confidence] || '#6B7280'
  const hasVal      = meta.validation && Object.keys(meta.validation).length > 0

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Badge color={modeColor}>{modeLabel}</Badge>
        {meta.confidence && <Badge color={confColor}>{meta.confidence} confidence</Badge>}
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {meta.chunks} chunks · {meta.docs} doc{meta.docs !== 1 ? 's' : ''}
        </span>
        {meta.graph_entities > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{meta.graph_entities} graph entities</span>}
      </div>
      {specialists.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={11} style={{ color: '#F59E0B' }} />
          {specialists.join(' · ')}
        </div>
      )}
      {meta.intent && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>Intent: {meta.intent}</div>}
      {meta.query_rewritten && meta.resolved_query && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, color: '#60A5FA' }}>
          <Info size={11} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Interpreted as: <em>{meta.resolved_query}</em></span>
        </div>
      )}
      {hasVal && <ValidationPanel validation={meta.validation} escalate={meta.escalate} />}
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const ask = async e => {
    e.preventDefault()
    if (!question.trim() || loading) return
    const q = question.trim()
    setQuestion('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    setStatusMsg('Connecting…')

    // Add empty assistant message that will fill in via streaming
    setMessages(m => [...m, { role: 'assistant', text: '', meta: null, streaming: true }])

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/agents/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query: q }),
      })

      if (!response.ok) {
        throw new Error(`Server error ${response.status}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.type === 'status') {
            setStatusMsg(event.message)

          } else if (event.type === 'token') {
            accumulated += event.text
            const snap = accumulated
            setMessages(m => m.map((msg, i) =>
              i === m.length - 1 ? { ...msg, text: snap } : msg
            ))

          } else if (event.type === 'done') {
            const meta = event.meta
            setMessages(m => m.map((msg, i) =>
              i === m.length - 1
                ? {
                    ...msg,
                    streaming: false,
                    meta: {
                      out_of_scope:    meta.out_of_scope,
                      agents:          meta.agents_used,
                      chunks:          meta.chunks_used,
                      docs:            meta.documents_used,
                      confidence:      meta.confidence,
                      intent:          meta.plan?.intent,
                      graph_entities:  meta.graph_entities,
                      validation:      meta.validation,
                      escalate:        meta.escalate,
                      query_rewritten: meta.query_rewritten,
                      resolved_query:  meta.resolved_query,
                    },
                  }
                : msg
            ))

          } else if (event.type === 'error') {
            setMessages(m => m.map((msg, i) =>
              i === m.length - 1
                ? { ...msg, text: 'Error: ' + event.message, streaming: false }
                : msg
            ))
          }
        }
      }
    } catch (err) {
      setMessages(m => m.map((msg, i) =>
        i === m.length - 1
          ? { ...msg, text: 'Error: ' + (err.message || 'Something went wrong'), streaming: false }
          : msg
      ))
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  const clear = async () => {
    await api.post('/agents/clear')
    setMessages([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 3px', letterSpacing: '-0.4px' }}>Document Q&A</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            Intelligent search · Agents activated automatically for complex queries
          </p>
        </div>
        <button onClick={clear} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FCA5A5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4, marginBottom: 16 }}>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-3)' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={26} color="#3B82F6" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 6px' }}>Ask anything about your documents</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Try: "What is PM-KISAN?" or "Who benefits from STARTUP INDIA?"</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              {['What schemes are available?', 'Summarize the latest circular', 'Who is the nodal ministry?'].map(s => (
                <button key={s} onClick={() => { setQuestion(s); inputRef.current?.focus() }} style={{
                  padding: '6px 14px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                  background: 'var(--bg-card)', border: '1px solid var(--border-hi)',
                  color: 'var(--text-2)', transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F666'; e.currentTarget.style.color = 'var(--text-1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--text-2)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const mode        = m.meta ? getMode(m.meta.agents) : 'document-search'
          const isMultiAgent = mode === 'multi-agent'

          return (
            <div key={i} style={{ display: 'flex', gap: 12, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 2,
                  background: m.meta?.out_of_scope ? 'rgba(239,68,68,0.15)' : isMultiAgent ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                  border: `1px solid ${m.meta?.out_of_scope ? '#EF444444' : isMultiAgent ? '#F59E0B44' : '#3B82F644'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isMultiAgent && !m.meta?.out_of_scope
                    ? <Zap size={15} color="#F59E0B" />
                    : <Bot size={15} color={m.meta?.out_of_scope ? '#EF4444' : '#60A5FA'} />}
                </div>
              )}

              <div style={{
                maxWidth: 660,
                background: m.role === 'user' ? 'linear-gradient(135deg, #3B82F6, #6366F1)' : 'var(--bg-card)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                padding: '12px 16px',
                boxShadow: m.role === 'user' ? '0 4px 20px rgba(99,102,241,0.3)' : '0 2px 8px rgba(0,0,0,0.2)',
              }}>
                {m.role === 'user' ? (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#fff' }}>{m.text}</p>
                ) : (
                  <>
                    {/* Streaming status indicator */}
                    {m.streaming && !m.text && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        {statusMsg || 'Thinking…'}
                      </div>
                    )}
                    {/* Answer text — renders as it streams in */}
                    {m.text && (
                      <div className="md-body">
                        <ReactMarkdown>{cleanAnswer(m.text)}</ReactMarkdown>
                        {/* Blinking cursor while streaming */}
                        {m.streaming && (
                          <span style={{ display: 'inline-block', width: 2, height: 14, background: '#3B82F6', marginLeft: 2, animation: 'blink-cursor 0.8s step-end infinite', verticalAlign: 'text-bottom' }} />
                        )}
                      </div>
                    )}
                    {/* Metadata — shown only after streaming finishes */}
                    {!m.streaming && <MessageMeta meta={m.meta} />}
                  </>
                )}
              </div>

              {m.role === 'user' && (
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 2,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                  border: '1px solid rgba(139,92,246,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User size={15} color="#C4B5FD" />
                </div>
              )}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={ask} style={{
        display: 'flex', gap: 10, flexShrink: 0,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 6, transition: 'border-color 0.2s',
      }}>
        <input
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about your documents…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 14px', fontSize: 14, color: 'var(--text-1)' }}
        />
        <button type="submit" disabled={loading || !question.trim()} style={{
          width: 42, height: 42, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: loading || !question.trim() ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', flexShrink: 0,
          opacity: loading || !question.trim() ? 0.45 : 1,
          boxShadow: loading || !question.trim() ? 'none' : '0 4px 14px rgba(99,102,241,0.4)',
        }}>
          <Send size={16} color="#fff" />
        </button>
      </form>
    </div>
  )
}
