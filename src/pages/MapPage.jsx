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
import { fetchForecast, FALLBACK_URLS } from '../services/avalancheForecast'
import { analyzeSegments, calcRouteRiskScore, calcHazardExposure } from '../utils/dangerAnalysis'

const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'
const TOPO_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

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
  const [searchValue, setSearchValue] = useState('')
  const [terrainPopup, setTerrainPopup] = useState(null)
  const [selectedDangerSeg, setSelectedDangerSeg] = useState(null)
  const [dangerPopupPos, setDangerPopupPos] = useState(null)
  const waypoints = useRouteStore((s) => s.waypoints)
  const setStoreForecast = useRouteStore((s) => s.setForecast)
  const dangerSegments = useRouteStore((s) => s.dangerSegments)
  const setDangerSegments = useRouteStore((s) => s.setDangerSegments)
  const routeRisk = useRouteStore((s) => s.routeRisk)
  const setRouteRisk = useRouteStore((s) => s.setRouteRisk)
  const pendingBounds = useRouteStore((s) => s.pendingBounds)
  const clearPendingBounds = useRouteStore((s) => s.clearPendingBounds)
  const [mapRegionForecast, setMapRegionForecast] = useState(null)
  const [hazardExposure, setHazardExposure] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [activeLayers, setActiveLayers] = useState([])
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
      }
    })
    return () => { cancelled = true }
  }, [currentRegion, setStoreForecast])

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
            'circle-radius': 8,
            'circle-color': [
              'match',
              ['get', 'mode'],
              'descent',
              '#A78BFA',
              '#ffffff',
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': [
              'match',
              ['get', 'mode'],
              'descent',
              '#7C3AED',
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
      map.getSource('route-points')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-caution')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-dangerous')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-extreme')?.setData({ type: 'FeatureCollection', features: [] })
      setDangerSegments([])
      setRouteRisk(null)
      setHazardExposure('0.00')
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
    if (!selectedDangerSeg) {
      setDangerPopupPos(null)
      return
    }
    const map = mapRef.current
    if (!map) return
    const midLng = (selectedDangerSeg.p1[0] + selectedDangerSeg.p2[0]) / 2
    const midLat = (selectedDangerSeg.p1[1] + selectedDangerSeg.p2[1]) / 2
    const point = map.project([midLng, midLat])
    setDangerPopupPos({ x: point.x, y: point.y })
  }, [selectedDangerSeg])

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
    if (waypoints.length < 2) {
      map.getSource('route-skin')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-descent')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-points')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-caution')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-dangerous')?.setData({ type: 'FeatureCollection', features: [] })
      map.getSource('route-extreme')?.setData({ type: 'FeatureCollection', features: [] })
      setDangerSegments([])
      setRouteRisk(null)
      setHazardExposure('0.00')
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

  return (
    <div className="w-full" style={{ position: 'relative', height: 'calc(100vh - 3.5rem)', overflow: 'visible' }}>
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

      {/* Terrain layer legend — bottom-left, above route builder */}
      {activeLayers.length > 0 &&
        activeLayers[0] &&
        LAYER_LEGENDS[activeLayers[0]] && (
          <div
            style={{
              position: 'absolute',
              bottom: '120px',
              left: '16px',
              background: 'rgba(15, 25, 40, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '12px 14px',
              zIndex: 10,
              minWidth: '180px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#F7FAFC',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              {LAYER_LEGENDS[activeLayers[0]].title}
            </div>
            {LAYER_LEGENDS[activeLayers[0]].stops.map((stop, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '3px',
                    backgroundColor: stop.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color: '#CBD5E0',
                  }}
                >
                  {stop.label}
                </span>
              </div>
            ))}
          </div>
        )}

      {/* Avalanche danger for current region */}
      {mapReady && (mapRegionForecast || currentRegion) && (
        <div
          className="absolute left-4 z-10 mt-2 rounded-lg border px-3 py-2 shadow-lg flex items-center gap-2 flex-wrap"
          style={{
            top: 56,
            background: 'rgba(30, 45, 61, 0.55)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
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
            <LayerTogglePanel
              currentStyle={currentStyle}
              onStyleChange={setMapStyle}
              satelliteStyleUrl={SATELLITE_STYLE}
              topoStyleUrl={TOPO_STYLE}
              activeLayers={activeLayers}
              onLayerToggle={setActiveLayers}
            />
          </motion.div>
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

      {/* Danger segment popup */}
      {selectedDangerSeg && dangerPopupPos && selectedDangerSeg.severity !== 'descent' && (() => {
        const mapEl = mapContainerRef.current
        const mapWidth = mapEl?.offsetWidth ?? window.innerWidth
        const mapHeight = mapEl?.offsetHeight ?? window.innerHeight
        const DANGER_POPUP_WIDTH = 220
        const DANGER_POPUP_HEIGHT = 180
        let popupX = dangerPopupPos.x - DANGER_POPUP_WIDTH / 2
        let popupY = dangerPopupPos.y - DANGER_POPUP_HEIGHT - 16
        if (popupX < MARGIN) popupX = MARGIN
        if (popupX + DANGER_POPUP_WIDTH > mapWidth - MARGIN) popupX = mapWidth - DANGER_POPUP_WIDTH - MARGIN
        if (popupY < MARGIN) popupY = dangerPopupPos.y + 24
        if (popupY + DANGER_POPUP_HEIGHT > mapHeight - MARGIN) popupY = mapHeight - DANGER_POPUP_HEIGHT - MARGIN
        const severityLabel = {
          caution: '⚠️ Caution',
          dangerous: '🔴 Dangerous',
          extreme: '🚨 Extreme',
        }[selectedDangerSeg.severity] ?? selectedDangerSeg.severity
        const footerText =
          selectedDangerSeg.severity === 'caution'
            ? 'Avalanche terrain. Extra caution required.'
            : selectedDangerSeg.severity === 'dangerous'
              ? 'High consequence terrain. Consider alternatives.'
              : 'Extreme terrain. Expert only. High rescue difficulty.'
        return (
          <div
            style={{
              position: 'absolute',
              left: popupX,
              top: popupY,
              zIndex: 20,
              pointerEvents: 'auto',
              background: '#1E2D3D',
              color: '#F7FAFC',
              padding: 12,
              borderRadius: 8,
              maxWidth: DANGER_POPUP_WIDTH,
              fontSize: 13,
              lineHeight: 1.5,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: `1px solid ${selectedDangerSeg.color}40`,
            }}
            className="relative"
          >
            <button
              type="button"
              onClick={() => setSelectedDangerSeg(null)}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-text-secondary hover:text-white hover:bg-white/10 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
            <div style={{ fontWeight: 700, marginBottom: 6, color: selectedDangerSeg.color, paddingRight: 24 }}>
              {severityLabel}
            </div>
            <div style={{ marginBottom: 4 }}>
              {selectedDangerSeg.reasons.join(' · ')}
            </div>
            <div className="text-text-secondary text-[11px] mt-1.5">
              Slope: {selectedDangerSeg.slope.toFixed(1)}° · Aspect: {selectedDangerSeg.aspect}
            </div>
            <div className="text-[11px] mt-1" style={{ color: '#718096' }}>
              {footerText}
            </div>
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
        .mapboxgl-ctrl-group button svg path,
        .mapboxgl-ctrl-group button svg {
          fill: #ffffff !important;
          stroke: #ffffff !important;
        }
        .mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon,
        .mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon,
        .mapboxgl-ctrl-compass .mapboxgl-ctrl-icon {
          filter: invert(1) !important;
        }
      `}</style>
    </div>
  )
}
