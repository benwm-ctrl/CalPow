import { useRef, useEffect, useState } from 'react'
import { useRouteStore } from '../store/routeStore'
import GpxParser from 'gpxparser'
import SaveRouteModal from './SaveRouteModal'

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IconRoute = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="2.5" cy="2.5" r="1.5"/>
    <circle cx="10.5" cy="10.5" r="1.5"/>
    <path d="M2.5 4v1.5C2.5 7.5 4 8 6.5 8s4 .5 4 2V9"/>
  </svg>
)
const IconUpload = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 8V2M3.5 4.5L6 2l2.5 2.5"/>
    <path d="M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
  </svg>
)
const IconDownload = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5"/>
    <path d="M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
  </svg>
)
const IconUndo = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 5H7.5a3 3 0 010 6H5"/>
    <path d="M4.5 2.5L2 5l2.5 2.5"/>
  </svg>
)
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M1.5 3h9M4 3V2h4v1M5 5.5v3M7 5.5v3M2.5 3l.7 7h5.6l.7-7"/>
  </svg>
)
const IconBookmark = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 2h8v9L6 8.5 2 11V2z"/>
  </svg>
)
// ─────────────────────────────────────────────────────────────────────────────

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

function buildGpxXml(waypoints) {
  const date = new Date().toISOString().slice(0, 10)
  const trkpts = waypoints.map((wp) => {
    const [lon, lat, ele = 0] = wp
    return `    <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CalPow" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>CalPow Route ${date}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
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

const Btn = ({ onClick, disabled, children, variant = 'default', style: extraStyle = {} }) => {
  const variants = {
    default: {
      border: '1px solid rgba(240,237,232,0.15)',
      backgroundColor: 'transparent',
      color: disabled ? 'rgba(240,237,232,0.2)' : 'rgba(240,237,232,0.55)',
    },
    primary: {
      border: '1px solid rgba(240,237,232,0.5)',
      backgroundColor: 'rgba(240,237,232,0.1)',
      color: disabled ? 'rgba(240,237,232,0.3)' : '#F0EDE8',
    },
    save: {
      border: '1px solid rgba(74,222,128,0.4)',
      backgroundColor: 'rgba(74,222,128,0.08)',
      color: disabled ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.85)',
    },
  }
  const v = variants[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 11px',
        ...v,
        ...LABEL,
        fontSize: 10, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = v.color }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.borderColor = v.border.replace('1px solid ', '') }}
    >
      {children}
    </button>
  )
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

  useEffect(() => { buildingModeRef.current = buildingMode }, [buildingMode])

  useEffect(() => {
    if (!mapReady) return
    let map = mapRef?.current
    const cleanupRef = { current: null }

    if (!map) {
      const interval = setInterval(() => {
        map = mapRef?.current
        if (map) { clearInterval(interval); cleanupRef.current = registerClick(map) }
      }, 100)
      return () => { clearInterval(interval); cleanupRef.current?.() }
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
        const { addWaypoint } = useRouteStore.getState()
        addWaypoint([lng, lat, elevation, routeModeRef.current])
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
        if (!tracks?.length) { alert('No tracks found in GPX file.'); return }
        const points = tracks[0].points
        if (!points?.length) { alert('No track points in GPX file.'); return }
        const wps = points.map((p) => [p.lon, p.lat, p.ele ?? 0, 'skin'])
        setWaypoints(wps)
        const lngs = wps.map((w) => w[0])
        const lats = wps.map((w) => w[1])
        mapRef.current.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 40, duration: 800 }
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
        style={{
          position: 'absolute',
          left: 16,
          bottom: waypoints.length >= 2 ? 210 : 24,
          zIndex: 10,
          backgroundColor: 'rgba(7,12,16,0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(240,237,232,0.1)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxWidth: 'calc(100vw - 2rem)',
          transition: 'bottom 0.2s ease',
        }}
      >
        {/* Build Route / Stop Building */}
        <Btn
          variant="primary"
          onClick={() => setBuildingMode(!buildingMode)}
          style={{ justifyContent: 'center' }}
        >
          <IconRoute />
          {buildingMode ? 'Stop Building' : 'Build Route'}
        </Btn>

        {/* Mode toggle: Skintrack / Descent */}
        {buildingMode && (
          <div style={{ display: 'flex', border: '1px solid rgba(240,237,232,0.1)' }}>
            {[
              { mode: 'skin', label: 'Skintrack', activeColor: 'rgba(240,237,232,0.1)', activeBorder: 'rgba(240,237,232,0.45)' },
              { mode: 'descent', label: 'Descent', activeColor: 'rgba(124,58,237,0.15)', activeBorder: 'rgba(167,139,250,0.5)' },
            ].map(({ mode, label, activeColor, activeBorder }) => {
              const active = routeMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRouteMode(mode)}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    border: 'none',
                    borderRight: mode === 'skin' ? '1px solid rgba(240,237,232,0.1)' : 'none',
                    backgroundColor: active ? activeColor : 'transparent',
                    color: active ? '#F0EDE8' : 'rgba(240,237,232,0.35)',
                    ...LABEL,
                    fontSize: 10, fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, color 0.15s',
                    outline: active ? `1px solid ${activeBorder}` : 'none',
                    outlineOffset: -1,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Undo / Clear */}
        {(buildingMode || waypoints.length > 0) && (
          <div style={{ display: 'flex', gap: 5 }}>
            <Btn onClick={removeLastWaypoint} disabled={waypoints.length === 0} style={{ flex: 1, justifyContent: 'center' }}>
              <IconUndo /> Undo
            </Btn>
            <Btn onClick={clearWaypoints} disabled={waypoints.length === 0} style={{ flex: 1, justifyContent: 'center' }}>
              <IconTrash /> Clear
            </Btn>
          </div>
        )}

        {/* Save / Download / Upload */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <Btn variant="save" onClick={() => setSaveModalOpen(true)} disabled={!canExport}>
            <IconBookmark /> Save Route
          </Btn>
          <Btn onClick={() => downloadGpx(waypoints)} disabled={!canExport}>
            <IconDownload /> Download GPX
          </Btn>
          <Btn onClick={() => fileInputRef.current?.click()}>
            <IconUpload /> Upload GPX
          </Btn>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx"
          style={{ display: 'none' }}
          onChange={handleUploadGpx}
        />
      </div>

      <SaveRouteModal isOpen={saveModalOpen} onClose={() => setSaveModalOpen(false)} />
    </>
  )
}
