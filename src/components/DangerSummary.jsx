import { useState } from 'react'

export default function DangerSummary({
  dangerSegments,
  routeRisk,
  hazardExposure,
  hasRoute,
  mapRef,
  setSelectedDangerSeg,
}) {
  const [expanded, setExpanded] = useState(false)
  const [hoveredSeg, setHoveredSeg] = useState(null)
  if (!dangerSegments?.length) return null

  const counts = { extreme: 0, dangerous: 0, caution: 0, safe: 0 }
  dangerSegments.forEach((s) => {
    if (s.severity !== 'descent') counts[s.severity]++
  })

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: hasRoute ? 280 : 100,
        background: 'rgba(30, 45, 61, 0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 14,
        minWidth: 220,
        pointerEvents: 'auto',
        zIndex: 10,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#3B8BEB #1E2D3D',
      }}
    >
      <div className="text-sm font-bold text-white">Route Danger Analysis</div>
      <div className="my-2 border-t border-white/20" />
      {routeRisk && (
        <div className="mb-2">
          <span className="text-xs text-text-secondary">Overall Risk: </span>
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: routeRisk.color }}
          >
            {routeRisk.label}
          </span>
        </div>
      )}
      <div
        className={`text-xs font-medium ${parseFloat(hazardExposure) > 0 ? 'text-orange-400' : 'text-emerald-400'}`}
      >
        ⚠️ {hazardExposure} km in hazard terrain
      </div>
      <div className="mt-2 space-y-1">
        {counts.extreme > 0 && (
          <div className="text-xs" style={{ color: '#FF0000' }}>
            🔴 {counts.extreme} extreme segment{counts.extreme !== 1 ? 's' : ''}
          </div>
        )}
        {counts.dangerous > 0 && (
          <div className="text-xs" style={{ color: '#E53E3E' }}>
            🟠 {counts.dangerous} dangerous segment{counts.dangerous !== 1 ? 's' : ''}
          </div>
        )}
        {counts.caution > 0 && (
          <div className="text-xs" style={{ color: '#DD6B20' }}>
            🟡 {counts.caution} caution segment{counts.caution !== 1 ? 's' : ''}
          </div>
        )}
        {counts.extreme === 0 && counts.dangerous === 0 && counts.caution === 0 && (
          <div className="text-xs text-emerald-400">✅ No hazard zones detected</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: '11px',
          color: '#3B8BEB',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          marginTop: '8px',
          padding: 0,
        }}
      >
        {expanded ? '▲ Hide details' : '▼ Why is this dangerous?'}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: '#A0AEC0',
            lineHeight: 1.5,
            maxHeight: '300px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#3B8BEB #1E2D3D',
          }}
        >
          {dangerSegments.filter((s) => s.severity !== 'safe' && s.reasons.length > 0).map((seg, i) => {
            const isHovered = hoveredSeg === seg.index
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const map = mapRef?.current
                  if (!map) return
                  const midLng = (seg.p1[0] + seg.p2[0]) / 2
                  const midLat = (seg.p1[1] + seg.p2[1]) / 2
                  map.flyTo({
                    center: [midLng, midLat],
                    zoom: 14,
                    pitch: 60,
                    duration: 1000,
                  })
                  if (seg.severity !== 'descent') {
                    map.once('moveend', () => setSelectedDangerSeg?.(seg))
                  }
                }}
                onMouseEnter={() => setHoveredSeg(seg.index)}
                onMouseLeave={() => setHoveredSeg(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    const map = mapRef?.current
                    if (!map) return
                    const midLng = (seg.p1[0] + seg.p2[0]) / 2
                    const midLat = (seg.p1[1] + seg.p2[1]) / 2
                    map.flyTo({
                      center: [midLng, midLat],
                      zoom: 14,
                      pitch: 60,
                      duration: 1000,
                    })
                    if (seg.severity !== 'descent') {
                      map.once('moveend', () => setSelectedDangerSeg?.(seg))
                    }
                  }
                }}
                style={{
                  marginBottom: '6px',
                  padding: '6px 8px',
                  background: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${seg.color}`,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: '2px' }}>
                  Segment {seg.index + 1}
                </div>
                <div>{seg.reasons.length ? seg.reasons.join(' · ') : 'Descent segment'}</div>
                <div style={{ marginTop: '2px', color: '#718096' }}>
                  Slope: {seg.slope.toFixed(1)}° · Aspect: {seg.aspect}
                </div>
              </div>
            )
          })}
          {dangerSegments.filter((s) => s.severity !== 'safe' && s.reasons.length > 0).length === 0 && (
            <div>All segments are within safe terrain parameters.</div>
          )}
        </div>
      )}
    </div>
  )
}
