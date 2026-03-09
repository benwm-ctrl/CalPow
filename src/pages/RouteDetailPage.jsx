import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuthStore } from '../store/authStore'
import { useRouteStore } from '../store/routeStore'
import { ArrowLeft, Pencil, Trash2, Download, Camera } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

const REGION_LABELS = {
  sierra: 'Sierra',
  shasta: 'Shasta',
  bridgeport: 'Bridgeport',
  eastern_sierra: 'Eastern Sierra (ESAC)',
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
  low: 'bg-safe text-white',
  moderate: 'bg-yellow-500 text-gray-900',
  considerable: 'bg-warning text-white',
  high: 'bg-danger text-white',
  extreme: 'bg-red-800 text-white',
}
const RISK_DESCRIPTIONS = {
  low: 'Mellow terrain with minimal avalanche exposure. Good for beginners and low-consequence days.',
  moderate: 'Sustained avalanche terrain with multiple decision points. Requires AIARE 1 and forecast awareness.',
  considerable: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  high: 'Consequential terrain with significant exposure. For experienced parties with strong rescue skills.',
  extreme: 'Extreme terrain. High consequence, requires AIARE 2 or guide-level decision making.',
}
const DIFFICULTY_COLORS = {
  beginner: 'bg-accent-blue text-white',
  intermediate: 'bg-yellow-500 text-gray-900',
  advanced: 'bg-warning text-white',
  expert: 'bg-danger text-white',
}

function buildStaticMapUrl(waypoints, token) {
  if (!waypoints || waypoints.length < 2) return null

  // Build GeoJSON line for the overlay
  const coords = waypoints.map(([lng, lat]) => [lng, lat])
  const geojson = {
    type: 'Feature',
    properties: { stroke: '#3B8BEB', 'stroke-width': 3 },
    geometry: { type: 'LineString', coordinates: coords },
  }

  const encoded = encodeURIComponent(JSON.stringify(geojson))

  // Use 'auto' to fit the map to the route bounds
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encoded})/auto/800x400@2x?padding=40&access_token=${token}`
}

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
    setLoading(true)
    setError('')
    supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) {
          setError(e.message)
          setRoute(null)
        } else {
          setRoute(data)
          setEditForm({
            name: data.name ?? '',
            notes: data.notes ?? '',
            difficulty_rating: data.difficulty_rating ?? '',
            avalanche_risk: data.avalanche_risk ?? '',
          })
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !route?.id) return
    let cancelled = false
    supabase
      .from('route_images')
      .select('id, image_url, caption, created_at')
      .eq('route_id', id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setImages(data ?? [])
      })
    return () => { cancelled = true }
  }, [id, route?.id])

  const handleDownloadGpx = () => {
    if (!waypoints || waypoints.length < 2) return
    const xml = buildGpxXml(waypoints)
    const blob = new Blob([xml], { type: 'application/gpx+xml' })
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
    if (typeof wps === 'string') {
      try {
        wps = JSON.parse(wps)
      } catch {
        return
      }
    }
    if (!Array.isArray(wps) || wps.length < 2) return
    useRouteStore.getState().setWaypoints(wps)
    const lngs = wps.map((wp) => wp[0])
    const lats = wps.map((wp) => wp[1])
    useRouteStore.getState().setPendingBounds({
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    })
    navigate('/map')
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id || !route?.id) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/${route.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('route-images')
      .upload(path, file, { upsert: true })
    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      e.target.value = ''
      return
    }
    const { data: urlData } = supabase.storage.from('route-images').getPublicUrl(path)
    const { error: insertErr } = await supabase
      .from('route_images')
      .insert({ route_id: route.id, user_id: user.id, image_url: urlData.publicUrl })
    if (insertErr) setError(insertErr.message)
    else {
      const { data: list } = await supabase
        .from('route_images')
        .select('id, image_url, caption, created_at')
        .eq('route_id', route.id)
        .order('created_at', { ascending: false })
      setImages(list ?? [])
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleSaveEdit = async () => {
    if (!route?.id) return
    setSaving(true)
    const { error: e } = await supabase
      .from('routes')
      .update({
        name: editForm.name.trim() || route.name,
        notes: editForm.notes.trim() || null,
        difficulty_rating: editForm.difficulty_rating || route.difficulty_rating,
        avalanche_risk: editForm.avalanche_risk || route.avalanche_risk,
        updated_at: new Date().toISOString(),
      })
      .eq('id', route.id)
    setSaving(false)
    if (e) {
      setError(e.message)
      return
    }
    setRoute((prev) => ({ ...prev, ...editForm }))
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!route?.id) return
    setDeleting(true)
    const { error: e } = await supabase.from('routes').delete().eq('id', route.id)
    setDeleting(false)
    if (e) {
      setError(e.message)
      setDeleteConfirm(false)
      return
    }
    navigate('/library', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error && !route) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-danger">{error}</p>
        <Link to="/library" className="text-accent-blue hover:underline">
          Back to Library
        </Link>
      </div>
    )
  }

  if (!route) return null

  let waypoints = route.gpx_data
  if (typeof waypoints === 'string') {
    try {
      waypoints = JSON.parse(waypoints)
    } catch {
      waypoints = null
    }
  }
  const mapUrl = token ? buildStaticMapUrl(waypoints, token) : null

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background-primary p-6">
      <div className="max-w-2xl mx-auto px-4">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-accent-blue mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>

        {error && (
          <p className="mb-4 text-danger text-sm" role="alert">
            {error}
          </p>
        )}

        {!editing ? (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary">{route.name}</h1>
            <div className="flex flex-wrap gap-2 mt-3 text-sm text-text-secondary">
              {route.distance_km != null && (
                <span>{Number(route.distance_km).toFixed(1)} km</span>
              )}
              {route.elevation_gain_m != null && (
                <span>+{route.elevation_gain_m} m gain</span>
              )}
              {route.max_elevation_m != null && (
                <span>Max {route.max_elevation_m} m</span>
              )}
              {route.date_toured && (
                <span>{new Date(route.date_toured).toLocaleDateString()}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {route.region && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-background-elevated text-text-primary">
                  {REGION_LABELS[route.region]}
                </span>
              )}
              {route.difficulty_rating && (
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    DIFFICULTY_COLORS[route.difficulty_rating]
                  }`}
                >
                  {DIFFICULTY_LABELS[route.difficulty_rating]}
                </span>
              )}
              {route.avalanche_risk && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      RISK_COLORS[route.avalanche_risk]
                    }`}
                  >
                    {RISK_LABELS[route.avalanche_risk]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedRisk(!expandedRisk)}
                    className="text-text-secondary hover:text-text-primary text-xs w-4 h-4 rounded-full border border-current flex items-center justify-center"
                    aria-label="Risk description"
                  >
                    ⓘ
                  </button>
                </span>
              )}
            </div>
            {expandedRisk && route.avalanche_risk && (
              <div className="text-xs text-text-secondary mt-1">
                {RISK_DESCRIPTIONS[route.avalanche_risk] ?? RISK_DESCRIPTIONS.moderate}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 rounded-lg bg-background-secondary border border-border p-4 space-y-3">
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-white focus:outline-none focus:border-accent-blue"
              placeholder="Route name"
            />
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-white focus:outline-none focus:border-accent-blue"
              placeholder="Notes"
            />
            <select
              value={editForm.difficulty_rating}
              onChange={(e) => setEditForm((f) => ({ ...f, difficulty_rating: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-white focus:outline-none focus:border-accent-blue"
            >
              {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select
              value={editForm.avalanche_risk}
              onChange={(e) => setEditForm((f) => ({ ...f, avalanche_risk: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-background-primary border border-border text-white focus:outline-none focus:border-accent-blue"
            >
              {Object.entries(RISK_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 rounded-lg border border-border text-text-primary hover:bg-background-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-3 py-2 rounded-lg font-medium text-white bg-accent-blue hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {!editing && (
          <div className="flex flex-wrap gap-2 mb-6">
            {waypoints && waypoints.length >= 2 && (
              <button
                type="button"
                onClick={handleDownloadGpx}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-background-elevated"
              >
                <Download className="w-4 h-4" />
                Download GPX
              </button>
            )}
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-background-elevated disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Add Photos'}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </>
            )}
          </div>
        )}

        {route.notes && !editing && (
          <section className="mb-6">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
              Notes
            </h2>
            <p className="text-text-primary whitespace-pre-wrap">{route.notes}</p>
          </section>
        )}

        {mapUrl && (
          <div
            role="button"
            tabIndex={0}
            onClick={handleOpenOnMap}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleOpenOnMap()
              }
            }}
            style={{ cursor: waypoints && waypoints.length >= 2 ? 'pointer' : 'default' }}
            title={waypoints && waypoints.length >= 2 ? 'Click to view on map' : ''}
            className="mb-6 rounded-lg overflow-hidden border border-border"
          >
            <img
              src={mapUrl}
              alt="Route map"
              className="w-full rounded-lg"
              style={{ maxHeight: '400px', objectFit: 'cover' }}
            />
          </div>
        )}

        {images.length > 0 && !editing && (
          <section className="mb-6">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
              Photos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {images.map((img) => (
                <a
                  key={img.id}
                  href={img.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-border bg-background-secondary aspect-square"
                >
                  <img
                    src={img.image_url}
                    alt={img.caption || 'Route photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-3">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-background-elevated"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          )}
          {!deleteConfirm ? (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-danger border border-danger hover:bg-danger/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Delete this route?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded text-sm font-medium text-white bg-danger hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-1.5 rounded text-sm text-text-secondary hover:bg-background-elevated"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
