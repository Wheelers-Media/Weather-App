const ALLOWED_FIELDS = new Set([
  'precipitationIntensity','precipitationProbability','temperature','temperatureApparent',
  'humidity','dewPoint','windSpeed','windGust','windDirection','cloudCover','visibility',
  'pressureSurfaceLevel','snowAccumulation','iceAccumulation','thunderstormProbability',
  'lightningFlashRateDensity','hailProbability','hailSize','fireIndex','epaIndex'
]);

export default async function handler(req, res) {
  const key = process.env.TOMORROW_API_KEY;
  if (!key) return res.status(503).json({ error: 'Tomorrow.io map tiles are not configured.' });

  const z = Number(req.query.z), x = Number(req.query.x), y = Number(req.query.y);
  const field = String(req.query.field || 'precipitationIntensity');
  const time = String(req.query.time || 'now');
  if (![z,x,y].every(Number.isFinite) || z < 1 || z > 12 || !ALLOWED_FIELDS.has(field)) {
    return res.status(400).json({ error: 'Invalid tile request.' });
  }

  try {
    const encodedTime = encodeURIComponent(time);
    const url = `https://api.tomorrow.io/v4/map/tile/${z}/${x}/${y}/${field}/${encodedTime}.png?apikey=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ error: 'Tomorrow.io tile request failed.', detail: detail.slice(0, 300) });
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(bytes);
  } catch (_) {
    return res.status(502).json({ error: 'Tomorrow.io provider request failed.' });
  }
}
