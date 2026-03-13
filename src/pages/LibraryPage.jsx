import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../services/supabase'
import { useAuthStore } from '../store/authStore'
import { useRouteStore } from '../store/routeStore'
import LoadingSpinner from '../components/LoadingSpinner'
import FadeIn from '../components/FadeIn'
import thumbRock from '../assets/images/ThumbRock.webp'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F14',
  panel: 'rgba(7,12,16,0.92)',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.4)',
  faint: 'rgba(240,237,232,0.2)',
  ghost: 'rgba(240,237,232,0.07)',
}

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

// ── Lookups ───────────────────────────────────────────────────────────────────
const REGION_LABELS = {
  sierra: 'Sierra',
  shasta: 'Shasta',
  bridgeport: 'Bridgeport',
  eastern_sierra: 'E. Sierra',
}
const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}
const RISK_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  considerable: 'Considerable',
  high: 'High',
  extreme: 'Extreme',
}
const RISK_COLORS = {
  low: '#38A169',
  moderate: '#D69E2E',
  considerable: '#DD6B20',
  high: '#E53E3E',
  extreme: '#822727',
}
const RISK_DESCRIPTIONS = {
  low: 'Mellow terrain with minimal avalanche exposure. Good for beginners and low-consequence days.',
  moderate: 'Sustained avalanche terrain with multiple decision points. Requires AIARE 1 and forecast awareness.',
  considerable: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  high: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  extreme: 'Extreme terrain. High consequence, requires AIARE 2 or guide-level decision making.',
}
const DIFFICULTY_COLORS = {
  beginner: '#3B8BEB',
  intermediate: '#D69E2E',
  advanced: '#DD6B20',
  expert: '#E53E3E',
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IconMountain = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 30L14 10l5 8 4-5 10 17H3z"/>
    <path d="M20 13l2-3"/>
  </svg>
)
const IconPin = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M5.5 1C3.57 1 2 2.57 2 4.5c0 2.7 3.5 5.5 3.5 5.5S9 7.2 9 4.5C9 2.57 7.43 1 5.5 1z"/>
    <circle cx="5.5" cy="4.5" r="1.2"/>
  </svg>
)
const IconMap = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 2.5l3-1.5 3 1.5 3-1.5V8.5l-3 1.5-3-1.5-3 1.5V2.5z"/>
    <path d="M4 1v8M7 2.5v8"/>
  </svg>
)

// ── Sub-components ────────────────────────────────────────────────────────────
const Tag = ({ children, color }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    border: `1px solid ${color}50`,
    backgroundColor: `${color}15`,
    color: color,
    ...LABEL,
    fontSize: 9, fontWeight: 700,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
)

const FilterSelect = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      padding: '7px 10px',
      backgroundColor: C.ghost,
      border: `1px solid ${C.border}`,
      color: C.muted,
      ...LABEL,
      fontSize: 10, fontWeight: 700,
      cursor: 'pointer',
      outline: 'none',
      appearance: 'none',
      paddingRight: 24,
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='rgba(240,237,232,0.3)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 8px center',
    }}
    onFocus={e => e.target.style.borderColor = C.borderHover}
    onBlur={e => e.target.style.borderColor = C.border}
  >
    {children}
  </select>
)

// ── Main component ────────────────────────────────────────────────────────────
export default function LibraryPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [expandedRiskId, setExpandedRiskId] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('routes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        setRoutes(error ? [] : (data ?? []))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const filteredAndSorted = useMemo(() => {
    let list = [...routes]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        (r.name?.toLowerCase().includes(q)) ||
        (r.location_label?.toLowerCase().includes(q))
      )
    }
    if (regionFilter !== 'all') list = list.filter(r => r.region === regionFilter)
    if (difficultyFilter !== 'all') list = list.filter(r => r.difficulty_rating === difficultyFilter)
    if (riskFilter !== 'all') list = list.filter(r => r.avalanche_risk === riskFilter)
    if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'distance') list.sort((a, b) => (b.distance_km ?? 0) - (a.distance_km ?? 0))
    if (sortBy === 'elevation') list.sort((a, b) => (b.elevation_gain_m ?? 0) - (a.elevation_gain_m ?? 0))
    return list
  }, [routes, search, regionFilter, difficultyFilter, riskFilter, sortBy])

  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 3.5rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg }}>

      {/* ── Hero banner ── */}
      <header style={{ position: 'relative', width: '100%', overflow: 'hidden', height: 180 }}>
        <img
          src={thumbRock}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 40%',
            backgroundColor: '#0A0F14',
          }}
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(10,15,20,0.3) 0%, rgba(10,15,20,0.85) 100%)',
        }}/>
        {/* Hero text */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '0 32px 24px', zIndex: 2 }}>
          <div style={{
            ...LABEL,
            fontSize: 9, fontWeight: 700,
            color: C.faint,
            marginBottom: 4,
          }}>
            Route Library
          </div>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontWeight: 800,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            color: C.text,
            margin: 0,
            lineHeight: 1,
          }}>
            Your Touring Archive
          </h1>
          <p style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12, color: C.muted,
            marginTop: 6, marginBottom: 0,
          }}>
            California backcountry · {routes.length} {routes.length === 1 ? 'route' : 'routes'} saved
          </p>
        </div>
        {/* Bottom border */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 1, backgroundColor: C.border,
          zIndex: 3,
        }}/>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {routes.length === 0 ? (
          /* ── Empty state ── */
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px 32px',
            border: `1px solid ${C.border}`,
            backgroundColor: C.ghost,
          }}>
            <div style={{ color: C.faint, marginBottom: 16 }}>
              <IconMountain />
            </div>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16, fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: C.muted, margin: 0,
            }}>
              No routes yet
            </p>
            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12, color: C.faint,
              marginTop: 6, marginBottom: 0,
            }}>
              Plan your first route on the map
            </p>
            <Link
              to="/map"
              style={{
                marginTop: 24,
                display: 'inline-block',
                padding: '9px 20px',
                border: `1px solid rgba(240,237,232,0.35)`,
                backgroundColor: 'rgba(240,237,232,0.07)',
                color: C.text,
                ...LABEL,
                fontSize: 11, fontWeight: 700,
                textDecoration: 'none',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.text; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.35)'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.07)' }}
            >
              Plan Your First Route
            </Link>
          </div>
        ) : (
          <>
            {/* ── Filter bar ── */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {/* Search */}
              <input
                type="text"
                placeholder="Search routes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: '1 1 200px',
                  padding: '7px 12px',
                  backgroundColor: C.ghost,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 12,
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = C.borderHover}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <FilterSelect value={regionFilter} onChange={setRegionFilter}>
                <option value="all">All Regions</option>
                <option value="sierra">Sierra</option>
                <option value="shasta">Shasta</option>
                <option value="bridgeport">Bridgeport</option>
                <option value="eastern_sierra">Eastern Sierra</option>
              </FilterSelect>
              <FilterSelect value={difficultyFilter} onChange={setDifficultyFilter}>
                <option value="all">All Difficulties</option>
                {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </FilterSelect>
              <FilterSelect value={riskFilter} onChange={setRiskFilter}>
                <option value="all">All Risk</option>
                {Object.entries(RISK_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </FilterSelect>
              <FilterSelect value={sortBy} onChange={setSortBy}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="distance">Distance</option>
                <option value="elevation">Elevation Gain</option>
              </FilterSelect>

              {/* Result count */}
              <div style={{
                display: 'flex', alignItems: 'center',
                ...LABEL, fontSize: 9, fontWeight: 700,
                color: C.faint,
                paddingLeft: 4,
                whiteSpace: 'nowrap',
              }}>
                {filteredAndSorted.length} / {routes.length}
              </div>
            </div>

            {/* ── Route list ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredAndSorted.map((route, i) => (
                <FadeIn key={route.id} delay={i * 0.04}>
                  <RouteRow
                    route={{ ...route, _index: i + 1 }}
                    expandedRiskId={expandedRiskId}
                    setExpandedRiskId={setExpandedRiskId}
                    navigate={navigate}
                  />
                </FadeIn>
              ))}
            </div>

            {filteredAndSorted.length === 0 && routes.length > 0 && (
              <div style={{
                textAlign: 'center',
                padding: '48px 0',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: C.faint,
              }}>
                No routes match your filters
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Route row ─────────────────────────────────────────────────────────────────
function RouteRow({ route, expandedRiskId, setExpandedRiskId, navigate }) {
  const [hovered, setHovered] = useState(false)

  let wps = route.gpx_data
  if (typeof wps === 'string') {
    try { wps = JSON.parse(wps) } catch { wps = null }
  }
  const hasRoute = Array.isArray(wps) && wps.length >= 2

  const riskColor = RISK_COLORS[route.avalanche_risk]
  const diffColor = DIFFICULTY_COLORS[route.difficulty_rating]

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        backgroundColor: hovered ? 'rgba(240,237,232,0.03)' : 'transparent',
        transition: 'border-color 0.15s, background-color 0.15s',
        overflow: 'hidden',
      }}
    >
      <Link to={`/library/${route.id}`} style={{ display: 'block', textDecoration: 'none', padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>

          {/* Row number */}
          <div style={{
            ...LABEL, fontSize: 9, fontWeight: 700,
            color: C.faint,
            paddingTop: 3,
            minWidth: 24,
            flexShrink: 0,
          }}>
            {String(route._index ?? '').padStart(2, '0')}
          </div>

          {/* Name + location */}
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16, fontWeight: 700,
              letterSpacing: '0.02em', textTransform: 'uppercase',
              color: C.text,
              lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {route.name}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              marginTop: 4,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11, color: C.muted,
            }}>
              {route.location_label && (
                <>
                  <span style={{ color: C.faint }}><IconPin /></span>
                  <span>{route.location_label}</span>
                </>
              )}
              {route.date_toured && (
                <span style={{ color: C.faint }}>
                  · {new Date(route.date_toured).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            {route.distance_km != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 15, fontWeight: 700, color: C.text,
                }}>{Number(route.distance_km).toFixed(1)}</div>
                <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>km</div>
              </div>
            )}
            {route.elevation_gain_m != null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 15, fontWeight: 700, color: C.text,
                }}>+{route.elevation_gain_m}</div>
                <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>m gain</div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {route.region && (
              <Tag color="rgba(240,237,232,0.4)">
                {REGION_LABELS[route.region] ?? route.region}
              </Tag>
            )}
            {route.difficulty_rating && diffColor && (
              <Tag color={diffColor}>
                {DIFFICULTY_LABELS[route.difficulty_rating] ?? route.difficulty_rating}
              </Tag>
            )}
            {route.avalanche_risk && riskColor && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Tag color={riskColor}>
                  {RISK_LABELS[route.avalanche_risk] ?? route.avalanche_risk}
                </Tag>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault(); e.stopPropagation()
                    setExpandedRiskId(id => id === route.id ? null : route.id)
                  }}
                  style={{
                    width: 14, height: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${C.faint}`,
                    backgroundColor: 'transparent',
                    color: C.faint, cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, fontWeight: 700,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.faint; e.currentTarget.style.borderColor = C.faint }}
                  aria-label="Risk description"
                >i</button>
              </span>
            )}
          </div>
        </div>

        {/* Risk description expansion */}
        <AnimatePresence>
          {expandedRiskId === route.id && route.avalanche_risk && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                marginTop: 10, paddingTop: 10,
                borderTop: `1px solid ${C.border}`,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 11, color: C.muted,
                lineHeight: 1.6,
              }}>
                {RISK_DESCRIPTIONS[route.avalanche_risk] ?? RISK_DESCRIPTIONS.moderate}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {/* View on map — separated from link */}
      {hasRoute && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <button
            type="button"
            onClick={e => {
              e.preventDefault()
              useRouteStore.getState().setWaypoints(wps)
              const lngs = wps.map(wp => wp[0])
              const lats = wps.map(wp => wp[1])
              useRouteStore.getState().setPendingBounds({
                minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
                minLat: Math.min(...lats), maxLat: Math.max(...lats),
              })
              navigate('/map')
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 0,
              ...LABEL, fontSize: 9, fontWeight: 700,
              color: C.faint,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.faint}
          >
            <IconMap />
            View on map ↗
          </button>
        </div>
      )}
    </motion.div>
  )
}
