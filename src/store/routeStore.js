import { create } from 'zustand'

/**
 * Waypoint tuple: [lng, lat, elevation, mode?]
 * - lng: longitude (number)
 * - lat: latitude (number)
 * - elevation: meters (number, from queryTerrainElevation or GPX)
 * - mode: 'skin' | 'descent' (optional, defaults to 'skin')
 * @typedef {[number, number, number, string?]} Waypoint
 */

/**
 * Segment from danger analysis (shape for consumers; full type in dangerAnalysis.js)
 * @typedef {{ severity: string }} DangerSegment
 */

/**
 * Route risk summary (shape from calcRouteRiskScore)
 * @typedef {{ label: string, color: string }} RouteRisk
 */

/**
 * @typedef {Object} RouteState
 * @property {Waypoint[]} waypoints
 * @property {boolean} buildingMode
 * @property {object | null} forecast
 * @property {DangerSegment[]} dangerSegments
 * @property {RouteRisk | null} routeRisk
 */

/**
 * @typedef {Object} RouteActions
 * @property {(wp: Waypoint) => void} addWaypoint
 * @property {() => void} undoWaypoint
 * @property {() => void} clearRoute
 * @property {(wps: Waypoint[] | null | undefined) => void} setWaypoints
 * @property {(on: boolean) => void} setBuildingMode
 * @property {(forecast: object | null) => void} setForecast
 * @property {(segments: DangerSegment[] | null | undefined) => void} setDangerSegments
 * @property {(r: RouteRisk | null) => void} setRouteRisk
 */

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<RouteState & RouteActions>>} */
export const useRouteStore = create((set) => ({
  waypoints: [],
  buildingMode: false,
  routeMode: 'skin',
  forecast: null,
  dangerSegments: [],
  routeRisk: null,
  pendingBounds: null,

  addWaypoint: (wp) => {
    console.log('addWaypoint called:', wp)
    const waypoint = Array.isArray(wp) && wp.length >= 3
      ? [wp[0], wp[1], wp[2], wp[3] ?? 'skin']
      : wp
    set((state) => ({ waypoints: [...state.waypoints, waypoint] }))
  },

  setBuildingMode: (v) => set({ buildingMode: Boolean(v) }),

  setRouteMode: (m) => set({ routeMode: m }),

  clearWaypoints: () =>
    set({ waypoints: [], dangerSegments: [], routeRisk: null }),

  removeLastWaypoint: () =>
    set((state) => ({ waypoints: state.waypoints.slice(0, -1) })),

  setWaypoints: (wps) =>
    set({
      waypoints: Array.isArray(wps)
        ? wps.map((wp) => (Array.isArray(wp) && wp.length >= 3 ? [wp[0], wp[1], wp[2], wp[3] ?? 'skin'] : wp))
        : [],
    }),

  setForecast: (forecast) =>
    set({ forecast: forecast ?? null }),

  setDangerSegments: (segments) =>
    set({
      dangerSegments: Array.isArray(segments) ? [...segments] : [],
    }),

  setRouteRisk: (r) =>
    set({ routeRisk: r ?? null }),

  setPendingBounds: (b) => set({ pendingBounds: b }),
  clearPendingBounds: () => set({ pendingBounds: null }),

  // Aliases for backwards compatibility
  undoWaypoint: () =>
    set((state) => ({ waypoints: state.waypoints.slice(0, -1) })),
  clearRoute: () =>
    set({ waypoints: [], dangerSegments: [], routeRisk: null }),
}))
