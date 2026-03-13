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
import { useRouteStore } from '../store/routeStore'

// ── constants ─────────────────────────────────────────────────────────────────
const BELOW_TREELINE = 2400
const NEAR_TREELINE  = 2900

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

const DANGER_LABELS = ['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme']

// Solid colors matching the avalanche standard palette — used for reference bands (low opacity)
// and for the legend chips (higher opacity border)
function dangerFill(level) {
  if (level >= 4) return 'rgba(239,68,68,0.10)'    // High/Extreme — red
  if (level >= 3) return 'rgba(251,146,60,0.10)'   // Considerable — orange
  if (level >= 2) return 'rgba(250,204,21,0.10)'   // Moderate     — yellow
  return           'rgba(74,222,128,0.07)'          // Low          — green
}
function dangerBorder(level) {
  if (level >= 4) return '#ef4444'
  if (level >= 3) return '#fb923c'
  if (level >= 2) return '#facc15'
  return           '#4ade80'
}

// ── helpers ───────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildProfileData(waypoints) {
  if (!waypoints || waypoints.length < 2)
    return { data: [], distanceKm: 0, elevationGainM: 0, minElevationM: 0, maxElevationM: 0 }

  let distanceKm = 0
  let elevationGainM = 0
  const first = typeof waypoints[0][2] === 'number' && !Number.isNaN(waypoints[0][2]) ? waypoints[0][2] : 0
  let minElevationM = first
  let maxElevationM = first

  const data = waypoints.map((wp, i) => {
    const elev = typeof wp[2] === 'number' && !Number.isNaN(wp[2]) ? wp[2] : 0
    if (i > 0) {
      const prev = waypoints[i - 1]
      const prevElev = typeof prev[2] === 'number' && !Number.isNaN(prev[2]) ? prev[2] : 0
      distanceKm += haversineKm(prev[1], prev[0], wp[1], wp[0])
      const delta = elev - prevElev
      if (delta > 0) elevationGainM += delta
    }
    if (elev > maxElevationM) maxElevationM = elev
    if (elev < minElevationM) minElevationM = elev
    return { distanceKm, elevation: elev }
  })

  return { data, distanceKm, elevationGainM, minElevationM, maxElevationM }
}

function estimateHours(distanceKm, elevationGainM) {
  return distanceKm / 4 + elevationGainM / 300
}

function formatDuration(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      backgroundColor: 'rgba(7,12,16,0.97)',
      border: '1px solid rgba(240,237,232,0.15)',
      padding: '6px 10px',
    }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 15, fontWeight: 800,
        color: '#F0EDE8', lineHeight: 1,
      }}>
        {typeof d.elevation === 'number' ? d.elevation.toFixed(0) : '—'} m
      </div>
      <div style={{ ...LABEL, fontSize: 8, color: 'rgba(240,237,232,0.3)', marginTop: 3 }}>
        {typeof d.distanceKm === 'number' ? d.distanceKm.toFixed(2) : '—'} km
      </div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function ElevationProfile() {
  const waypoints = useRouteStore((s) => s.waypoints)
  const forecast  = useRouteStore((s) => s.forecast)

  if (!waypoints || waypoints.length < 2) return null

  const { data, distanceKm, elevationGainM, minElevationM, maxElevationM } = buildProfileData(waypoints)
  if (!data?.length) return null

  const baseDanger  = forecast?.danger_level ?? 1
  const belowDanger = forecast?.danger_below_treeline ?? Math.max(1, baseDanger - 1)
  const nearDanger  = forecast?.danger_near_treeline  ?? baseDanger
  const aboveDanger = forecast?.danger_above_treeline ?? Math.min(5, baseDanger + 1)

  const estimatedHours = estimateHours(distanceKm, elevationGainM)
  const yMin = Math.floor(minElevationM - 20)
  const yMax = Math.ceil(maxElevationM  + 20)

  const stats = [
    { label: 'Distance',  value: `${distanceKm.toFixed(2)} km` },
    { label: 'Gain',      value: `${elevationGainM.toFixed(0)} m` },
    { label: 'Est. Time', value: formatDuration(estimatedHours) },
    { label: 'Max Elev',  value: `${maxElevationM.toFixed(0)} m` },
  ]

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '326px',
        right: '236px',
        width: 'auto',
        zIndex: 5,
        height: '180px',
        backgroundColor: 'rgba(7,12,16,0.97)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(240,237,232,0.09)',
      }}
    >
      {/* ── Top strip: stats + legend ── */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid rgba(240,237,232,0.07)',
        height: 36,
      }}>
        {/* Stats cells */}
        {stats.map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 14px',
            borderRight: '1px solid rgba(240,237,232,0.07)',
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 800,
              color: '#F0EDE8', lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{ ...LABEL, fontSize: 7, color: 'rgba(240,237,232,0.3)', marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Elevation band legend chips — only if forecast present */}
        {forecast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0 12px',
            borderLeft: '1px solid rgba(240,237,232,0.07)',
          }}>
            <span style={{ ...LABEL, fontSize: 7, color: 'rgba(240,237,232,0.25)', marginRight: 4 }}>
              Avy danger
            </span>
            {[
              { label: 'Below treeline', level: belowDanger },
              { label: 'Near treeline',  level: nearDanger },
              { label: 'Above treeline', level: aboveDanger },
            ].map(({ label, level }) => (
              <div key={label} style={{
                ...LABEL, fontSize: 8, fontWeight: 700,
                padding: '2px 8px',
                color: dangerBorder(level),
                border: `1px solid ${dangerBorder(level)}50`,
                backgroundColor: dangerFill(level),
                whiteSpace: 'nowrap',
              }}>
                {label.replace(' treeline', '')} · {DANGER_LABELS[level] ?? level}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div style={{ width: '100%', height: 'calc(180px - 36px)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#F0EDE8" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#F0EDE8" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke="rgba(240,237,232,0.05)"
              horizontal vertical={false}
            />

            {/* Below treeline band */}
            <ReferenceArea
              y1={yMin}
              y2={Math.min(BELOW_TREELINE, yMax)}
              fill={dangerFill(belowDanger)}
              fillOpacity={1}
              strokeOpacity={0}
            />
            {/* Near treeline band */}
            {yMax > BELOW_TREELINE && (
              <ReferenceArea
                y1={Math.max(BELOW_TREELINE, yMin)}
                y2={Math.min(NEAR_TREELINE, yMax)}
                fill={dangerFill(nearDanger)}
                fillOpacity={1}
                strokeOpacity={0}
              />
            )}
            {/* Above treeline band */}
            {yMax > NEAR_TREELINE && (
              <ReferenceArea
                y1={Math.max(NEAR_TREELINE, yMin)}
                y2={yMax}
                fill={dangerFill(aboveDanger)}
                fillOpacity={1}
                strokeOpacity={0}
              />
            )}

            <XAxis
              dataKey="distanceKm"
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fill: 'rgba(240,237,232,0.25)', letterSpacing: '0.06em' }}
              tickFormatter={(v) => `${typeof v === 'number' ? v.toFixed(1) : v}`}
              axisLine={{ stroke: 'rgba(240,237,232,0.07)' }}
              tickLine={false}
            />
            <YAxis
              dataKey="elevation"
              type="number"
              domain={[yMin, yMax]}
              tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fill: 'rgba(240,237,232,0.25)', letterSpacing: '0.04em' }}
              tickFormatter={(v) => `${typeof v === 'number' ? Math.round(v) : v}`}
              axisLine={false}
              tickLine={false}
              width={42}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(240,237,232,0.18)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            <Area
              type="linear"
              dataKey="elevation"
              stroke="#F0EDE8"
              strokeWidth={1.5}
              fill="url(#elevGrad)"
              dot={false}
              activeDot={{ r: 3, fill: '#F0EDE8', stroke: 'none' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
