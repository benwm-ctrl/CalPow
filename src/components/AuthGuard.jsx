import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoadingSpinner from './LoadingSpinner'

export default function AuthGuard({ children }) {
  const { session, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
