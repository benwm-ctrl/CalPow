export default async function handler(req, res) {
  const { zone_id } = req.query

  const url = `https://api.avalanche.org/v2/public/product?type=forecast&zone_id=${zone_id}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CalPow/1.0 backcountry-ski-app'
      }
    })
    const data = await response.json()
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
