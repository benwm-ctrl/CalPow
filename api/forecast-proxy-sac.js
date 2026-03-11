const ZONE_IDS = {
  sierra: { center: 'SAC', zone: 2458 },
  shasta: { center: 'MSAC', zone: 1833 },
  bridgeport: { center: 'BAC', zone: 3004 },
  eastern_sierra: { center: 'ESAC', zone: 128 },
}

export default async function handler(req, res) {
  const { region } = req.query
  const zone = ZONE_IDS[region]
  if (!zone) return res.status(400).json({ error: 'unknown region' })

  const url = `https://api.avalanche.org/v2/public/product?type=forecast&center_id=${zone.center}&zone_id=${zone.zone}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CalPow/1.0 benwm@stanford.edu'
      }
    })
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
