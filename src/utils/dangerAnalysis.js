import { fetchForecast } from '../services/avalancheForecast'

const R = 6371000

function haversineDistance(p1, p2) {
  const lat1 = p1[1] * Math.PI / 180
  const lat2 = p2[1] * Math.PI / 180
  const dLat = (p2[1] - p1[1]) * Math.PI / 180
  const dLon = (p2[0] - p1[0]) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function getSlopeAngle(p1, p2) {
  const dist = haversineDistance(p1, p2)
  if (dist < 1) return 0
  const elevDiff = Math.abs((p2[2] || 0) - (p1[2] || 0))
  return Math.atan(elevDiff / dist) * (180 / Math.PI)
}

function getAspect(p1, p2) {
  const dLon = p2[0] - p1[0]
  const dLat = p2[1] - p1[1]
  const aspectRad = Math.atan2(-dLon, -dLat)
  const aspectAngle = (aspectRad * (180 / Math.PI) + 360) % 360
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(aspectAngle / 45) % 8]
}

export function analyzeSegments(waypoints, forecast) {
  if (!waypoints || waypoints.length < 2) return []

  return waypoints.slice(0, -1).map((p1, i) => {
    const p2 = waypoints[i + 1]
    const mode = p1[3] === 'descent' ? 'descent' : 'skin'

    if (mode === 'descent') {
      return {
        p1,
        p2,
        slope: 0,
        aspect: '',
        severity: 'descent',
        reasons: [],
        color: '#FF6B6B',
        index: i,
        mode: 'descent',
      }
    }

    const slope = getSlopeAngle(p1, p2)
    const aspect = getAspect(p1, p2)
    const dangerousAspects = forecast?.dangerous_aspects ?? []

    const reasons = []
    let severity = 'safe'

    if (slope >= 35) {
      reasons.push(`Extreme slope (${slope.toFixed(0)}°)`)
      severity = 'extreme'
    } else if (slope >= 28) {
      reasons.push(`Steep slope (${slope.toFixed(0)}°)`)
      severity = 'dangerous'
    } else if (slope >= 22) {
      reasons.push(`Avalanche terrain (${slope.toFixed(0)}°)`)
      severity = 'caution'
    }

    // Elevation gain rate: steep if gaining/losing lots of elevation per 100m path
    const elevDiff = Math.abs((p2[2] || 0) - (p1[2] || 0))
    const dist = haversineDistance(p1, p2)
    const gainPer100m = dist >= 1 ? (elevDiff / dist) * 100 : 0
    if (gainPer100m > 60 && severity === 'safe') severity = 'caution'
    if (gainPer100m > 80 && severity === 'caution') severity = 'dangerous'
    if (gainPer100m > 100 && severity === 'dangerous') severity = 'extreme'

    if (dangerousAspects.includes(aspect)) {
      reasons.push(`Dangerous aspect (${aspect}) per forecast`)
      if (severity === 'safe') severity = 'caution'
      if (severity === 'caution') severity = 'dangerous'
    }

    const color =
      severity === 'extreme' ? '#FF0000' :
      severity === 'dangerous' ? '#E53E3E' :
      severity === 'caution' ? '#DD6B20' :
      '#ffffff'

    return { p1, p2, slope, aspect, severity, reasons, color, index: i, mode: 'skin' }
  })
}

export function calcRouteRiskScore(segments) {
  const skinSegments = segments.filter((s) => s.severity !== 'descent')
  if (!skinSegments.length) return null
  const counts = { extreme: 0, dangerous: 0, caution: 0, safe: 0 }
  skinSegments.forEach((s) => counts[s.severity]++)
  const total = skinSegments.length
  if (counts.extreme / total > 0.1) return { label: 'High', color: '#E53E3E' }
  if (counts.dangerous / total > 0.2) return { label: 'Considerable', color: '#DD6B20' }
  if (counts.caution / total > 0.3) return { label: 'Moderate', color: '#D69E2E' }
  return { label: 'Low', color: '#38A169' }
}

export function calcHazardExposure(segments) {
  let hazardDist = 0
  segments.forEach((s) => {
    if (s.severity !== 'safe' && s.severity !== 'descent') {
      hazardDist += haversineDistance(s.p1, s.p2)
    }
  })
  return (hazardDist / 1000).toFixed(2)
}
