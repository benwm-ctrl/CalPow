import { create } from 'zustand'

/**
 * Waypoint: [lng, lat, elevation]
 * elevation in meters (from queryTerrainElevation or GPX)
 */
export const useRouteStore = create((set) => ({
  waypoints: [],
  buildingMode: false,
  forecast: null,
  dangerSegments: [],

  addWaypoint: (wp) =>
    set((state) => ({ waypoints: [...state.waypoints, wp] })),

  undoWaypoint: () =>
    set((state) => ({
      waypoints: state.waypoints.length > 0 ? state.waypoints.slice(0, -1) : [],
    })),

  clearRoute: () => set({ waypoints: [], dangerSegments: [] }),

  setWaypoints: (wps) => set({ waypoints: wps ?? [] }),

  setBuildingMode: (on) => set({ buildingMode: on }),

  setForecast: (forecast) => set({ forecast }),

  setDangerSegments: (segments) => set({ dangerSegments: segments ?? [] }),
}))
