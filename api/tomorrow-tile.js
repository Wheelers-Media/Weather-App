const FIELDS = {
  precipitationIntensity: { hours: 336 },
  rainIntensity: { hours: 336 },
  snowIntensity: { hours: 336 },
  freezingRainIntensity: { hours: 336 },
  sleetIntensity: { hours: 336 },
  temperature: { hours: 336 },
  temperatureApparent: { hours: 336 },
  humidity: { hours: 336 },
  dewPoint: { hours: 336 },
  windSpeed: { hours: 336 },
  windGust: { hours: 336 },
  windDirection: { hours: 336 },
  pressureSeaLevel: { hours: 336 },
  cloudCover: { hours: 336 },
  cloudBase: { hours: 336 },
  cloudCeiling: { hours: 336 },
  visibility: { hours: 336 },
  thunderstormProbability: { hours: 336 },
  lightningFlashRateDensity: { hours: 90 },
  lightningProbability: { hours: 36 }
};

const GRADIENTS = {
  thunderstormProbability: '0:00000000,10:2563eb33,25:06b6d466,40:22c55e88,55:facc15aa,70:f97316cc,85:ef4444ee,100:a855f7ff',
  lightningProbability: '0:00000000,10:2563eb33,25:06b6d466,40:22c55e88,55:facc15aa,70:f97316cc,85:ef4444ee,100:a855f7ff',
  precipitationIntensity: '0:00000000,1:60a5fa66,3:22c55e88,8:facc15aa,15:f97316cc,30:ef4444ee,50:a855f7ff',
  rainIntensity: '0:00000000,1:60a5fa66,3:22c55e88,8:facc15aa,15:f97316cc,30:ef4444ee,50:a855f7ff'
};

function normalizeTime(value, maxHours) {
  if (!value || value === 'now') return 'now';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const min = now - 7 * 24 * 60 * 60 * 1000;
  const max = now + maxHours * 60 * 60 * 1000 + 15 * 60 * 1000;
  if (date.getTime() < min || date.getTime() > max) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export default async function handler(req, res) {
  const key = process.env.TOMORROW_API_KEY;
  if (!key) return res.status(503).json({ error: 'Tomorrow.io map tiles are not configured.' });

  const secFetchSite = String(req.headers['sec-fetch-site'] || '');
  if (secFetchSite === 'cross-site') return res.status(403).json({ error: 'Cross-site tile requests are not allowed.' });

  const z = Number(req.query.z), x = Number(req.query.x), y = Number(req.query.y);
  const field = String(req.query.field || 'precipitationIntensity');
  const config = FIELDS[field];
  if (![z, x, y].every(Number.isFinite) || z < 1 || z > 12 || !config) {
    return res.status(400).json({ error: 'Invalid tile request.' });
  }

  const time = normalizeTime(req.query.time, config.hours);
  if (!time) return res.status(400).json({ error: 'Requested time is outside this layer horizon.' });

  try {
    const pathTime = encodeURIComponent(time);
    const params = new URLSearchParams({ apikey: key });
    if (GRADIENTS[field]) params.set('gradient', GRADIENTS[field]);
    const url = `https://api.tomorrow.io/v4/map/tile/${z}/${x}/${y}/${encodeURIComponent(field)}/${pathTime}.png?${params}`;
    const response = await fetch(url, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: 'Tomorrow.io tile request failed.',
        providerStatus: response.status,
        detail: detail.slice(0, 240)
      });
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).send(bytes);
  } catch (_) {
    return res.status(502).json({ error: 'Tomorrow.io provider request failed.' });
  }
}
