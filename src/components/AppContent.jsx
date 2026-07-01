import { lazy, Suspense } from 'react'
import { useLocation, Routes, Route } from 'react-router-dom'
import Navbar from './Navbar'

const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const MapPage = lazy(() => import('../pages/MapPage'))
const LibraryPage = lazy(() => import('../pages/LibraryPage'))
const RouteDetailPage = lazy(() => import('../pages/RouteDetailPage'))
const EducationPage = lazy(() => import('../pages/EducationPage'))
const BeforeYouGoPage = lazy(() => import('../pages/BeforeYouGoPage'))
const MikePage = lazy(() => import('../pages/MikePage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const CreditsFooter = lazy(() => import('./CreditsFooter'))

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#0A0F14', color: 'rgba(240,237,232,0.3)',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
      letterSpacing: '0.14em', textTransform: 'uppercase',
    }}>
      Loading
    </div>
  )
}

export default function AppContent() {
  const location = useLocation()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0F14', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Suspense fallback={<Loading />}>
        <div className={location.pathname === '/' ? 'min-h-screen flex-1' : 'min-h-[calc(100vh-4rem)] pt-16 flex-1'}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:id" element={<RouteDetailPage />} />
            <Route path="/education" element={<EducationPage />} />
            <Route path="/before-you-go" element={<BeforeYouGoPage />} />
            <Route path="/mike" element={<MikePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <CreditsFooter />
      </Suspense>
    </div>
  )
}
