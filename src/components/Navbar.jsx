import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../services/supabase'

// ── Inline SVG icons — no Lucide ──────────────────────────────────────────
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="5" r="2.5"/>
    <path d="M1.5 13c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5"/>
  </svg>
)

const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="7" r="2"/>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4"/>
  </svg>
)

const IconSignOut = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5"/>
    <path d="M9 10l3-3-3-3M12 7H5"/>
  </svg>
)

const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M3 5h14M3 10h14M3 15h14"/>
  </svg>
)

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 4l12 12M16 4L4 16"/>
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────

const navLinks = [
  { to: '/map', label: 'Map' },
  { to: '/library', label: 'Library' },
  { to: '/education', label: 'Education' },
  { to: '/before-you-go', label: 'Before You Go' },
  { to: '/mike', label: 'Mike' },
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
  if (user?.email) return user.email.slice(0, 2).toUpperCase()
  return '?'
}

const LABEL_STYLE = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  transition: 'color 0.15s',
  whiteSpace: 'nowrap',
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
    if (!user?.id) { setProfile(null); return }
    supabase.from('profiles').select('avatar_url, username').eq('id', user.id).maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [user?.id, location.pathname])

  useEffect(() => {
    if (location.pathname !== '/') { setVisible(true); return }
    setVisible(false)
    const onScroll = () => setVisible(window.scrollY > 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  useEffect(() => {
    const onShow = () => setVisible(true)
    window.addEventListener('showNavbar', onShow)
    return () => window.removeEventListener('showNavbar', onShow)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleSignOut = async () => {
    setDropdownOpen(false)
    setMobileOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <div style={{
      transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      opacity: visible ? 1 : 0,
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
    }}>
      <nav style={{
        height: 56,
        width: '100%',
        backdropFilter: 'blur(16px)',
        backgroundColor: scrolled ? 'rgba(7,12,16,0.97)' : 'rgba(10,15,20,0.88)',
        borderBottom: `1px solid ${scrolled ? 'rgba(240,237,232,0.1)' : 'transparent'}`,
        transition: 'background-color 0.25s, border-color 0.25s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', height: '100%',
          maxWidth: 1200, margin: '0 auto', padding: '0 32px',
          gap: 0,
        }}>

          {/* ── Logo ── */}
          <Link
            to="/"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18, fontWeight: 800,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: '#F0EDE8', textDecoration: 'none',
              flexShrink: 0, marginRight: 48,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.65'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            CalPow
          </Link>

          {/* ── Desktop nav links ── */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 36,
          }} className="hidden md:flex">
            {navLinks.map(({ to, label }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    ...LABEL_STYLE,
                    color: active ? '#F0EDE8' : 'rgba(240,237,232,0.4)',
                    position: 'relative',
                    paddingBottom: 2,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
                  onMouseLeave={e => e.currentTarget.style.color = active ? '#F0EDE8' : 'rgba(240,237,232,0.4)'}
                >
                  {label}
                  {/* Active tick — 1px bottom line */}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      style={{
                        position: 'absolute', bottom: -2, left: 0, right: 0,
                        height: 1,
                        backgroundColor: '#F0EDE8',
                      }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* ── Right: user avatar or sign in ── */}
          <div style={{ flexShrink: 0, marginLeft: 'auto' }} className="hidden md:flex">
            {user ? (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(o => !o)}
                  aria-expanded={dropdownOpen}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32,
                    border: `1px solid ${dropdownOpen ? 'rgba(240,237,232,0.4)' : 'rgba(240,237,232,0.15)'}`,
                    backgroundColor: dropdownOpen ? 'rgba(240,237,232,0.08)' : 'transparent',
                    color: '#F0EDE8',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.06)' }}
                  onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
                >
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : getInitials(user)
                  }
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                        width: 192,
                        backgroundColor: '#070C10',
                        border: '1px solid rgba(240,237,232,0.1)',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        zIndex: 60,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Email row */}
                      <div style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(240,237,232,0.07)',
                      }}>
                        <p style={{
                          fontFamily: "'Barlow', sans-serif",
                          fontSize: 10, color: 'rgba(240,237,232,0.3)',
                          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {profile?.username || user.email}
                        </p>
                      </div>

                      {[
                        { to: '/profile', label: 'Profile', icon: <IconUser /> },
                        { to: '/settings', label: 'Settings', icon: <IconSettings /> },
                      ].map(({ to, label, icon }) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setDropdownOpen(false)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            ...LABEL_STYLE,
                            fontSize: 11,
                            color: 'rgba(240,237,232,0.6)',
                            transition: 'background 0.12s, color 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.05)'; e.currentTarget.style.color = '#F0EDE8' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(240,237,232,0.6)' }}
                        >
                          <span style={{ color: 'rgba(240,237,232,0.35)', flexShrink: 0 }}>{icon}</span>
                          {label}
                        </Link>
                      ))}

                      <div style={{ borderTop: '1px solid rgba(240,237,232,0.07)' }}>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          style={{
                            display: 'flex', width: '100%', alignItems: 'center', gap: 10,
                            padding: '10px 14px',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            ...LABEL_STYLE,
                            fontSize: 11,
                            color: 'rgba(240,237,232,0.4)',
                            textAlign: 'left',
                            transition: 'background 0.12s, color 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.05)'; e.currentTarget.style.color = '#F0EDE8' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(240,237,232,0.4)' }}
                        >
                          <span style={{ color: 'rgba(240,237,232,0.3)', flexShrink: 0 }}><IconSignOut /></span>
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  ...LABEL_STYLE,
                  fontSize: 11,
                  color: 'rgba(240,237,232,0.4)',
                  padding: '6px 12px',
                  border: '1px solid rgba(240,237,232,0.15)',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#F0EDE8'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.4)'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)' }}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* ── Mobile: avatar + hamburger ── */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {user && (
              <Link
                to="/profile"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30,
                  border: '1px solid rgba(240,237,232,0.15)',
                  color: '#F0EDE8',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, fontWeight: 700,
                  overflow: 'hidden',
                }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitials(user)
                }
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(o => !o)}
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                border: '1px solid rgba(240,237,232,0.15)',
                background: 'transparent', cursor: 'pointer',
                color: '#F0EDE8',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)'}
            >
              {mobileOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 40,
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 240,
                zIndex: 50,
                backgroundColor: '#070C10',
                borderLeft: '1px solid rgba(240,237,232,0.08)',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Close button */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(240,237,232,0.06)',
              }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.25)',
                }}>Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(240,237,232,0.4)', padding: 4,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.4)'}
                >
                  <IconClose />
                </button>
              </div>

              {/* Nav links */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {navLinks.map(({ to, label }, i) => {
                  const active = isActive(to)
                  return (
                    <motion.div
                      key={to}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.2 }}
                    >
                      <Link
                        to={to}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '16px 20px',
                          borderBottom: '1px solid rgba(240,237,232,0.04)',
                          ...LABEL_STYLE,
                          fontSize: 12,
                          color: active ? '#F0EDE8' : 'rgba(240,237,232,0.45)',
                          backgroundColor: active ? 'rgba(240,237,232,0.04)' : 'transparent',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.06)'; e.currentTarget.style.color = '#F0EDE8' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = active ? 'rgba(240,237,232,0.04)' : 'transparent'; e.currentTarget.style.color = active ? '#F0EDE8' : 'rgba(240,237,232,0.45)' }}
                      >
                        {label}
                        {active && (
                          <span style={{
                            width: 4, height: 4,
                            backgroundColor: '#F0EDE8',
                            borderRadius: 0,
                            flexShrink: 0,
                          }}/>
                        )}
                      </Link>
                    </motion.div>
                  )
                })}
              </div>

              {/* Bottom: sign in / sign out */}
              <div style={{ borderTop: '1px solid rgba(240,237,232,0.06)', padding: '16px 20px' }}>
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', background: 'transparent', border: 'none',
                      cursor: 'pointer', padding: 0,
                      ...LABEL_STYLE, fontSize: 11,
                      color: 'rgba(240,237,232,0.35)',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.35)'}
                  >
                    <IconSignOut />
                    Sign Out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    style={{
                      ...LABEL_STYLE, fontSize: 11,
                      color: 'rgba(240,237,232,0.4)',
                      display: 'block',
                      padding: '10px 14px',
                      border: '1px solid rgba(240,237,232,0.15)',
                      textAlign: 'center',
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#F0EDE8'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.4)'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)' }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
