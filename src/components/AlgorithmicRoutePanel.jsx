/**
 * AlgorithmicRoutePanel.jsx
 *
 * Shows the result of a terrain-physics engine route (POST /route/auto).
 * Displayed alongside (never instead of) the existing manual route builder.
 *
 * Sections:
 *   - Live context header (wind, AFP zone, danger level)
 *   - Cost breakdown (per-segment slope / PRA / z_δ / cell_counts)
 *   - Disclaimer — always visible, never collapsible
 *   - Warnings from the engine (graceful degradation messages)
 *
 * Design: matches the CalPow field-report / brutalist aesthetic exactly —
 * sharp corners, Barlow Condensed uppercase labels, no emojis, inline SVGs.
 */

const C = {
  bg:          'rgba(7,12,16,0.95)',
  border:      'rgba(240,237,232,0.09)',
  borderHi:    'rgba(240,237,232,0.22)',
  text:        '#F0EDE8',
  muted:       'rgba(240,237,232,0.45)',
  faint:       'rgba(240,237,232,0.2)',
  ghost:       'rgba(240,237,232,0.04)',
  cyan:        '#22d3ee',
  green:       '#4ade80',
  amber:       '#fbbf24',
  red:         '#f87171',
  purple:      '#c084fc',
}

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
}

// Danger level → display color
const DANGER_COLOR = ['', C.green, C.green, C.amber, C.red, C.purple]
const DANGER_LABEL = ['', 'Low', 'Moderate', 'Considerable', 'High', 'Extreme']

// ── Sub-components ────────────────────────────────────────────────────────────

function Tag({ children, color = C.faint }) {
  return (
    <span style={{
      ...LABEL, fontSize: 8, fontWeight: 700,
      padding: '2px 6px',
      border: `1px solid ${color}40`,
      color,
    }}>
      {children}
    </span>
  )
}

function Row({ label, value, color = C.text, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{ ...LABEL, fontSize: 8, fontWeight: 700, color: C.faint }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'monospace' : "'Barlow Condensed', sans-serif",
        fontSize: mono ? 10 : 12, fontWeight: 700, color,
      }}>{value}</span>
    </div>
  )
}

// Wind compass needle (pure SVG, no emoji)
function WindNeedle({ deg, size = 20 }) {
  const rad = ((deg - 90) * Math.PI) / 180
  const cx = size / 2, cy = size / 2, r = size / 2 - 2
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="1"/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="1.5" fill={C.cyan}/>
    </svg>
  )
}

// Stat mini-bar
function StatBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 2, backgroundColor: C.ghost, marginTop: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, transition: 'width 0.4s' }} />
    </div>
  )
}

// Per-segment table row
function SegRow({ seg, index, maxZDelta, maxCounts }) {
  const praColor = seg.pra_membership > 0.6 ? C.red : seg.pra_membership > 0.2 ? C.amber : C.green
  return (
    <div style={{
      padding: '7px 0',
      borderBottom: `1px solid ${C.border}`,
      display: 'grid',
      gridTemplateColumns: '18px 1fr 1fr 1fr 1fr',
      gap: 8,
      alignItems: 'center',
    }}>
      <span style={{ ...LABEL, fontSize: 8, color: C.faint }}>{String(index + 1).padStart(2, '0')}</span>

      {/* Slope */}
      <div>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700, color: seg.slope_deg > 35 ? C.red : seg.slope_deg > 28 ? C.amber : C.text }}>
          {seg.slope_deg != null ? `${seg.slope_deg.toFixed(0)}°` : '—'}
        </span>
        <StatBar value={seg.slope_deg ?? 0} max={55} color={seg.slope_deg > 35 ? C.red : C.amber} />
      </div>

      {/* PRA */}
      <div>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700, color: praColor }}>
          {seg.pra_membership != null ? seg.pra_membership.toFixed(2) : '—'}
        </span>
        <StatBar value={seg.pra_membership ?? 0} max={1} color={praColor} />
      </div>

      {/* z_δ */}
      <div>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700, color: C.muted }}>
          {seg.z_delta_m != null ? `${seg.z_delta_m.toFixed(0)}m` : '—'}
        </span>
        <StatBar value={seg.z_delta_m ?? 0} max={maxZDelta} color={C.cyan} />
      </div>

      {/* cell_counts */}
      <div>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 11, fontWeight: 700, color: C.faint }}>
          {seg.cell_counts != null ? Math.round(seg.cell_counts) : '—'}
        </span>
        <StatBar value={seg.cell_counts ?? 0} max={maxCounts} color={C.purple} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AlgorithmicRoutePanel({ result, loading, error, onClose }) {
  if (!result && !loading && !error) return null

  const lc   = result?.live_context ?? {}
  const segs = result?.segment_stats ?? []
  const maxZDelta  = Math.max(1, ...segs.map(s => s.z_delta_m  ?? 0))
  const maxCounts  = Math.max(1, ...segs.map(s => s.cell_counts ?? 0))
  const dangerLvl  = lc.danger_level
  const windDeg    = lc.wind?.direction_deg
  const windMph    = lc.wind?.speed_mph

  return (
    <div style={{
      position: 'absolute',
      top: 72, right: 16,
      width: 300,
      maxHeight: 'calc(100vh - 100px)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Route icon */}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round">
            <circle cx="2" cy="2" r="1.5"/>
            <circle cx="9" cy="9" r="1.5"/>
            <path d="M2 3.5v1C2 6.5 3.5 7 5.5 7s3.5.5 3.5 2V8.5"/>
          </svg>
          <span style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.cyan }}>
            Algorithmic Route
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', backgroundColor: 'transparent',
            color: C.faint, cursor: 'pointer', fontSize: 14,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = C.text }}
          onMouseLeave={e => { e.currentTarget.style.color = C.faint }}
        >×</button>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', padding: '12px', flex: 1 }}>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.muted }}>
            <div style={{ ...LABEL, fontSize: 9, marginBottom: 8 }}>Computing route</div>
            <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>
              Fetching wind + forecast · running terrain physics
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{ padding: '12px 0' }}>
            <div style={{ ...LABEL, fontSize: 9, color: C.red, marginBottom: 6 }}>Engine Error</div>
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              {error}
            </div>
            <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginTop: 10, lineHeight: 1.6 }}>
              Make sure the engine is running:
              <br/>uvicorn api.app:app --port 8000
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <>
            {/* Live context: wind + AFP */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 8 }}>Live Context</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {windDeg != null
                  ? <WindNeedle deg={windDeg} size={24} />
                  : <div style={{ width: 24, height: 24, border: `1px solid ${C.border}` }} />
                }
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 12, fontWeight: 700, color: C.text }}>
                    {windDeg != null ? `${Math.round(windDeg)}°` : '—'} {windMph != null ? `· ${windMph.toFixed(0)} mph` : ''}
                  </div>
                  <div style={{ ...LABEL, fontSize: 8, color: C.faint }}>
                    {lc.open_meteo_ok ? 'Live wind (Open-Meteo)' : 'Wind unavailable — default'}
                  </div>
                </div>
                {dangerLvl != null && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 14, fontWeight: 800, color: DANGER_COLOR[dangerLvl] }}>
                      {dangerLvl}
                    </div>
                    <div style={{ ...LABEL, fontSize: 8, color: DANGER_COLOR[dangerLvl] }}>
                      {DANGER_LABEL[dangerLvl]}
                    </div>
                  </div>
                )}
              </div>

              {lc.zone_name && (
                <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 4 }}>
                  Zone: {lc.zone_name}
                </div>
              )}

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <Tag color={result.forecast_applied ? C.green : C.faint}>
                  {result.forecast_applied ? 'Forecast applied' : 'Tier-A only'}
                </Tag>
                <Tag color={lc.afp_ok ? C.green : C.faint}>
                  {lc.afp_ok ? 'AFP connected' : 'AFP offline'}
                </Tag>
              </div>
            </div>

            {/* Route stats */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
              <Row label="Total cost" value={result.total_cost.toFixed(2)} />
              <Row label="Path cells" value={`${result.n_cells} cells`} />
              <Row label="Sx wind azimuth" value={lc.sx_azimuth_used != null ? `${lc.sx_azimuth_used}°` : '—'} />
            </div>

            {/* Segment breakdown */}
            {segs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginBottom: 6 }}>
                  Segment Terrain Breakdown
                </div>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '18px 1fr 1fr 1fr 1fr',
                  gap: 8, paddingBottom: 4,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {['#', 'Slope', 'PRA', 'z_δ', 'Paths'].map(h => (
                    <span key={h} style={{ ...LABEL, fontSize: 7, color: C.faint }}>{h}</span>
                  ))}
                </div>
                {segs.map((seg, i) => (
                  <SegRow key={i} seg={seg} index={i} maxZDelta={maxZDelta} maxCounts={maxCounts} />
                ))}
                <div style={{ ...LABEL, fontSize: 7, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>
                  PRA = release probability · z_δ = runout intensity · Paths = overhead source count
                </div>
              </div>
            )}

            {/* Warnings */}
            {lc.warnings?.length > 0 && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ ...LABEL, fontSize: 8, color: C.amber, marginBottom: 6 }}>Warnings</div>
                {lc.warnings.map((w, i) => (
                  <div key={i} style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: 10,
                    color: C.muted, lineHeight: 1.5, marginBottom: 4,
                    paddingLeft: 8, borderLeft: `2px solid ${C.amber}40`,
                  }}>
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer — always visible */}
            <div style={{
              padding: '10px',
              border: `1px solid rgba(251,191,36,0.25)`,
              backgroundColor: 'rgba(251,191,36,0.04)',
            }}>
              <div style={{ ...LABEL, fontSize: 8, fontWeight: 700, color: C.amber, marginBottom: 5 }}>
                Planning Aid Only
              </div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 9, color: C.faint, lineHeight: 1.6 }}>
                {result.disclaimer}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500&family=Barlow+Condensed:wght@700;800&display=swap');
      `}</style>
    </div>
  )
}
