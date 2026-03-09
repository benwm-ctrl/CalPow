import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import { motion } from 'framer-motion'
import { useRouteStore } from '../store/routeStore'

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function buildProfileData(waypoints) {
  if (!waypoints || waypoints.length < 2) return { data: [], distanceKm: 0, elevationGainM: 0, minElevationM: 0, maxElevationM: 0 }
  let distanceKm = 0
  let elevationGainM = 0
  let minElevationM = typeof waypoints[0][2] === 'number' && !Number.isNaN(waypoints[0][2]) ? waypoints[0][2] : 0
  let maxElevationM = minElevationM
  const data = waypoints.map((wp, i) => {
    const lng = wp[0]
    const lat = wp[1]
    const ele = wp[2]
    const elev = typeof ele === 'number' && !Number.isNaN(ele) ? ele : 0
    if (i > 0) {
      const prevLng = waypoints[i - 1][0]
      const prevLat = waypoints[i - 1][1]
      const prevEle = waypoints[i - 1][2]
      const prevElev = typeof prevEle === 'number' && !Number.isNaN(prevEle) ? prevEle : 0
      distanceKm += haversineKm(prevLat, prevLng, lat, lng)
      const delta = elev - prevElev
      if (delta > 0) elevationGainM += delta
      if (elev > maxElevationM) maxElevationM = elev
      if (elev < minElevationM) minElevationM = elev
    } else {
      if (elev > maxElevationM) maxElevationM = elev
      if (elev < minElevationM) minElevationM = elev
    }
    return { distanceKm, elevation: elev }
  })
  return { data, distanceKm, elevationGainM, minElevationM, maxElevationM }
}

/** Estimated time: 300 m elevation per hour + 4 km/hr on flat (Naismith-style) */
function estimateHours(distanceKm, elevationGainM) {
  const hoursFromDist = distanceKm / 4
  const hoursFromElev = elevationGainM / 300
  return hoursFromDist + hoursFromElev
}

function formatDuration(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const BELOW_TREELINE = 2400 // meters
const NEAR_TREELINE = 2900 // meters

function dangerColor(level, opacity = 0.15) {
  if (level >= 4) return `rgba(255, 0, 0, ${opacity})` // High/Extreme
  if (level >= 3) return `rgba(255, 140, 0, ${opacity})` // Considerable
  if (level >= 2) return `rgba(255, 215, 0, ${opacity})` // Moderate
  return `rgba(40, 167, 69, ${opacity})` // Low
}

export default function ElevationProfile() {
  const waypoints = useRouteStore((s) => s.waypoints)
  const forecast = useRouteStore((s) => s.forecast)

  if (!waypoints || waypoints.length < 2) return null

  const { data, distanceKm, elevationGainM, minElevationM, maxElevationM } = buildProfileData(waypoints)
  if (!data || data.length === 0) return null

  const baseDanger = forecast?.danger_level ?? 1
  // Above treeline is typically 1 level higher than base; below treeline typically 1 level lower
  const belowDanger = forecast?.danger_below_treeline ?? Math.max(1, baseDanger - 1)
  const nearDanger = forecast?.danger_near_treeline ?? baseDanger
  const aboveDanger = forecast?.danger_above_treeline ?? Math.min(5, baseDanger + 1)

  const estimatedHours = estimateHours(distanceKm, elevationGainM)
  const yMin = Math.floor(minElevationM - 20)
  const yMax = Math.ceil(maxElevationM + 20)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        bottom: 0,
        left: '260px',
        right: '280px',
        width: 'auto',
        zIndex: 5,
        height: '180px',
        backgroundColor: 'rgba(30, 45, 61, 0.55)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 12px 4px 12px',
      }}
    >
      {/* Stats row — 20px */}
      <div className="flex flex-wrap gap-3" style={{ height: '20px', minHeight: '20px' }}>
        <span className="text-xs font-medium text-text-secondary">
          Distance: <strong className="text-text-primary">{distanceKm.toFixed(2)} km</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Gain: <strong className="text-text-primary">{elevationGainM.toFixed(1)} m</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Est. time: <strong className="text-text-primary">{formatDuration(estimatedHours)}</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Max elev: <strong className="text-text-primary">{maxElevationM.toFixed(1)} m</strong>
        </span>
      </div>

      {/* Legend row — 20px */}
      {forecast && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            fontSize: '10px',
            color: '#A0AEC0',
            height: '20px',
            minHeight: '20px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#A0AEC0' }}>Avy danger by elevation:</span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: dangerColor(belowDanger, 0.6),
              color: '#fff',
            }}
          >
            Below treeline: {['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'][belowDanger] ?? belowDanger}
          </span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: dangerColor(nearDanger, 0.6),
              color: '#fff',
            }}
          >
            Near treeline: {['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'][nearDanger] ?? nearDanger}
          </span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: dangerColor(aboveDanger, 0.6),
              color: '#fff',
            }}
          >
            Above treeline: {['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme'][aboveDanger] ?? aboveDanger}
          </span>
        </div>
      )}

      {/* Chart — remaining height (100px) */}
      <div style={{ width: '100%', height: '100px' }}>
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B8BEB" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#3B8BEB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#2D3748" opacity={0.5} />
              <XAxis
                dataKey="distanceKm"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fill: '#A0AEC0', fontSize: 10 }}
                tickFormatter={(v) => `${typeof v === 'number' ? v.toFixed(1) : v} km`}
              />
              <YAxis
                dataKey="elevation"
                type="number"
                domain={[yMin, yMax]}
                tick={{ fill: '#A0AEC0', fontSize: 10 }}
                tickFormatter={(v) => `${typeof v === 'number' ? v.toFixed(1) : v} m`}
                width={36}
              />
              {/* Below treeline band */}
              <ReferenceArea
                y1={yMin}
                y2={Math.min(BELOW_TREELINE, yMax)}
                fill={dangerColor(belowDanger)}
                fillOpacity={1}
                strokeOpacity={0}
              />
              {/* Near treeline band */}
              {yMax > BELOW_TREELINE && (
                <ReferenceArea
                  y1={Math.max(BELOW_TREELINE, yMin)}
                  y2={Math.min(NEAR_TREELINE, yMax)}
                  fill={dangerColor(nearDanger)}
                  fillOpacity={1}
                  strokeOpacity={0}
                />
              )}
              {/* Above treeline band */}
              {yMax > NEAR_TREELINE && (
                <ReferenceArea
                  y1={Math.max(NEAR_TREELINE, yMin)}
                  y2={yMax}
                  fill={dangerColor(aboveDanger)}
                  fillOpacity={1}
                  strokeOpacity={0}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E2D3D',
                  border: '1px solid #2D3748',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#F7FAFC' }}
                formatter={(value) => [typeof value === 'number' ? value.toFixed(1) + ' m' : String(value ?? ''), 'Elevation']}
                labelFormatter={(label) => `Distance: ${label} km`}
              />
              <Area
                type="linear"
                dataKey="elevation"
                stroke="#3B8BEB"
                strokeWidth={2}
                fill="url(#elevationGradient)"
              />
            </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
