export async function fetchWeatherForLocation(lng, lat) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`
  const res = await fetch(url)
  const data = await res.json()
  return {
    temp: data.current.temperature_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
  }
}

export function windDirectionLabel(degrees) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}
