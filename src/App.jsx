import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { supabase } from './services/supabase'
import { useAuthStore } from './store/authStore'
import AppContent from './components/AppContent'

function App() {
  const { setSession, setLoading } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
