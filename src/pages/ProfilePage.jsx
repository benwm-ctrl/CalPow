import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../services/supabase'
import { Camera } from 'lucide-react'
import heroBanner from '../assets/images/TQ-ski-and-ride-1.jpg'

const ACCENT_BLUE = '#3B8BEB'
const CARD_BG = '#1E2D3D'
const BORDER = '#2D3748'

const CREATOR_ID = '5178fd3d-91d3-444b-bd7e-6711197c3adb'

const REGION_LABELS = {
  sierra: 'Sierra',
  shasta: 'Shasta',
  bridgeport: 'Bridgeport',
  eastern_sierra: 'Eastern Sierra',
}

const TOURING_STYLE_OPTIONS = [
  'Suffer-fest skinning',
  'Mellow powder laps',
  'Ski mountaineering',
  'Splitboarding',
  'Dawn patrol',
  'Overnight missions',
  'Technical couloirs',
  'Tree skiing',
]

const BEACON_OPTIONS = [
  'Mammut Barryvox',
  'BCA Tracker 4',
  'Pieps Micro BT',
  'Ortovox 3+',
  'Arva Neo Pro',
  'Black Diamond Recon BT',
  'Other',
]

const ABILITY_OPTIONS = [
  'Learning the basics',
  'Comfortable on moderate terrain',
  'Comfortable in steep terrain',
  'Advanced — technical lines',
  'Expert — high consequence terrain',
]

function getInitials(profile, user) {
  if (profile?.full_name) {
    return profile.full_name.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (user?.user_metadata?.full_name) {
    return user.user_metadata.full_name.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (user?.email) return user.email.slice(0, 2).toUpperCase()
  return '?'
}

export default function ProfilePage() {
  const { user } = useAuthStore()
  const fileInputRef = useRef(null)
  const skiPhotoInputRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [routes, setRoutes] = useState([])
  const [stats, setStats] = useState({ totalTours: 0, totalDistance: 0, totalElevation: 0, favoriteRegion: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const form = profile || {}
  const setForm = (next) => setProfile((p) => ({ ...p, ...next }))

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const [profileRes, routesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('routes').select('id, name, region, distance_km, elevation_gain_m').eq('user_id', user.id),
      ])
      if (profileRes.data) setProfile({ ...profileRes.data })
      else setProfile({ id: user.id, full_name: user.user_metadata?.full_name })
      if (routesRes.data) {
        setRoutes(routesRes.data)
        const totalTours = routesRes.data.length
        const totalDistance = routesRes.data.reduce((s, r) => s + (Number(r.distance_km) || 0), 0)
        const totalElevation = routesRes.data.reduce((s, r) => s + (Number(r.elevation_gain_m) || 0), 0)
        const regions = routesRes.data.map((r) => r.region).filter(Boolean)
        const counts = {}
        regions.forEach((r) => { counts[r] = (counts[r] || 0) + 1 })
        const favoriteRegion = Object.keys(counts).length ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : null
        setStats({ totalTours, totalDistance, totalElevation, favoriteRegion })
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  const handleAvatarClick = () => fileInputRef.current?.click()
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      setToast('Upload failed')
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
    setProfile((p) => ({ ...p, avatar_url: urlData.publicUrl }))
    e.target.value = ''
  }

  const handleSkiPhotoClick = () => skiPhotoInputRef.current?.click()
  const handleSkiPhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/ski-photo.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      setToast('Upload failed')
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ ski_photo_url: urlData.publicUrl }).eq('id', user.id)
    setProfile((p) => ({ ...p, ski_photo_url: urlData.publicUrl }))
    e.target.value = ''
  }

  const toggleTouringStyle = (style) => {
    const current = Array.isArray(form.touring_style) ? form.touring_style : []
    const next = current.includes(style) ? current.filter((s) => s !== style) : [...current, style]
    setForm({ touring_style: next })
  }

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    const payload = {
      id: user.id,
      username: form.username || null,
      full_name: form.full_name,
      avatar_url: form.avatar_url,
      home_region: form.home_region || null,
      years_backcountry: form.years_backcountry ?? null,
      ski_model: form.ski_model || null,
      ski_year: form.ski_year ?? null,
      binding_model: form.binding_model || null,
      binding_year: form.binding_year ?? null,
      ski_photo_url: form.ski_photo_url || null,
      beacon: form.beacon || null,
      ability_level: form.ability_level || null,
      touring_style: form.touring_style?.length ? form.touring_style : null,
      aiare_level: form.aiare_level || null,
      aiare_year: form.aiare_year ?? null,
      wfa_certified: !!form.wfa_certified,
      avy_experience_years: form.avy_experience_years ?? null,
      bio: form.bio || null,
      sponsor_me: form.sponsor_me || null,
      favorite_route_id: form.favorite_route_id || null,
    }
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    setSaving(false)
    if (error) {
      setToast('Save failed')
      return
    }
    setToast('Profile updated! 🤙')
    setTimeout(() => setToast(null), 3000)
  }

  if (!user) return null
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-background-primary">
        <div className="w-8 h-8 border-2 border-white border-t-[#3B8BEB] rounded-full animate-spin" />
      </div>
    )
  }

  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background-primary pb-12">
      {/* Hero */}
      <header className="relative w-full h-[200px] overflow-hidden">
        <img src={heroBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(15,25,35,0.6)' }} />
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4 flex-wrap">
          <div className="relative group">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative flex items-center justify-center w-[100px] h-[100px] rounded-full overflow-hidden border-2 border-white/40 shrink-0"
              style={{ backgroundColor: form.avatar_url ? 'transparent' : ACCENT_BLUE }}
            >
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{getInitials(form, user)}</span>
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-white" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {form.username || 'Anonymous'}
              {user?.id === CREATOR_ID && (
                <span style={{
                  textShadow: '0 0 12px rgba(255, 215, 0, 0.9), 0 0 24px rgba(255, 215, 0, 0.5)',
                  fontSize: '1.3em',
                  lineHeight: 1,
                }}>
                  👑
                </span>
              )}
            </h1>
            {form.home_region && (
              <span
                className="inline-flex w-fit px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: ACCENT_BLUE }}
              >
                {REGION_LABELS[form.home_region] || form.home_region}
              </span>
            )}
            {memberSince && <p className="text-sm text-white/80">Member since {memberSince}</p>}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 -mt-2 z-10 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '🗺️', label: 'Total Tours', value: String(stats.totalTours) },
            { icon: '📏', label: 'Total Distance', value: `${Number(stats.totalDistance).toFixed(0)} km` },
            { icon: '⛰️', label: 'Total Elevation', value: `${Number(stats.totalElevation).toLocaleString()} m` },
            { icon: '🏔️', label: 'Favorite Region', value: stats.favoriteRegion ? REGION_LABELS[stats.favoriteRegion] || stats.favoriteRegion : '—' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-4"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <p className="text-2xl font-bold" style={{ color: ACCENT_BLUE }}>{s.value}</p>
              <p className="text-sm text-text-secondary mt-0.5">{s.icon} {s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns */}
      <div className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>About</h2>
            <label className="block text-xs text-text-secondary mb-1">Username</label>
            <input
              type="text"
              value={form.username ?? ''}
              onChange={(e) => setForm({ username: e.target.value })}
              placeholder="Choose a username"
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted mb-4"
              style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
            />
            <textarea
              value={form.bio ?? ''}
              onChange={(e) => setForm({ bio: e.target.value })}
              placeholder="Tell the crew about yourself..."
              className="w-full h-24 px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted resize-y mb-4"
              style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
            />
            <div className="space-y-3">
              <input
                type="number"
                min={0}
                value={form.years_backcountry ?? ''}
                onChange={(e) => setForm({ years_backcountry: e.target.value ? parseInt(e.target.value, 10) : null })}
                placeholder="Years skiing backcountry"
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              />
              <select
                value={form.home_region ?? ''}
                onChange={(e) => setForm({ home_region: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              >
                <option value="">Home region</option>
                {Object.entries(REGION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>Touring Style</h2>
            <div className="flex flex-wrap gap-2">
              {TOURING_STYLE_OPTIONS.map((style) => {
                const selected = (form.touring_style || []).includes(style)
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleTouringStyle(style)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: selected ? ACCENT_BLUE : 'transparent',
                      color: selected ? '#fff' : '#A0AEC0',
                      border: `1px solid ${selected ? ACCENT_BLUE : BORDER}`,
                    }}
                  >
                    {style}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>Sponsor Me 🤙</h2>
            <input
              type="text"
              value={form.sponsor_me ?? ''}
              onChange={(e) => setForm({ sponsor_me: e.target.value })}
              placeholder="I ski every weekend and my Instagram is definitely gonna blow up..."
              className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
              style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
            />
            <p className="text-xs text-text-muted italic mt-2">Not actually looking for sponsors. Probably.</p>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>The Quiver 🎿</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ski Model</label>
                <input
                  type="text"
                  value={form.ski_model ?? ''}
                  onChange={(e) => setForm({ ski_model: e.target.value })}
                  placeholder="e.g. Line Pescado"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                  style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ski Year</label>
                <input
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.ski_year ?? ''}
                  onChange={(e) => setForm({ ski_year: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="e.g. 2024"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                  style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
                />
              </div>
              {(form.ski_year || form.ski_model) && (
                <p className="text-sm text-text-secondary">
                  {[form.ski_year, form.ski_model].filter(Boolean).join(' ')}
                </p>
              )}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Binding Model</label>
                <input
                  type="text"
                  value={form.binding_model ?? ''}
                  onChange={(e) => setForm({ binding_model: e.target.value })}
                  placeholder="e.g. Dynafit Speed Radical"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                  style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Binding Year</label>
                <input
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.binding_year ?? ''}
                  onChange={(e) => setForm({ binding_year: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="e.g. 2023"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                  style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
                />
              </div>
              {(form.binding_year || form.binding_model) && (
                <p className="text-sm text-text-secondary">
                  {[form.binding_year, form.binding_model].filter(Boolean).join(' ')}
                </p>
              )}
              <div className="pt-2">
                <label className="block text-xs text-text-secondary mb-2">Ski photo</label>
                <button
                  type="button"
                  onClick={handleSkiPhotoClick}
                  className="relative w-full rounded-lg overflow-hidden border-2 border-dashed transition-colors group"
                  style={{
                    borderColor: BORDER,
                    aspectRatio: '16/5',
                    backgroundColor: form.ski_photo_url ? 'transparent' : 'rgba(15, 25, 35, 0.5)',
                  }}
                >
                  {form.ski_photo_url ? (
                    <>
                      <img src={form.ski_photo_url} alt="Your skis" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-10 h-10 text-white" />
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">Upload a photo of your skis 🎿</span>
                  )}
                </button>
                <input
                  ref={skiPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSkiPhotoUpload}
                />
              </div>
              <select
                value={form.beacon ?? ''}
                onChange={(e) => setForm({ beacon: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              >
                <option value="">Beacon</option>
                {BEACON_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select
                value={form.ability_level ?? ''}
                onChange={(e) => setForm({ ability_level: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              >
                <option value="">Ability level</option>
                {ABILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>Safety Credentials 🦺</h2>
            <div className="space-y-3">
              <div className="flex gap-4">
                {['None', 'Level 1', 'Level 2'].map((level) => (
                  <label key={level} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="aiare"
                      checked={(form.aiare_level || 'None') === level}
                      onChange={() => setForm({ aiare_level: level === 'None' ? null : level })}
                      className="text-accent-blue"
                    />
                    <span className="text-sm text-text-primary">{level}</span>
                  </label>
                ))}
              </div>
              {(form.aiare_level === 'Level 1' || form.aiare_level === 'Level 2') && (
                <input
                  type="number"
                  min={1990}
                  max={2030}
                  value={form.aiare_year ?? ''}
                  onChange={(e) => setForm({ aiare_year: e.target.value ? parseInt(e.target.value, 10) : null })}
                  placeholder="Year"
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                  style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
                />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.wfa_certified}
                  onChange={(e) => setForm({ wfa_certified: e.target.checked })}
                  className="rounded text-accent-blue"
                />
                <span className="text-sm text-text-primary">WFA Certified</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.avy_experience_years ?? ''}
                onChange={(e) => setForm({ avy_experience_years: e.target.value ? parseInt(e.target.value, 10) : null })}
                placeholder="Years of avy education/experience"
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-3">
              Consider taking an AIARE course if you haven't.{' '}
              <a href="https://aiare.net/find-a-course/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: ACCENT_BLUE }}>Find a course</a>
            </p>
          </div>

          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: ACCENT_BLUE }}>Favorite Route ⭐</h2>
            {routes.length === 0 ? (
              <p className="text-sm text-text-secondary">
                Save some routes first! <Link to="/map" className="underline" style={{ color: ACCENT_BLUE }}>Go to Map</Link>
              </p>
            ) : (
              <select
                value={form.favorite_route_id ?? ''}
                onChange={(e) => setForm({ favorite_route_id: e.target.value || null })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{ backgroundColor: '#0F1923', border: `1px solid ${BORDER}` }}
              >
                <option value="">Select a route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            {form.favorite_route_id && (() => {
              const route = routes.find((r) => r.id === form.favorite_route_id)
              return route ? (
                <p className="text-sm text-text-secondary mt-2">
                  {route.name}
                  {route.region && (
                    <span className="ml-2 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: ACCENT_BLUE }}>{REGION_LABELS[route.region]}</span>
                  )}
                </p>
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ backgroundColor: ACCENT_BLUE }}
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white shadow-lg"
          style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
