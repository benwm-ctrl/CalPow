/**
 * engineApi.js — Client for the CalPow terrain-physics routing engine.
 *
 * Calls POST /route/auto on the Python FastAPI service (engine/api/app.py).
 * The engine automatically fetches live wind (Open-Meteo) and avalanche
 * danger (AFP) for the route midpoint, fuses them with the precomputed
 * Tier-A cost surface, and returns the least-cost path.
 *
 * Configure the engine URL with VITE_ENGINE_URL (defaults to localhost:8000).
 *
 * Architecture note (corpus §0.5 / §6.5):
 *   - The engine is the only place Tier-A and Tier-B data are fused.
 *   - The frontend never touches the cost rasters directly.
 *   - The returned route is always annotated with a disclaimer that MUST be
 *     displayed to the user before or alongside the route result.
 */

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:8000'

/**
 * Find the least-cost route between two points using the terrain-physics engine.
 *
 * @param {[number, number]} start  [longitude, latitude] WGS84
 * @param {[number, number]} end    [longitude, latitude] WGS84
 * @returns {Promise<EngineRouteResult>}
 */
export async function findEngineRoute(start, end) {
  const res = await fetch(`${ENGINE_URL}/route/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start, end }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `Engine error ${res.status}`)
  }

  return res.json()
}

/**
 * Health check — true if the engine is reachable and tiles are loaded.
 * @returns {Promise<boolean>}
 */
export async function checkEngineHealth() {
  try {
    const res = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
