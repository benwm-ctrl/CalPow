import { useRef, useEffect, useState } from 'react'
import { useRouteStore } from '../store/routeStore'
import { Route, Upload, Download, Undo2, Trash2, Bookmark } from 'lucide-react'
import GpxParser from 'gpxparser'
import SaveRouteModal from './SaveRouteModal'

function buildGpxXml(waypoints) {
  const date = new Date().toISOString().slice(0, 10)
  const trkpts = waypoints
    .map((wp) => {
      const lon = wp[0]
      const lat = wp[1]
      const ele = wp[2] ?? 0
      return `    <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CalPow" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>CalPow Route ${date}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
}

function downloadGpx(waypoints) {
  const xml = buildGpxXml(waypoints)
  const blob = new Blob([xml], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calpow-${new Date().toISOString().slice(0, 10)}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RouteBuilder({ mapRef, mapReady }) {
  const fileInputRef = useRef(null)
  const buildingModeRef = useRef(false)
  const routeModeRef = useRef('skin')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const waypoints = useRouteStore((s) => s.waypoints)
  const buildingMode = useRouteStore((s) => s.buildingMode)
  const routeMode = useRouteStore((s) => s.routeMode)
  const setRouteMode = useRouteStore((s) => s.setRouteMode)
  const removeLastWaypoint = useRouteStore((s) => s.removeLastWaypoint)
  const clearWaypoints = useRouteStore((s) => s.clearWaypoints)
  const setWaypoints = useRouteStore((s) => s.setWaypoints)
  const setBuildingMode = useRouteStore((s) => s.setBuildingMode)

  buildingModeRef.current = buildingMode
  routeModeRef.current = routeMode
  useEffect(() => {
    buildingModeRef.current = buildingMode
  }, [buildingMode])

  useEffect(() => {
    if (!mapReady) return

    // Poll for map being available (handles hot reload)
    let map = mapRef?.current
    const cleanupRef = { current: null }

    if (!map) {
      const interval = setInterval(() => {
        map = mapRef?.current
        if (map) {
          clearInterval(interval)
          cleanupRef.current = registerClick(map)
        }
      }, 100)
      return () => {
        clearInterval(interval)
        cleanupRef.current?.()
      }
    }

    cleanupRef.current = registerClick(map)
    return () => cleanupRef.current?.()

    function registerClick(map) {
      const handler = (e) => {
        if (!buildingModeRef.current) return
        const { lng, lat } = e.lngLat
        let elevation = 0
        try {
          const elev = map.queryTerrainElevation([lng, lat], { exaggerated: false })
          if (typeof elev === 'number' && !Number.isNaN(elev)) elevation = Math.round(elev)
        } catch (_) {}
        const mode = routeModeRef.current
        const { addWaypoint } = useRouteStore.getState()
        console.log('✅ waypoint added:', mode, lng.toFixed(4), lat.toFixed(4))
        addWaypoint([lng, lat, elevation, mode])
      }
      map.on('click', handler)
      return () => map.off('click', handler)
    }
  }, [mapReady, mapRef])

  const handleUploadGpx = (e) => {
    const file = e.target.files?.[0]
    if (!file || !mapRef?.current) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const gpx = new GpxParser()
        gpx.parse(reader.result)
        const tracks = gpx.tracks
        if (!tracks?.length) {
          alert('No tracks found in GPX file.')
          return
        }
        const points = tracks[0].points
        if (!points?.length) {
          alert('No track points in GPX file.')
          return
        }
        const wps = points.map((p) => [p.lon, p.lat, p.ele ?? 0, 'skin'])
        setWaypoints(wps)
        const lngs = wps.map((w) => w[0])
        const lats = wps.map((w) => w[1])
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const padding = 40
        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding, duration: 800 }
        )
      } catch (err) {
        console.error(err)
        alert('Failed to parse GPX file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const canExport = waypoints.length >= 2

  return (
    <>
      <div
        className="absolute left-4 z-10 flex flex-col gap-2 transition-[bottom] duration-200 max-w-[calc(100vw-2rem)]"
        style={{
          bottom: waypoints.length >= 2 ? 170 : 16,
          background: 'rgba(30, 45, 61, 0.55)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '8px',
        }}
      >
      {/* Build Route / Stop Building */}
      <button
        type="button"
        onClick={() => setBuildingMode(!buildingMode)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white shadow-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#3B8BEB' }}
      >
        <Route className="w-4 h-4" />
        {buildingMode ? 'Stop Building' : 'Build Route'}
      </button>

      {buildingMode && (
        <div
          style={{
            display: 'flex',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #2D3748',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setRouteMode('skin')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: routeMode === 'skin' ? '#3B8BEB' : '#1E2D3D',
              color: routeMode === 'skin' ? '#fff' : '#718096',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🎿 Skintrack
          </button>
          <button
            type="button"
            onClick={() => setRouteMode('descent')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: routeMode === 'descent' ? '#7C3AED' : '#1E2D3D',
              color: routeMode === 'descent' ? '#fff' : '#718096',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🔴 Descent
          </button>
        </div>
      )}

      {/* Undo / Clear — only when building or when there are points */}
      {(buildingMode || waypoints.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={removeLastWaypoint}
            disabled={waypoints.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-primary bg-background-secondary border border-border hover:bg-background-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={clearWaypoints}
            disabled={waypoints.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-primary bg-background-secondary border border-border hover:bg-background-elevated disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Download GPX / Upload GPX */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          disabled={!canExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#38A169' }}
        >
          <Bookmark className="w-4 h-4" />
          Save Route
        </button>
        <button
          type="button"
          onClick={() => downloadGpx(waypoints)}
          disabled={!canExport}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-primary bg-background-secondary border border-border hover:bg-background-elevated disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Download GPX
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text-primary bg-background-secondary border border-border hover:bg-background-elevated"
        >
          <Upload className="w-4 h-4" />
          Upload GPX
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={handleUploadGpx}
        />
      </div>
      </div>

      <SaveRouteModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
      />
    </>
  )
}
