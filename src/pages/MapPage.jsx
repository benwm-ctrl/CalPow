import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBox } from '@mapbox/search-js-react'
import { useRouteStore } from '../store/routeStore'
import LayerTogglePanel from '../components/LayerTogglePanel'
import RouteBuilder from '../components/RouteBuilder'
import ElevationProfile from '../components/ElevationProfile'
import { fetchForecast, FALLBACK_URLS } from '../services/avalancheForecast'

const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'
const TOPO_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

const REGIONS = {
  sierra: { center: [-119.5, 38.5], zoom: 8 },
  shasta: { center: [-122.2, 41.4], zoom: 10 },
  bridgeport: { center: [-119.3, 38.3], zoom: 9 },
  eastern_sierra: { center: [-118.9, 37.6], zoom: 8 },
}

function addTerrainAndSky(map) {
  if (!map) return
  try {
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
      })
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 })
    if (!map.getLayer('sky')) {
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      })
    }
  } catch (e) {
    console.warn('CalPow: addTerrainAndSky', e)
  }
}

function slopeColor(angle) {
  if (angle < 30) return '#38A169'
  if (angle < 35) return '#D69E2E'
  if (angle < 45) return '#DD6B20'
  return '#E53E3E'
}

function slopeSubLabel(angle) {
  if (angle < 30) return 'Low avalanche terrain'
  if (angle < 35) return 'Avalanche terrain begins'
  if (angle < 45) return 'Prime avalanche terrain'
  return 'Extreme terrain'
}

function tempColor(temp) {
  if (temp == null) return '#A0AEC0'
  if (temp < 32) return '#63B3ED'
  if (temp < 45) return '#68D391'
  return '#FC8181'
}

export default function MapPage() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const routeInitialized = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [currentStyle, setCurrentStyle] = useState('satellite')
  const [currentRegion, setCurrentRegion] = useState('sierra')
  const [searchValue, setSearchValue] = useState('')
  const [terrainPopup, setTerrainPopup] = useState(null)
  const waypoints = useRouteStore((s) => s.waypoints)
  const setForecast = useRouteStore((s) => s.setForecast)
  const [mapRegionForecast, setMapRegionForecast] = useState(null)
  const POPUP_WIDTH = 220
  const POPUP_HEIGHT = 280
  const MARGIN = 12

  useEffect(() => {
    let cancelled = false
    setMapRegionForecast(null)
    fetchForecast(currentRegion).then((forecast) => {
      if (!cancelled) {
        setForecast(forecast)
        setMapRegionForecast(forecast)
      }
    })
    return () => { cancelled = true }
  }, [currentRegion, setForecast])

  const handleRightClick = useCallback(async (e) => {
    e.preventDefault()
    const map = mapRef.current
    if (!map) return
    const { lng, lat } = e.lngLat
    const { x, y } = e.point

    setTerrainPopup({ lng, lat, x, y, loading: true })

    const offset = 0.0005
    const aspectDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

    let slopeAngle = 0
    let aspect = '—'
    try {
      const elevCenter = map.queryTerrainElevation([lng, lat], { exaggerated: false }) ?? 0
      const elevNorth = map.queryTerrainElevation([lng, lat + offset], { exaggerated: false }) ?? 0
      const elevSouth = map.queryTerrainElevation([lng, lat - offset], { exaggerated: false }) ?? 0
      const elevEast = map.queryTerrainElevation([lng + offset, lat], { exaggerated: false }) ?? 0
      const elevWest = map.queryTerrainElevation([lng - offset, lat], { exaggerated: false }) ?? 0

      const dzdx = (elevEast - elevWest) / (2 * offset * 111000)
      const dzdy = (elevNorth - elevSouth) / (2 * offset * 111000)

      slopeAngle = Math.atan(Math.sqrt(dzdx ** 2 + dzdy ** 2)) * (180 / Math.PI)

      const aspectRad = Math.atan2(-dzdx, -dzdy)
      const aspectAngle = (aspectRad * (180 / Math.PI) + 360) % 360
      aspect = aspectDirs[Math.round(aspectAngle / 45) % 8]

      console.log('elevCenter:', elevCenter)
      console.log('elevNorth:', elevNorth)
      console.log('elevSouth:', elevSouth)
      console.log('elevEast:', elevEast)
      console.log('elevWest:', elevWest)
      console.log('dzdx:', dzdx)
      console.log('dzdy:', dzdy)
      console.log('aspectAngle:', aspectAngle)
      console.log('aspect:', aspect)
    } catch (err) {
      console.warn('Terrain elevation query failed', err)
    }

    let wind = null
    let temp = null
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`
      )
      const data = await res.json()
      wind = {
        speed: data.current.wind_speed_10m,
        direction: data.current.wind_direction_10m,
        label: aspectDirs[Math.round(data.current.wind_direction_10m / 45) % 8],
      }
      temp = data.current.temperature_2m
    } catch (err) {
      console.warn('Weather fetch failed', err)
    }

    setTerrainPopup({ lng, lat, x, y, loading: false, wind, temp, slopeAngle, aspect })
  }, [])

  const initRouteLayer = useCallback(() => {
    const map = mapRef.current
    if (!map || routeInitialized.current) return
    try {
      if (!map.getSource('route-line')) {
        map.addSource('route-line', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-line-glow',
          type: 'line',
          source: 'route-line',
          paint: {
            'line-color': '#ffffff',
            'line-width': 6,
            'line-blur': 4,
            'line-opacity': 0.3,
          },
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
          },
        })
      }
      if (!map.getSource('route-points')) {
        map.addSource('route-points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-points',
          type: 'circle',
          source: 'route-points',
          paint: {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#3B8BEB',
          },
        })
      }
      routeInitialized.current = true
    } catch (e) {
      console.warn('initRouteLayer:', e)
    }
  }, [])

  const setMapStyle = useCallback((styleUrl, styleKey) => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(styleUrl)
    map.once('style.load', () => {
      addTerrainAndSky(map)
      setCurrentStyle(styleKey)
    })
  }, [])

  const flyToRegion = useCallback((regionKey) => {
    const map = mapRef.current
    const config = REGIONS[regionKey]
    if (!map || !config) return
    map.flyTo({ center: config.center, zoom: config.zoom })
    setCurrentRegion(regionKey)
  }, [])

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token || !mapContainerRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: SATELLITE_STYLE,
      center: [-119.5, 38.5],
      zoom: 8,
      pitch: 60,
      bearing: 0,
    })

    mapRef.current = map

    const crashGuard = setInterval(() => {
      if (!mapRef.current) clearInterval(crashGuard)
    }, 1000)

    map.on('load', () => {
      addTerrainAndSky(map)
      initRouteLayer()
      setMapReady(true)
    })

    map.on('contextmenu', handleRightClick)
    map.on('click', () => setTerrainPopup(null))

    map.on('style.load', () => {
      routeInitialized.current = false
      addTerrainAndSky(map)
      initRouteLayer()
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    return () => {
      clearInterval(crashGuard)
      map.remove()
      mapRef.current = null
    }
  }, [initRouteLayer, handleRightClick])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeInitialized.current) return

    const lineData =
      waypoints.length >= 2
        ? {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: waypoints.map(([lng, lat]) => [lng, lat]),
            },
          }
        : { type: 'FeatureCollection', features: [] }

    const pointData = {
      type: 'FeatureCollection',
      features: waypoints.map(([lng, lat], i) => ({
        type: 'Feature',
        properties: { id: i },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })),
    }

    try {
      map.getSource('route-line')?.setData(lineData)
      map.getSource('route-points')?.setData(pointData)
    } catch (e) {
      console.warn('route setData:', e)
    }
  }, [waypoints])

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height: 'calc(100vh - 3.5rem)' }}
        aria-label="Map"
      />

      {/* Region selector — top-left */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
        {[
          { key: 'sierra', label: 'Sierra' },
          { key: 'shasta', label: 'Shasta' },
          { key: 'bridgeport', label: 'Bridgeport' },
          { key: 'eastern_sierra', label: 'Eastern Sierra' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => flyToRegion(key)}
            className="px-3 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: currentRegion === key ? '#3B8BEB' : '#1E2D3D',
              color: currentRegion === key ? '#F7FAFC' : '#A0AEC0',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Avalanche danger for current region */}
      {mapReady && (mapRegionForecast || currentRegion) && (
        <div
          className="absolute left-4 z-10 mt-2 rounded-lg border px-3 py-2 shadow-lg flex items-center gap-2 flex-wrap"
          style={{
            top: 56,
            backgroundColor: '#1E2D3D',
            borderColor: '#2D3748',
          }}
        >
          <span className="text-xs text-text-secondary">Avalanche danger</span>
          {mapRegionForecast ? (
            <>
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: mapRegionForecast.color }}
              >
                {mapRegionForecast.danger_level != null
                  ? `${mapRegionForecast.danger_level} - ${mapRegionForecast.danger_label}`
                  : mapRegionForecast.danger_label}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">Live</span>
              <a
                href={mapRegionForecast.forecast_url || FALLBACK_URLS[currentRegion]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium ml-1"
                style={{ color: '#3B8BEB' }}
              >
                Full forecast ↗
              </a>
            </>
          ) : (
            <span className="text-xs text-text-muted">Loading…</span>
          )}
        </div>
      )}

      {/* Layer toggle + route UI */}
      {mapReady && (
        <>
          <div
            className="absolute top-4 z-10"
            style={{ right: '220px', width: '280px' }}
          >
            {mapRef.current && (
              <SearchBox
                accessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                map={mapRef.current}
                mapboxgl={mapboxgl}
                value={searchValue}
                onChange={(v) => setSearchValue(v)}
                onRetrieve={(res) => {
                  const feat = res.features?.[0]
                  if (feat?.geometry?.coordinates) {
                    const [lng, lat] = feat.geometry.coordinates
                    mapRef.current?.flyTo({ center: [lng, lat], zoom: 13 })
                  }
                }}
                theme={{
                  variables: {
                    colorBackground: '#1E2D3D',
                    colorBackgroundHover: '#243447',
                    colorText: '#F7FAFC',
                    colorTextSecondary: '#A0AEC0',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  },
                }}
              />
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <LayerTogglePanel
              currentStyle={currentStyle}
              onStyleChange={setMapStyle}
              satelliteStyleUrl={SATELLITE_STYLE}
              topoStyleUrl={TOPO_STYLE}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <RouteBuilder mapRef={mapRef} />
          </motion.div>
        </>
      )}

      <ElevationProfile />

      {/* Terrain analysis popup */}
      {terrainPopup && (() => {
        const mapEl = mapContainerRef.current
        const mapWidth = mapEl?.offsetWidth ?? window.innerWidth
        const mapHeight = mapEl?.offsetHeight ?? window.innerHeight
        let popupX = terrainPopup.x - POPUP_WIDTH / 2
        let popupY = terrainPopup.y - POPUP_HEIGHT - 16
        if (popupX < MARGIN) popupX = MARGIN
        if (popupX + POPUP_WIDTH > mapWidth - MARGIN) popupX = mapWidth - POPUP_WIDTH - MARGIN
        if (popupY < MARGIN) popupY = terrainPopup.y + 24
        if (popupY + POPUP_HEIGHT > mapHeight - MARGIN) popupY = mapHeight - POPUP_HEIGHT - MARGIN
        return (
        <div
          style={{
            position: 'absolute',
            left: popupX,
            top: popupY,
            transform: 'none',
            zIndex: 20,
            pointerEvents: 'auto',
            background: 'rgba(15,25,35,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(59,139,235,0.4)',
            borderRadius: '12px',
            padding: '16px',
            minWidth: '220px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
          className="relative"
        >
          {/* Triangle pointer */}
          <div
            style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid rgba(15,25,35,0.95)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-9px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '9px solid transparent',
              borderRight: '9px solid transparent',
              borderTop: '9px solid rgba(59,139,235,0.4)',
            }}
          />

          {terrainPopup.loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="w-8 h-8 border-2 border-white border-t-[#3B8BEB] rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">Analyzing terrain...</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setTerrainPopup(null)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-text-secondary hover:text-white hover:bg-white/10 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
              <div className="text-[11px] font-medium uppercase tracking-wider pr-6" style={{ color: '#3B8BEB' }}>
                Terrain Analysis
              </div>
              <div className="text-[11px] text-text-secondary mt-1">
                {terrainPopup.lat.toFixed(4)}, {terrainPopup.lng.toFixed(4)}
              </div>
              <div className="border-t border-white/10 my-3" />

              {/* Slope */}
              <div className="mb-3">
                <div className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span>⛰️</span> Slope Angle
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: slopeColor(terrainPopup.slopeAngle ?? 0) }}>
                  {(terrainPopup.slopeAngle ?? 0).toFixed(1)}°
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  {slopeSubLabel(terrainPopup.slopeAngle ?? 0)}
                </div>
              </div>

              {/* Aspect */}
              <div className="mb-3">
                <div className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span>🧭</span> Aspect: <span className="text-white font-medium">{terrainPopup.aspect ?? '—'}</span>
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  North-facing slopes hold weak layers longest
                </div>
              </div>

              {/* Wind */}
              <div className="mb-3">
                <div className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span>💨</span> Wind
                </div>
                <div className="text-sm text-white mt-0.5">
                  {terrainPopup.wind
                    ? `${terrainPopup.wind.speed} mph from ${terrainPopup.wind.label}`
                    : 'Unavailable'}
                </div>
                {terrainPopup.wind?.speed > 25 && (
                  <div className="text-[11px] text-orange-400 mt-0.5">⚠️ Wind loading likely</div>
                )}
              </div>

              {/* Temperature */}
              <div>
                <div className="text-xs text-text-secondary flex items-center gap-1.5">
                  <span>🌡️</span> Temperature
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: tempColor(terrainPopup.temp) }}>
                  {terrainPopup.temp != null ? `${terrainPopup.temp}°F` : 'Unavailable'}
                </div>
                {terrainPopup.temp != null && terrainPopup.temp > 45 && (
                  <div className="text-[11px] text-orange-400 mt-0.5">⚠️ Wet avalanche risk</div>
                )}
              </div>
            </>
          )}
        </div>
        )
      })()}

      {/* Dark theme overrides for Mapbox controls */}
      <style>{`
        .mapboxgl-ctrl-group {
          background-color: #1E2D3D !important;
          border: 1px solid #2D3748 !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .mapboxgl-ctrl-group button {
          background-color: #1E2D3D !important;
          color: #F7FAFC !important;
          width: 36px !important;
          height: 36px !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background-color: #243447 !important;
        }
        .mapboxgl-ctrl-group button + button {
          border-top: 1px solid #2D3748 !important;
        }
      `}</style>
    </div>
  )
}
