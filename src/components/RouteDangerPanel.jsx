// RouteDangerPanel.jsx
// Displays per-segment danger analysis for a drawn route.
// Props:
//   segments       — array from dangerAnalysis.analyzeSegments()
//   forecast       — current avalanche forecast object (or null)
//   onSegmentClick — (segment) => void  — called when user clicks a segment row
//   selectedSeg    — currently selected segment (or null)
//   onClose        — () => void

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

// ── Severity config ───────────────────────────────────────────────────────────
const SEV = {
  safe:      { color: '#4ade80', label: 'Safe',      short: 'SF' },
  caution:   { color: '#fb923c', label: 'Caution',   short: 'CA' },
  dangerous: { color: '#ef4444', label: 'Dangerous', short: 'DG' },
  extreme:   { color: '#9333ea', label: 'Extreme',   short: 'EX' },
  descent:   { color: 'rgba(240,237,232,0.25)', label: 'Descent', short: 'DS' },
}

function sev(s) { return SEV[s] ?? SEV.safe }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDist(km) {
  if (km == null) return '—'
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
function fmtElev(m) {
  if (m == null) return '—'
  return `${Math.round(m)} m`
}

// ── Score bar (overall risk) ──────────────────────────────────────────────────
function RiskBar({ score }) {
  // score 0–100
  const pct = Math.min(100, Math.max(0, score ?? 0))
  const color = pct < 25 ? '#4ade80' : pct < 50 ? '#fb923c' : pct < 75 ? '#ef4444' : '#9333ea'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ ...LABEL, fontSize: 8, fontWeight: 700, color: C.faint }}>Route Risk Score</span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(pct)}</span>
      </div>
      <div style={{ height: 3, backgroundColor: C.ghost, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, backgroundColor: color, transition: 'width 0.4s' }}/>
      </div>
    </div>
  )
}

// ── Exposure summary ──────────────────────────────────────────────────────────
function ExposureSummary({ segments }) {
  if (!segments?.length) return null
  const total = segments.reduce((s, seg) => s + (seg.distance_km ?? 0), 0)
  const exposed = segments.filter(s => s.severity === 'caution' || s.severity === 'dangerous' || s.severity === 'extreme')
    .reduce((s, seg) => s + (seg.distance_km ?? 0), 0)
  const pct = total > 0 ? Math.round((exposed / total) * 100) : 0

  const counts = {}
  segments.forEach(s => { if (s.severity !== 'descent') counts[s.severity] = (counts[s.severity] || 0) + 1 })

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ ...LABEL, fontSize: 8, color: C.faint }}>Hazard Exposure</span>
        <span style={{ ...LABEL, fontSize: 11, fontWeight: 700, color: pct > 50 ? '#ef4444' : pct > 25 ? '#fb923c' : C.muted }}>{pct}%</span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([severity, count]) => (
          <span key={severity} style={{
            ...LABEL, fontSize: 8, fontWeight: 700,
            padding: '2px 7px',
            color: sev(severity).color,
            border: `1px solid ${sev(severity).color}40`,
            backgroundColor: `${sev(severity).color}10`,
          }}>
            {sev(severity).label} × {count}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Segment row ───────────────────────────────────────────────────────────────
function SegmentRow({ seg, index, selected, onClick }) {
  const s = sev(seg.severity)
  return (
    <button
      type="button"
      onClick={() => onClick(seg)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 10px',
        border: `1px solid ${selected ? s.color + '60' : C.border}`,
        backgroundColor: selected ? `${s.color}0D` : 'transparent',
        textAlign: 'left', cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        marginBottom: 2,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = C.borderHover }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = C.border }}
    >
      {/* Severity swatch */}
      <div style={{
        width: 3, flexShrink: 0, alignSelf: 'stretch',
        backgroundColor: s.color,
      }}/>

      {/* Segment index */}
      <div style={{
        ...LABEL, fontSize: 9, fontWeight: 700,
        color: C.faint, flexShrink: 0, width: 18,
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ ...LABEL, fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>
          {seg.mode === 'descent' && (
            <span style={{ ...LABEL, fontSize: 8, color: 'rgba(240,237,232,0.25)', border: `1px solid ${C.border}`, padding: '0px 4px' }}>Descent</span>
          )}
        </div>
        {/* Reasons */}
        {seg.reasons?.length > 0 && (
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: C.muted, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {seg.reasons.slice(0, 2).join(' · ')}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, color: C.text }}>{fmtDist(seg.distance_km)}</div>
        <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>
          {seg.slope != null ? `${seg.slope.toFixed(0)}° · ${seg.aspect ?? '—'}` : seg.aspect ?? '—'}
        </div>
      </div>
    </button>
  )
}

// ── Segment detail drawer ─────────────────────────────────────────────────────
function SegmentDetail({ seg }) {
  if (!seg) return null
  const s = sev(seg.severity)
  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      marginTop: 8, paddingTop: 10,
      borderLeft: `3px solid ${s.color}`,
      paddingLeft: 10,
    }}>
      <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 8 }}>Segment Detail</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {[
          { label: 'Severity', value: s.label, color: s.color },
          { label: 'Aspect', value: seg.aspect ?? '—' },
          { label: 'Slope', value: seg.slope != null ? `${seg.slope.toFixed(1)}°` : '—' },
          { label: 'Distance', value: fmtDist(seg.distance_km) },
          { label: 'Elev Gain', value: seg.elev_gain != null ? `+${fmtElev(seg.elev_gain)}` : '—' },
          { label: 'Elev Loss', value: seg.elev_loss != null ? `-${fmtElev(seg.elev_loss)}` : '—' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: color ?? C.text }}>{value}</div>
          </div>
        ))}
      </div>
      {seg.reasons?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 6 }}>Hazard Flags</div>
          {seg.reasons.map((r, i) => (
            <div key={i} style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 11, color: C.muted, lineHeight: 1.5,
              paddingLeft: 8,
              borderLeft: `2px solid ${s.color}40`,
              marginBottom: 3,
            }}>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Forecast badge ────────────────────────────────────────────────────────────
function ForecastBadge({ forecast }) {
  if (!forecast) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10,
    }}>
      <div style={{
        ...LABEL, fontSize: 9, fontWeight: 700,
        padding: '2px 8px',
        backgroundColor: forecast.color ?? '#888',
        color: '#fff',
        flexShrink: 0,
      }}>
        {forecast.danger_level != null
          ? `${forecast.danger_level} · ${forecast.danger_label}`
          : forecast.danger_label ?? 'Unknown'}
      </div>
      <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: C.faint }}>
        {forecast.travel_advice ? forecast.travel_advice.slice(0, 60) + (forecast.travel_advice.length > 60 ? '…' : '') : 'Current forecast'}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function RouteDangerPanel({ segments, forecast, onSegmentClick, selectedSeg, onClose, riskScore }) {
  if (!segments?.length) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 16, left: 16,
      width: 300,
      maxHeight: 'calc(100vh - 180px)',
      backgroundColor: C.bg,
      backdropFilter: 'blur(14px)',
      border: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      zIndex: 20,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 12px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint }}>
          Route Danger Analysis
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: 'transparent',
            color: C.faint, cursor: 'pointer', fontSize: 14,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.faint}
        >×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', padding: '12px', flex: 1 }}>
        <RiskBar score={riskScore} />
        <ExposureSummary segments={segments} />
        <ForecastBadge forecast={forecast} />

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10 }}>
          <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 8 }}>
            Segments <span style={{ color: 'rgba(240,237,232,0.2)' }}>({segments.length})</span>
          </div>
          {segments.map((seg, i) => (
            <SegmentRow
              key={i}
              seg={seg}
              index={i}
              selected={selectedSeg === seg}
              onClick={onSegmentClick}
            />
          ))}
        </div>

        {selectedSeg && <SegmentDetail seg={selectedSeg} />}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500&family=Barlow+Condensed:wght@400;700;800&display=swap');
      `}</style>
    </div>
  )
}
