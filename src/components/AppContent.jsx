import { useLocation, Routes, Route } from 'react-router-dom'
import Navbar from './Navbar'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/LoginPage'
import MapPage from '../pages/MapPage'
import LibraryPage from '../pages/LibraryPage'
import RouteDetailPage from '../pages/RouteDetailPage'
import EducationPage from '../pages/EducationPage'
import BeforeYouGoPage from '../pages/BeforeYouGoPage'
import MikePage from '../pages/MikePage'
import ProfilePage from '../pages/ProfilePage'
import NotFoundPage from '../pages/NotFoundPage'
import CreditsFooter from './CreditsFooter'

export default function AppContent() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <Navbar />
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
    </div>
  )
}
