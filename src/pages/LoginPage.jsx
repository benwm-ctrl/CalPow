import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
    }

    setSubmitting(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        // Profile row is created by handle_new_user() trigger on auth.users insert
        if (data?.user && !signUpError) {
          // Optional: update profile with display name etc. here if you add fields later
        }
      }
      navigate('/map', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4"
      style={{ backgroundColor: '#0F1923' }}
    >
      <div
        className="w-full max-w-md rounded-lg p-8 shadow-xl"
        style={{ backgroundColor: '#1E2D3D' }}
      >
        <h1
          className="text-2xl font-bold text-center mb-1"
          style={{ color: '#3B8BEB' }}
        >
          CalPow
        </h1>
        <p className="text-center text-text-secondary text-sm mb-6">
          Plan Smart. Ski California.
        </p>

        <div className="flex rounded-lg overflow-hidden mb-6 bg-background-primary/50">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'signin'
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'signup'
                ? 'bg-accent-blue text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-background-primary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-background-primary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              placeholder="••••••••"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded bg-background-primary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#3B8BEB' }}
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
