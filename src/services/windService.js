const MAX_POINTS = 120
const MAX_URL_LENGTH = 4000

/**
 * Base grid spacing in degrees for a given zoom level.
 */
function getSpacing(zoom) {
  if (zoom <= 8) return 0.03
  if (zoom <= 10) return 0.03 - (zoom - 8) * 0.0075
  if (zoom <= 12) return 0.015 - (zoom - 10) * 0.0045
  return 0.006
}

/**
 * Generate grid of unique (lat, lng) points: lat from south to north, lng from west to east.
 * Capped at maxPoints; step size increased until grid fits.
 */
function getGridPoints(bounds, zoom, maxPoints = MAX_POINTS) {
  const north = bounds.getNorthEast().lat
  const south = bounds.getSouthWest().lat
  const east = bounds.getNorthEast().lng
  const west = bounds.getSouthWest().lng
  const latSpan = north - south
  const lngSpan = east - west
  if (latSpan <= 0 || lngSpan <= 0) return []

  let step = getSpacing(zoom)
  let points = []
  for (;;) {
    const nLat = Math.max(1, Math.floor(latSpan / step) + 1)
    const nLng = Math.max(1, Math.floor(lngSpan / step) + 1)
    if (nLat * nLng > maxPoints) {
      step *= 1.3
      if (step >= Math.max(latSpan, lngSpan)) break
      continue
    }
    const latStep = nLat > 1 ? latSpan / (nLat - 1) : 0
    const lngStep = nLng > 1 ? lngSpan / (nLng - 1) : 0
    points = []
    for (let i = 0; i < nLat; i++) {
      const lat = south + i * latStep
      for (let j = 0; j < nLng; j++) {
        const lng = west + j * lngStep
        points.push({ lat, lng })
      }
    }
    break
  }
  return points
}

function buildWindUrl(points) {
  const lats = points.map((p) => p.lat.toFixed(4)).join(',')
  const lngs = points.map((p) => p.lng.toFixed(4)).join(',')
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    current: 'wind_speed_10m,wind_direction_10m,wind_speed_80m,wind_direction_80m',
    wind_speed_unit: 'mph',
    timezone: 'auto',
  })
  return `${OPEN_METEO_BASE}?${params.toString()}`
}

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast'

function parseWindResponse(data, points) {
  const list = Array.isArray(data) ? data : [data]
  return list.map((item, i) => {
    const pt = points[i] || { lat: item.latitude, lng: item.longitude }
    const c = item.current || {}
    return {
      lat: pt.lat,
      lng: pt.lng,
      speed: c.wind_speed_10m ?? 0,
      direction: c.wind_direction_10m ?? 0,
      speed80: c.wind_speed_80m ?? c.wind_speed_10m ?? 0,
      direction80: c.wind_direction_80m ?? c.wind_direction_10m ?? 0,
    }
  })
}

/**
 * Fetch wind for one batch of points in a single request. Uses .toFixed(4) for URL length.
 */
async function fetchWindBatch(points, tempMode = null) {
  if (points.length === 0) return []
  const url = buildWindUrl(points, tempMode)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Wind API ${res.status}`)
  const data = await res.json()
  return parseWindResponse(data, points, tempMode)
}

/**
 * Fetch wind data for a grid of points across the current map bounds.
 * Grid capped at 120 points; if URL would exceed 4000 chars, step size is increased until it fits.
 * @param {mapboxgl.LngLatBounds} bounds - map.getBounds()
 * @param {number} zoom - map.getZoom()
 * @returns {Promise<Array<{ lat, lng, speed, direction, speed80, direction80 }>>}
 * @throws {Error} if request fails — caller should disable wind and show toast
 */
export async function fetchWindGrid(bounds, zoom) {
  let maxPoints = MAX_POINTS
  let points = getGridPoints(bounds, zoom, maxPoints)
  if (points.length === 0) return []

  let url = buildWindUrl(points)
  while (url.length > MAX_URL_LENGTH && maxPoints > 1) {
    maxPoints = Math.max(1, Math.floor(maxPoints / 1.5))
    points = getGridPoints(bounds, zoom, maxPoints)
    if (points.length === 0) return []
    url = buildWindUrl(points)
  }

  return fetchWindBatch(points)
}
