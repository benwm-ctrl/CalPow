import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../services/supabase'

const C = {
  bg: '#0A0F14',
  panel: '#070C10',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.25)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.2)',
  ghost: 'rgba(240,237,232,0.04)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (password !== confirmPassword) { setError('Passwords do not match'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    }
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
      }
      navigate(location.state?.from ?? { pathname: '/' }, { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    backgroundColor: C.ghost,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 3.5rem)',
      backgroundColor: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        padding: '36px 32px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 26, fontWeight: 800,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            color: C.text,
          }}>CalPow</div>
          <div style={{
            ...LABEL, fontSize: 9, fontWeight: 700,
            color: C.faint, marginTop: 5,
          }}>Plan Smart. Ski California.</div>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          border: `1px solid ${C.border}`,
          marginBottom: 28,
        }}>
          {[
            { id: 'signin', label: 'Sign In' },
            { id: 'signup', label: 'Create Account' },
          ].map(({ id, label }) => {
            const active = mode === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setMode(id); setError('') }}
                style={{
                  flex: 1, padding: '9px 0',
                  border: 'none',
                  borderRight: id === 'signin' ? `1px solid ${C.border}` : 'none',
                  backgroundColor: active ? 'rgba(240,237,232,0.08)' : 'transparent',
                  color: active ? C.text : C.muted,
                  ...LABEL, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s, color 0.15s',
                  outline: active ? `1px solid rgba(240,237,232,0.2)` : 'none',
                  outlineOffset: -1,
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 6 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.borderHover}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 6 }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.borderHover}
              onBlur={e => e.target.style.borderColor = C.border}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" style={{ display: 'block', ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.borderHover}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>
          )}

          {error && (
            <p role="alert" style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11, color: 'rgba(229,62,62,0.85)',
              borderLeft: '2px solid rgba(229,62,62,0.5)',
              paddingLeft: 8, margin: 0,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '11px 0',
              border: `1px solid ${submitting ? C.border : 'rgba(240,237,232,0.4)'}`,
              backgroundColor: submitting ? C.ghost : 'rgba(240,237,232,0.09)',
              color: submitting ? C.faint : C.text,
              ...LABEL, fontSize: 11, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.15s, background-color 0.15s',
              marginTop: 4,
            }}
            onMouseEnter={e => { if (!submitting) { e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.14)'; e.currentTarget.style.borderColor = '#F0EDE8' }}}
            onMouseLeave={e => { if (!submitting) { e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.09)'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)' }}}
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
