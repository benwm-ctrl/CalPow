import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SearchBox } from '@mapbox/search-js-react'
import { useRouteStore } from '../store/routeStore'
import LayerTogglePanel from '../components/LayerTogglePanel'
import RouteBuilder from '../components/RouteBuilder'
import ElevationProfile from '../components/ElevationProfile'
import DangerSummary from '../components/DangerSummary'
import AspectElevationRose from '../components/AspectElevationRose'
import { fetchForecast, FALLBACK_URLS } from '../services/avalancheForecast'
import { fetchWindGrid } from '../services/windService'
import { analyzeSegments, calcRouteRiskScore, calcHazardExposure } from '../utils/dangerAnalysis'

const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'
const TOPO_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

const WIND_MIN_ZOOM = 10 // match terrain layers (raster minzoom)

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const REGIONS = {
  sierra: { center: [-119.5, 38.5], zoom: 8 },
  shasta: { center: [-122.2, 41.4], zoom: 10 },
  bridgeport: { center: [-119.3, 38.3], zoom: 9 },
  eastern_sierra: { center: [-118.9, 37.6], zoom: 8 },
}

const TERRAIN_TILESETS = {
  slope: 'benwm.calpow_slope_califo_r',
  aspect: 'benwm.calpow_aspec_califo_r',
  tri: 'benwm.calpow_tri_califo_r',
  composite: 'benwm.calpow_compo_califo_r',
}

// Color ramps for each layer type
const LAYER_COLORS = {
  slope: [
    0, '#2ecc71', // 0°   flat - green
    106, '#f1c40f', // 25°  watch - yellow
    127, '#e67e22', // 30°  avalanche terrain - orange
    148, '#e74c3c', // 35°  high consequence - red
    191, '#8e44ad', // 45°+ extreme - purple
    255, '#1a1a2e', // 60°  cliff - near black
  ],
  aspect: [
    0, '#2980b9', // N   blue
    32, '#1abc9c', // NE  teal
    64, '#27ae60', // E   green
    96, '#f39c12', // SE  yellow
    128, '#e74c3c', // S   red
    160, '#e91e63', // SW  pink
    192, '#9b59b6', // W   purple
    224, '#3498db', // NW  light blue
    255, '#2980b9', // N   blue
  ],
  tri: [
    0, '#f7fbff',
    64, '#c6dbef',
    128, '#6baed6',
    192, '#2171b5',
    255, '#08306b',
  ],
  composite: [
    0, '#2ecc71', // low risk green
    64, '#f1c40f', // moderate yellow
    128, '#e67e22', // considerable orange
    192, '#e74c3c', // high red
    255, '#8e44ad', // extreme purple
  ],
}

const LAYER_LEGENDS = {
  slope: {
    title: 'Slope Angle',
    unit: 'degrees',
    stops: [
      { color: '#2ecc71', label: '< 25°  Safe' },
      { color: '#f1c40f', label: '25-30°  Watch' },
      { color: '#e67e22', label: '30-35°  Avalanche terrain' },
      { color: '#e74c3c', label: '35-45°  High consequence' },
      { color: '#8e44ad', label: '45°+   Extreme' },
    ],
  },
  aspect: {
    title: 'Slope Aspect',
    unit: 'direction',
    stops: [
      { color: '#2980b9', label: 'North' },
      { color: '#1abc9c', label: 'NE' },
      { color: '#27ae60', label: 'East' },
      { color: '#f39c12', label: 'SE' },
      { color: '#e74c3c', label: 'South' },
      { color: '#e91e63', label: 'SW' },
      { color: '#9b59b6', label: 'West' },
      { color: '#3498db', label: 'NW' },
    ],
  },
  tri: {
    title: 'Terrain Ruggedness',
    unit: 'TRI index',
    stops: [
      { color: '#f7fbff', label: 'Smooth' },
      { color: '#6baed6', label: 'Moderate' },
      { color: '#08306b', label: 'Very rugged' },
    ],
  },
  composite: {
    title: 'Composite Risk',
    unit: 'risk score',
    stops: [
      { color: '#2ecc71', label: 'Low risk' },
      { color: '#f1c40f', label: 'Moderate' },
      { color: '#e67e22', label: 'Considerable' },
      { color: '#e74c3c', label: 'High' },
      { color: '#8e44ad', label: 'Extreme' },
    ],
  },
}

function buildColorExpression(stops) {
  // Builds a Mapbox raster-color interpolate expression
  // stops = [value, color, value, color, ...]
  const pairs = []
  for (let i = 0; i < stops.length; i += 2) {
    pairs.push(stops[i] / 255) // normalize to 0-1
    pairs.push(stops[i + 1])
  }
  return ['interpolate', ['linear'], ['raster-value'], ...pairs]
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
  const [showPanHint, setShowPanHint] = useState(true)
  const panHintDismissedRef = useRef(false)
  const [searchValue, setSearchValue] = useState('')
  const [terrainPopup, setTerrainPopup] = useState(null)
  const [selectedDangerSeg, setSelectedDangerSeg] = useState(null)
  const waypoints = useRouteStore((s) => s.waypoints)
  const setStoreForecast = useRouteStore((s) => s.setForecast)
  const dangerSegments = useRouteStore((s) => s.dangerSegments)
  const setDangerSegments = useRouteStore((s) => s.setDangerSegments)
  const routeRisk = useRouteStore((s) => s.routeRisk)
  const setRouteRisk = useRouteStore((s) => s.setRouteRisk)
  const pendingBounds = useRouteStore((s) => s.pendingBounds)
  const clearPendingBounds = useRouteStore((s) => s.clearPendingBounds)
  const [mapRegionForecast, setMapRegionForecast] = useState(null)
  const [detailedForecast, setDetailedForecast] = useState(null)
  const [hazardExposure, setHazardExposure] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [activeLayers, setActiveLayers] = useState([])
  const [windEnabled, setWindEnabled] = useState(false)
  const [windData, setWindData] = useState([])
  const [windLoading, setWindLoading] = useState(false)
  const [windElevation, setWindElevation] = useState('10m') // '10m' | '80m'
  const [windError, setWindError] = useState(false) // show "Wind data unavailable" toast
  const [precipRadarEnabled, setPrecipRadarEnabled] = useState(false)
  const [precipRadarLoading, setPrecipRadarLoading] = useState(false)
  const [precipRadarPath, setPrecipRadarPath] = useState(null) // RainViewer tile path, updated ~10min
  const [snowDepthEnabled, setSnowDepthEnabled] = useState(false)
  const [snowDepthUnavailable, setSnowDepthUnavailable] = useState(false)
  const windCanvasRef = useRef(null)
  const windCancelRef = useRef(false)
  const windDataRef = useRef([])
  const windElevationRef = useRef('10m')
  const [mapZoom, setMapZoom] = useState(8)
  const [slopeLegendCollapsed, setSlopeLegendCollapsed] = useState(() => {
    try {
      return localStorage.getItem('calpow_slope_legend_collapsed') === 'true'
    } catch {
      return false
    }
  })
  const POPUP_WIDTH = 220
  const POPUP_HEIGHT = 280
  const MARGIN = 12

  useEffect(() => {
    let cancelled = false
    setMapRegionForecast(null)
    fetchForecast(currentRegion).then((f) => {
      if (!cancelled) {
        setStoreForecast(f)
        setMapRegionForecast(f)
        setForecast(f)
        console.log('forecast stored in routeStore:', f)
        console.log('Full forecast data:', JSON.stringify(f, null, 2))
      }
    })
    return () => { cancelled = true }
  }, [currentRegion, setStoreForecast])

  useEffect(() => {
    let cancelled = false
    setDetailedForecast(null)
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    fetch(`${base}/api/forecast-proxy-sac?region=${currentRegion}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDetailedForecast(data)
      })
      .catch((err) => {
        if (!cancelled) console.warn('Detailed forecast fetch failed:', err)
      })
    return () => { cancelled = true }
  }, [currentRegion])

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
      if (!map.getSource('route-skin')) {
        map.addSource('route-skin', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-skin',
          type: 'line',
          source: 'route-skin',
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
          },
        })
      }
      if (!map.getSource('route-descent')) {
        map.addSource('route-descent', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-descent',
          type: 'line',
          source: 'route-descent',
          paint: {
            'line-color': '#A78BFA',
            'line-width': 3,
            'line-dasharray': [3, 2],
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
            'circle-radius': 4,
            'circle-color': [
              'match',
              ['get', 'mode'],
              'descent', '#A78BFA',
              '#ffffff',
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': [
              'match',
              ['get', 'mode'],
              'descent', '#7C3AED',
              '#3B8BEB',
            ],
          },
        })
      }
      // Danger overlay layers — render on top
      if (!map.getSource('route-caution')) {
        map.addSource('route-caution', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-caution',
          type: 'line',
          source: 'route-caution',
          paint: {
            'line-color': '#DD6B20',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      }
      if (!map.getSource('route-dangerous')) {
        map.addSource('route-dangerous', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-dangerous',
          type: 'line',
          source: 'route-dangerous',
          paint: {
            'line-color': '#E53E3E',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        })
      }
      if (!map.getSource('route-extreme')) {
        map.addSource('route-extreme', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'route-extreme',
          type: 'line',
          source: 'route-extreme',
          paint: {
            'line-color': '#FF0000',
            'line-width': 5,
            'line-opacity': 1,
            'line-dasharray': [1, 0],
          },
        })
      }
      routeInitialized.current = true
    } catch (e) {
      console.warn('initRouteLayer:', e)
    }
  }, [])

  const applyRouteDataToMap = useCallback((map, waypoints, forecast) => {
    if (!map || !routeInitialized.current) return
    if (!waypoints || waypoints.length < 2) {
      map.getSource('route-skin')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-descent')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-caution')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-dangerous')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-extreme')?.setData({ type: 'FeatureCollection', features: [] })
      setDangerSegments([])
      setRouteRisk(null)
      setHazardExposure('0.00')

      // Still render the single waypoint dot
      map.getSource('route-points')?.setData({
        type: 'FeatureCollection',
        features: (waypoints ?? []).map((wp, i) => ({
          type: 'Feature',
          properties: { id: i, mode: wp[3] ?? 'skin' },
          geometry: { type: 'Point', coordinates: [wp[0], wp[1]] },
        })),
      })
      return
    }
    // Each segment's mode = the mode of its endpoint (wp[i+1])
    // First segment = mode of wp[0]
    const skinCoords = []
    const descentCoords = []

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i]
      const p2 = waypoints[i + 1]
      // Segment mode = destination waypoint's mode (first segment uses wp[0])
      const segMode = i === 0 ? (p1[3] ?? 'skin') : (p2[3] ?? 'skin')
      const coords = [[p1[0], p1[1]], [p2[0], p2[1]]]
      const feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      }
      if (segMode === 'descent') {
        descentCoords.push(feature)
      } else {
        skinCoords.push(feature)
      }
    }

    map.getSource('route-skin')?.setData({
      type: 'FeatureCollection',
      features: skinCoords,
    })
    map.getSource('route-descent')?.setData({
      type: 'FeatureCollection',
      features: descentCoords,
    })

    // Waypoint dots — all waypoints including first
    map.getSource('route-points')?.setData({
      type: 'FeatureCollection',
      features: waypoints.map((wp, i) => ({
        type: 'Feature',
        properties: { id: i, mode: wp[3] ?? 'skin' },
        geometry: { type: 'Point', coordinates: [wp[0], wp[1]] },
      })),
    })
    const analysisSegments = analyzeSegments(waypoints, forecast)
    const cautionFeatures = []
    const dangerousFeatures = []
    const extremeFeatures = []
    analysisSegments.forEach((seg) => {
      const feature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [seg.p1[0], seg.p1[1]],
            [seg.p2[0], seg.p2[1]],
          ],
        },
      }
      if (seg.severity === 'caution') cautionFeatures.push(feature)
      if (seg.severity === 'dangerous') dangerousFeatures.push(feature)
      if (seg.severity === 'extreme') extremeFeatures.push(feature)
    })
    map.getSource('route-caution')?.setData({
      type: 'FeatureCollection',
      features: cautionFeatures,
    })
    map.getSource('route-dangerous')?.setData({
      type: 'FeatureCollection',
      features: dangerousFeatures,
    })
    map.getSource('route-extreme')?.setData({
      type: 'FeatureCollection',
      features: extremeFeatures,
    })
    setDangerSegments(analysisSegments)
    setRouteRisk(calcRouteRiskScore(analysisSegments))
    setHazardExposure(calcHazardExposure(analysisSegments))
  }, [setDangerSegments, setRouteRisk])

  const setMapStyle = useCallback((styleUrl, styleKey) => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(styleUrl)
    map.once('style.load', () => {
      routeInitialized.current = false
      addTerrainAndSky(map)
      initRouteLayer()
      const { waypoints: wp, forecast: fc } = useRouteStore.getState()
      applyRouteDataToMap(map, wp, fc)
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

    map.on('style.load', () => {
      // Re-create route sources after style change to avoid "Source not found"
      routeInitialized.current = false
      addTerrainAndSky(map)
      initRouteLayer()
      const { waypoints: wp, forecast: fc } = useRouteStore.getState()
      applyRouteDataToMap(map, wp, fc)
    })

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    return () => {
      clearInterval(crashGuard)
      map.remove()
      mapRef.current = null
    }
  }, [initRouteLayer, handleRightClick])

  useEffect(() => {
    const m = mapRef.current
    if (!mapReady || !m) return
    const closePopup = () => setTerrainPopup(null)
    const closeDangerPopup = () => setSelectedDangerSeg(null)
    m.on('contextmenu', closePopup)
    m.on('click', closeDangerPopup)
    return () => {
      m.off('contextmenu', closePopup)
      m.off('click', closeDangerPopup)
    }
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return

    let draggingIndex = null

    const onMouseDown = (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['route-points'],
      })
      if (!features.length) return

      draggingIndex = features[0].properties.id
      map.getCanvas().style.cursor = 'grabbing'

      map.dragPan.disable()
      e.preventDefault()
    }

    const onMouseMove = (e) => {
      if (draggingIndex === null) return
      const { lng, lat } = e.lngLat
      let elevation = 0
      try {
        const elev = map.queryTerrainElevation([lng, lat], { exaggerated: false })
        if (typeof elev === 'number' && !Number.isNaN(elev)) elevation = Math.round(elev)
      } catch (_) {}

      const { waypoints } = useRouteStore.getState()
      const updated = [...waypoints]
      updated[draggingIndex] = [lng, lat, elevation, updated[draggingIndex][3] ?? 'skin']
      useRouteStore.getState().setWaypoints(updated)
    }

    const onMouseUp = () => {
      if (draggingIndex === null) return
      draggingIndex = null
      map.getCanvas().style.cursor = ''
      map.dragPan.enable()
    }

    const onMouseEnterPoint = () => {
      if (draggingIndex === null) {
        map.getCanvas().style.cursor = 'grab'
      }
    }
    const onMouseLeavePoint = () => {
      if (draggingIndex === null) {
        map.getCanvas().style.cursor = ''
      }
    }

    map.on('mousedown', 'route-points', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.on('mouseenter', 'route-points', onMouseEnterPoint)
    map.on('mouseleave', 'route-points', onMouseLeavePoint)

    return () => {
      map.off('mousedown', 'route-points', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      map.off('mouseenter', 'route-points', onMouseEnterPoint)
      map.off('mouseleave', 'route-points', onMouseLeavePoint)
    }
  }, [mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const LAYER_TYPES = ['slope', 'aspect', 'tri', 'composite']

    LAYER_TYPES.forEach((layerType) => {
      const isActive = activeLayers.includes(layerType)
      const sourceId = `terrain-${layerType}`
      const layerId = `terrain-layer-${layerType}`
      const tilesetId = TERRAIN_TILESETS[layerType]

      if (isActive) {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [
              `https://a.tiles.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.jpg?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`,
              `https://b.tiles.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.jpg?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`,
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 13,
          })
        }
        if (!map.getLayer(layerId)) {
          map.addLayer(
            {
              id: layerId,
              type: 'raster',
              source: sourceId,
              minzoom: 10,
              maxzoom: 22,
              paint: {
                'raster-opacity': 0.75,
              },
            },
            'route-skin'
          )
        }
      } else {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      }
    })
  }, [activeLayers, mapReady])

  // RainViewer precip radar: fetch latest tile path (no API key)
  const fetchRainViewerPath = useCallback(async () => {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    const data = await res.json()
    // nowcast[0] is the most current live frame
    const nowcast = data?.radar?.nowcast
    if (Array.isArray(nowcast) && nowcast.length > 0) {
      return nowcast[0].path
    }
    // fallback to latest past frame
    const past = data?.radar?.past
    if (Array.isArray(past) && past.length > 0) {
      return past[past.length - 1].path
    }
    return null
  }, [])

  // Precip radar layer: add/remove source + layer below route/terrain (beforeId: 'route-skin')
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const sourceId = 'precip-radar'
    const layerId = 'precip-radar-layer'

    if (!precipRadarEnabled || !precipRadarPath) {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      return
    }

    if (map.getSource(sourceId)) {
      map.removeLayer(layerId)
      map.removeSource(sourceId)
    }
    const tileUrl = `https://tilecache.rainviewer.com${precipRadarPath}/256/{z}/{x}/{y}/2/1_1.png`
    map.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 7,
      attribution: 'RainViewer',
    })
    map.addLayer(
      {
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.65,
          'raster-resampling': 'linear',
        },
      },
      'route-skin'
    )

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [mapReady, precipRadarEnabled, precipRadarPath])

  // Snow depth (NOHRSC) raster — dynamic export, no API key; insert below precip-radar-layer if present
  const NOHRSC_SNOW_TILE_URL =
    'https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export' +
    '?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:0&f=image'
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const sourceId = 'snow-depth'
    const layerId = 'snow-depth-layer'

    if (!snowDepthEnabled) {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      return
    }

    if (map.getSource(sourceId)) {
      map.removeLayer(layerId)
      map.removeSource(sourceId)
    }

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [NOHRSC_SNOW_TILE_URL],
      tileSize: 256,
    })
    const layerOpts = {
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': 0.7,
        'raster-resampling': 'linear',
      },
    }
    if (map.getLayer('precip-radar-layer')) {
      map.addLayer(layerOpts, 'precip-radar-layer')
    } else {
      map.addLayer(layerOpts, 'route-skin')
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [mapReady, snowDepthEnabled])

  // Optional: probe NOHRSC when snow layer enabled; show brief toast if unavailable
  useEffect(() => {
    if (!snowDepthEnabled) {
      setSnowDepthUnavailable(false)
      return
    }
    let timeoutId
    const probeUrl =
      'https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export' +
      '?bbox=-13600000,4500000,-13500000,4600000&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:0&f=image'
    fetch(probeUrl)
      .then((r) => {
        if (!r.ok) throw new Error('NOHRSC probe failed')
      })
      .catch(() => {
        setSnowDepthUnavailable(true)
        timeoutId = setTimeout(() => setSnowDepthUnavailable(false), 4000)
      })
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [snowDepthEnabled])

  // On precip radar enable: fetch path once; then refresh every 10 min while enabled
  useEffect(() => {
    if (!precipRadarEnabled) return
    setPrecipRadarLoading(true)
    fetchRainViewerPath()
      .then((path) => {
        if (path) setPrecipRadarPath(path)
      })
      .finally(() => setPrecipRadarLoading(false))

    const interval = setInterval(() => {
      fetchRainViewerPath().then((path) => {
        if (path) setPrecipRadarPath(path)
      })
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [precipRadarEnabled, fetchRainViewerPath])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !pendingBounds) return
    const { minLng, maxLng, minLat, maxLat } = pendingBounds
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 100, duration: 1200, pitch: 60 }
    )
    clearPendingBounds()
  }, [mapReady, pendingBounds, clearPendingBounds])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeInitialized.current) return
    if (!waypoints || waypoints.length < 2) {
      map.getSource('route-skin')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-descent')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-caution')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-dangerous')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-extreme')?.setData({ type: 'FeatureCollection', features: [] })
      setDangerSegments([])
      setRouteRisk(null)
      setHazardExposure('0.00')

      // Still render the single waypoint dot
      map.getSource('route-points')?.setData({
        type: 'FeatureCollection',
        features: (waypoints ?? []).map((wp, i) => ({
          type: 'Feature',
          properties: { id: i, mode: wp[3] ?? 'skin' },
          geometry: { type: 'Point', coordinates: [wp[0], wp[1]] },
        })),
      })
      return
    }
    // Each segment's mode = the mode of its endpoint (wp[i+1])
    // First segment = mode of wp[0]
    const skinCoords = []
    const descentCoords = []

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i]
      const p2 = waypoints[i + 1]
      // Segment mode = destination waypoint's mode (first segment uses wp[0])
      const segMode = i === 0 ? (p1[3] ?? 'skin') : (p2[3] ?? 'skin')
      const coords = [[p1[0], p1[1]], [p2[0], p2[1]]]
      const feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      }
      if (segMode === 'descent') {
        descentCoords.push(feature)
      } else {
        skinCoords.push(feature)
      }
    }

    map.getSource('route-skin')?.setData({
      type: 'FeatureCollection',
      features: skinCoords,
    })
    map.getSource('route-descent')?.setData({
      type: 'FeatureCollection',
      features: descentCoords,
    })

    // Waypoint dots — all waypoints including first
    map.getSource('route-points')?.setData({
      type: 'FeatureCollection',
      features: waypoints.map((wp, i) => ({
        type: 'Feature',
        properties: { id: i, mode: wp[3] ?? 'skin' },
        geometry: { type: 'Point', coordinates: [wp[0], wp[1]] },
      })),
    })
    const analysisSegments = analyzeSegments(waypoints, forecast)
    const cautionFeatures = []
    const dangerousFeatures = []
    const extremeFeatures = []
    analysisSegments.forEach((seg) => {
      const feature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [seg.p1[0], seg.p1[1]],
            [seg.p2[0], seg.p2[1]],
          ],
        },
      }
      if (seg.severity === 'caution') cautionFeatures.push(feature)
      if (seg.severity === 'dangerous') dangerousFeatures.push(feature)
      if (seg.severity === 'extreme') extremeFeatures.push(feature)
    })
    map.getSource('route-caution')?.setData({
      type: 'FeatureCollection',
      features: cautionFeatures,
    })
    map.getSource('route-dangerous')?.setData({
      type: 'FeatureCollection',
      features: dangerousFeatures,
    })
    map.getSource('route-extreme')?.setData({
      type: 'FeatureCollection',
      features: extremeFeatures,
    })
    setDangerSegments(analysisSegments)
    setRouteRisk(calcRouteRiskScore(analysisSegments))
    setHazardExposure(calcHazardExposure(analysisSegments))
  }, [waypoints, forecast, setDangerSegments, setRouteRisk])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const hideHint = () => {
      if (panHintDismissedRef.current) return
      panHintDismissedRef.current = true
      setShowPanHint(false)
      map.off('mousedown', hideHint)
      map.off('click', hideHint)
      map.off('zoom', hideHint)
      map.off('zoomend', hideHint)
    }
    map.on('mousedown', hideHint)
    map.on('click', hideHint)
    map.on('zoom', hideHint)
    map.on('zoomend', hideHint)
    return () => {
      map.off('mousedown', hideHint)
      map.off('click', hideHint)
      map.off('zoom', hideHint)
      map.off('zoomend', hideHint)
    }
  }, [mapReady])

  // Fetch wind grid only (no temp). Wind fetch never passes tempMode.
  const fetchWindForMap = useCallback(() => {
    const map = mapRef.current
    if (!map || !windEnabled) return
    if (map.getZoom() < WIND_MIN_ZOOM) return
    windCancelRef.current = false
    setWindLoading(true)
    const bounds = map.getBounds()
    const zoom = map.getZoom()
    setWindError(false)
    fetchWindGrid(bounds, zoom)
      .then((data) => {
        if (!windCancelRef.current) setWindData(data)
      })
      .catch(() => {
        if (!windCancelRef.current) {
          setWindData([])
          setWindEnabled(false)
          setWindError(true)
          setTimeout(() => setWindError(false), 4000)
        }
      })
      .finally(() => {
        if (!windCancelRef.current) setWindLoading(false)
      })
  }, [windEnabled])

  useEffect(() => {
    if (!windEnabled) {
      setWindData([])
      windCancelRef.current = true
      return
    }
    const map = mapRef.current
    if (map && map.getZoom() >= WIND_MIN_ZOOM) fetchWindForMap()
  }, [windEnabled, fetchWindForMap])

  // Keep refs in sync for redrawWindCanvas (called on every move, no state closure)
  useEffect(() => {
    windDataRef.current = windData
    windElevationRef.current = windElevation
  }, [windData, windElevation])

  // Pure redraw: existing windData at current map.project() positions. No fetch.
  const redrawWindCanvas = useCallback(() => {
    const map = mapRef.current
    const canvas = windCanvasRef.current
    const container = mapContainerRef.current
    const data = windDataRef.current
    const use80 = windElevationRef.current === '80m'
    if (!map || !canvas || !container || !data.length) return

    const w = container.offsetWidth
    const h = container.offsetHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    function snapToCardinal(deg) {
      const dirs = [0, 45, 90, 135, 180, 225, 270, 315]
      const normalized = ((deg % 360) + 360) % 360
      return dirs.reduce((prev, curr) =>
        Math.abs(curr - normalized) < Math.abs(prev - normalized) ? curr : prev
      )
    }
    const directionColor = (deg) => {
      const snapped = snapToCardinal(deg)
      const colors = {
        0: '#60a5fa',    // N  — blue
        45: '#a78bfa',   // NE — purple
        90: '#34d399',   // E  — green
        135: '#fbbf24',  // SE — amber
        180: '#f87171',  // S  — red
        225: '#fb923c',  // SW — orange
        270: '#38bdf8',  // W  — sky
        315: '#e879f9',  // NW — pink
      }
      return colors[snapped]
    }
    // Cardinal degrees (met from) → screen angle in radians (0° = right in canvas, clockwise)
    const cardinalToScreenAngle = (cardinalDeg) => {
      const goDeg = (cardinalDeg + 180) % 360
      return ((goDeg - 90) * Math.PI) / 180
    }

    const arrowScale = (speed) => {
      if (speed <= 5) return 40
      if (speed <= 15) return 40 + ((speed - 5) * 30) / 10
      if (speed <= 25) return 70 + ((speed - 15) * 40) / 10
      if (speed <= 40) return 110 + ((speed - 25) * 40) / 15
      return 175
    }
    const HEAD_BASE = 14
    const HEAD_HEIGHT = 18

    data.forEach((pt) => {
      const speed = use80 ? pt.speed80 : pt.speed
      const direction = use80 ? pt.direction80 : pt.direction
      const point = map.project([pt.lng, pt.lat])
      const px = point.x
      const py = point.y
      if (px < -100 || px > w + 100 || py < -100 || py > h + 100) return
      const snapped = snapToCardinal(direction)
      const angle = cardinalToScreenAngle(snapped)
      const len = arrowScale(speed)
      const tx = px + len * Math.cos(angle)
      const ty = py + len * Math.sin(angle)
      const color = directionColor(snapped)
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(
        tx - HEAD_HEIGHT * Math.cos(angle) + (HEAD_BASE / 2) * Math.sin(angle),
        ty - HEAD_HEIGHT * Math.sin(angle) - (HEAD_BASE / 2) * Math.cos(angle)
      )
      ctx.lineTo(
        tx - HEAD_HEIGHT * Math.cos(angle) - (HEAD_BASE / 2) * Math.sin(angle),
        ty - HEAD_HEIGHT * Math.sin(angle) + (HEAD_BASE / 2) * Math.cos(angle)
      )
      ctx.closePath()
      ctx.fill()
    })
    ctx.globalAlpha = 1
  }, [])

  // Sync map zoom to state and re-fetch wind on moveend/zoomend only (no fetch on move)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const onMoveEnd = () => {
      setMapZoom(map.getZoom())
      if (windEnabled && map.getZoom() >= WIND_MIN_ZOOM) fetchWindForMap()
    }
    setMapZoom(map.getZoom())
    map.on('moveend', onMoveEnd)
    map.on('zoomend', onMoveEnd)
    return () => {
      map.off('moveend', onMoveEnd)
      map.off('zoomend', onMoveEnd)
    }
  }, [mapReady, windEnabled, fetchWindForMap])

  // Register move → redraw (live during drag/zoom). Initial draw + redraw when windData/windElevation change.
  const windVisible = windEnabled && mapZoom >= WIND_MIN_ZOOM
  useEffect(() => {
    const map = mapRef.current
    if (!windVisible || !map) return
    map.on('move', redrawWindCanvas)
    redrawWindCanvas()
    return () => {
      map.off('move', redrawWindCanvas)
      const c = windCanvasRef.current
      if (c) {
        const ctx = c.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, c.width, c.height)
      }
    }
  }, [windVisible, windData, windElevation, mapReady, redrawWindCanvas])

  return (
    <div className="w-full" style={{ position: 'relative', height: 'calc(100vh - 3.5rem)', overflow: 'visible' }}>
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height: 'calc(100vh - 3.5rem)' }}
        aria-label="Map"
      />

      {/* Wind overlay canvas — only visible when zoom >= WIND_MIN_ZOOM (match terrain layers) */}
      {windEnabled && mapZoom >= WIND_MIN_ZOOM && (
        <canvas
          ref={windCanvasRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        />
      )}

      {/* Wind error toast */}
      {windError && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          padding: '8px 16px',
          backgroundColor: 'rgba(7,12,16,0.95)',
          border: '1px solid rgba(239,83,80,0.4)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(240,237,232,0.7)',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          Wind data unavailable
        </div>
      )}

      {/* Snow depth unavailable toast */}
      {snowDepthUnavailable && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          padding: '8px 16px',
          backgroundColor: 'rgba(7,12,16,0.95)',
          border: '1px solid rgba(239,83,80,0.4)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(240,237,232,0.7)',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          Snow data unavailable
        </div>
      )}

      {/* Wind direction legend — cardinal colors + 10m/80m toggle */}
      {windEnabled && mapZoom >= WIND_MIN_ZOOM && (
        <div style={{
          position: 'absolute',
          bottom: precipRadarEnabled ? (waypoints?.length >= 2 ? 210 : 130) : (waypoints?.length >= 2 ? 160 : 80),
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          backgroundColor: 'rgba(7,12,16,0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(240,237,232,0.1)',
          padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {[
            { label: 'N', color: '#60a5fa' },
            { label: 'NE', color: '#a78bfa' },
            { label: 'E', color: '#34d399' },
            { label: 'SE', color: '#fbbf24' },
            { label: 'S', color: '#f87171' },
            { label: 'SW', color: '#fb923c' },
            { label: 'W', color: '#38bdf8' },
            { label: 'NW', color: '#e879f9' },
          ].map(({ label, color }) => (
            <span key={label} style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color,
            }}>
              {label}
            </span>
          ))}
          <div style={{ width: 1, height: 12, background: 'rgba(240,237,232,0.12)' }}/>
          <div style={{ display: 'flex', gap: 3 }}>
            {['10m', '80m'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setWindElevation(v)}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '2px 7px',
                  border: `1px solid ${windElevation === v ? 'rgba(240,237,232,0.4)' : 'transparent'}`,
                  background: windElevation === v ? 'rgba(240,237,232,0.08)' : 'transparent',
                  color: windElevation === v ? '#F0EDE8' : 'rgba(240,237,232,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pan hint — center, pulses until first click or zoom */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '8px 16px',
          border: '1px solid rgba(240,237,232,0.15)',
          backgroundColor: 'rgba(7,12,16,0.75)',
          backdropFilter: 'blur(8px)',
          color: 'rgba(240,237,232,0.6)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          fontStyle: 'normal',
          pointerEvents: 'none', userSelect: 'none',
          whiteSpace: 'nowrap', zIndex: 5,
          transition: showPanHint ? 'opacity 0.2s' : 'none',
          opacity: showPanHint ? 1 : 0,
        }}
        className={showPanHint ? 'pan-hint-pulse' : ''}
      >
        Ctrl + drag to pan
      </div>

      {/* Region selector — top-left */}
      <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
        {[
          { key: 'sierra', label: 'Sierra' },
          { key: 'shasta', label: 'Shasta' },
          { key: 'bridgeport', label: 'Bridgeport' },
          { key: 'eastern_sierra', label: 'E. Sierra' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => flyToRegion(key)}
            style={{
              padding: '5px 12px',
              border: `1px solid ${currentRegion === key ? 'rgba(240,237,232,0.7)' : 'rgba(240,237,232,0.15)'}`,
              backgroundColor: currentRegion === key ? 'rgba(240,237,232,0.1)' : 'transparent',
              color: currentRegion === key ? '#F0EDE8' : 'rgba(240,237,232,0.4)',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => { if (currentRegion !== key) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.35)'; e.currentTarget.style.color = 'rgba(240,237,232,0.75)' }}}
            onMouseLeave={e => { if (currentRegion !== key) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)'; e.currentTarget.style.color = 'rgba(240,237,232,0.4)' }}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right-side stack: layers panel, slope legend, aspect rose */}
      {mapReady && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            zIndex: 10,
          }}
        >
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
              activeLayers={activeLayers}
              onLayerToggle={setActiveLayers}
              windEnabled={windEnabled}
              onWindToggle={setWindEnabled}
              windLoading={windLoading}
              windZoomBlocked={windEnabled && mapZoom < WIND_MIN_ZOOM}
              precipRadarEnabled={precipRadarEnabled}
              onPrecipRadarToggle={setPrecipRadarEnabled}
              precipRadarLoading={precipRadarLoading}
              snowDepthEnabled={snowDepthEnabled}
              onSnowDepthToggle={setSnowDepthEnabled}
            />
          </motion.div>

          {/* Slope angle legend panel */}
          <div style={{
            backgroundColor: 'rgba(7,12,16,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(240,237,232,0.08)',
            padding: '10px 12px',
            minWidth: 180,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8,
              marginBottom: slopeLegendCollapsed ? 0 : 8,
              borderBottom: slopeLegendCollapsed ? 'none' : '1px solid rgba(240,237,232,0.07)',
              paddingBottom: slopeLegendCollapsed ? 0 : 8,
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.18em',
                color: 'rgba(240,237,232,0.4)',
              }}>
                {activeLayers.length > 0 && LAYER_LEGENDS[activeLayers[0]]
                  ? LAYER_LEGENDS[activeLayers[0]].title
                  : 'Slope Angle'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !slopeLegendCollapsed
                  setSlopeLegendCollapsed(next)
                  try { localStorage.setItem('calpow_slope_legend_collapsed', String(next)) } catch (_) {}
                }}
                style={{
                  padding: '2px 4px', border: 'none',
                  background: 'transparent',
                  color: 'rgba(240,237,232,0.3)', cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, letterSpacing: '0.1em',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,237,232,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.3)'}
              >
                {slopeLegendCollapsed ? '▶' : '▼'}
              </button>
            </div>
            {!slopeLegendCollapsed && (
              <>
                {activeLayers.length > 0 && activeLayers[0] && LAYER_LEGENDS[activeLayers[0]] ? (
                  LAYER_LEGENDS[activeLayers[0]].stops.map((stop, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{
                        width: 10, height: 10, flexShrink: 0,
                        backgroundColor: stop.color,
                      }}/>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 10, letterSpacing: '0.06em',
                        color: 'rgba(240,237,232,0.55)',
                      }}>{stop.label}</span>
                    </div>
                  ))
                ) : (
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.25)',
                  }}>
                    Select a terrain layer
                  </span>
                )}
              </>
            )}
          </div>

          {/* Precip radar legend — no zoom gate; show when layer on */}
          {precipRadarEnabled && (
            <div style={{
              backgroundColor: 'rgba(7,12,16,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(240,237,232,0.08)',
              padding: '10px 12px',
              minWidth: 180,
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.18em',
                color: 'rgba(240,237,232,0.4)',
                marginBottom: 4,
                borderBottom: '1px solid rgba(240,237,232,0.07)',
                paddingBottom: 6,
              }}>
                Precip Radar
              </div>
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 9, color: 'rgba(240,237,232,0.25)',
                margin: '0 0 8px', letterSpacing: '0.04em',
              }}>
                RainViewer · updates 10 min
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {[
                  { color: '#00d4ff', label: 'Light' },
                  { color: '#00ff00', label: 'Mod' },
                  { color: '#ffff00', label: 'Heavy' },
                  { color: '#ff6600', label: 'Intense' },
                  { color: '#ff0000', label: 'Extreme' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 18, height: 6, background: color }}/>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'rgba(240,237,232,0.35)',
                    }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {snowDepthEnabled && (
            <div style={{
              backgroundColor: 'rgba(7,12,16,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(240,237,232,0.08)',
              padding: '10px 12px',
              minWidth: 200,
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.18em',
                color: 'rgba(240,237,232,0.4)',
                marginBottom: 4,
                borderBottom: '1px solid rgba(240,237,232,0.07)',
                paddingBottom: 6,
              }}>
                Snow Depth
              </div>
              <p style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 9, color: 'rgba(240,237,232,0.25)',
                margin: '0 0 8px', letterSpacing: '0.04em',
              }}>
                NOHRSC · updates 4× daily
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                {[
                  { color: '#00ffff', label: 'Trace' },
                  { color: '#00c8ff', label: '1"' },
                  { color: '#0096ff', label: '3"' },
                  { color: '#0050ff', label: '6"' },
                  { color: '#00c800', label: '12"' },
                  { color: '#c8ff00', label: '18"' },
                  { color: '#ffff00', label: '24"' },
                  { color: '#ffa000', label: '36"' },
                  { color: '#ff0000', label: '48"' },
                  { color: '#ff00ff', label: '60"+' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ width: 14, height: 6, background: color }}/>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 8, letterSpacing: '0.04em',
                      color: 'rgba(240,237,232,0.35)',
                    }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Avalanche danger for current region */}
      {mapReady && (mapRegionForecast || currentRegion) && (
        <div
          style={{
            position: 'absolute',
            top: 56, left: 16,
            minWidth: 160,
            backgroundColor: 'rgba(7,12,16,0.88)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(240,237,232,0.1)',
            padding: '8px 12px',
            zIndex: 10,
          }}
        >
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(240,237,232,0.3)',
            marginBottom: 5,
          }}>
            Avalanche Danger
          </div>
          {mapRegionForecast ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                backgroundColor: mapRegionForecast.color,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: '#fff',
              }}>
                {mapRegionForecast.danger_level != null
                  ? `${mapRegionForecast.danger_level} · ${mapRegionForecast.danger_label}`
                  : mapRegionForecast.danger_label}
              </span>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#4ade80',
              }}>Live</span>
              <a
                href={mapRegionForecast.forecast_url || FALLBACK_URLS[currentRegion]}
                target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.4)',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.4)'}
              >
                Full Forecast ↗
              </a>
            </div>
          ) : (
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(240,237,232,0.3)' }}>
              Loading…
            </span>
          )}
        </div>
      )}

      {/* Aspect / elevation rose — below avalanche danger bar */}
      {mapReady && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 116,
            zIndex: 10,
          }}
        >
          <AspectElevationRose
            forecastData={mapRegionForecast}
            detailedForecast={detailedForecast}
            region={currentRegion}
          />
        </div>
      )}

      {/* Layer toggle + route UI */}
      {mapReady && (
        <>
          <div
            className="absolute top-4 z-10"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              width: '280px',
              backdropFilter: 'blur(8px)',
              background: 'transparent',
            }}
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
                    colorBackground: 'rgba(30, 45, 61, 0.55)',
                    colorBackgroundHover: 'rgba(36, 52, 71, 0.65)',
                    colorText: '#F7FAFC',
                    colorTextSecondary: '#A0AEC0',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
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
            <RouteBuilder mapRef={mapRef} mapReady={mapReady} />
          </motion.div>
          <DangerSummary
            dangerSegments={dangerSegments}
            routeRisk={routeRisk}
            hazardExposure={hazardExposure ?? '0.00'}
            hasRoute={waypoints.length >= 2}
            mapRef={mapRef}
            setSelectedDangerSeg={setSelectedDangerSeg}
          />
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
          <div style={{
            position: 'absolute', left: popupX, top: popupY,
            zIndex: 20, pointerEvents: 'auto',
            backgroundColor: 'rgba(7,12,16,0.97)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(240,237,232,0.12)',
            padding: '14px',
            minWidth: 210,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {/* Triangle pointer */}
            <div style={{
              position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
              borderTop: '7px solid rgba(7,12,16,0.97)',
            }}/>
            <div style={{
              position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
              borderTop: '8px solid rgba(240,237,232,0.12)',
            }}/>

            {terrainPopup.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' }}>
                <div style={{
                  width: 20, height: 20,
                  border: '1.5px solid rgba(240,237,232,0.15)',
                  borderTopColor: '#F0EDE8',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}/>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.35)',
                }}>Analyzing terrain…</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTerrainPopup(null)}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', background: 'transparent',
                    color: 'rgba(240,237,232,0.3)', cursor: 'pointer', fontSize: 14,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.3)'}
                >×</button>

                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'rgba(240,237,232,0.35)',
                  marginBottom: 2,
                }}>Terrain Analysis</div>
                <div style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 10, color: 'rgba(240,237,232,0.25)',
                  marginBottom: 10,
                }}>
                  {terrainPopup.lat.toFixed(4)}, {terrainPopup.lng.toFixed(4)}
                </div>
                <div style={{ borderTop: '1px solid rgba(240,237,232,0.07)', marginBottom: 10 }}/>

                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.3)', marginBottom: 3,
                  }}>Slope Angle</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 18, fontWeight: 700,
                    color: slopeColor(terrainPopup.slopeAngle ?? 0),
                    lineHeight: 1,
                  }}>
                    {(terrainPopup.slopeAngle ?? 0).toFixed(1)}°
                  </div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 10, color: 'rgba(240,237,232,0.3)', marginTop: 2,
                  }}>
                    {slopeSubLabel(terrainPopup.slopeAngle ?? 0)}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.3)', marginBottom: 3,
                  }}>Aspect</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 700, color: '#F0EDE8',
                  }}>
                    {terrainPopup.aspect ?? '—'}
                  </div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'rgba(240,237,232,0.3)', marginTop: 2 }}>
                    N-facing slopes hold weak layers longest
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.3)', marginBottom: 3,
                  }}>Wind</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#F0EDE8' }}>
                    {terrainPopup.wind
                      ? `${terrainPopup.wind.speed} mph · ${terrainPopup.wind.label}`
                      : 'Unavailable'}
                  </div>
                  {terrainPopup.wind?.speed > 25 && (
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fb923c', marginTop: 2 }}>
                      Wind loading likely
                    </div>
                  )}
                </div>

                <div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.3)', marginBottom: 3,
                  }}>Temperature</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 700,
                    color: tempColor(terrainPopup.temp),
                  }}>
                    {terrainPopup.temp != null ? `${terrainPopup.temp}°F` : 'Unavailable'}
                  </div>
                  {terrainPopup.temp != null && terrainPopup.temp > 45 && (
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fb923c', marginTop: 2 }}>
                      Wet avalanche risk
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Danger segment popup */}
      {selectedDangerSeg && selectedDangerSeg.severity !== 'descent' && (() => {
        const mapEl = mapContainerRef.current
        const mapWidth = mapEl?.offsetWidth ?? window.innerWidth
        const popupX = (mapWidth / 2) + 160
        const popupY = 60
        const severityLabel = {
          caution: 'Caution',
          dangerous: 'Dangerous',
          extreme: 'Extreme',
        }[selectedDangerSeg.severity] ?? selectedDangerSeg.severity
        const footerText = {
          caution: 'Avalanche terrain. Extra caution required.',
          dangerous: 'High consequence terrain. Consider alternatives.',
          extreme: 'Extreme terrain. Expert only.',
        }[selectedDangerSeg.severity] ?? ''

        return (
          <div style={{
            position: 'absolute', left: popupX, top: popupY,
            zIndex: 20, pointerEvents: 'auto',
            backgroundColor: 'rgba(7,12,16,0.97)',
            border: `1px solid ${selectedDangerSeg.color}40`,
            padding: '12px 14px',
            maxWidth: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <button
              type="button"
              onClick={() => setSelectedDangerSeg(null)}
              style={{
                position: 'absolute', top: 6, right: 8,
                width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent',
                color: 'rgba(240,237,232,0.3)', cursor: 'pointer', fontSize: 14,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#F0EDE8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,237,232,0.3)'}
            >×</button>

            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: selectedDangerSeg.color,
              marginBottom: 6, paddingRight: 20,
            }}>
              {severityLabel}
            </div>
            <div style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11, color: 'rgba(240,237,232,0.6)',
              lineHeight: 1.5, marginBottom: 6,
            }}>
              {selectedDangerSeg.reasons.join(' · ')}
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(240,237,232,0.3)',
              marginBottom: 4,
            }}>
              {selectedDangerSeg.slope.toFixed(1)}° · {selectedDangerSeg.aspect}
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'rgba(240,237,232,0.2)',
            }}>
              {footerText}
            </div>
          </div>
        )
      })()}

      {/* Mapbox control overrides + Barlow + spin */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@400;600;700;800&display=swap');

        .mapboxgl-ctrl-group {
          background-color: rgba(7,12,16,0.92) !important;
          border: 1px solid rgba(240,237,232,0.1) !important;
          border-radius: 0 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
        }
        .mapboxgl-ctrl-group button {
          background-color: transparent !important;
          color: #F0EDE8 !important;
          width: 32px !important;
          height: 32px !important;
          border-radius: 0 !important;
          transition: background-color 0.15s !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background-color: rgba(240,237,232,0.08) !important;
        }
        .mapboxgl-ctrl-group button + button {
          border-top: 1px solid rgba(240,237,232,0.07) !important;
        }
        .mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon,
        .mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon,
        .mapboxgl-ctrl-compass .mapboxgl-ctrl-icon {
          filter: invert(1) !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
