/**
 * AnchorRoutePanel.jsx — Left sidebar for algorithmic anchor-routing mode.
 *
 * The user places anchor points (A, B, C…) on the map; the engine computes
 * the least-cost path between each consecutive pair. This panel shows:
 *   • Anchor list with remove controls
 *   • Per-segment engine status (loading / result / error)
 *   • Live wind + AFP zone / danger level from the engine's live_context
 *   • Per-segment hazard table (slope, PRA, z_δ, overhead exposure)
 *   • Disclaimer — always visible, cannot be hidden
 *
 * Design: CalPow field-report aesthetic — Barlow Condensed, sharp corners,
 * #0A0F14 background, no emojis, no Tailwind utilities, inline style objects.
 */

import { useEffect, useRef } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#0A0F14',
  panel:    '#111820',
  border:   '#1E2A38',
  borderHi: '#2E4A68',
  text:     '#F0EDE8',
  muted:    '#7A8EA0',
  cyan:     '#00D4FF',
  amber:    '#F5A623',
  red:      '#E53E3E',
  green:    '#38A169',
  orange:   '#DD6B20',
  purple:   '#9B59B6',
}

const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const ANCHOR_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ── Danger-level display ──────────────────────────────────────────────────────
const DANGER_META = {
  1: { label: 'LOW',         color: '#38A169' },
  2: { label: 'MODERATE',    color: '#D69E2E' },
  3: { label: 'CONSIDERABLE',color: '#DD6B20' },
  4: { label: 'HIGH',        color: '#E53E3E' },
  5: { label: 'EXTREME',     color: '#9B59B6' },
}

function dangerColor(level) {
  return DANGER_META[level]?.color ?? C.muted
}
function dangerLabel(level) {
  return DANGER_META[level]?.label ?? 'UNKNOWN'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v, digits = 1) {
  if (v == null || isNaN(v)) return '—'
  return Number(v).toFixed(digits)
}

function StatBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ height: 3, background: C.border, flex: 1, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color ?? C.cyan }} />
    </div>
  )
}

function WindCompass({ dirDeg, speedMph }) {
  const rad = (dirDeg * Math.PI) / 180
  const cx = 18, cy = 18, r = 12
  const tx = cx + r * Math.sin(rad)
  const ty = cy - r * Math.cos(rad)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="1" />
        <circle cx={cx} cy={cy} r="1.5" fill={C.cyan} />
        <line
          x1={cx} y1={cy} x2={tx} y2={ty}
          stroke={C.cyan} strokeWidth="1.5" strokeLinecap="round"
        />
        <text x={cx} y={5} textAnchor="middle"
          style={{ ...LABEL, fontSize: 6, fill: C.muted }}>N</text>
      </svg>
      <div>
        <div style={{ ...LABEL, fontSize: 11, color: C.text }}>
          {dirDeg != null ? `${Math.round(dirDeg)}°` : '—'}
          {speedMph != null ? ` · ${Math.round(speedMph)} MPH` : ''}
        </div>
        <div style={{ ...LABEL, fontSize: 9, color: C.muted }}>WIND</div>
      </div>
    </div>
  )
}

// ── Segment stats card ────────────────────────────────────────────────────────
function SegmentCard({ segIndex, segment, fromLabel, toLabel }) {
  const { status, result, error } = segment

  const cardStyle = {
    borderLeft: `2px solid ${
      status === 'loading' ? C.amber
      : status === 'error'   ? C.red
      :                        C.cyan
    }`,
    background: C.panel,
    padding: '8px 10px',
    marginBottom: 6,
  }

  if (status === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ ...LABEL, fontSize: 9, color: C.amber, marginBottom: 4 }}>
          {fromLabel} → {toLabel}
        </div>
        <LoadingDots />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={cardStyle}>
        <div style={{ ...LABEL, fontSize: 9, color: C.red, marginBottom: 4 }}>
          {fromLabel} → {toLabel}  ·  ENGINE ERROR
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: 'Barlow, sans-serif' }}>
          {error || 'Could not compute route between these anchors.'}
        </div>
      </div>
    )
  }

  if (status === 'done' && result) {
    const stats = result.segment_stats ?? []
    const liveCtx = result.live_context ?? {}

    // Aggregate across segments: pick worst/max
    let maxSlope = 0, maxPra = 0, maxZdelta = 0, maxCells = 0
    for (const s of stats) {
      if ((s.slope_deg ?? 0) > maxSlope)       maxSlope  = s.slope_deg
      if ((s.pra_membership ?? 0) > maxPra)    maxPra    = s.pra_membership
      if ((s.z_delta_m ?? 0) > maxZdelta)      maxZdelta = s.z_delta_m
      if ((s.cell_counts ?? 0) > maxCells)     maxCells  = s.cell_counts
    }

    const slopeColor = maxSlope >= 45 ? C.purple : maxSlope >= 35 ? C.red : maxSlope >= 30 ? C.orange : C.green

    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ ...LABEL, fontSize: 9, color: C.cyan }}>
            {fromLabel} → {toLabel}
          </div>
          <div style={{ ...LABEL, fontSize: 9, color: C.muted }}>
            {result.n_cells} CELLS
          </div>
        </div>

        {/* Hazard row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <StatRow
            label="MAX SLOPE"
            value={`${fmt(maxSlope)}°`}
            bar={<StatBar value={maxSlope} max={60} color={slopeColor} />}
          />
          <StatRow
            label="PRA RELEASE"
            value={fmt(maxPra, 2)}
            bar={<StatBar value={maxPra} max={1} color={C.amber} />}
          />
          <StatRow
            label="z-DELTA (M)"
            value={fmt(maxZdelta)}
            bar={<StatBar value={maxZdelta} max={50} color={C.red} />}
          />
          <StatRow
            label="OVERHEAD"
            value={fmt(maxCells, 0)}
            bar={<StatBar value={maxCells} max={100} color={C.purple} />}
          />
        </div>

        {result.forecast_applied && (
          <div style={{ ...LABEL, fontSize: 8, color: C.cyan, marginTop: 5 }}>
            FORECAST SCALING APPLIED
          </div>
        )}
      </div>
    )
  }

  return null
}

function StatRow({ label, value, bar }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ ...LABEL, fontSize: 8, color: C.muted }}>{label}</span>
        <span style={{ ...LABEL, fontSize: 9, color: C.text }}>{value}</span>
      </div>
      {bar}
    </div>
  )
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 4, height: 4,
          background: C.amber,
          animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
      <span style={{ ...LABEL, fontSize: 9, color: C.amber, marginLeft: 4 }}>
        COMPUTING
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Live context bar ──────────────────────────────────────────────────────────
function LiveContextBar({ liveCtx }) {
  if (!liveCtx) return null
  const { wind, zone_name, danger_level, afp_ok, warnings } = liveCtx
  return (
    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.panel }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <WindCompass dirDeg={wind?.direction_deg} speedMph={wind?.speed_mph} />
        {afp_ok && danger_level && (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              ...LABEL, fontSize: 10,
              color: dangerColor(danger_level),
              border: `1px solid ${dangerColor(danger_level)}`,
              padding: '1px 5px',
            }}>
              {dangerLabel(danger_level)}
            </div>
            <div style={{ ...LABEL, fontSize: 8, color: C.muted, marginTop: 2 }}>
              {zone_name ?? 'AFP ZONE'}
            </div>
          </div>
        )}
      </div>
      {warnings?.length > 0 && (
        <div style={{
          borderLeft: `2px solid ${C.amber}`,
          padding: '4px 6px',
          marginTop: 4,
          background: 'rgba(245,166,35,0.06)',
        }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ ...LABEL, fontSize: 8, color: C.amber, marginBottom: 2 }}>
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * @param {Object} props
 * @param {Array}  props.anchors    — array of [lon, lat]
 * @param {Array}  props.segments   — array of {status, result, error}
 * @param {Function} props.onRemoveAnchor  — (index) => void
 * @param {Function} props.onClearAll      — () => void
 */
export default function AnchorRoutePanel({ anchors, segments, onRemoveAnchor, onClearAll }) {
  // Derive latest live_context from last done segment
  let liveCtx = null
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i]?.status === 'done' && segments[i]?.result?.live_context) {
      liveCtx = segments[i].result.live_context
      break
    }
  }

  const isEmpty = anchors.length === 0

  return (
    <div style={{
      width: 240,
      height: '100%',
      background: C.bg,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ ...LABEL, fontSize: 12, color: C.cyan, marginBottom: 1 }}>
            ANCHOR ROUTE
          </div>
          <div style={{ ...LABEL, fontSize: 8, color: C.muted }}>
            CLICK MAP TO PLACE ANCHORS
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={onClearAll}
            style={{
              ...LABEL, fontSize: 8, color: C.muted,
              background: 'none', border: `1px solid ${C.border}`,
              padding: '2px 6px', cursor: 'pointer',
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Live context */}
      {liveCtx && <LiveContextBar liveCtx={liveCtx} />}

      {/* Anchors + segments */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
        {isEmpty ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                stroke={C.muted} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="5"/>
                <path d="M8 3v10M3 8h10" strokeWidth="1"/>
              </svg>
            </div>
            <div style={{ ...LABEL, fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
              CLICK THE MAP<br/>TO PLACE<br/>FIRST ANCHOR
            </div>
          </div>
        ) : (
          anchors.map((anchor, idx) => {
            const letter = ANCHOR_LETTERS[idx] ?? `(${idx + 1})`
            const seg    = segments[idx - 1] // segment from prev anchor to this one
            return (
              <div key={idx}>
                {/* Segment card (before this anchor, between idx-1 and idx) */}
                {idx > 0 && seg && (
                  <SegmentCard
                    segIndex={idx - 1}
                    segment={seg}
                    fromLabel={ANCHOR_LETTERS[idx - 1] ?? `(${idx})`}
                    toLabel={letter}
                  />
                )}

                {/* Anchor dot */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 2px',
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 22, height: 22, flexShrink: 0,
                    border: `1px solid ${C.cyan}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...LABEL, fontSize: 10, color: C.cyan,
                  }}>
                    {letter}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...LABEL, fontSize: 9, color: C.text }}>
                      {anchor[1].toFixed(4)}° N
                    </div>
                    <div style={{ ...LABEL, fontSize: 8, color: C.muted }}>
                      {anchor[0].toFixed(4)}° W
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveAnchor(idx)}
                    title={`Remove anchor ${letter}`}
                    style={{
                      background: 'none', border: 'none',
                      color: C.muted, cursor: 'pointer', padding: 2,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2L2 8"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* "Place next anchor" hint when route is in progress */}
        {anchors.length > 0 && anchors.length < 26 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 2px 10px',
            color: C.muted,
          }}>
            <div style={{
              width: 22, height: 22, flexShrink: 0,
              border: `1px dashed ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...LABEL, fontSize: 10, color: C.border,
            }}>
              {ANCHOR_LETTERS[anchors.length] ?? '+'}
            </div>
            <div style={{ ...LABEL, fontSize: 8, color: C.border }}>
              CLICK MAP TO ADD
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer — always visible */}
      <div style={{
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        borderLeft: `2px solid ${C.amber}`,
        padding: '8px 10px',
        background: 'rgba(245,166,35,0.05)',
        margin: 0,
      }}>
        <div style={{ ...LABEL, fontSize: 8, color: C.amber, marginBottom: 3 }}>
          PLANNING AID ONLY
        </div>
        <div style={{
          fontFamily: 'Barlow, sans-serif',
          fontSize: 9, color: C.muted, lineHeight: 1.5,
        }}>
          Routes are computed from terrain physics and the most recent daily forecast.
          Not a real-time safety assessment. Always consult the current forecast at{' '}
          <span style={{ color: C.amber }}>avalanche.org</span>, carry rescue gear,
          and apply your own judgment in the field.
        </div>
      </div>
    </div>
  )
}
