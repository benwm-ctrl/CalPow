/**
 * Distance in km between consecutive waypoints (Haversine).
 * Waypoints: [lng, lat, elevation]
 */
function distanceKm(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0
  const R = 6371 // km
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lon1, lat1] = waypoints[i]
    const [lon2, lat2] = waypoints[i + 1]
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return Math.round(total * 1000) / 1000
}

/**
 * Total elevation gain in meters (sum of positive deltas).
 */
function elevationGainM(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0
  let gain = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const e1 = waypoints[i][2] ?? 0
    const e2 = waypoints[i + 1][2] ?? 0
    if (e2 > e1) gain += e2 - e1
  }
  return Math.round(gain)
}

/**
 * Max elevation in meters.
 */
function maxElevationM(waypoints) {
  if (!waypoints || waypoints.length === 0) return null
  const elevations = waypoints.map((w) => w[2]).filter((e) => e != null && !Number.isNaN(e))
  if (elevations.length === 0) return null
  return Math.round(Math.max(...elevations))
}

export { distanceKm, elevationGainM, maxElevationM }
