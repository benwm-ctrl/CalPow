import { supabase } from './supabase'

const CENTER_IDS = {
  sierra: 'SAC',
  shasta: 'MSAC',
  bridgeport: 'BAC',
  eastern_sierra: 'ESAC',
}

const BRIDGEPORT_CENTER_IDS = ['BAC', 'BTAC', 'BARC']

// Zone IDs for v2/public/forecast endpoint (full structured forecast)
const ZONE_IDS = {
  sierra: 1082,         // SAC Central Sierra
  shasta: 1084,          // MSAC Shasta
  bridgeport: 1086,      // BAC Bridgeport
  eastern_sierra: 1088,  // ESAC Eastern Sierra
}

const DANGER_LABELS = {
  1: 'Low',
  2: 'Moderate',
  3: 'Considerable',
  4: 'High',
  5: 'Extreme',
}

const DANGER_COLORS = {
  1: '#38A169',
  2: '#D69E2E',
  3: '#DD6B20',
  4: '#E53E3E',
  5: '#9B2335',
}

const FALLBACK_URLS = {
  sierra: 'https://www.sierraavalanchecenter.org/forecasts/',
  shasta: 'https://www.shastaavalanche.org/avalanche-forecast',
  bridgeport: 'https://bridgeportavalanchecenter.org/',
  eastern_sierra: 'https://www.esavalanche.org/',
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Get cached forecast for region and today if it exists. */
async function getCachedForecast(region) {
  try {
    const { data, error } = await supabase
      .from('avalanche_forecasts')
      .select('region, danger_level, danger_label, travel_advice, forecast_url, zones')
      .eq('region', region)
      .eq('forecast_date', todayISO())
      .maybeSingle()
    if (error || !data) return null
    const level = data.danger_level
    const fallback = level ?? 1
    return {
      region: data.region,
      center: CENTER_IDS[region],
      danger_level: level,
      danger_label: data.danger_label ?? DANGER_LABELS[level] ?? 'No Rating',
      color: (level && DANGER_COLORS[level]) ?? '#4A5568',
      travel_advice: data.travel_advice ?? null,
      forecast_url: data.forecast_url ?? FALLBACK_URLS[region] ?? null,
      zones: Array.isArray(data.zones) ? data.zones : [],
      danger_below_treeline: data.danger_below_treeline ?? fallback,
      danger_near_treeline: data.danger_near_treeline ?? fallback,
      danger_above_treeline: data.danger_above_treeline ?? fallback,
    }
  } catch {
    return null
  }
}

/** Upsert forecast into cache. */
async function upsertForecastCache(region, forecast) {
  if (!forecast) return
  try {
    await supabase.from('avalanche_forecasts').upsert(
      {
        region,
        forecast_date: todayISO(),
        danger_level: forecast.danger_level,
        danger_label: forecast.danger_label,
        travel_advice: forecast.travel_advice ?? null,
        forecast_url: forecast.forecast_url ?? null,
        zones: forecast.zones ?? [],
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'region,forecast_date' }
    )
  } catch (e) {
    console.warn('Forecast cache upsert failed', e)
  }
}

export async function fetchForecast(region) {
  const cached = await getCachedForecast(region)
  if (cached) return cached

  // Fetch full structured forecast from v2/public/forecast for this region and log (Sierra = 1082)
  const zoneId = ZONE_IDS[region]
  if (zoneId != null) {
    try {
      const forecastRes = await fetch(
        `https://api.avalanche.org/v2/public/forecast?zone_id=${zoneId}`
      )
      const forecastData = await forecastRes.json()
      console.log(
        'Full forecast data (v2/public/forecast):',
        JSON.stringify(forecastData, null, 2)
      )
    } catch (e) {
      console.warn('Structured forecast fetch failed for zone', zoneId, e)
    }
  }

  const centerIds =
    region === 'bridgeport'
      ? BRIDGEPORT_CENTER_IDS
      : CENTER_IDS[region]
        ? [CENTER_IDS[region]]
        : []
  if (!centerIds.length) return null

  for (const centerId of centerIds) {
    try {
      const res = await fetch(
        `https://api.avalanche.org/v2/public/products/map-layer/${centerId}`
      )
      const data = await res.json()

      if (region === 'bridgeport') {
        console.log('Bridgeport API response:', JSON.stringify(data).slice(0, 500))
      }

      const features = data?.features ?? []
      if (!features.length) continue

      const maxDanger = Math.max(
        ...features.map((f) => f.properties?.danger_level ?? 0).filter((d) => d > 0),
        0
      )

      const primaryFeature =
        features.find((f) => f.properties?.danger_level > 0) ?? features[0]
      const props = primaryFeature?.properties ?? {}

      // Parse elevation-band danger if present (e.g. dangerRatings or per-zone elevation)
      let dangerBelow = maxDanger > 0 ? maxDanger : null
      let dangerNear = dangerBelow
      let dangerAbove = dangerBelow
      const dangerRatings = data?.dangerRatings ?? data?.danger_ratings ?? props?.danger_ratings
      if (Array.isArray(dangerRatings) && dangerRatings.length > 0) {
        for (const dr of dangerRatings) {
          const band = (dr.elevation_band ?? dr.band ?? '').toLowerCase()
          const level = dr.danger_level ?? dr.lower ?? dr.upper ?? dr.rating
          if (level == null || level < 0) continue
          if (band === 'btl' || band === 'below_treeline' || band === 'below treeline') {
            dangerBelow = level
          } else if (band === 'tln' || band === 'near_treeline' || band === 'treeline') {
            dangerNear = level
          } else if (band === 'alp' || band === 'above_treeline' || band === 'alpine') {
            dangerAbove = level
          }
        }
      }

      const forecast = {
        region,
        center: props.center ?? centerId,
        danger_level: maxDanger > 0 ? maxDanger : null,
        danger_label:
          maxDanger > 0 ? DANGER_LABELS[maxDanger] : 'No Rating',
        color: maxDanger > 0 ? DANGER_COLORS[maxDanger] : '#4A5568',
        travel_advice: props.travel_advice ?? null,
        forecast_url: props.link ?? FALLBACK_URLS[region] ?? null,
        danger_below_treeline: dangerBelow ?? maxDanger ?? 1,
        danger_near_treeline: dangerNear ?? maxDanger ?? 1,
        danger_above_treeline: dangerAbove ?? maxDanger ?? 1,
        zones: features.map((f) => ({
          name: f.properties?.name,
          danger_level: f.properties?.danger_level,
          danger_label:
            DANGER_LABELS[f.properties?.danger_level] ?? 'No Rating',
          color: DANGER_COLORS[f.properties?.danger_level] ?? '#4A5568',
          travel_advice: f.properties?.travel_advice,
          link: f.properties?.link,
        })),
        _apiResponse: data,
      }

      await upsertForecastCache(region, forecast)
      return forecast
    } catch (e) {
      console.warn('Forecast fetch failed for', region, 'centerId', centerId, e)
    }
  }

  console.warn('No forecast data for', region, 'tried center IDs:', centerIds)
  return null
}

/** Get the most recent cached forecast for a region (any date). */
export async function fetchMostRecentCachedForecast(region, supabaseClient) {
  const { data, error } = await supabaseClient
    .from('avalanche_forecasts')
    .select('*')
    .eq('region', region)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export { DANGER_LABELS, DANGER_COLORS, FALLBACK_URLS }
