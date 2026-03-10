export default async function handler(req, res) {
  const { region } = req.query

  const URLS = {
    sierra: 'https://www.sierraavalanchecenter.org/forecasts/avalanche/central-sierra-nevada/json',
    shasta: 'https://www.shastaavalanche.org/forecast/json',
    bridgeport: 'https://bridgeportavalanchecenter.org/forecast/json',
    eastern_sierra: 'https://esavalanche.org/forecast/json',
  }

  const url = URLS[region]
  if (!url) return res.status(400).json({ error: 'unknown region' })

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CalPow/1.0 backcountry-ski-app'
      }
    })
    const text = await response.text()
    console.log('SAC response:', text.substring(0, 500))
    const data = JSON.parse(text)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message, url })
  }
}
