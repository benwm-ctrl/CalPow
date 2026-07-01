import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import FadeIn from '../components/FadeIn'
import { fetchForecast, fetchMostRecentCachedForecast, FALLBACK_URLS, DANGER_LABELS, DANGER_COLORS } from '../services/avalancheForecast'
import { supabase } from '../services/supabase'
import skierSummit from '../assets/images/ZachH_McGee-10-1536x1016.jpg'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F14',
  panel: '#070C10',
  border: 'rgba(240,237,232,0.09)',
  borderHover: 'rgba(240,237,232,0.22)',
  text: '#F0EDE8',
  muted: 'rgba(240,237,232,0.45)',
  faint: 'rgba(240,237,232,0.22)',
  ghost: 'rgba(240,237,232,0.04)',
}
const LABEL = {
  fontFamily: "'Barlow Condensed', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
}

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IconExternal = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M4 2H2.5A1.5 1.5 0 001 3.5v4A1.5 1.5 0 002.5 9h4A1.5 1.5 0 008 7.5V6"/>
    <path d="M6 1H9M9 1v3M9 1L4.5 5.5"/>
  </svg>
)
const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 5.5l2.5 2.5 4.5-5"/>
  </svg>
)
const IconDownload = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5"/>
    <path d="M1 9.5v1a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-1"/>
  </svg>
)

// ── Data ──────────────────────────────────────────────────────────────────────
const CHECKLIST_STORAGE_KEY = 'calpow-gear-checklist'

const GEAR_ITEMS = [
  {
    category: 'Avalanche Safety (required)',
    items: [
      { id: 'beacon', label: 'Avalanche beacon — tested and on body' },
      { id: 'probe', label: 'Probe — in pack' },
      { id: 'shovel', label: 'Shovel — in pack' },
      { id: 'airbag', label: 'Airbag pack (recommended)' },
    ],
  },
  {
    category: 'Navigation',
    items: [
      { id: 'offline-map', label: 'Downloaded offline map (Gaia GPS, CalTopo, or OnX)' },
      { id: 'compass', label: 'Compass' },
      { id: 'gps', label: 'GPS device or phone with GPS' },
    ],
  },
  {
    category: 'Communication',
    items: [
      { id: 'phone', label: 'Fully charged phone' },
      { id: 'sat-com', label: 'Satellite communicator (inReach or SPOT)' },
      { id: 'trip-plan', label: 'Trip plan filed with someone at home' },
    ],
  },
  {
    category: 'Layers & Clothing',
    items: [
      { id: 'base', label: 'Moisture-wicking base layer' },
      { id: 'mid', label: 'Insulating mid layer' },
      { id: 'shell', label: 'Waterproof shell jacket and pants' },
      { id: 'hat-gloves', label: 'Warm hat and gloves (+ spare gloves)' },
      { id: 'goggles', label: 'Goggles and sunglasses' },
      { id: 'sun', label: 'Sun protection (sunscreen + lip balm)' },
    ],
  },
  {
    category: 'Ski Gear',
    items: [
      { id: 'skis', label: 'Skis with touring bindings' },
      { id: 'skins', label: 'Climbing skins' },
      { id: 'crampons', label: 'Ski crampons (if icy conditions)' },
      { id: 'helmet', label: 'Helmet' },
    ],
  },
  {
    category: 'Emergency & Nutrition',
    items: [
      { id: 'first-aid', label: 'First aid kit' },
      { id: 'bivy', label: 'Emergency bivy or space blanket' },
      { id: 'headlamp', label: 'Headlamp with extra batteries' },
      { id: 'food', label: 'Food and water (more than you think)' },
      { id: 'hand-warmers', label: 'Hand warmers' },
    ],
  },
]

const allItemIds = GEAR_ITEMS.flatMap(g => g.items.map(i => i.id))
const TOTAL_ITEMS = allItemIds.length

const REGION_CONFIG = [
  { key: 'sierra', title: 'Sierra Nevada', centerName: 'Sierra Avalanche Center' },
  { key: 'shasta', title: 'Mt. Shasta', centerName: 'Mt. Shasta Avalanche Center' },
  { key: 'bridgeport', title: 'Bridgeport', centerName: 'Bridgeport Avalanche Center' },
  { key: 'eastern_sierra', title: 'Eastern Sierra', centerName: 'Eastern Sierra Avalanche Center' },
]

const WEATHER_LINKS = [
  { title: 'NWS Sierra', desc: 'South Lake Tahoe area', url: 'https://forecast.weather.gov/MapClick.php?CityName=South+Lake+Tahoe&state=CA' },
  { title: 'NWS Shasta', desc: 'Mount Shasta area', url: 'https://forecast.weather.gov/MapClick.php?CityName=Mount+Shasta&state=CA' },
  { title: 'NWS Bridgeport', desc: 'Bridgeport area', url: 'https://forecast.weather.gov/MapClick.php?CityName=Bridgeport&state=CA' },
  { title: 'NWS Mammoth', desc: 'Mammoth Lakes area', url: 'https://forecast.weather.gov/MapClick.php?CityName=Mammoth+Lakes&state=CA' },
  { title: 'OpenSnow CA', desc: 'Ski and backcountry weather', url: 'https://opensnow.com/state/CA' },
]

function loadCheckedSet() {
  try { const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY); return new Set(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) } catch { return new Set() }
}
function saveCheckedSet(set) {
  try { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...set])) } catch {}
}

function getTripPlanHTML() {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CalPow Trip Plan</title>
<style>body{font-family:system-ui,sans-serif;background:#0A0F14;color:#F0EDE8;max-width:800px;margin:0 auto;padding:40px 24px}.header{border-bottom:1px solid rgba(240,237,232,0.1);padding-bottom:24px;margin-bottom:32px}.logo{font-size:24px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.title{font-size:14px;color:rgba(240,237,232,0.45);margin-top:4px;font-family:monospace}.section{margin-bottom:32px}.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:rgba(240,237,232,0.3);margin-bottom:12px;border-top:1px solid rgba(240,237,232,0.07);padding-top:12px}.field{border:1px solid rgba(240,237,232,0.09);padding:14px;margin-bottom:8px}.field-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:rgba(240,237,232,0.3);margin-bottom:8px}.field-value{border-bottom:1px solid rgba(240,237,232,0.09);padding-bottom:8px;min-height:28px;font-size:14px}.warning{border:1px solid rgba(229,62,62,0.3);border-left:3px solid #E53E3E;padding:14px 16px;margin-bottom:32px;color:rgba(229,62,62,0.8);font-size:12px}.footer{border-top:1px solid rgba(240,237,232,0.07);padding-top:24px;color:rgba(240,237,232,0.2);font-size:11px;text-align:center}</style>
</head><body>
<div class="header"><div class="logo">CalPow</div><div class="title">Backcountry Trip Plan — ${dateStr}</div></div>
<div class="warning">Always check the current avalanche forecast before heading out. File this plan with someone who will call for help if you don't check in.</div>
<div class="section"><div class="section-title">Tour Details</div>
<div class="field"><div class="field-label">Route Name</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Date & Start Time</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Trailhead / Start Location</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Planned Route Description</div><div class="field-value" style="min-height:60px"></div></div>
<div class="field"><div class="field-label">Expected Return Time</div><div class="field-value"></div></div></div>
<div class="section"><div class="section-title">Group</div>
<div class="field"><div class="field-label">Number of People</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Group Members</div><div class="field-value" style="min-height:60px"></div></div>
<div class="field"><div class="field-label">Experience Level</div><div class="field-value"></div></div></div>
<div class="section"><div class="section-title">Emergency Contact</div>
<div class="field"><div class="field-label">Name</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Phone</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">When to Call for Help</div><div class="field-value"></div></div></div>
<div class="section"><div class="section-title">Conditions</div>
<div class="field"><div class="field-label">Avalanche Danger Level</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Avalanche Problems</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Weather Forecast</div><div class="field-value"></div></div>
<div class="field"><div class="field-label">Recent Observations / Red Flags</div><div class="field-value" style="min-height:60px"></div></div></div>
<div class="footer">Generated by CalPow — Plan Smart. Ski California.</div>
</body></html>`
}

// ── Sub-components ────────────────────────────────────────────────────────────
const SectionHeading = ({ children }) => (
  <h2 style={{
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 'clamp(18px, 3vw, 24px)',
    fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase',
    color: C.text, marginBottom: 16, marginTop: 0,
  }}>{children}</h2>
)

const OutlineBtn = ({ onClick, children, style: extra = {} }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '8px 16px',
      border: `1px solid ${C.border}`,
      backgroundColor: C.ghost, color: C.muted,
      ...LABEL, fontSize: 10, fontWeight: 700,
      cursor: 'pointer',
      transition: 'border-color 0.15s, color 0.15s',
      ...extra,
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.text }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
  >
    {children}
  </button>
)

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BeforeYouGoPage() {
  const [checked, setChecked] = useState(() => loadCheckedSet())
  const [forecasts, setForecasts] = useState({})
  const [loadingForecasts, setLoadingForecasts] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    async function loadForecasts() {
      const [sierra, shasta, bridgeport, eastern] = await Promise.all([
        fetchForecast('sierra'), fetchForecast('shasta'),
        fetchForecast('bridgeport'), fetchForecast('eastern_sierra'),
      ])
      const initial = { sierra, shasta, bridgeport, eastern_sierra: eastern }
      const next = { ...initial }

      for (const config of REGION_CONFIG) {
        const f = initial[config.key]
        if (f == null || f.danger_level == null || f.danger_level === 0) {
          const cached = await fetchMostRecentCachedForecast(config.key, supabase)
          if (config.key === 'bridgeport') {
            const useCached = cached && (() => {
              const diffDays = (Date.now() - new Date(cached.forecast_date).getTime()) / 86400000
              return diffDays <= 4
            })()
            if (useCached) {
              const level = cached.danger_level
              next.bridgeport = { region: cached.region, danger_level: level, danger_label: cached.danger_label ?? DANGER_LABELS[level] ?? 'No Rating', color: (level && DANGER_COLORS[level]) ?? '#4A5568', travel_advice: cached.travel_advice ?? null, forecast_url: cached.forecast_url ?? FALLBACK_URLS.bridgeport ?? null, zones: Array.isArray(cached.zones) ? cached.zones : [], isStale: true, cachedDate: cached.forecast_date }
            } else {
              next.bridgeport = { region: 'bridgeport', noActiveForecast: true, forecast_url: FALLBACK_URLS.bridgeport }
            }
          } else if (cached) {
            const level = cached.danger_level
            next[config.key] = { region: cached.region, danger_level: level, danger_label: cached.danger_label ?? DANGER_LABELS[level] ?? 'No Rating', color: (level && DANGER_COLORS[level]) ?? '#4A5568', travel_advice: cached.travel_advice ?? null, forecast_url: cached.forecast_url ?? FALLBACK_URLS[config.key] ?? null, zones: Array.isArray(cached.zones) ? cached.zones : [], isStale: true, cachedDate: cached.forecast_date }
          }
        }
      }
      setForecasts(next)
      setLoadingForecasts(false)
    }
    loadForecasts()
  }, [])

  useEffect(() => { saveCheckedSet(checked) }, [checked])

  const toggleItem = (id) => {
    setChecked(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const progress = checked.size

  return (
    <div style={{ minHeight: 'calc(100vh - 3.5rem)', backgroundColor: C.bg }}>

      {/* Hero */}
      <header style={{ position: 'relative', overflow: 'hidden', minHeight: 180 }}>
        <img src={skierSummit} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', backgroundColor: C.panel }} loading="lazy" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,15,20,0.3) 0%, rgba(10,15,20,0.88) 100%)' }}/>
        <div style={{ position: 'relative', zIndex: 2, padding: '48px 32px 28px' }}>
          <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, marginBottom: 8 }}>Pre-Tour Checklist</div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, letterSpacing: '0.01em', textTransform: 'uppercase', color: C.text, margin: '0 0 8px', lineHeight: 1 }}>
            Before You Go
          </h1>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
            Don't leave the trailhead without checking these off
          </p>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: C.border }}/>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* ── 1. Current Forecasts ── */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeading>Current Avalanche Forecasts</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
            {REGION_CONFIG.map((config, index) => {
              const forecast = forecasts[config.key]
              const fallbackUrl = FALLBACK_URLS[config.key]
              return (
                <FadeIn key={config.key} delay={index * 0.08}>
                  <div style={{ border: `1px solid ${C.border}`, padding: '16px', backgroundColor: C.ghost, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Region header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.text, margin: 0 }}>
                        {config.title}
                      </h3>
                      {!loadingForecasts && forecast && !forecast.noActiveForecast && (
                        <span style={{ ...LABEL, fontSize: 8, color: forecast.isStale ? 'rgba(251,191,36,0.7)' : 'rgba(74,222,128,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: forecast.isStale ? '#fbbf24' : '#4ade80', display: 'inline-block' }}/>
                          {forecast.isStale ? 'Cached' : 'Live'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: C.faint, marginBottom: 12 }}>
                      {config.centerName}
                    </div>

                    {loadingForecasts ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[32, '100%', '75%'].map((w, i) => (
                          <div key={i} style={{ height: i === 0 ? 28 : 12, width: w, backgroundColor: 'rgba(240,237,232,0.05)', animation: 'pulse 1.5s infinite' }}/>
                        ))}
                      </div>
                    ) : !forecast ? (
                      <>
                        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.faint, margin: '0 0 12px', flex: 1 }}>No forecast available</p>
                        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.8)', textDecoration: 'none', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#3B8BEB'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(59,139,235,0.8)'}>
                          Open center website <IconExternal />
                        </a>
                      </>
                    ) : forecast.noActiveForecast ? (
                      <>
                        <div style={{ ...LABEL, fontSize: 10, fontWeight: 700, color: C.faint, border: `1px solid ${C.border}`, padding: '4px 10px', display: 'inline-block', marginBottom: 8 }}>No Active Forecast</div>
                        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.6, margin: '0 0 12px', flex: 1 }}>
                          Bridgeport publishes forecasts Fri–Sun. Check back this weekend.
                        </p>
                        <a href={forecast.forecast_url || fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.8)', textDecoration: 'none' }}>
                          Full Forecast <IconExternal />
                        </a>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'inline-block', padding: '3px 10px', backgroundColor: forecast.color, ...LABEL, fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                          {forecast.danger_level != null ? `${forecast.danger_level} · ${forecast.danger_label}` : forecast.danger_label}
                        </div>
                        {forecast.isStale && forecast.cachedDate && (
                          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 9, fontStyle: 'italic', color: C.faint, margin: '0 0 6px' }}>
                            Last forecast: {new Date(forecast.cachedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                        {forecast.travel_advice && (
                          <div style={{ marginBottom: 10, flex: 1 }}>
                            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                              {expanded[config.key] ? forecast.travel_advice : `${forecast.travel_advice.slice(0, 120).trim()}${forecast.travel_advice.length > 120 ? '…' : ''}`}
                            </p>
                            {forecast.travel_advice.length > 120 && (
                              <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [config.key]: !prev[config.key] }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.7)', padding: '4px 0 0', transition: 'color 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#3B8BEB'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(59,139,235,0.7)'}>
                                {expanded[config.key] ? 'Read less' : 'Read more'}
                              </button>
                            )}
                          </div>
                        )}
                        <a href={forecast.forecast_url || fallbackUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.8)', textDecoration: 'none', marginTop: 'auto', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#3B8BEB'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(59,139,235,0.8)'}>
                          Full Forecast <IconExternal />
                        </a>
                      </>
                    )}
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>

        {/* ── 2. Weather ── */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeading>Weather</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 2 }}>
            {WEATHER_LINKS.map(card => (
              <a key={card.url} href={card.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', padding: '14px', border: `1px solid ${C.border}`, backgroundColor: C.ghost, textDecoration: 'none', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text, margin: '0 0 4px' }}>{card.title}</h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, margin: '0 0 10px', flex: 1 }}>{card.desc}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.7)' }}>Open <IconExternal /></span>
              </a>
            ))}
          </div>
        </section>

        {/* ── 3. Gear Checklist ── */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <SectionHeading>Gear Checklist</SectionHeading>
            <span style={{ ...LABEL, fontSize: 9, color: C.faint }}>{progress} / {TOTAL_ITEMS} checked</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, backgroundColor: 'rgba(240,237,232,0.07)', marginBottom: 24, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', backgroundColor: '#38A169' }}
              initial={false}
              animate={{ width: `${(progress / TOTAL_ITEMS) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {GEAR_ITEMS.map(group => (
              <div key={group.category}>
                <div style={{ ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 8 }}>
                  {group.category}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {group.items.map(item => {
                    const isChecked = checked.has(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          style={{
                            width: '100%', textAlign: 'left',
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '7px 8px',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = C.ghost}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{
                            flexShrink: 0, width: 16, height: 16, marginTop: 1,
                            border: `1px solid ${isChecked ? '#38A169' : 'rgba(240,237,232,0.2)'}`,
                            backgroundColor: isChecked ? '#38A169' : 'transparent',
                            color: isChecked ? '#fff' : 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'border-color 0.15s, background-color 0.15s',
                          }}>
                            {isChecked && <IconCheck />}
                          </span>
                          <span style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: 12, lineHeight: 1.5,
                            color: isChecked ? C.faint : C.muted,
                            textDecoration: isChecked ? 'line-through' : 'none',
                            transition: 'color 0.15s',
                          }}>
                            {item.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setChecked(new Set())}
            style={{
              marginTop: 20, padding: '6px 14px',
              border: `1px solid ${C.border}`, background: 'transparent',
              ...LABEL, fontSize: 9, fontWeight: 700, color: C.faint,
              cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.color = C.muted }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.faint }}
          >
            Reset Checklist
          </button>
        </section>

        {/* ── 4. Trip Planning ── */}
        <section style={{ marginBottom: 56 }}>
          <SectionHeading>Trip Planning</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
            {[
              {
                title: 'File a Trip Plan',
                body: 'Always tell someone where you are going, your planned route, and when to call for help if you haven\'t checked in.',
                action: (
                  <OutlineBtn onClick={() => {
                    const html = getTripPlanHTML()
                    const blob = new Blob([html], { type: 'text/html' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'calpow-trip-plan.html'; a.click()
                    URL.revokeObjectURL(url)
                  }}>
                    <IconDownload /> Download Trip Plan
                  </OutlineBtn>
                )
              },
              {
                title: 'Check the Forecast',
                body: 'Read the full forecast the morning of your tour, not the night before. Conditions change overnight.',
                action: (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[
                      { label: 'Sierra', url: 'https://www.sierraavalanchecenter.org/forecasts/' },
                      { label: 'Shasta', url: 'https://www.shastaavalanche.org/avalanche-forecast' },
                      { label: 'Bridgeport', url: 'https://bridgeportavalanchecenter.org/' },
                      { label: 'ESAC', url: 'https://www.esavalanche.org/' },
                    ].map(({ label, url }) => (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${C.border}`, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.75)', textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,139,235,0.4)'; e.currentTarget.style.color = '#3B8BEB' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = 'rgba(59,139,235,0.75)' }}>
                        {label} <IconExternal />
                      </a>
                    ))}
                  </div>
                )
              },
              {
                title: 'Know Your Rescue Plan',
                body: 'Know the nearest hospital, how to call for rescue, and make sure someone in your group knows how to use their beacon.',
                action: (
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Sierra Nevada SAR: 911</p>
                    <a href="https://www.rei.com/learn/expert-advice/wilderness-sos.html" target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.75)', textDecoration: 'none' }}>
                      How to call for rescue <IconExternal />
                    </a>
                  </div>
                )
              },
            ].map(({ title, body, action }) => (
              <div key={title} style={{ border: `1px solid ${C.border}`, padding: '16px', backgroundColor: C.ghost, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text, margin: 0 }}>{title}</h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.65, margin: 0, flex: 1 }}>{body}</p>
                {action}
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Level Up ── */}
        <section>
          <SectionHeading>Level Up Your Skills</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {[
              { title: 'AIARE Level 1 Course', desc: 'Find a formal avalanche course near you', url: 'https://aiare.net/find-a-course/' },
              { title: 'Avalanche Field Guide', desc: 'Danger scale, problems, red flags', to: '/education' },
              { title: 'Sierra Avy Education', desc: 'Resources from the Sierra Avalanche Center', url: 'https://www.sierraavalanchecenter.org/education/' },
              { title: 'ESAC Education', desc: 'Resources from the Eastern Sierra Avalanche Center', url: 'https://www.esavalanche.org/education' },
              { title: 'Talk to Mike', desc: 'AI guide for trip and safety questions', to: '/mike' },
            ].map(card => {
              const inner = (
                <>
                  <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.text, margin: '0 0 4px' }}>{card.title}</h3>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: C.muted, margin: '0 0 10px', flex: 1 }}>{card.desc}</p>
                  <span style={{ ...LABEL, fontSize: 9, color: 'rgba(59,139,235,0.7)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {card.url ? 'Open' : 'Go'} <IconExternal />
                  </span>
                </>
              )
              const sharedStyle = {
                display: 'flex', flexDirection: 'column', padding: '14px',
                border: `1px solid ${C.border}`, backgroundColor: C.ghost,
                textDecoration: 'none', transition: 'border-color 0.15s',
              }
              return card.url ? (
                <a key={card.title} href={card.url} target="_blank" rel="noopener noreferrer" style={sharedStyle}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  {inner}
                </a>
              ) : (
                <Link key={card.title} to={card.to} style={sharedStyle}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.borderHover}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  {inner}
                </Link>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
