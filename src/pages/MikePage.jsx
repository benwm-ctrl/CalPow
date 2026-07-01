import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { sendMessageToMike, fetchNOAAWeather } from '../services/groq'
import { useRouteStore } from '../store/routeStore'
import mikeImg from '../assets/images/Salm_Miles-Clark-1.jpg'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F14',
  panel: '#070C10',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.22)',
  ghost: 'rgba(240,237,232,0.04)',
  userBubble: 'rgba(240,237,232,0.1)',
  mikeBubble: '#070C10',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

// ── Inline SVG ────────────────────────────────────────────────────────────────
const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 7L2 2l2 5-2 5 10-5z"/>
  </svg>
)

// ── Data ──────────────────────────────────────────────────────────────────────
const TOPIC_CHIPS = [
  'Avalanche Safety', 'Trip Planning', 'Gear',
  'Reading Forecasts', 'Snow Science', 'Route Selection',
]

const STARTER_PROMPTS = [
  'What should I know before my first Sierra tour?',
  'How do I read an avalanche forecast?',
  'What avy gear do I need?',
  'How do I assess slope angle in the field?',
]

const REGION_CENTERS = {
  sierra: { lat: 38.5, lng: -119.5 },
  shasta: { lat: 41.4, lng: -122.2 },
  bridgeport: { lat: 38.3, lng: -119.3 },
  eastern_sierra: { lat: 37.6, lng: -118.9 },
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MikePage() {
  const forecast = useRouteStore(s => s.forecast)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const sendMessage = async (content) => {
    const trimmed = (typeof content === 'string' ? content : input).trim()
    if (!trimmed || loading) return
    const userMessage = { role: 'user', content: trimmed, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    try {
      const history = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
      const center = REGION_CENTERS[forecast?.region] ?? REGION_CENTERS.sierra
      const weather = await fetchNOAAWeather(center.lat, center.lng)
      const reply = await sendMessageToMike(history, forecast, weather)
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Having trouble connecting. Check your connection and try again.', timestamp: new Date() }])
    } finally {
      setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg }}>

      {/* ── Left sidebar — Mike's profile ── */}
      <aside className="hidden md:flex" style={{ width: 260, flexShrink: 0, flexDirection: 'column', borderRight: `1px solid ${C.border}`, padding: 24, overflowY: 'auto' }}>
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ position: 'sticky', top: 0 }}
        >
          {/* Avatar */}
          <div style={{ width: 72, height: 72, overflow: 'hidden', marginBottom: 14, border: `1px solid ${C.border}` }}>
            <img src={mikeImg} alt="Mike" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Name + title */}
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.text, margin: '0 0 3px' }}>
            Mike
          </h1>
          <div style={{ ...LABEL, fontSize: 9, color: C.faint, marginBottom: 14 }}>
            Backcountry Guide · Sierra Nevada
          </div>

          {/* Bio */}
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.65, margin: '0 0 16px', borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            I've skied the Sierra for 20 years and guided in the Cascades and Eastern Sierra.
            I'm here to give you direct, safety-focused advice. Ask me anything.
          </p>

          {/* Disclaimer */}
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: C.faint, fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 20px', paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            Mike is an AI assistant, not a real guide or certified instructor.
            Always consult official avalanche forecasts and consider taking a real AIARE course.
          </p>

          {/* Topic chips */}
          <div style={{ ...LABEL, fontSize: 9, color: C.faint, marginBottom: 10 }}>Topics</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {TOPIC_CHIPS.map(topic => (
              <button
                key={topic}
                type="button"
                onClick={() => sendMessage(topic)}
                disabled={loading}
                style={{
                  padding: '4px 10px',
                  border: `1px solid ${C.border}`,
                  backgroundColor: 'transparent',
                  color: loading ? C.faint : C.muted,
                  ...LABEL, fontSize: 9,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = loading ? C.faint : C.muted }}
              >
                {topic}
              </button>
            ))}
          </div>
        </motion.div>
      </aside>

      {/* ── Right — Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile header */}
        <header className="flex md:hidden" style={{
          alignItems: 'center', gap: 12, padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, overflow: 'hidden', flexShrink: 0, border: `1px solid ${C.border}` }}>
            <img src={mikeImg} alt="Mike" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.text }}>Mike</div>
            <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>Backcountry Guide · Sierra Nevada</div>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {messages.length === 0 && !loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, maxWidth: 560, margin: '0 auto', width: '100%' }}>
              {STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    textAlign: 'left', padding: '14px',
                    border: `1px solid ${C.border}`,
                    backgroundColor: C.ghost,
                    color: C.muted,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 12, lineHeight: 1.5,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <motion.div
              key={msg.timestamp?.getTime?.() ?? Math.random()}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              {msg.role === 'assistant' && (
                <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 5 }}>Mike</div>
              )}
              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                border: `1px solid ${msg.role === 'user' ? 'rgba(240,237,232,0.2)' : C.border}`,
                backgroundColor: msg.role === 'user' ? C.userBubble : C.mikeBubble,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13, lineHeight: 1.65,
                color: C.text,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
              <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginTop: 4 }}>
                {msg.timestamp && formatTime(msg.timestamp)}
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            >
              <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 5 }}>Mike</div>
              <div style={{ padding: '12px 16px', border: `1px solid ${C.border}`, backgroundColor: C.mikeBubble, display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    style={{ width: 5, height: 5, backgroundColor: C.faint, display: 'inline-block' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div style={{
          flexShrink: 0,
          borderTop: `1px solid ${C.border}`,
          padding: '12px 16px',
          display: 'flex', gap: 8, alignItems: 'stretch',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }}}
            placeholder="Ask Mike anything…"
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: `1px solid ${C.border}`,
              backgroundColor: C.ghost,
              color: C.text,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 13,
              outline: 'none',
              opacity: loading ? 0.5 : 1,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = C.borderHover}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 42,
              border: `1px solid ${(!loading && input.trim()) ? 'rgba(240,237,232,0.4)' : C.border}`,
              backgroundColor: (!loading && input.trim()) ? 'rgba(240,237,232,0.08)' : 'transparent',
              color: (!loading && input.trim()) ? C.text : C.faint,
              cursor: (!loading && input.trim()) ? 'pointer' : 'not-allowed',
              transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
              flexShrink: 0,
            }}
            aria-label="Send"
          >
            <motion.span whileTap={(!loading && input.trim()) ? { scale: 0.85 } : {}}>
              <IconSend />
            </motion.span>
          </button>
        </div>
      </div>
    </div>
  )
}
