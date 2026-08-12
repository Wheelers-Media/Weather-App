export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=90, stale-while-revalidate=180');
  const key = process.env.ACCUWEATHER_API_KEY;
  if (!key) return res.status(503).json({ error: 'AccuWeather MinuteCast is not configured.' });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Valid lat and lon are required.' });
  }

  try {
    const params = new URLSearchParams({ q: `${lat},${lon}`, details: 'true' });
    const response = await fetch(`https://dataservice.accuweather.com/forecasts/v1/minute?${params}`, {
      headers: { Authorization: `Bearer ${key}`, 'Accept-Encoding': 'gzip' }
    });
    const body = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    return res.send(body);
  } catch (error) {
    return res.status(502).json({ error: 'MinuteCast provider request failed.' });
  }
}
