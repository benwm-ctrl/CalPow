import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuthStore } from '../store/authStore'
import { useRouteStore } from '../store/routeStore'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F14',
  panel: '#070C10',
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

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IconArrowLeft = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 6H2M2 6l4-4M2 6l4 4"/>
  </svg>
)
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3"/>
  </svg>
)
const IconDownload = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5"/>
    <path d="M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
  </svg>
)
const IconCamera = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4a1 1 0 011-1h1l1-1.5h4L9 3h1a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
    <circle cx="6" cy="6.5" r="1.5"/>
  </svg>
)
const IconInfo = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="5.5" cy="5.5" r="4.5"/>
    <path d="M5.5 4.5v3M5.5 3.5v.01"/>
  </svg>
)
const IconMap = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 2.5l3.5-1 3 1 3.5-1V9.5L8.5 10.5l-3-1-3.5 1V2.5z"/>
    <path d="M4.5 1.5v9M7.5 2.5v9"/>
  </svg>
)

// ── Lookups ───────────────────────────────────────────────────────────────────
const REGION_LABELS = {
  sierra: 'Sierra',
  shasta: 'Shasta',
  bridgeport: 'Bridgeport',
  eastern_sierra: 'Eastern Sierra',
}
const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
}
const RISK_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  considerable: 'Considerable',
  high: 'High',
  extreme: 'Extreme',
}
const RISK_COLORS = {
  low: '#38A169',
  moderate: '#D69E2E',
  considerable: '#DD6B20',
  high: '#E53E3E',
  extreme: '#9B2335',
}
const DIFFICULTY_COLORS = {
  beginner: '#3B8BEB',
  intermediate: '#D69E2E',
  advanced: '#DD6B20',
  expert: '#E53E3E',
}
const RISK_DESCRIPTIONS = {
  low: 'Mellow terrain with minimal avalanche exposure. Good for beginners and low-consequence days.',
  moderate: 'Sustained avalanche terrain with multiple decision points. Requires AIARE 1 and forecast awareness.',
  considerable: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  high: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  extreme: 'Extreme terrain. High consequence, requires AIARE 2 or guide-level decision making.',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildStaticMapUrl(waypoints, token) {
  if (!waypoints || waypoints.length < 2) return null
  const coords = waypoints.map(([lng, lat]) => [lng, lat])
  const geojson = { type: 'Feature', properties: { stroke: '#F0EDE8', 'stroke-width': 2 }, geometry: { type: 'LineString', coordinates: coords } }
  const encoded = encodeURIComponent(JSON.stringify(geojson))
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/800x400@2x?padding=40&access_token=${token}`
}

function buildGpxXml(waypoints) {
  const date = new Date().toISOString().slice(0, 10)
  const trkpts = waypoints.map(wp => `    <trkpt lat="${wp[1]}" lon="${wp[0]}"><ele>${wp[2] ?? 0}</ele></trkpt>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CalPow" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>CalPow Route ${date}</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`
}

// ── Sub-components ────────────────────────────────────────────────────────────
const GhostBtn = ({ onClick, disabled, children, style: extra = {} }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px',
      border: `1px solid ${C.border}`,
      backgroundColor: disabled ? 'transparent' : C.ghost,
      color: disabled ? C.faint : C.muted,
      ...LABEL, fontSize: 10, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
      ...extra,
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}}
    onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}}
  >
    {children}
  </button>
)

const inputStyle = {
  width: '100%', padding: '9px 11px', boxSizing: 'border-box',
  backgroundColor: 'rgba(7,12,16,0.8)', border: `1px solid ${C.border}`,
  color: C.text, fontFamily: "'Barlow', sans-serif", fontSize: 12,
  outline: 'none', transition: 'border-color 0.15s',
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RouteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const photoInputRef = useRef(null)
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', notes: '', difficulty_rating: '', avalanche_risk: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [expandedRisk, setExpandedRisk] = useState(false)
  const token = import.meta.env.VITE_MAPBOX_TOKEN

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true); setError('')
    supabase.from('routes').select('*').eq('id', id).single().then(({ data, error: e }) => {
      if (cancelled) return
      if (e) { setError(e.message); setRoute(null) }
      else {
        setRoute(data)
        setEditForm({ name: data.name ?? '', notes: data.notes ?? '', difficulty_rating: data.difficulty_rating ?? '', avalanche_risk: data.avalanche_risk ?? '' })
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !route?.id) return
    let cancelled = false
    supabase.from('route_images').select('id, image_url, caption, created_at').eq('route_id', id).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (!cancelled && !error) setImages(data ?? []) })
    return () => { cancelled = true }
  }, [id, route?.id])

  const handleDownloadGpx = () => {
    if (!waypoints || waypoints.length < 2) return
    const blob = new Blob([buildGpxXml(waypoints)], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calpow-${route?.name?.replace(/\W+/g, '-') || 'route'}-${new Date().toISOString().slice(0, 10)}.gpx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenOnMap = () => {
    if (!route?.gpx_data) return
    let wps = route.gpx_data
    if (typeof wps === 'string') { try { wps = JSON.parse(wps) } catch { return } }
    if (!Array.isArray(wps) || wps.length < 2) return
    useRouteStore.getState().setWaypoints(wps)
    const lngs = wps.map(wp => wp[0]); const lats = wps.map(wp => wp[1])
    useRouteStore.getState().setPendingBounds({ minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) })
    navigate('/map')
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !route?.id) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${route.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('route-images').upload(path, file, { upsert: true })
    if (uploadErr) { setError(uploadErr.message); setUploading(false); e.target.value = ''; return }
    const { data: urlData } = supabase.storage.from('route-images').getPublicUrl(path)
    const { error: insertErr } = await supabase.from('route_images').insert({ route_id: route.id, user_id: user.id, image_url: urlData.publicUrl })
    if (insertErr) setError(insertErr.message)
    else {
      const { data: list } = await supabase.from('route_images').select('id, image_url, caption, created_at').eq('route_id', route.id).order('created_at', { ascending: false })
      setImages(list ?? [])
    }
    setUploading(false); e.target.value = ''
  }

  const handleSaveEdit = async () => {
    if (!route?.id) return
    setSaving(true)
    const { error: e } = await supabase.from('routes').update({
      name: editForm.name.trim() || route.name,
      notes: editForm.notes.trim() || null,
      difficulty_rating: editForm.difficulty_rating || route.difficulty_rating,
      avalanche_risk: editForm.avalanche_risk || route.avalanche_risk,
      updated_at: new Date().toISOString(),
    }).eq('id', route.id)
    setSaving(false)
    if (e) { setError(e.message); return }
    setRoute(prev => ({ ...prev, ...editForm }))
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!route?.id) return
    setDeleting(true)
    const { error: e } = await supabase.from('routes').delete().eq('id', route.id)
    setDeleting(false)
    if (e) { setError(e.message); setDeleteConfirm(false); return }
    navigate('/library', { replace: true })
  }

  // ── Loading / error states ──
  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner />
    </div>
  )

  if (error && !route) return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: 'rgba(229,62,62,0.8)' }}>{error}</p>
      <Link to="/library" style={{ ...LABEL, fontSize: 10, color: C.muted, textDecoration: 'none', borderBottom: `1px solid ${C.border}` }}>Back to Library</Link>
    </div>
  )

  if (!route) return null

  let waypoints = route.gpx_data
  if (typeof waypoints === 'string') { try { waypoints = JSON.parse(waypoints) } catch { waypoints = null } }
  const mapUrl = token ? buildStaticMapUrl(waypoints, token) : null

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg, paddingBottom: 64 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Back link ── */}
        <Link
          to="/library"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...LABEL, fontSize: 9, color: C.faint, textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.faint}
        >
          <IconArrowLeft /> Library
        </Link>

        {error && (
          <p role="alert" style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: 'rgba(229,62,62,0.8)', borderLeft: '2px solid rgba(229,62,62,0.4)', paddingLeft: 8, marginBottom: 16 }}>
            {error}
          </p>
        )}

        {/* ── View mode header ── */}
        {!editing ? (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, letterSpacing: '0.01em', textTransform: 'uppercase', color: C.text, margin: '0 0 12px', lineHeight: 1 }}>
              {route.name}
            </h1>

            {/* Stats row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 12, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
              {[
                route.distance_km != null && { label: 'Distance', value: `${Number(route.distance_km).toFixed(1)} km` },
                route.elevation_gain_m != null && { label: 'Gain', value: `+${route.elevation_gain_m} m` },
                route.max_elevation_m != null && { label: 'Max Elev', value: `${route.max_elevation_m} m` },
                route.date_toured && { label: 'Toured', value: new Date(route.date_toured).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
              ].filter(Boolean).map(s => (
                <div key={s.label} style={{ padding: '8px 16px', borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tags row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {route.region && (
                <span style={{ ...LABEL, fontSize: 9, color: C.muted, border: `1px solid ${C.border}`, padding: '3px 9px' }}>
                  {REGION_LABELS[route.region] || route.region}
                </span>
              )}
              {route.difficulty_rating && (
                <span style={{
                  ...LABEL, fontSize: 9, fontWeight: 700,
                  color: '#fff',
                  backgroundColor: DIFFICULTY_COLORS[route.difficulty_rating] || '#4A5568',
                  padding: '3px 9px',
                }}>
                  {DIFFICULTY_LABELS[route.difficulty_rating]}
                </span>
              )}
              {route.avalanche_risk && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    ...LABEL, fontSize: 9, fontWeight: 700,
                    color: '#fff',
                    backgroundColor: RISK_COLORS[route.avalanche_risk] || '#4A5568',
                    padding: '3px 9px',
                  }}>
                    {RISK_LABELS[route.avalanche_risk]} Risk
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedRisk(!expandedRisk)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.faint, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                    aria-label="Risk description"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.faint }}
                  >
                    <IconInfo />
                  </button>
                </span>
              )}
            </div>

            {expandedRisk && route.avalanche_risk && (
              <div style={{ marginTop: 8, padding: '10px 12px', border: `1px solid ${C.border}`, borderLeft: `3px solid ${RISK_COLORS[route.avalanche_risk]}`, backgroundColor: C.ghost }}>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.6 }}>
                  {RISK_DESCRIPTIONS[route.avalanche_risk]}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Edit mode ── */
          <div style={{ marginBottom: 24, border: `1px solid ${C.border}`, backgroundColor: C.ghost }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, ...LABEL, fontSize: 9, color: C.faint }}>
              Editing Route
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Route name"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = C.borderHover}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={4}
                placeholder="Notes"
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => e.target.style.borderColor = C.borderHover}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              {[
                { key: 'difficulty_rating', label: 'Difficulty', options: DIFFICULTY_LABELS },
                { key: 'avalanche_risk', label: 'Avalanche Risk', options: RISK_LABELS },
              ].map(({ key, label, options }) => (
                <div key={key}>
                  <div style={{ ...LABEL, fontSize: 9, color: C.faint, marginBottom: 5 }}>{label}</div>
                  <select
                    value={editForm[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      ...inputStyle,
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='rgba(240,237,232,0.3)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28,
                    }}
                    onFocus={e => e.target.style.borderColor = C.borderHover}
                    onBlur={e => e.target.style.borderColor = C.border}
                  >
                    <option value="">—</option>
                    {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <GhostBtn onClick={() => setEditing(false)}>Cancel</GhostBtn>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px',
                    border: `1px solid ${saving ? C.border : 'rgba(240,237,232,0.4)'}`,
                    backgroundColor: saving ? 'transparent' : 'rgba(240,237,232,0.09)',
                    color: saving ? C.faint : C.text,
                    ...LABEL, fontSize: 10, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!saving) { e.currentTarget.style.borderColor = '#F0EDE8'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.14)' }}}
                  onMouseLeave={e => { if (!saving) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.09)' }}}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Action bar ── */}
        {!editing && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
            {waypoints && waypoints.length >= 2 && (
              <GhostBtn onClick={handleDownloadGpx}><IconDownload /> Download GPX</GhostBtn>
            )}
            {waypoints && waypoints.length >= 2 && (
              <GhostBtn onClick={handleOpenOnMap}><IconMap /> Open on Map</GhostBtn>
            )}
            {user && (
              <>
                <GhostBtn onClick={() => photoInputRef.current?.click()} disabled={uploading}>
                  <IconCamera /> {uploading ? 'Uploading…' : 'Add Photos'}
                </GhostBtn>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect}/>
              </>
            )}
            <GhostBtn onClick={() => setEditing(true)}><IconEdit /> Edit</GhostBtn>
          </div>
        )}

        {/* ── Notes ── */}
        {route.notes && !editing && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ ...LABEL, fontSize: 9, color: C.faint, marginBottom: 10 }}>Notes</div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {route.notes}
            </p>
          </section>
        )}

        {/* ── Static map ── */}
        {mapUrl && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenOnMap}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenOnMap() }}}
            style={{
              marginBottom: 28,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
              cursor: waypoints && waypoints.length >= 2 ? 'pointer' : 'default',
              position: 'relative',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (waypoints?.length >= 2) e.currentTarget.style.borderColor = C.borderHover }}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            title={waypoints && waypoints.length >= 2 ? 'Open on map' : ''}
          >
            <img
              src={mapUrl}
              alt="Route map"
              style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }}
            />
            {waypoints && waypoints.length >= 2 && (
              <div style={{
                position: 'absolute', bottom: 10, right: 10,
                ...LABEL, fontSize: 8, color: 'rgba(240,237,232,0.7)',
                backgroundColor: 'rgba(7,12,16,0.75)',
                padding: '4px 8px',
                border: `1px solid rgba(240,237,232,0.15)`,
              }}>
                Open on Map
              </div>
            )}
          </div>
        )}

        {/* ── Photos ── */}
        {images.length > 0 && !editing && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ ...LABEL, fontSize: 9, color: C.faint, marginBottom: 10 }}>
              Photos <span style={{ color: 'rgba(240,237,232,0.2)' }}>({images.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2 }}>
              {images.map(img => (
                <a
                  key={img.id}
                  href={img.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', overflow: 'hidden', border: `1px solid ${C.border}`, aspectRatio: '1', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <img
                    src={img.image_url}
                    alt={img.caption || 'Route photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Delete zone ── */}
        {!editing && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px',
                  border: '1px solid rgba(229,62,62,0.3)',
                  backgroundColor: 'transparent',
                  color: 'rgba(229,62,62,0.6)',
                  ...LABEL, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(229,62,62,0.7)'; e.currentTarget.style.color = '#E53E3E' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(229,62,62,0.3)'; e.currentTarget.style.color = 'rgba(229,62,62,0.6)' }}
              >
                <IconTrash /> Delete Route
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted }}>
                  Permanently delete this route?
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px',
                    border: '1px solid rgba(229,62,62,0.5)',
                    backgroundColor: 'rgba(229,62,62,0.1)',
                    color: '#E53E3E',
                    ...LABEL, fontSize: 10, fontWeight: 700,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.6 : 1,
                    transition: 'border-color 0.15s',
                  }}
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '6px 14px',
                    border: `1px solid ${C.border}`,
                    backgroundColor: 'transparent',
                    color: C.muted,
                    ...LABEL, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
