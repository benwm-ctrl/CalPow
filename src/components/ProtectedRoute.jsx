import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setHasSession(false)
        navigate('/login', { replace: true })
      } else {
        setHasSession(true)
      }
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          setHasSession(false)
          navigate('/login', { replace: true })
        } else {
          setHasSession(true)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [navigate])

  if (!ready || !hasSession) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return children
}
