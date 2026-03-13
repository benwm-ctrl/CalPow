// ElevationProfilePanel.jsx
// Elevation profile with danger zone reference areas rendered below the line.
// Props:
//   waypoints  — array of [lng, lat, elevation, mode?]
//   segments   — array from dangerAnalysis.analyzeSegments()  (for danger coloring)
//   onClose    — () => void
// Dependencies: recharts

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceArea, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const C = {
  bg: 'rgba(7,12,16,0.95)',
  border: 'rgba(240,237,232,0.09)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.2)',
  grid: 'rgba(240,237,232,0.05)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

const SEV_COLORS = {
  safe:      '#4ade80',
  caution:   '#fb923c',
  dangerous: '#ef4444',
  extreme:   '#9333ea',
  descent:   'rgba(240,237,232,0.15)',
}

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineDist([lng1, lat1], [lng2, lat2]) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Build chart data from waypoints ──────────────────────────────────────────
function buildChartData(waypoints) {
  if (!waypoints?.length) return []
  let cumDist = 0
  return waypoints.map((wp, i) => {
    if (i > 0) cumDist += haversineDist(waypoints[i - 1], wp)
    return {
      dist: parseFloat(cumDist.toFixed(3)),
      elev: Math.round(wp[2] ?? 0),
      wpIndex: i,
    }
  })
}

// ── Build danger reference areas from segments ────────────────────────────────
// Each segment maps to a dist range on the x-axis
function buildDangerAreas(segments, chartData) {
  if (!segments?.length || !chartData?.length) return []
  const areas = []
  let segStart = 0

  segments.forEach((seg, i) => {
    const segDist = seg.distance_km ?? 0
    const x1 = chartData[segStart]?.dist ?? 0
    const endWpIdx = Math.min(segStart + 1, chartData.length - 1)
    // find the waypoint index that ends this segment
    const x2 = chartData[segStart + 1]?.dist ?? x1 + segDist
    areas.push({
      x1, x2,
      severity: seg.severity ?? 'safe',
      label: seg.severity,
    })
    segStart = Math.min(segStart + 1, chartData.length - 1)
  })
  return areas
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      backgroundColor: 'rgba(7,12,16,0.97)',
      border: '1px solid rgba(240,237,232,0.15)',
      padding: '7px 11px',
    }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1 }}>
        {d.elev.toLocaleString()} m
      </div>
      <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginTop: 3 }}>
        {d.dist.toFixed(2)} km
      </div>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ chartData }) {
  if (!chartData?.length) return null
  const elevs = chartData.map(d => d.elev)
  const minElev = Math.min(...elevs)
  const maxElev = Math.max(...elevs)
  const totalDist = chartData[chartData.length - 1]?.dist ?? 0

  // Gain/loss
  let gain = 0, loss = 0
  for (let i = 1; i < chartData.length; i++) {
    const delta = chartData[i].elev - chartData[i - 1].elev
    if (delta > 0) gain += delta
    else loss += Math.abs(delta)
  }

  return (
    <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
      {[
        { label: 'Distance', value: `${totalDist.toFixed(1)} km` },
        { label: 'Gain', value: `+${Math.round(gain)} m` },
        { label: 'Loss', value: `-${Math.round(loss)} m` },
        { label: 'High Point', value: `${maxElev.toLocaleString()} m` },
        { label: 'Low Point', value: `${minElev.toLocaleString()} m` },
      ].map(s => (
        <div key={s.label} style={{
          flex: 1, padding: '6px 8px',
          borderRight: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
          <div style={{ ...LABEL, fontSize: 7, color: C.faint, marginTop: 3 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ElevationProfilePanel({ waypoints, segments, onClose }) {
  if (!waypoints?.length || waypoints.length < 2) return null

  const chartData = buildChartData(waypoints)
  const dangerAreas = buildDangerAreas(segments, chartData)

  const elevs = chartData.map(d => d.elev)
  const minElev = Math.min(...elevs)
  const maxElev = Math.max(...elevs)
  const elevPad = Math.round((maxElev - minElev) * 0.12) || 50
  const yDomain = [Math.max(0, minElev - elevPad), maxElev + elevPad]
  const xMax = chartData[chartData.length - 1]?.dist ?? 1

  return (
    <div style={{
      position: 'absolute',
      bottom: 16, left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(680px, calc(100vw - 360px))',
      backgroundColor: C.bg,
      backdropFilter: 'blur(14px)',
      border: `1px solid ${C.border}`,
      zIndex: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint }}>Elevation Profile</div>
          {/* Danger legend */}
          {segments?.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {Object.entries({
                Safe: SEV_COLORS.safe,
                Caution: SEV_COLORS.caution,
                Dangerous: SEV_COLORS.dangerous,
                Extreme: SEV_COLORS.extreme,
              }).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, backgroundColor: color + '60' }}/>
                  <span style={{ ...LABEL, fontSize: 7, color: C.faint }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: 'transparent',
            color: C.faint, cursor: 'pointer', fontSize: 14,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.faint}
        >×</button>
      </div>

      {/* Chart */}
      <div style={{ padding: '12px 14px 8px', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F0EDE8" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="#F0EDE8" stopOpacity={0.02}/>
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0"
              stroke={C.grid}
              horizontal={true}
              vertical={false}
            />

            {/* Danger reference areas — drawn UNDER the elevation line */}
            {dangerAreas.map((area, i) => (
              area.severity !== 'safe' && area.severity !== 'descent' && (
                <ReferenceArea
                  key={i}
                  x1={area.x1}
                  x2={area.x2}
                  y1={yDomain[0]}
                  y2={yDomain[1]}
                  fill={SEV_COLORS[area.severity]}
                  fillOpacity={0.08}
                  stroke={SEV_COLORS[area.severity]}
                  strokeOpacity={0.2}
                  strokeWidth={1}
                />
              )
            ))}

            <XAxis
              dataKey="dist"
              type="number"
              domain={[0, xMax]}
              tickCount={5}
              tickFormatter={v => `${v.toFixed(1)}`}
              tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fill: 'rgba(240,237,232,0.3)', letterSpacing: '0.08em' }}
              axisLine={{ stroke: C.border }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tickCount={4}
              tickFormatter={v => `${v.toLocaleString()}`}
              tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fill: 'rgba(240,237,232,0.3)', letterSpacing: '0.06em' }}
              axisLine={false}
              tickLine={false}
              width={52}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(240,237,232,0.2)', strokeWidth: 1, strokeDasharray: '3 3' }}
            />

            <Area
              type="monotone"
              dataKey="elev"
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

      {/* X axis label */}
      <div style={{ textAlign: 'center', ...LABEL, fontSize: 7, color: 'rgba(240,237,232,0.18)', paddingBottom: 6 }}>
        Distance (km)
      </div>

      {/* Stats */}
      <StatsRow chartData={chartData} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400&family=Barlow+Condensed:wght@700;800&display=swap');
      `}</style>
    </div>
  )
}
