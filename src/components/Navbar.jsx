import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

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

const navLinks = [
  { to: '/map', label: 'Map' },
  { to: '/library', label: 'Library' },
  { to: '/education', label: 'Education' },
  { to: '/before-you-go', label: 'Before You Go' },
  { to: '/mike', label: 'Mike' },
]

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
  const [visible, setVisible] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

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
        }}>
          {/* Logo */}
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

          {/* Desktop nav links */}
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
                  {active && (
                    <span style={{
                      position: 'absolute', bottom: -2, left: 0, right: 0,
                      height: 1, backgroundColor: '#F0EDE8',
                    }} />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden" style={{ alignItems: 'center', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                border: '1px solid rgba(240,237,232,0.15)',
                background: 'transparent', cursor: 'pointer',
                color: '#F0EDE8', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)'}
            >
              {mobileOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 240,
            zIndex: 50,
            backgroundColor: '#070C10',
            borderLeft: '1px solid rgba(240,237,232,0.08)',
            boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column',
          }}>
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
                }}
              >
                <IconClose />
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {navLinks.map(({ to, label }) => {
                const active = isActive(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(240,237,232,0.04)',
                      ...LABEL_STYLE, fontSize: 12,
                      color: active ? '#F0EDE8' : 'rgba(240,237,232,0.45)',
                      backgroundColor: active ? 'rgba(240,237,232,0.04)' : 'transparent',
                    }}
                  >
                    {label}
                    {active && <span style={{ width: 4, height: 4, backgroundColor: '#F0EDE8', flexShrink: 0 }}/>}
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
