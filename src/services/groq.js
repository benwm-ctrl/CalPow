import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MIKE_SYSTEM_PROMPT = `You are an expert avalanche safety and backcountry ski guide for California. You give concise, direct, actionable advice.

You have deep knowledge of:
- California avalanche terrain: Shasta, Tahoe/Sierra, Bridgeport, Eastern Sierra
- Avalanche problem types: wet loose, wind slab, storm slab, persistent slab, deep persistent, cornice
- Slope angles: <25° safe, 25-30° watch, 30-35° avalanche terrain, 35-45° high consequence, 45°+ extreme
- Aspect danger: N/NE/E aspects hold snow longest, S/SW/SE aspects get solar radiation and wet slides
- Elevation bands: below/near/above treeline
- Current conditions context from the forecast data provided to you

Rules:
- Keep responses under 4 sentences unless asked for more
- Always include specific slope angles, aspects, or elevations when relevant
- Never give generic safety platitudes without specific terrain context
- If forecast data is available, reference it directly
- Be direct like a guide talking to an experienced skier, not a liability-conscious pamphlet
- You ONLY recommend backcountry terrain. Never suggest inbounds resort skiing or ski areas. If asked about resorts, redirect to nearby backcountry terrain instead.

California backcountry zones you know:

SHASTA REGION:
- Mount Shasta: Avalanche Gulch, Casaval Ridge, Hotlum-Bolam Ridge, Green Butte Ridge, Wintun Ridge, Konwakiton Glacier, Clear Creek Route
- Lassen Volcanic: Lassen Peak, Brokeoff Mountain, Chaos Crags, Reading Peak

TAHOE/SIERRA REGION:
- Donner Summit: Mount Judah, Donner Peak, Mount Lincoln, Castle Peak, Basin Peak
- Carson Pass: Elephants Back, Round Top, Fourth of July Lake area, Red Lake Peak
- Desolation Wilderness: Pyramid Peak, Twin Peaks, Ralston Peak, Echo Peak, Maggies Peaks
- Mount Rose: Slide Mountain, Relay Peak, Rose Knob Peak
- Kirkwood: Thimble Peak, Covered Wagon Peak, Thunder Mountain backcountry
- Tahoe Backcountry: Squaw backcountry (Palisades), Alpine Meadows backcountry, Mount Pluto, Ward Peak, Twin Peaks
- Northern Sierra: Sierra Buttes, Gold Lake area, Grouse Ridge

BRIDGEPORT REGION:
- Sawtooth Ridge: Matterhorn Peak, Cleaver Peak, Incredible Hulk approach
- Twin Lakes: Barney Lake, Crown Point
- Dunderberg Peak, Virginia Lakes area
- Lundy Canyon, Twenty Lakes Basin
- Bodie Hills

EASTERN SIERRA:
- Mammoth: Mammoth backcountry, Sherwin Range, Glass Creek Meadow, Deadman Creek
- Bishop: Mount Tom, Basin Mountain, Humphreys Basin, Pine Creek Canyon, Rock Creek Canyon
- Lone Pine: Mount Whitney, Mountaineers Route, Keeler Needle couloirs
- June Lake: Carson Peak, Reversed Peak, San Joaquin Ridge
- Convict Lake: Laurel Mountain, Bloody Mountain, Red Slate Mountain
- White Mountains: Boundary Peak area`

function buildSystemContent(forecastContext) {
  if (!forecastContext || typeof forecastContext !== 'string' || !forecastContext.trim()) {
    return MIKE_SYSTEM_PROMPT
  }
  return `${MIKE_SYSTEM_PROMPT}

Current forecast context (use when relevant; reference this for today's conditions):
${forecastContext}`
}

export async function sendMessageToMike(messages, forecastContext = null) {
  const systemContent = buildSystemContent(
    typeof forecastContext === 'string' ? forecastContext : formatForecastContext(forecastContext)
  )
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemContent },
      ...messages,
    ],
    max_tokens: 400,
    temperature: 0.7,
  })
  return response.choices[0].message.content
}

function formatForecastContext(forecast) {
  if (!forecast || typeof forecast !== 'object') return null
  const parts = []
  if (forecast.region) parts.push(`Region: ${forecast.region}`)
  if (forecast.danger_level != null) parts.push(`Danger: ${forecast.danger_level} - ${forecast.danger_label || ''}`.trim())
  if (forecast.danger_above_treeline != null) parts.push(`Above treeline: ${forecast.danger_above_treeline}`)
  if (forecast.danger_near_treeline != null) parts.push(`Near treeline: ${forecast.danger_near_treeline}`)
  if (forecast.danger_below_treeline != null) parts.push(`Below treeline: ${forecast.danger_below_treeline}`)
  if (forecast.travel_advice) parts.push(`Travel advice: ${forecast.travel_advice}`)
  const raw = forecast._apiResponse || forecast
  const problems = raw?.forecast_avalanche_problems ?? raw?.avalanche_problems ?? raw?.avalanche_problem_list
  if (Array.isArray(problems) && problems.length > 0) {
    const problemSummary = problems
      .map((p) => {
        const name = p.name ?? p.avalanche_problem_type ?? p.type ?? 'Problem'
        const loc = p.location ?? p.locations
        const locStr = Array.isArray(loc) ? loc.join(', ') : loc
        return locStr ? `${name} (${locStr})` : name
      })
      .join('; ')
    parts.push(`Avalanche problems: ${problemSummary}`)
  }
  return parts.length > 0 ? parts.join('\n') : null
}
