import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../services/supabase'
import heroBanner from '../assets/images/TQ-ski-and-ride-1.jpg'

const C = {
  bg: '#0A0F14',
  panel: '#070C10',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.2)',
  ghost: 'rgba(240,237,232,0.04)',
  input: 'rgba(7,12,16,0.8)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IconCamera = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 5.5A1.5 1.5 0 012.5 4h1l1.5-2h7L13.5 4h1A1.5 1.5 0 0116 5.5v8A1.5 1.5 0 0114.5 15h-11A1.5 1.5 0 012 13.5v-8z"/>
    <circle cx="9" cy="10" r="2.5"/>
  </svg>
)

// ── Lookups ───────────────────────────────────────────────────────────────────
const CREATOR_ID = '5178fd3d-91d3-444b-bd7e-6711197c3adb'

const REGION_LABELS = { sierra: 'Sierra', shasta: 'Shasta', bridgeport: 'Bridgeport', eastern_sierra: 'Eastern Sierra' }

const TOURING_STYLE_OPTIONS = [
  'Suffer-fest skinning', 'Mellow powder laps', 'Ski mountaineering',
  'Splitboarding', 'Dawn patrol', 'Overnight missions',
  'Technical couloirs', 'Tree skiing',
]
const BEACON_OPTIONS = [
  'Mammut Barryvox', 'BCA Tracker 4', 'Pieps Micro BT',
  'Ortovox 3+', 'Arva Neo Pro', 'Black Diamond Recon BT', 'Other',
]
const ABILITY_OPTIONS = [
  'Learning the basics', 'Comfortable on moderate terrain',
  'Comfortable in steep terrain', 'Advanced — technical lines',
  'Expert — high consequence terrain',
]

function getInitials(profile, user) {
  if (profile?.full_name) return profile.full_name.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (user?.email) return user.email.slice(0, 2).toUpperCase()
  return '?'
}

// ── Sub-components ────────────────────────────────────────────────────────────
const FieldLabel = ({ children }) => (
  <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 6 }}>{children}</div>
)

const Input = ({ value, onChange, placeholder, type = 'text', min, max, style: extra = {} }) => (
  <input
    type={type} value={value ?? ''} onChange={onChange}
    placeholder={placeholder} min={min} max={max}
    style={{
      width: '100%', padding: '9px 11px', boxSizing: 'border-box',
      backgroundColor: C.input, border: `1px solid ${C.border}`,
      color: C.text, fontFamily: "'Barlow', sans-serif", fontSize: 12,
      outline: 'none', transition: 'border-color 0.15s', ...extra,
    }}
    onFocus={e => e.target.style.borderColor = C.borderHover}
    onBlur={e => e.target.style.borderColor = C.border}
  />
)

const Select = ({ value, onChange, children }) => (
  <select
    value={value ?? ''}
    onChange={onChange}
    style={{
      width: '100%', padding: '9px 11px',
      backgroundColor: C.input, border: `1px solid ${C.border}`,
      color: value ? C.text : C.muted,
      fontFamily: "'Barlow', sans-serif", fontSize: 12,
      outline: 'none', appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='rgba(240,237,232,0.3)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      paddingRight: 28, transition: 'border-color 0.15s',
    }}
    onFocus={e => e.target.style.borderColor = C.borderHover}
    onBlur={e => e.target.style.borderColor = C.border}
  >
    {children}
  </select>
)

const SectionCard = ({ title, children }) => (
  <div style={{ border: `1px solid ${C.border}`, backgroundColor: C.ghost, marginBottom: 2 }}>
    <div style={{
      padding: '10px 16px',
      borderBottom: `1px solid ${C.border}`,
      ...LABEL, fontSize: 9, fontWeight: 700,
      color: C.faint,
    }}>{title}</div>
    <div style={{ padding: '16px' }}>{children}</div>
  </div>
)

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const [avatarHovered, setAvatarHovered] = useState(false)

  const form = profile || {}
  const setForm = next => setProfile(p => ({ ...p, ...next }))

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const [profileRes, routesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('routes').select('id, name, region, distance_km, elevation_gain_m').eq('user_id', user.id),
      ])
      setProfile(profileRes.data ? { ...profileRes.data } : { id: user.id, full_name: user.user_metadata?.full_name })
      if (routesRes.data) {
        setRoutes(routesRes.data)
        const totalTours = routesRes.data.length
        const totalDistance = routesRes.data.reduce((s, r) => s + (Number(r.distance_km) || 0), 0)
        const totalElevation = routesRes.data.reduce((s, r) => s + (Number(r.elevation_gain_m) || 0), 0)
        const counts = {}
        routesRes.data.map(r => r.region).filter(Boolean).forEach(r => { counts[r] = (counts[r] || 0) + 1 })
        const favoriteRegion = Object.keys(counts).length ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : null
        setStats({ totalTours, totalDistance, totalElevation, favoriteRegion })
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { setToast('Upload failed'); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: urlData.publicUrl }))
    e.target.value = ''
  }

  const handleSkiPhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/ski-photo.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { setToast('Upload failed'); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ ski_photo_url: urlData.publicUrl }).eq('id', user.id)
    setProfile(p => ({ ...p, ski_photo_url: urlData.publicUrl }))
    e.target.value = ''
  }

  const toggleTouringStyle = (style) => {
    const current = Array.isArray(form.touring_style) ? form.touring_style : []
    setForm({ touring_style: current.includes(style) ? current.filter(s => s !== style) : [...current, style] })
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
    if (error) { setToast('Save failed'); return }
    setToast('Profile saved')
    setTimeout(() => setToast(null), 3000)
  }

  if (!user) return null
  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: `1.5px solid ${C.border}`, borderTopColor: C.text, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
    </div>
  )

  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg, paddingBottom: 64 }}>

      {/* ── Hero ── */}
      <header style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img src={heroBanner} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.2) 0%, rgba(10,15,20,0.75) 100%)' }}/>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 32px 24px', display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={() => setAvatarHovered(true)}
              onMouseLeave={() => setAvatarHovered(false)}
              style={{
                width: 88, height: 88, overflow: 'hidden',
                border: `1px solid rgba(240,237,232,0.3)`,
                backgroundColor: form.avatar_url ? 'transparent' : 'rgba(240,237,232,0.08)',
                cursor: 'pointer', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.text,
              }}
            >
              {form.avatar_url
                ? <img src={form.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 800, color: C.text }}>{getInitials(form, user)}</span>
              }
              <span style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: avatarHovered ? 1 : 0,
                transition: 'opacity 0.15s',
                pointerEvents: 'none',
              }}>
                <IconCamera />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload}/>
          </div>

          {/* Name + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', color: C.text, margin: 0 }}>
                {form.username || 'Anonymous'}
              </h1>
              {user?.id === CREATOR_ID && (
                <span style={{ ...LABEL, fontSize: 8, color: 'rgba(255,215,0,0.8)', border: '1px solid rgba(255,215,0,0.3)', padding: '2px 6px', backgroundColor: 'rgba(255,215,0,0.06)' }}>
                  Founder
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {form.home_region && (
                <span style={{ ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.8)', border: '1px solid rgba(59,139,235,0.25)', padding: '2px 8px' }}>
                  {REGION_LABELS[form.home_region] || form.home_region}
                </span>
              )}
              {memberSince && (
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.faint }}>
                  Member since {memberSince}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: C.border }}/>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Stats bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 2, margin: '24px 0' }}>
          {[
            { label: 'Total Tours', value: String(stats.totalTours) },
            { label: 'Total Distance', value: `${Number(stats.totalDistance).toFixed(0)} km` },
            { label: 'Total Elevation', value: `${Number(stats.totalElevation).toLocaleString()} m` },
            { label: 'Favorite Region', value: stats.favoriteRegion ? REGION_LABELS[stats.favoriteRegion] || stats.favoriteRegion : '—' },
          ].map(s => (
            <div key={s.label} style={{ border: `1px solid ${C.border}`, padding: '12px 16px', backgroundColor: C.ghost }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
              <div style={{ ...LABEL, fontSize: 8, color: C.faint, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Two-col form ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            <SectionCard title="About">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <FieldLabel>Username</FieldLabel>
                  <Input value={form.username} onChange={e => setForm({ username: e.target.value })} placeholder="Choose a username"/>
                </div>
                <div>
                  <FieldLabel>Bio</FieldLabel>
                  <textarea
                    value={form.bio ?? ''}
                    onChange={e => setForm({ bio: e.target.value })}
                    placeholder="Tell the crew about yourself…"
                    rows={4}
                    style={{
                      width: '100%', padding: '9px 11px', boxSizing: 'border-box',
                      backgroundColor: C.input, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: "'Barlow', sans-serif", fontSize: 12,
                      resize: 'vertical', outline: 'none', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = C.borderHover}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>
                <div>
                  <FieldLabel>Years skiing backcountry</FieldLabel>
                  <Input type="number" min={0} value={form.years_backcountry} onChange={e => setForm({ years_backcountry: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="0"/>
                </div>
                <div>
                  <FieldLabel>Home Region</FieldLabel>
                  <Select value={form.home_region} onChange={e => setForm({ home_region: e.target.value || null })}>
                    <option value="">Select region</option>
                    {Object.entries(REGION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Touring Style">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TOURING_STYLE_OPTIONS.map(style => {
                  const selected = (form.touring_style || []).includes(style)
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => toggleTouringStyle(style)}
                      style={{
                        padding: '5px 11px',
                        border: `1px solid ${selected ? 'rgba(240,237,232,0.4)' : C.border}`,
                        backgroundColor: selected ? 'rgba(240,237,232,0.08)' : 'transparent',
                        color: selected ? C.text : C.muted,
                        ...LABEL, fontSize: 9, fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
                      }}
                    >
                      {style}
                    </button>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard title="Sponsor Me">
              <Input value={form.sponsor_me} onChange={e => setForm({ sponsor_me: e.target.value })} placeholder="I ski every weekend and my Instagram is definitely gonna blow up…"/>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, fontStyle: 'italic', color: C.faint, margin: '8px 0 0' }}>
                Not actually looking for sponsors. Probably.
              </p>
            </SectionCard>

          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            <SectionCard title="The Quiver">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <FieldLabel>Ski Model</FieldLabel>
                  <Input value={form.ski_model} onChange={e => setForm({ ski_model: e.target.value })} placeholder="e.g. Line Pescado"/>
                </div>
                <div>
                  <FieldLabel>Ski Year</FieldLabel>
                  <Input type="number" min={2000} max={2030} value={form.ski_year} onChange={e => setForm({ ski_year: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="e.g. 2024"/>
                </div>
                <div>
                  <FieldLabel>Binding Model</FieldLabel>
                  <Input value={form.binding_model} onChange={e => setForm({ binding_model: e.target.value })} placeholder="e.g. Dynafit Speed Radical"/>
                </div>
                <div>
                  <FieldLabel>Binding Year</FieldLabel>
                  <Input type="number" min={2000} max={2030} value={form.binding_year} onChange={e => setForm({ binding_year: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="e.g. 2023"/>
                </div>

                {/* Ski photo upload */}
                <div>
                  <FieldLabel>Ski Photo</FieldLabel>
                  <button
                    type="button"
                    onClick={() => skiPhotoInputRef.current?.click()}
                    style={{
                      position: 'relative', width: '100%',
                      aspectRatio: '16/5', overflow: 'hidden',
                      border: `1px dashed ${C.border}`,
                      backgroundColor: form.ski_photo_url ? 'transparent' : C.ghost,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {form.ski_photo_url ? (
                      <>
                        <img src={form.ski_photo_url} alt="Your skis" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        <span style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', color: C.text }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                          <IconCamera />
                        </span>
                      </>
                    ) : (
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.faint }}>Upload a photo of your skis</span>
                    )}
                  </button>
                  <input ref={skiPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSkiPhotoUpload}/>
                </div>

                <div>
                  <FieldLabel>Beacon</FieldLabel>
                  <Select value={form.beacon} onChange={e => setForm({ beacon: e.target.value || null })}>
                    <option value="">Select beacon</option>
                    {BEACON_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Ability Level</FieldLabel>
                  <Select value={form.ability_level} onChange={e => setForm({ ability_level: e.target.value || null })}>
                    <option value="">Select level</option>
                    {ABILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Safety Credentials">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <FieldLabel>AIARE Level</FieldLabel>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['None', 'Level 1', 'Level 2'].map(level => {
                      const active = (form.aiare_level || 'None') === level
                      return (
                        <label key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input
                            type="radio" name="aiare"
                            checked={active}
                            onChange={() => setForm({ aiare_level: level === 'None' ? null : level })}
                            style={{ accentColor: '#3B8BEB' }}
                          />
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.06em', color: active ? C.text : C.muted }}>
                            {level}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                {(form.aiare_level === 'Level 1' || form.aiare_level === 'Level 2') && (
                  <div>
                    <FieldLabel>AIARE Year</FieldLabel>
                    <Input type="number" min={1990} max={2030} value={form.aiare_year} onChange={e => setForm({ aiare_year: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="Year"/>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.wfa_certified}
                    onChange={e => setForm({ wfa_certified: e.target.checked })}
                    style={{ accentColor: '#3B8BEB', width: 14, height: 14 }}
                  />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: '0.06em', color: C.muted }}>
                    WFA Certified
                  </span>
                </label>
                <div>
                  <FieldLabel>Years of avy experience</FieldLabel>
                  <Input type="number" min={0} value={form.avy_experience_years} onChange={e => setForm({ avy_experience_years: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="0"/>
                </div>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: C.faint, margin: 0 }}>
                  Consider taking an AIARE course.{' '}
                  <a href="https://aiare.net/find-a-course/" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'rgba(59,139,235,0.75)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#3B8BEB'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(59,139,235,0.75)'}>
                    Find a course
                  </a>
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Favorite Route">
              {routes.length === 0 ? (
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, margin: 0 }}>
                  Save some routes first.{' '}
                  <Link to="/map" style={{ color: 'rgba(59,139,235,0.75)', textDecoration: 'none' }}>Go to Map</Link>
                </p>
              ) : (
                <Select value={form.favorite_route_id} onChange={e => setForm({ favorite_route_id: e.target.value || null })}>
                  <option value="">Select a route</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              )}
              {form.favorite_route_id && (() => {
                const route = routes.find(r => r.id === form.favorite_route_id)
                return route ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted }}>{route.name}</span>
                    {route.region && (
                      <span style={{ ...LABEL, fontSize: 8, color: 'rgba(59,139,235,0.7)', border: '1px solid rgba(59,139,235,0.2)', padding: '1px 6px' }}>
                        {REGION_LABELS[route.region]}
                      </span>
                    )}
                  </div>
                ) : null
              })()}
            </SectionCard>

          </div>
        </div>

        {/* ── Save button ── */}
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '13px 0',
              border: `1px solid ${saving ? C.border : 'rgba(240,237,232,0.4)'}`,
              backgroundColor: saving ? C.ghost : 'rgba(240,237,232,0.08)',
              color: saving ? C.faint : C.text,
              ...LABEL, fontSize: 12, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.borderColor = '#F0EDE8'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.14)' }}}
            onMouseLeave={e => { if (!saving) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.4)'; e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.08)' }}}
          >
            {saving ? (
              <>
                <div style={{ width: 14, height: 14, border: `1.5px solid ${C.border}`, borderTopColor: C.text, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                Saving…
              </>
            ) : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, padding: '9px 20px',
          backgroundColor: C.panel, border: `1px solid ${C.border}`,
          ...LABEL, fontSize: 10, color: C.text,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
