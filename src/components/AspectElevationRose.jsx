import { useEffect, useMemo, useState } from 'react'

const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const ELEVATIONS = ['above', 'near', 'below']

const ASPECT_LOCATION_MAP = {
  north: 0, northeast: 1, east: 2, southeast: 3,
  south: 4, southwest: 5, west: 6, northwest: 7,
}
const ELEVATION_LOCATION_MAP = { upper: 0, middle: 1, lower: 2 }

const DANGER_COLORS = {
  1: '#38A169', 2: '#D69E2E', 3: '#DD6B20', 4: '#E53E3E', 5: '#1a1a1a',
}

const PROBLEM_TYPE_COLORS = {
  'Wet Loose': '#3b82f6', 'Wind Slab': '#8b5cf6', 'Storm Slab': '#eab308',
  'Persistent Slab': '#f97316', 'Deep Persistent': '#ef4444',
  'Loose Dry': '#6b7280', 'Cornice': '#ec4899', 'Glide': '#22c55e',
}

function normalizeProblemType(name) {
  if (!name || typeof name !== 'string') return ''
  const normalized = name.trim()
  for (const key of Object.keys(PROBLEM_TYPE_COLORS)) {
    if (key.toLowerCase() === normalized.toLowerCase()) return key
  }
  return normalized
}

function buildProblemGrid(detailedForecast) {
  const grid = Array(8).fill(null).map(() => Array(3).fill(null))
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
      const parts = String(loc).trim().toLowerCase().split(/\s+/)
      if (parts.length < 2) continue
      const a = ASPECT_LOCATION_MAP[parts[0]]
      const e = ELEVATION_LOCATION_MAP[parts[1]]
      if (a != null && e != null && grid[a][e] == null) grid[a][e] = color
    }
  }

  return { grid, activeProblemTypes: Array.from(activeTypes.entries()).map(([name, color]) => ({ name, color })) }
}

function buildDangerGrid(forecastData) {
  const grid = Array(8).fill(null).map(() => Array(3).fill(0))
  if (!forecastData) return grid
  const raw = forecastData._apiResponse || forecastData
  const problems = raw?.avalancheProblems ?? raw?.avalanche_problems

  if (Array.isArray(problems) && problems.length > 0) {
    for (const problem of problems) {
      const dangerLevel = problem.dangerLevel ?? problem.danger_level ?? forecastData.danger_level ?? 1
      const aspectElevations = problem.aspectElevations ?? problem.aspect_elevations ?? problem.aspectElevation
      if (aspectElevations && Array.isArray(aspectElevations)) {
        for (let a = 0; a < Math.min(8, aspectElevations.length); a++) {
          const row = aspectElevations[a]
          if (!Array.isArray(row)) continue
          for (let e = 0; e < Math.min(3, row.length); e++) {
            if (row[e]) grid[a][e] = Math.max(grid[a][e], dangerLevel)
          }
        }
      }
    }
  }

  if (grid.every((row) => row.every((v) => v === 0))) {
    const above = forecastData.danger_above_treeline ?? forecastData.danger_level ?? 0
    const near = forecastData.danger_near_treeline ?? forecastData.danger_level ?? 0
    const below = forecastData.danger_below_treeline ?? forecastData.danger_level ?? 0
    for (let a = 0; a < 8; a++) { grid[a][0] = above; grid[a][1] = near; grid[a][2] = below }
  }

  return grid
}

export default function AspectElevationRose({ forecastData, detailedForecast, region }) {
  const STORAGE_KEY = 'calpow_aspect_rose_collapsed'
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch (_) {}
  }

  useEffect(() => {
    console.log('AspectElevationRose forecastData:', forecastData)
    if (forecastData?._apiResponse) console.log('Raw API response:', forecastData._apiResponse)
  }, [forecastData])

  const dangerGrid = useMemo(() => buildDangerGrid(forecastData), [forecastData])
  const problemResult = useMemo(() => buildProblemGrid(detailedForecast), [detailedForecast])
  const useProblemGrid = problemResult.activeProblemTypes.length > 0 &&
    problemResult.grid.some((row) => row.some((c) => c != null))

  const size = 116
  const cx = size / 2
  const cy = size / 2
  const innerR = 16
  const midR = 29
  const outerR = 43
  const radii = [outerR, midR, innerR]
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
    if (rInner === 0) return `M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`
  }

  const labelRadius = outerR + 9
  const labels = ASPECTS.map((label, i) => {
    const angle = 90 - (i + 0.5) * segmentAngle
    return {
      label,
      x: cx + labelRadius * Math.cos(toRad(angle)),
      y: cy - labelRadius * Math.sin(toRad(angle)),
    }
  })

  // NOTE: Positioned below the danger bar (top: ~104px) to avoid overlap.
  // The danger bar sits at top: 56px and is ~44px tall.
  // This component is placed at top: 108px, left: 16px in MapPage.
  // If MapPage renders this component, update its top offset accordingly.
  return (
    <div style={{
      width: 158,
      backgroundColor: 'rgba(7,12,16,0.92)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(240,237,232,0.1)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(240,237,232,0.07)',
      }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 9, fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'rgba(240,237,232,0.4)',
        }}>
          Aspect / Elev
        </span>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          style={{
            border: 'none', background: 'transparent',
            color: 'rgba(240,237,232,0.3)', cursor: 'pointer',
            fontSize: 9, padding: '2px 4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.3)'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 10px 10px' }}>
          {/* Rose SVG */}
          <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
            {ASPECTS.map((_, a) =>
              ELEVATIONS.map((_, e) => {
                let fill = 'transparent', fillOpacity = 0, stroke = 'rgba(240,237,232,0.08)'
                if (useProblemGrid) {
                  const color = problemResult.grid[a][e]
                  fill = color ?? 'transparent'
                  fillOpacity = color ? 0.88 : 0
                  stroke = color ? 'rgba(240,237,232,0.2)' : 'rgba(240,237,232,0.08)'
                } else {
                  const danger = dangerGrid[a][e]
                  fill = danger > 0 ? DANGER_COLORS[danger] ?? '#4A5568' : 'transparent'
                  fillOpacity = danger > 0 ? 0.82 : 0
                  stroke = danger > 0 ? 'rgba(240,237,232,0.2)' : 'rgba(240,237,232,0.08)'
                }
                return (
                  <path
                    key={`${a}-${e}`}
                    d={getSectorPath(a, e)}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={stroke}
                    strokeWidth="0.6"
                  />
                )
              })
            )}
            {labels.map(({ label, x, y }) => (
              <text
                key={label}
                x={x} y={y}
                textAnchor="middle" dominantBaseline="middle"
                style={{
                  fontSize: 7.5,
                  fill: 'rgba(240,237,232,0.5)',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </text>
            ))}
          </svg>

          {/* Elevation ring legend */}
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { label: 'Above treeline' },
              { label: 'Near treeline' },
              { label: 'Below treeline' },
            ].map(({ label }, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 7, height: 7, flexShrink: 0,
                  border: '1px solid rgba(240,237,232,0.15)',
                  backgroundColor: i === 0 ? 'rgba(240,237,232,0.1)' : i === 1 ? 'rgba(240,237,232,0.05)' : 'transparent',
                }}/>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, letterSpacing: '0.06em',
                  color: 'rgba(240,237,232,0.3)',
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Problem types or danger scale */}
          {useProblemGrid && problemResult.activeProblemTypes.length > 0 ? (
            <div style={{ marginTop: 6, borderTop: '1px solid rgba(240,237,232,0.07)', paddingTop: 6 }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'rgba(240,237,232,0.25)',
                marginBottom: 4,
              }}>
                Problem Types
              </div>
              {problemResult.activeProblemTypes.map(({ name, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <div style={{ width: 7, height: 7, backgroundColor: color, flexShrink: 0 }}/>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, letterSpacing: '0.04em',
                    color: 'rgba(240,237,232,0.45)',
                  }}>{name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              marginTop: 5,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, letterSpacing: '0.08em',
              color: 'rgba(240,237,232,0.2)',
            }}>
              Color = danger (1–5)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
