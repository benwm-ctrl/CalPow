import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Check } from 'lucide-react'
import FadeIn from '../components/FadeIn'
import { fetchForecast, fetchMostRecentCachedForecast, FALLBACK_URLS, DANGER_LABELS, DANGER_COLORS } from '../services/avalancheForecast'
import { supabase } from '../services/supabase'

import skierSummit from '../assets/images/ZachH_McGee-10-1536x1016.jpg'

const BG_DARK = '#0F1923'
const CARD_BG = '#1E2D3D'
const ACCENT_BLUE = '#3B8BEB'
const BORDER = '#2D3748'

const CHECKLIST_STORAGE_KEY = 'calpow-gear-checklist'

const GEAR_ITEMS = [
  {
    category: 'Avalanche Safety (required)',
    items: [
      { id: 'beacon', label: 'Avalanche beacon (transceiver) — tested and on body' },
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

const allItemIds = GEAR_ITEMS.flatMap((g) => g.items.map((i) => i.id))
const TOTAL_ITEMS = allItemIds.length

function loadCheckedSet() {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveCheckedSet(set) {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...set]))
  } catch {}
}

function getTripPlanHTML() {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CalPow Trip Plan</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; background: #0F1923; color: #F7FAFC; max-width: 800px; margin: 0 auto; padding: 40px 24px; }
    .header { border-bottom: 2px solid #3B8BEB; padding-bottom: 24px; margin-bottom: 32px; }
    .logo { color: #3B8BEB; font-size: 28px; font-weight: 800; }
    .title { font-size: 20px; color: #A0AEC0; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { color: #3B8BEB; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; }
    .field { background: #1E2D3D; border: 1px solid #2D3748; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .field-label { color: #A0AEC0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .field-value { color: #F7FAFC; font-size: 16px; border-bottom: 1px solid #2D3748; padding-bottom: 8px; min-height: 28px; }
    .warning { background: #2D1515; border: 1px solid #E53E3E; border-radius: 8px; padding: 16px; margin-bottom: 32px; color: #FC8181; font-size: 14px; }
    .footer { border-top: 1px solid #2D3748; padding-top: 24px; color: #4A5568; font-size: 12px; text-align: center; }
    .avy-centers { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .avy-link { color: #3B8BEB; font-size: 13px; text-decoration: none; background: #1E2D3D; padding: 4px 12px; border-radius: 20px; border: 1px solid #2D3748; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">CalPow</div>
    <div class="title">Backcountry Trip Plan — ${dateStr}</div>
  </div>
  <div class="warning">⚠️ Always check the current avalanche forecast before heading out. File this plan with someone who will call for help if you don't check in.</div>
  <div class="section">
    <div class="section-title">Tour Details</div>
    <div class="field"><div class="field-label">Route Name</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Date & Start Time</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Trailhead / Start Location</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Planned Route Description</div><div class="field-value" style="min-height:60px"></div></div>
    <div class="field"><div class="field-label">Expected Return Time</div><div class="field-value"></div></div>
  </div>
  <div class="section">
    <div class="section-title">Group</div>
    <div class="field"><div class="field-label">Number of People</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Group Members</div><div class="field-value" style="min-height:60px"></div></div>
    <div class="field"><div class="field-label">Experience Level</div><div class="field-value"></div></div>
  </div>
  <div class="section">
    <div class="section-title">Emergency Contact</div>
    <div class="field"><div class="field-label">Name</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Phone</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">When to Call for Help If No Check-In</div><div class="field-value"></div></div>
  </div>
  <div class="section">
    <div class="section-title">Conditions Check</div>
    <div class="field"><div class="field-label">Avalanche Danger Level</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Avalanche Problems</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Weather Forecast</div><div class="field-value"></div></div>
    <div class="field"><div class="field-label">Recent Observations / Red Flags</div><div class="field-value" style="min-height:60px"></div></div>
  </div>
  <div class="section">
    <div class="section-title">Avalanche Forecast Sources</div>
    <div class="avy-centers">
      <a class="avy-link" href="https://www.sierraavalanchecenter.org/forecasts/" target="_blank">Sierra Avalanche Center</a>
      <a class="avy-link" href="https://www.shastaavalanche.org/avalanche-forecast" target="_blank">Mt. Shasta Avalanche Center</a>
      <a class="avy-link" href="https://bridgeportavalanchecenter.org/" target="_blank">Bridgeport Avalanche Center</a>
      <a class="avy-link" href="https://www.esavalanche.org/" target="_blank">Eastern Sierra Avalanche Center</a>
    </div>
  </div>
  <div class="footer">Generated by CalPow — Plan Smart. Ski California.<br>Always consult official avalanche forecasts. This plan is not a substitute for proper training.</div>
</body>
</html>`
}

const REGION_CONFIG = [
  { key: 'sierra', title: 'Sierra Nevada', centerName: 'Sierra Avalanche Center' },
  { key: 'shasta', title: 'Mt. Shasta', centerName: 'Mt. Shasta Avalanche Center' },
  { key: 'bridgeport', title: 'Bridgeport', centerName: 'Bridgeport Avalanche Center' },
  { key: 'eastern_sierra', title: 'Eastern Sierra', centerName: 'Eastern Sierra Avalanche Center (ESAC)' },
]

export default function BeforeYouGoPage() {
  const [checked, setChecked] = useState(() => loadCheckedSet())
  const [forecasts, setForecasts] = useState({})
  const [loadingForecasts, setLoadingForecasts] = useState(true)

  useEffect(() => {
    async function loadForecasts() {
      const [sierra, shasta, bridgeport, eastern] = await Promise.all([
        fetchForecast('sierra'),
        fetchForecast('shasta'),
        fetchForecast('bridgeport'),
        fetchForecast('eastern_sierra'),
      ])
      const initial = { sierra, shasta, bridgeport, eastern_sierra: eastern }
      const next = { ...initial }

      for (const config of REGION_CONFIG) {
        const f = initial[config.key]
        if (f == null || f.danger_level == null || f.danger_level === 0) {
          const cached = await fetchMostRecentCachedForecast(config.key, supabase)

          if (config.key === 'bridgeport') {
            const CACHE_MAX_DAYS = 4
            const useCached =
              cached &&
              (() => {
                const cachedDate = new Date(cached.forecast_date)
                const diffDays = (Date.now() - cachedDate.getTime()) / (86400 * 1000)
                return diffDays <= CACHE_MAX_DAYS
              })()
            if (useCached) {
              const level = cached.danger_level
              next.bridgeport = {
                region: cached.region,
                danger_level: level,
                danger_label: cached.danger_label ?? DANGER_LABELS[level] ?? 'No Rating',
                color: (level && DANGER_COLORS[level]) ?? '#4A5568',
                travel_advice: cached.travel_advice ?? null,
                forecast_url: cached.forecast_url ?? FALLBACK_URLS.bridgeport ?? null,
                zones: Array.isArray(cached.zones) ? cached.zones : [],
                isStale: true,
                cachedDate: cached.forecast_date,
              }
            } else {
              next.bridgeport = {
                region: 'bridgeport',
                noActiveForecast: true,
                forecast_url: FALLBACK_URLS.bridgeport,
              }
            }
          } else if (cached) {
            const level = cached.danger_level
            next[config.key] = {
              region: cached.region,
              danger_level: level,
              danger_label: cached.danger_label ?? DANGER_LABELS[level] ?? 'No Rating',
              color: (level && DANGER_COLORS[level]) ?? '#4A5568',
              travel_advice: cached.travel_advice ?? null,
              forecast_url: cached.forecast_url ?? FALLBACK_URLS[config.key] ?? null,
              zones: Array.isArray(cached.zones) ? cached.zones : [],
              isStale: true,
              cachedDate: cached.forecast_date,
            }
          }
        }
      }

      setForecasts(next)
      setLoadingForecasts(false)
    }
    loadForecasts()
  }, [])

  useEffect(() => {
    saveCheckedSet(checked)
  }, [checked])

  const toggleItem = (id) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetChecklist = () => {
    setChecked(new Set())
  }

  const progress = checked.size
  const leftCategories = GEAR_ITEMS.slice(0, 3)
  const rightCategories = GEAR_ITEMS.slice(3, 6)

  const downloadTripPlanTemplate = () => {
    const tripPlanHTML = getTripPlanHTML()
    const blob = new Blob([tripPlanHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'calpow-trip-plan.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)]"
      style={{ backgroundColor: BG_DARK }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <header className="relative mb-12 rounded-2xl overflow-hidden min-h-[180px] flex flex-col justify-end p-6 sm:p-8">
          <img
            src={skierSummit}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ backgroundColor: '#1E2D3D', objectPosition: 'center 40%' }}
            loading="lazy"
          />
          <div
            className="absolute inset-0 z-0"
            style={{ backgroundColor: 'rgba(15, 25, 35, 0.78)' }}
          />
          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              Before You Go
            </h1>
            <p className="text-lg text-text-secondary mt-2">
              Don't leave the trailhead without checking these off
            </p>
          </div>
        </header>

        {/* 1. Current Conditions */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">
            Current Avalanche Forecasts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {REGION_CONFIG.map((config, index) => {
              const forecast = forecasts[config.key]
              const fallbackUrl = FALLBACK_URLS[config.key]
              return (
                <FadeIn key={config.key} delay={index * 0.1}>
                  <motion.div
                    className="rounded-xl border p-6"
                    style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ y: -4, boxShadow: '0 0 0 1px rgba(59, 139, 235, 0.25), 0 8px 32px rgba(0,0,0,0.3)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {config.title}
                      </h3>
                      {!loadingForecasts && forecast && !forecast.noActiveForecast && (
                        <>
                          {forecast.isStale ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-orange-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" aria-hidden />
                              Cached
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
                              Live
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary mb-4">
                      {config.centerName}
                    </p>

                    {loadingForecasts ? (
                      <div className="space-y-3">
                        <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
                        <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
                        <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
                      </div>
                    ) : !forecast ? (
                      <>
                        <p className="text-sm text-text-muted mb-4">
                          No forecast available
                        </p>
                        <a
                          href={fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium"
                          style={{ color: ACCENT_BLUE }}
                        >
                          Open center website
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    ) : forecast.noActiveForecast ? (
                      <>
                        <div
                          className="inline-block px-3 py-1.5 rounded-lg text-sm font-semibold mb-4 text-white"
                          style={{ backgroundColor: '#4A5568' }}
                        >
                          No Active Forecast
                        </div>
                        <p className="text-sm text-text-secondary mb-4">
                          Bridgeport Avalanche Center publishes forecasts on Fridays, Saturdays, and Sundays. Check back this weekend or visit their site for current observations.
                        </p>
                        <a
                          href={forecast.forecast_url || fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium mb-2"
                          style={{ color: ACCENT_BLUE }}
                        >
                          View Full Forecast ↗
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    ) : (
                      <>
                        <div
                          className="inline-block px-3 py-1.5 rounded-lg text-sm font-semibold mb-4 text-white"
                          style={{ backgroundColor: forecast.color }}
                        >
                          {forecast.danger_level != null
                            ? `${forecast.danger_level} - ${forecast.danger_label}`
                            : forecast.danger_label}
                        </div>
                        {forecast.isStale && forecast.cachedDate && (
                          <p className="text-[11px] text-text-muted italic mb-2">
                            Last forecast: {new Date(forecast.cachedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                        {forecast.travel_advice && (
                          <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                            {forecast.travel_advice.length > 120
                              ? `${forecast.travel_advice.slice(0, 120).trim()}…`
                              : forecast.travel_advice}
                          </p>
                        )}
                        <a
                          href={forecast.forecast_url || fallbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium mb-2"
                          style={{ color: ACCENT_BLUE }}
                        >
                          View Full Forecast ↗
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </motion.div>
                </FadeIn>
              )
            })}
          </div>
        </section>

        {/* 2. Weather */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">Weather</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'NWS Sierra Forecast',
                desc: 'South Lake Tahoe area',
                url: 'https://forecast.weather.gov/MapClick.php?CityName=South+Lake+Tahoe&state=CA',
              },
              {
                title: 'NWS Shasta Forecast',
                desc: 'Mount Shasta area',
                url: 'https://forecast.weather.gov/MapClick.php?CityName=Mount+Shasta&state=CA',
              },
              {
                title: 'NWS Bridgeport',
                desc: 'Bridgeport area',
                url: 'https://forecast.weather.gov/MapClick.php?CityName=Bridgeport&state=CA',
              },
              {
                title: 'NWS Mammoth Lakes',
                desc: 'Mammoth Lakes area',
                url: 'https://forecast.weather.gov/MapClick.php?CityName=Mammoth+Lakes&state=CA',
              },
              {
                title: 'OpenSnow California',
                desc: 'Ski and backcountry weather',
                url: 'https://opensnow.com/state/CA',
              },
            ].map((card) => (
              <a
                key={card.url}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border p-4 flex flex-col hover:opacity-95 transition-opacity"
                style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
              >
                <span className="text-2xl mb-2" aria-hidden>⛅</span>
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="text-sm text-text-secondary mt-0.5 flex-1">
                  {card.desc}
                </p>
                <span
                  className="inline-flex items-center gap-1 text-sm font-medium mt-2"
                  style={{ color: ACCENT_BLUE }}
                >
                  Open
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* 3. Gear Checklist */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-1">
            Gear Checklist
          </h2>
          <p className="text-text-secondary mb-4">
            Check off your gear before every tour
          </p>
          <div
            className="rounded-xl border p-4 mb-4"
            style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {progress} / {TOTAL_ITEMS} checked
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: BORDER }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: ACCENT_BLUE }}
                initial={false}
                animate={{ width: `${(progress / TOTAL_ITEMS) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              {leftCategories.map((group) => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    {group.category}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const isChecked = checked.has(item.id)
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors"
                          >
                            <span
                              className="shrink-0 w-5 h-5 rounded border flex items-center justify-center"
                              style={{
                                borderColor: isChecked
                                  ? '#38A169'
                                  : BORDER,
                                backgroundColor: isChecked
                                  ? '#38A169'
                                  : 'transparent',
                              }}
                            >
                              {isChecked && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </span>
                            <span
                              className={`text-sm text-text-primary ${
                                isChecked
                                  ? 'line-through text-text-muted'
                                  : ''
                              }`}
                            >
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
            <div className="space-y-6">
              {rightCategories.map((group) => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    {group.category}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => {
                      const isChecked = checked.has(item.id)
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className="w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors"
                          >
                            <span
                              className="shrink-0 w-5 h-5 rounded border flex items-center justify-center"
                              style={{
                                borderColor: isChecked
                                  ? '#38A169'
                                  : BORDER,
                                backgroundColor: isChecked
                                  ? '#38A169'
                                  : 'transparent',
                              }}
                            >
                              {isChecked && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </span>
                            <span
                              className={`text-sm text-text-primary ${
                                isChecked
                                  ? 'line-through text-text-muted'
                                  : ''
                              }`}
                            >
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
          </div>
          <button
            type="button"
            onClick={resetChecklist}
            className="mt-6 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary border hover:bg-background-elevated transition-colors"
            style={{ borderColor: BORDER }}
          >
            Reset Checklist
          </button>
        </section>

        {/* 4. Trip Planning */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">
            Trip Planning
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="rounded-xl border p-6 flex flex-col"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <h3 className="font-semibold text-white mb-2">
                File a Trip Plan
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">
                Always tell someone where you are going, your planned route, and
                when to call for help if you haven't checked in. Include:
                trailhead, route, expected return time, emergency contact.
              </p>
              <button
                type="button"
                onClick={downloadTripPlanTemplate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white w-fit hover:opacity-90 transition-opacity"
                style={{ backgroundColor: ACCENT_BLUE }}
              >
                Download Trip Plan Template
              </button>
            </div>
            <div
              className="rounded-xl border p-6 flex flex-col"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <h3 className="font-semibold text-white mb-2">
                Check the Forecast
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">
                Read the full forecast the morning of your tour, not the night
                before. Conditions change overnight.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="https://www.sierraavalanchecenter.org/forecasts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-white border hover:opacity-90"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: ACCENT_BLUE,
                    color: ACCENT_BLUE,
                  }}
                >
                  Sierra Forecast
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://www.shastaavalanche.org/avalanche-forecast"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-white border hover:opacity-90"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: ACCENT_BLUE,
                    color: ACCENT_BLUE,
                  }}
                >
                  Shasta Forecast
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://bridgeportavalanchecenter.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-white border hover:opacity-90"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: ACCENT_BLUE,
                    color: ACCENT_BLUE,
                  }}
                >
                  Bridgeport Forecast
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://www.esavalanche.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium text-white border hover:opacity-90"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: ACCENT_BLUE,
                    color: ACCENT_BLUE,
                  }}
                >
                  ESAC Forecast
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div
              className="rounded-xl border p-6 flex flex-col"
              style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
            >
              <h3 className="font-semibold text-white mb-2">
                Know Your Rescue Plan
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed flex-1">
                Know the nearest hospital, how to call for rescue, and make sure
                someone in your group knows how to use their beacon.
              </p>
              <p className="text-sm text-text-primary font-medium mt-2">
                Sierra Nevada SAR: 911
              </p>
              <a
                href="https://www.rei.com/learn/expert-advice/wilderness-sos.html"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: ACCENT_BLUE }}
              >
                How to call for rescue in the backcountry
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        {/* 5. AIARE & Education */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">
            Level Up Your Skills
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'AIARE Level 1 Course',
                desc: 'Find a formal avalanche course near you',
                url: 'https://aiare.net/find-a-course/',
                external: true,
              },
              {
                title: 'Avalanche Education Hub',
                desc: 'Danger scale, problems, red flags, and more',
                to: '/education',
                external: false,
              },
              {
                title: 'Sierra Avalanche Center Education',
                desc: 'Resources from the Sierra Avalanche Center',
                url: 'https://www.sierraavalanchecenter.org/education/',
                external: true,
              },
              {
                title: 'Eastern Sierra Avalanche Center Education',
                desc: 'Resources from ESAC',
                url: 'https://www.esavalanche.org/education',
                external: true,
              },
              {
                title: 'Talk to Mike the Guide',
                desc: 'AI backcountry guide for trip and safety questions',
                to: '/mike',
                external: false,
              },
            ].map((card) => {
              const content = (
                <>
                  <h3 className="font-semibold text-white">{card.title}</h3>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {card.desc}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 text-sm font-medium mt-2"
                    style={{ color: ACCENT_BLUE }}
                  >
                    {card.external ? 'Open' : 'Go'}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </>
              )
              const cardClass =
                'rounded-xl border p-4 flex flex-col text-left hover:opacity-95 transition-opacity'
              const cardStyle = {
                backgroundColor: CARD_BG,
                borderColor: BORDER,
              }
              if (card.external) {
                return (
                  <a
                    key={card.title}
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                    style={cardStyle}
                  >
                    {content}
                  </a>
                )
              }
              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className={cardClass}
                  style={cardStyle}
                >
                  {content}
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
