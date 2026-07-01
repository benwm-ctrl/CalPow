import { useState } from 'react'

const C = {
  bg: 'rgba(7,12,16,0.95)',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.2)',
  ghost: 'rgba(240,237,232,0.04)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

const SEV = {
  extreme:   { color: '#9333ea', label: 'Extreme' },
  dangerous: { color: '#ef4444', label: 'Dangerous' },
  caution:   { color: '#fb923c', label: 'Caution' },
  safe:      { color: '#4ade80', label: 'Safe' },
  descent:   { color: 'rgba(240,237,232,0.25)', label: 'Descent' },
}

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

  const hazardFloat = parseFloat(hazardExposure) || 0
  const hasHazard = hazardFloat > 0

  const hazardSegs = dangerSegments.filter(
    (s) => s.severity !== 'safe' && s.severity !== 'descent' && s.reasons?.length > 0
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        top: 346,
        backgroundColor: C.bg,
        backdropFilter: 'blur(14px)',
        border: `1px solid ${C.border}`,
        minWidth: 220,
        maxWidth: 280,
        pointerEvents: 'auto',
        zIndex: 10,
        maxHeight: 'calc(100vh - 560px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(240,237,232,0.15) transparent',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '9px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint }}>
          Route Danger Analysis
        </div>
      </div>

      <div style={{ padding: '10px 12px' }}>

        {/* ── Overall Risk ── */}
        {routeRisk && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ ...LABEL, fontSize: 8, color: C.faint }}>Overall Risk</span>
            <span style={{
              ...LABEL, fontSize: 11, fontWeight: 700,
              padding: '1px 8px',
              backgroundColor: routeRisk.color,
              color: '#fff',
            }}>
              {routeRisk.label}
            </span>
          </div>
        )}

        {/* ── Hazard exposure ── */}
        <div style={{
          ...LABEL, fontSize: 9, fontWeight: 700,
          color: hasHazard ? '#fb923c' : '#4ade80',
          marginBottom: 6,
        }}>
          {hasHazard
            ? `${hazardExposure} km in hazard terrain`
            : 'No hazard zones detected'}
        </div>

        {/* ── Severity chips ── */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {['extreme', 'dangerous', 'caution', 'safe'].map((sev) => {
            const n = counts[sev]
            if (!n) return null
            return (
              <span key={sev} style={{
                ...LABEL, fontSize: 8, fontWeight: 700,
                padding: '2px 7px',
                color: SEV[sev].color,
                border: `1px solid ${SEV[sev].color}40`,
                backgroundColor: `${SEV[sev].color}10`,
              }}>
                {SEV[sev].label} × {n}
              </span>
            )
          })}
          {counts.extreme === 0 && counts.dangerous === 0 && counts.caution === 0 && (
            <span style={{ ...LABEL, fontSize: 8, color: C.faint }}>All segments clear</span>
          )}
        </div>

        {/* ── Expand toggle ── */}
        {hazardSegs.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              ...LABEL,
              fontSize: 9, fontWeight: 700,
              color: C.faint,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.faint}
          >
            <span style={{ fontSize: 7 }}>{expanded ? '▲' : '▶'}</span>
            {expanded ? 'Hide segments' : 'Show hazard segments'}
          </button>
        )}

        {/* ── Segment list ── */}
        {expanded && hazardSegs.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hazardSegs.map((seg, i) => {
              const s = SEV[seg.severity] ?? SEV.safe
              const isHovered = hoveredSeg === seg.index
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (seg.severity !== 'descent') setSelectedDangerSeg?.(seg)
                  }}
                  onMouseEnter={() => setHoveredSeg(seg.index)}
                  onMouseLeave={() => setHoveredSeg(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (seg.severity !== 'descent') setSelectedDangerSeg?.(seg)
                    }
                  }}
                  style={{
                    padding: '7px 10px',
                    border: `1px solid ${isHovered ? s.color + '60' : C.border}`,
                    backgroundColor: isHovered ? `${s.color}0D` : 'transparent',
                    borderLeft: `3px solid ${s.color}`,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  {/* Seg header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ ...LABEL, fontSize: 10, fontWeight: 700, color: s.color }}>
                      {s.label}
                    </span>
                    <span style={{ ...LABEL, fontSize: 8, color: C.faint }}>
                      Seg {seg.index + 1}
                    </span>
                  </div>
                  {/* Reasons */}
                  {seg.reasons?.length > 0 && (
                    <div style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 10, color: C.muted, lineHeight: 1.45,
                      marginBottom: 3,
                    }}>
                      {seg.reasons.join(' · ')}
                    </div>
                  )}
                  {/* Slope / aspect */}
                  <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>
                    {seg.slope != null ? `${seg.slope.toFixed(1)}°` : '—'} · {seg.aspect ?? '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {expanded && hazardSegs.length === 0 && (
          <div style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 10, color: C.faint,
            marginTop: 8, lineHeight: 1.5,
          }}>
            All segments are within safe terrain parameters.
          </div>
        )}
      </div>
    </div>
  )
}
