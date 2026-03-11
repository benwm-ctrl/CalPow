import { useEffect, useMemo, useState } from 'react'

const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const ELEVATIONS = ['above', 'near', 'below'] // outer to inner: above treeline, near, below

const ASPECT_LOCATION_MAP = {
  north: 0,
  northeast: 1,
  east: 2,
  southeast: 3,
  south: 4,
  southwest: 5,
  west: 6,
  northwest: 7,
}
const ELEVATION_LOCATION_MAP = {
  upper: 0,   // above treeline
  middle: 1,  // near treeline
  lower: 2,   // below treeline
}

const DANGER_COLORS = {
  1: '#38A169',
  2: '#D69E2E',
  3: '#DD6B20',
  4: '#E53E3E',
  5: '#1a1a1a',
}

const PROBLEM_TYPE_COLORS = {
  'Wet Loose': '#3b82f6',
  'Wind Slab': '#8b5cf6',
  'Storm Slab': '#eab308',
  'Persistent Slab': '#f97316',
  'Deep Persistent': '#ef4444',
  'Loose Dry': '#6b7280',
  'Cornice': '#ec4899',
  'Glide': '#22c55e',
}

function normalizeProblemType(name) {
  if (!name || typeof name !== 'string') return ''
  const normalized = name.trim()
  for (const key of Object.keys(PROBLEM_TYPE_COLORS)) {
    if (key.toLowerCase() === normalized.toLowerCase()) return key
  }
  return normalized
}

/**
 * Build 8x3 grid of problem-type colors from detailedForecast.forecast_avalanche_problems[].location.
 * Location strings: "{aspect} {elevation}" e.g. "north upper", "southeast middle".
 * Returns { grid: string[][] (color per cell), activeProblemTypes: { name, color }[] }.
 */
function buildProblemGrid(detailedForecast) {
  const grid = Array(8)
    .fill(null)
    .map(() => Array(3).fill(null))
  const activeTypes = new Map()

  const problems = detailedForecast?.forecast_avalanche_problems ?? detailedForecast?.avalanche_problems ?? []
  if (!Array.isArray(problems)) return { grid, activeProblemTypes: [] }

  for (const problem of problems) {
    const locations = problem.location ?? problem.locations ?? []
    if (!Array.isArray(locations)) continue
    const problemType = normalizeProblemType(problem.name ?? problem.avalanche_problem_type ?? problem.type)
    const color = problemType ? (PROBLEM_TYPE_COLORS[problemType] ?? '#6b7280') : '#6b7280'
    if (problemType) activeTypes.set(problemType, color)

    for (const loc of locations) {
      const s = String(loc).trim().toLowerCase()
      const parts = s.split(/\s+/)
      if (parts.length < 2) continue
      const aspectKey = parts[0]
      const elevKey = parts[1]
      const a = ASPECT_LOCATION_MAP[aspectKey]
      const e = ELEVATION_LOCATION_MAP[elevKey]
      if (a != null && e != null && grid[a][e] == null) {
        grid[a][e] = color
      }
    }
  }

  const activeProblemTypes = Array.from(activeTypes.entries()).map(([name, color]) => ({ name, color }))
  return { grid, activeProblemTypes }
}

/**
 * Parse forecastData into an 8 (aspect) x 3 (elevation) grid of danger levels (1-5 or 0 = not dangerous).
 * - If avalancheProblems[].aspectElevations exists (9x3 boolean or similar), use it with problem danger level.
 * - Else use overall danger_above_treeline, danger_near_treeline, danger_below_treeline for all aspects.
 */
function buildDangerGrid(forecastData) {
  const grid = Array(8)
    .fill(null)
    .map(() => Array(3).fill(0))

  if (!forecastData) return grid

  const raw = forecastData._apiResponse || forecastData

  // Try aspect-specific data: avalancheProblems with aspectElevations [aspect][elevation]
  const problems = raw?.avalancheProblems ?? raw?.avalanche_problems
  if (Array.isArray(problems) && problems.length > 0) {
    for (const problem of problems) {
      const dangerLevel = problem.dangerLevel ?? problem.danger_level ?? forecastData.danger_level ?? 1
      const aspectElevations =
        problem.aspectElevations ?? problem.aspect_elevations ?? problem.aspectElevation
      if (aspectElevations && Array.isArray(aspectElevations)) {
        // Assume [aspect 0-7 or 8][elevation 0-2]: N, NE, E, SE, S, SW, W, NW (and sometimes 8th = N again)
        const rows = aspectElevations.length
        for (let a = 0; a < Math.min(8, rows); a++) {
          const row = aspectElevations[a]
          if (!Array.isArray(row)) continue
          for (let e = 0; e < Math.min(3, row.length); e++) {
            if (row[e]) grid[a][e] = Math.max(grid[a][e], dangerLevel)
          }
        }
      }
    }
  }

  // If no aspect-specific data, fill by elevation band for all aspects
  if (grid.every((row) => row.every((v) => v === 0))) {
    const above = forecastData.danger_above_treeline ?? forecastData.danger_level ?? 0
    const near = forecastData.danger_near_treeline ?? forecastData.danger_level ?? 0
    const below = forecastData.danger_below_treeline ?? forecastData.danger_level ?? 0
    for (let a = 0; a < 8; a++) {
      grid[a][0] = above
      grid[a][1] = near
      grid[a][2] = below
    }
  }

  return grid
}

export default function AspectElevationRose({ forecastData, detailedForecast, region }) {
  const STORAGE_KEY = 'calpow_aspect_rose_collapsed'
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch (_) {}
  }

  useEffect(() => {
    console.log('AspectElevationRose forecastData (full object):', forecastData)
    if (forecastData?._apiResponse) {
      console.log('Raw API response (for aspect/elevation fields):', forecastData._apiResponse)
    }
  }, [forecastData])

  const dangerGrid = useMemo(() => buildDangerGrid(forecastData), [forecastData])
  const problemResult = useMemo(() => buildProblemGrid(detailedForecast), [detailedForecast])
  const useProblemGrid = problemResult.activeProblemTypes.length > 0 &&
    problemResult.grid.some((row) => row.some((c) => c != null))

  const size = 120
  const cx = size / 2
  const cy = size / 2
  const innerR = 17
  const midR = 31
  const outerR = 46
  const radii = [outerR, midR, innerR] // above, near, below

  const segmentAngle = 360 / 8
  const toRad = (deg) => (deg * Math.PI) / 180

  const getSectorPath = (aspectIndex, elevIndex) => {
    const startAngle = 90 - (aspectIndex + 1) * segmentAngle
    const endAngle = 90 - aspectIndex * segmentAngle
    const rOuter = radii[elevIndex]
    const rInner = elevIndex === 2 ? 0 : radii[elevIndex + 1]
    const x1 = cx + rOuter * Math.cos(toRad(startAngle))
    const y1 = cy - rOuter * Math.sin(toRad(startAngle))
    const x2 = cx + rOuter * Math.cos(toRad(endAngle))
    const y2 = cy - rOuter * Math.sin(toRad(endAngle))
    const x3 = cx + rInner * Math.cos(toRad(endAngle))
    const y3 = cy - rInner * Math.sin(toRad(endAngle))
    const x4 = cx + rInner * Math.cos(toRad(startAngle))
    const y4 = cy - rInner * Math.sin(toRad(startAngle))
    if (rInner === 0) {
      return `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`
    }
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`
  }

  const labelRadius = outerR + 9
  const labels = ASPECTS.map((label, i) => {
    const angle = 90 - (i + 0.5) * segmentAngle
    const x = cx + labelRadius * Math.cos(toRad(angle))
    const y = cy - labelRadius * Math.sin(toRad(angle))
    return { label, x, y }
  })

  return (
    <div
      style={{
        width: '160px',
        minHeight: collapsed ? undefined : '170px',
        background: 'rgba(15, 25, 40, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: collapsed ? '8px 10px' : '8px 10px',
        zIndex: 10,
      }}
    >
      {/* Title bar with minimize */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: collapsed ? 0 : '6px',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
          paddingBottom: collapsed ? 0 : 6,
        }}
      >
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#F7FAFC',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          ASPECT / ELEVATION
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          style={{
            padding: 2,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: '#A0AEC0',
            cursor: 'pointer',
            fontSize: 10,
          }}
          className="hover:opacity-80"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <>
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        {/* Segments */}
        {ASPECTS.map((_, a) =>
          ELEVATIONS.map((_, e) => {
            let fill = 'transparent'
            let fillOpacity = 0
            let stroke = 'rgba(255,255,255,0.08)'
            if (useProblemGrid) {
              const color = problemResult.grid[a][e]
              fill = color ?? 'transparent'
              fillOpacity = color ? 0.9 : 0
              stroke = color ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'
            } else {
              const danger = dangerGrid[a][e]
              fill = danger > 0 ? DANGER_COLORS[danger] ?? '#4A5568' : 'transparent'
              fillOpacity = danger > 0 ? 0.85 : 0
              stroke = danger > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'
            }
            return (
              <path
                key={`${a}-${e}`}
                d={getSectorPath(a, e)}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={stroke}
                strokeWidth="0.5"
              />
            )
          })
        )}
        {/* Aspect labels */}
        {labels.map(({ label, x, y }) => (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 8, fill: '#CBD5E0', fontWeight: 600 }}
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Legend: 3 rings + problem types or danger */}
      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {[
          { label: 'Above treeline', color: 'rgba(255,255,255,0.5)' },
          { label: 'Near treeline', color: 'rgba(255,255,255,0.35)' },
          { label: 'Below treeline', color: 'rgba(255,255,255,0.2)' },
        ].map(({ label }, i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '8px',
              color: '#A0AEC0',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.2)',
                background: i === 0 ? 'rgba(255,255,255,0.12)' : i === 1 ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            />
            <span>{label}</span>
          </div>
        ))}
        {useProblemGrid && problemResult.activeProblemTypes.length > 0 ? (
          <>
            <div style={{ marginTop: '4px', fontSize: '8px', color: '#718096', fontWeight: 600 }}>
              Problem types
            </div>
            {problemResult.activeProblemTypes.map(({ name, color }) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '8px',
                  color: '#A0AEC0',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                />
                <span>{name}</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ marginTop: '2px', fontSize: '8px', color: '#718096' }}>
            Color = danger (1–5)
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
