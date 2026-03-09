import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../services/supabase'
import { LogOut, User, Menu, X, Settings } from 'lucide-react'

const navLinks = [
  { to: '/map', label: 'Map' },
  { to: '/library', label: 'Library' },
  { to: '/education', label: 'Education' },
  { to: '/before-you-go', label: 'Before You Go' },
  { to: '/mike', label: 'AI Guide' },
]

function getInitials(user) {
  if (user?.user_metadata?.full_name) {
    return user.user_metadata.full_name
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase()
  }
  return '?'
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [visible, setVisible] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      return
    }
    supabase.from('profiles').select('avatar_url, username').eq('id', user.id).maybeSingle().then(({ data }) => setProfile(data))
  }, [user?.id, location.pathname])

  useEffect(() => {
    if (location.pathname !== '/') {
      setVisible(true)
      return
    }
    setVisible(false)
    const handleScroll = () => {
      if (window.scrollY > 80) setVisible(true)
      else setVisible(false)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  useEffect(() => {
    const onShowNavbar = () => setVisible(true)
    window.addEventListener('showNavbar', onShowNavbar)
    return () => window.removeEventListener('showNavbar', onShowNavbar)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    setDropdownOpen(false)
    setMobileOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(to + '/')
  }

  const linkClass = (to) =>
    `transition-colors ${
      isActive(to) ? 'text-accent-blue' : 'text-text-secondary hover:text-accent-light'
    } text-base font-semibold`

  return (
    <div
      style={{
        transition: 'transform 0.4s ease, opacity 0.4s ease',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}
    >
    <nav
      className="sticky top-0 z-40 transition-[border-color] duration-200 h-16"
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '0 16px',
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(15, 25, 35, 0.85)',
        borderBottom: scrolled ? '1px solid #2D3748' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto w-full flex items-center">
        {/* Logo — far left */}
        <div style={{ flexShrink: 0 }}>
          <Link
            to="/"
            className="text-xl font-bold text-text-primary hover:text-accent-blue transition-colors pl-0 ml-0"
          >
            CalPow
          </Link>
        </div>

        {/* Nav links — centered */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            gap: '32px',
          }}
          className="hidden md:flex"
        >
          {navLinks.map(({ to, label }) => (
            <Link key={to} to={to} className={linkClass(to)}>
              {label}
            </Link>
          ))}
        </div>

        {/* Avatar — far right */}
        <div style={{ flexShrink: 0 }}>
          {user ? (
            <div className="relative mr-0 pr-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden bg-accent-blue text-text-primary font-medium text-sm hover:opacity-90 transition-opacity shrink-0"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      {getInitials(user)}
                    </motion.span>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 py-1 w-48 rounded-lg bg-background-elevated border border-border shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs text-text-muted truncate">
                        {profile?.username || user.email}
                      </p>
                    </div>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-secondary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-secondary"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-secondary text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-accent-blue hover:text-accent-light transition-colors">
                Sign In
              </Link>
            )}
        </div>

        {/* Mobile: hamburger + avatar */}
        <div className="flex md:hidden items-center gap-2" style={{ flexShrink: 0 }}>
            {user && (
              <Link
                to="/profile"
                className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden shrink-0 bg-accent-blue text-text-primary font-medium text-sm"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(user)
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="p-2 text-text-primary hover:bg-background-elevated rounded-lg transition-colors"
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
            >
              <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </motion.span>
            </button>
          </div>
        </div>
      {/* Mobile drawer: slide from right */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden fixed top-0 right-0 bottom-0 w-64 z-50 bg-background-secondary border-l border-border shadow-xl"
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="pt-20 px-4 py-4 flex flex-col gap-1">
              {navLinks.map(({ to, label }) => (
                <Link key={to} to={to} className={`py-3 px-2 rounded-lg ${linkClass(to)}`}>
                  {label}
                </Link>
              ))}
              {!user && (
                <Link to="/login" className="py-3 px-2 rounded-lg text-accent-blue font-medium">
                  Sign In
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    </div>
  )
}
