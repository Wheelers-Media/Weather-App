export default async function handler(req, res) {
  const clientId = process.env.XWEATHER_CLIENT_ID;
  const clientSecret = process.env.XWEATHER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(503).json({ error: 'Xweather lightning threats are not configured.' });

  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  const radius = Math.min(100, Math.max(5, Number(req.query.radius || 100)));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Valid lat and lon are required.' });
  }

  try {
    const params = new URLSearchParams({
      p: `${lat},${lon}`,
      radius: `${radius}km`,
      limit: '100',
      format: 'json',
      client_id: clientId,
      client_secret: clientSecret
    });
    const response = await fetch(`https://data.api.xweather.com/lightning/threats/closest?${params}`);
    const body = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
    return res.send(body);
  } catch (_) {
    return res.status(502).json({ error: 'Xweather lightning threat provider request failed.' });
  }
}
