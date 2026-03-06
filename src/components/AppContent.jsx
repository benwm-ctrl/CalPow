import { useLocation, Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'
import AuthGuard from './AuthGuard'
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

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

export default function AppContent() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background-primary">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={location.pathname === '/' ? 'min-h-screen' : 'min-h-[calc(100vh-4rem)] pt-16'}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route
              path="/library"
              element={
                <AuthGuard>
                  <LibraryPage />
                </AuthGuard>
              }
            />
            <Route
              path="/library/:id"
              element={
                <AuthGuard>
                  <RouteDetailPage />
                </AuthGuard>
              }
            />
            <Route path="/education" element={<EducationPage />} />
            <Route path="/before-you-go" element={<BeforeYouGoPage />} />
            <Route path="/mike" element={<MikePage />} />
            <Route
              path="/profile"
              element={
                <AuthGuard>
                  <ProfilePage />
                </AuthGuard>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
