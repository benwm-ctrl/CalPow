import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../services/supabase'
import { useAuthStore } from '../store/authStore'
import { useRouteStore } from '../store/routeStore'
import { Mountain, MapPin } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import FadeIn from '../components/FadeIn'

import thumbRock from '../assets/images/ThumbRock.webp'

const REGION_LABELS = {
  sierra: 'Sierra',
  shasta: 'Shasta',
  bridgeport: 'Bridgeport',
  eastern_sierra: 'Eastern Sierra (ESAC)',
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
  low: 'bg-safe text-white',
  moderate: 'bg-yellow-500 text-gray-900',
  considerable: 'bg-warning text-white',
  high: 'bg-danger text-white',
  extreme: 'bg-red-800 text-white',
}
const RISK_DESCRIPTIONS = {
  low: 'Mellow terrain with minimal avalanche exposure. Good for beginners and low-consequence days.',
  moderate: 'Sustained avalanche terrain with multiple decision points. Requires AIARE 1 and forecast awareness.',
  considerable: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  high: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  extreme: 'Extreme terrain. High consequence, requires AIARE 2 or guide-level decision making.',
}
const DIFFICULTY_COLORS = {
  beginner: 'bg-accent-blue text-white',
  intermediate: 'bg-yellow-500 text-gray-900',
  advanced: 'bg-warning text-white',
  expert: 'bg-danger text-white',
}

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
        if (error) {
          console.error(error)
          setRoutes([])
        } else {
          setRoutes(data ?? [])
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const filteredAndSorted = useMemo(() => {
    let list = [...routes]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.location_label && r.location_label.toLowerCase().includes(q))
      )
    }
    if (regionFilter !== 'all') list = list.filter((r) => r.region === regionFilter)
    if (difficultyFilter !== 'all') list = list.filter((r) => r.difficulty_rating === difficultyFilter)
    if (riskFilter !== 'all') list = list.filter((r) => r.avalanche_risk === riskFilter)
    if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sortBy === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sortBy === 'distance') list.sort((a, b) => (b.distance_km ?? 0) - (a.distance_km ?? 0))
    if (sortBy === 'elevation') list.sort((a, b) => (b.elevation_gain_m ?? 0) - (a.elevation_gain_m ?? 0))
    return list
  }, [routes, search, regionFilter, difficultyFilter, riskFilter, sortBy])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background-primary">
      {/* Hero banner */}
      <header className="relative w-full overflow-hidden h-[160px] md:h-[220px]">
        <img
          src={thumbRock}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ backgroundColor: '#1E2D3D', objectPosition: 'center 40%' }}
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(15,25,35,0.1) 0%, rgba(15,25,35,0.7) 100%)',
          }}
        />
        <div className="absolute bottom-0 left-0 pb-6 pl-6 z-10">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Your Touring Library
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Your California backcountry routes
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 px-4">
        <h1 className="sr-only">Touring Library</h1>

        {routes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-background-secondary border border-border">
            <Mountain className="w-16 h-16 text-text-muted mb-4" />
            <p className="text-lg font-medium text-text-primary">No routes yet</p>
            <p className="text-text-secondary mt-1">Plan your first route on the map</p>
            <Link
              to="/map"
              className="mt-6 px-4 py-2 rounded-lg font-medium text-white"
              style={{ backgroundColor: '#3B8BEB' }}
            >
              Plan Your First Route
            </Link>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search by name or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background-secondary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue"
              />
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background-secondary border border-border text-text-primary focus:outline-none focus:border-accent-blue"
              >
                <option value="all">All Regions</option>
                <option value="sierra">Sierra</option>
                <option value="shasta">Shasta</option>
                <option value="bridgeport">Bridgeport</option>
                <option value="eastern_sierra">Eastern Sierra (ESAC)</option>
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background-secondary border border-border text-text-primary focus:outline-none focus:border-accent-blue"
              >
                <option value="all">All Difficulties</option>
                {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background-secondary border border-border text-text-primary focus:outline-none focus:border-accent-blue"
              >
                <option value="all">All Risk</option>
                {Object.entries(RISK_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg bg-background-secondary border border-border text-text-primary focus:outline-none focus:border-accent-blue"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="distance">Distance</option>
                <option value="elevation">Elevation Gain</option>
              </select>
            </div>

            <div className="space-y-3">
              {filteredAndSorted.map((route, i) => (
                <FadeIn key={route.id} delay={i * 0.05}>
                  <motion.div
                    className="block rounded-lg border border-border bg-background-secondary p-4"
                    whileHover={{ y: -2, backgroundColor: '#2a3a4d' }}
                    transition={{ duration: 0.2 }}
                  >
                    <Link to={`/library/${route.id}`} className="block">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-text-primary truncate">
                        {route.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
                        {route.location_label && (
                          <>
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span>{route.location_label}</span>
                          </>
                        )}
                        {route.date_toured && (
                          <span>
                            {new Date(route.date_toured).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm">
                      {route.distance_km != null && (
                        <span className="px-2 py-1 rounded bg-background-elevated text-text-secondary">
                          {Number(route.distance_km).toFixed(1)} km
                        </span>
                      )}
                      {route.elevation_gain_m != null && (
                        <span className="px-2 py-1 rounded bg-background-elevated text-text-secondary">
                          +{route.elevation_gain_m} m
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {route.region && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-background-elevated text-text-primary">
                          {REGION_LABELS[route.region] ?? route.region}
                        </span>
                      )}
                      {route.difficulty_rating && (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            DIFFICULTY_COLORS[route.difficulty_rating] ?? 'bg-background-elevated text-text-primary'
                          }`}
                        >
                          {DIFFICULTY_LABELS[route.difficulty_rating] ?? route.difficulty_rating}
                        </span>
                      )}
                      {route.avalanche_risk && (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              RISK_COLORS[route.avalanche_risk] ?? 'bg-background-elevated text-text-primary'
                            }`}
                          >
                            {RISK_LABELS[route.avalanche_risk] ?? route.avalanche_risk}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setExpandedRiskId((id) => (id === route.id ? null : route.id))
                            }}
                            className="text-text-secondary hover:text-text-primary text-xs w-4 h-4 rounded-full border border-current flex items-center justify-center"
                            aria-label="Risk description"
                          >
                            ⓘ
                          </button>
                          {expandedRiskId === route.id && (
                            <span className="text-xs text-text-secondary mt-1 w-full block">
                              {RISK_DESCRIPTIONS[route.avalanche_risk] ?? RISK_DESCRIPTIONS.moderate}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    </div>
                  </Link>
                  {route.gpx_data && (() => {
                    let wps = route.gpx_data
                    if (typeof wps === 'string') {
                      try {
                        wps = JSON.parse(wps)
                      } catch {
                        wps = null
                      }
                    }
                    return Array.isArray(wps) && wps.length >= 2 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          useRouteStore.getState().setWaypoints(wps)
                          const lngs = wps.map((wp) => wp[0])
                          const lats = wps.map((wp) => wp[1])
                          useRouteStore.getState().setPendingBounds({
                            minLng: Math.min(...lngs),
                            maxLng: Math.max(...lngs),
                            minLat: Math.min(...lats),
                            maxLat: Math.max(...lats),
                          })
                          navigate('/map')
                        }}
                        className="mt-2 text-xs font-medium text-accent-blue hover:text-accent-light"
                      >
                        View on map
                      </button>
                    ) : null
                  })()}
                </motion.div>
              </FadeIn>
              ))}
            </div>
            {filteredAndSorted.length === 0 && routes.length > 0 && (
              <p className="text-center text-text-secondary py-8">No routes match your filters.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
