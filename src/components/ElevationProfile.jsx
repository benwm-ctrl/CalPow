import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  if (!waypoints || waypoints.length < 2) return { data: [], distanceKm: 0, elevationGainM: 0, maxElevationM: 0 }
  let distanceKm = 0
  let elevationGainM = 0
  let maxElevationM = waypoints[0][2] ?? 0
  const data = waypoints.map((wp, i) => {
    const [lng, lat, ele] = wp
    const elev = typeof ele === 'number' && !Number.isNaN(ele) ? ele : 0
    if (i > 0) {
      const [prevLng, prevLat, prevEle] = waypoints[i - 1]
      const prevElev = typeof prevEle === 'number' && !Number.isNaN(prevEle) ? prevEle : 0
      distanceKm += haversineKm(prevLat, prevLng, lat, lng)
      const delta = elev - prevElev
      if (delta > 0) elevationGainM += delta
      if (elev > maxElevationM) maxElevationM = elev
    } else if (elev > maxElevationM) {
      maxElevationM = elev
    }
    return { distanceKm: Math.round(distanceKm * 1000) / 1000, elevation: Math.round(elev * 10) / 10 }
  })
  return { data, distanceKm, elevationGainM: Math.round(elevationGainM), maxElevationM: Math.round(maxElevationM) }
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

export default function ElevationProfile() {
  const waypoints = useRouteStore((s) => s.waypoints)
  const { data, distanceKm, elevationGainM, maxElevationM } = buildProfileData(waypoints)
  const estimatedHours = estimateHours(distanceKm, elevationGainM)

  if (waypoints.length < 2) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="absolute bottom-0 left-0 right-0 z-10 p-3 rounded-t-lg border-t border-border"
      style={{
        height: 160,
        backgroundColor: 'rgba(30, 45, 61, 0.95)',
      }}
    >
      {/* Stats badges */}
      <div className="flex flex-wrap gap-3 mb-2">
        <span className="text-xs font-medium text-text-secondary">
          Distance: <strong className="text-text-primary">{distanceKm.toFixed(2)} km</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Gain: <strong className="text-text-primary">{elevationGainM} m</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Est. time: <strong className="text-text-primary">{formatDuration(estimatedHours)}</strong>
        </span>
        <span className="text-xs font-medium text-text-secondary">
          Max elev: <strong className="text-text-primary">{maxElevationM} m</strong>
        </span>
      </div>

      <div className="h-[100px] w-full">
        <ResponsiveContainer width="100%" height="100%">
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
              tickFormatter={(v) => `${v} km`}
            />
            <YAxis
              dataKey="elevation"
              type="number"
              domain={['dataMin - 50', 'dataMax + 50']}
              tick={{ fill: '#A0AEC0', fontSize: 10 }}
              tickFormatter={(v) => `${v} m`}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2D3D',
                border: '1px solid #2D3748',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#F7FAFC' }}
              formatter={(value) => [typeof value === 'number' ? value.toFixed(0) + ' m' : String(value ?? ''), 'Elevation']}
              labelFormatter={(label) => `Distance: ${label} km`}
            />
            <Area
              type="monotone"
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
