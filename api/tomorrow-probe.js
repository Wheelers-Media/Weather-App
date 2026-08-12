const MAP_FIELDS = new Set([
  'precipitationIntensity','rainIntensity','snowIntensity','freezingRainIntensity','sleetIntensity',
  'temperature','temperatureApparent','humidity','dewPoint','windSpeed','windGust','windDirection',
  'pressureSeaLevel','cloudCover','cloudBase','cloudCeiling','visibility','thunderstormProbability',
  'lightningFlashRateDensity','lightningProbability'
]);

export default async function handler(req, res) {
  const key = process.env.TOMORROW_API_KEY;
  const field = String(req.query.field || 'thunderstormProbability');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');

  if (!key) return res.status(200).json({ configured:false, field, available:false, reason:'not_configured' });
  if (!MAP_FIELDS.has(field)) return res.status(400).json({ configured:true, field, available:false, reason:'unsupported_field' });

  try {
    // Calgary at z4 gives a small, representative land tile. This verifies the key,
    // Weather Maps endpoint permission, and field entitlement without exposing the key.
    const url = `https://api.tomorrow.io/v4/map/tile/4/2/5/${encodeURIComponent(field)}/now.png?apikey=${encodeURIComponent(key)}`;
    const response = await fetch(url, { headers: { 'Accept-Encoding':'gzip, deflate, br' } });
    try { await response.body?.cancel?.(); } catch (_) {}

    if (response.ok) return res.status(200).json({ configured:true, field, available:true });
    if (response.status === 401 || response.status === 403) {
      return res.status(200).json({ configured:true, field, available:false, reason:'not_entitled_or_invalid_key', providerStatus:response.status });
    }
    if (response.status === 429) {
      return res.status(200).json({ configured:true, field, available:false, reason:'rate_limited', providerStatus:429 });
    }
    return res.status(200).json({ configured:true, field, available:false, reason:'provider_error', providerStatus:response.status });
  } catch (_) {
    return res.status(200).json({ configured:true, field, available:false, reason:'provider_unreachable' });
  }
}
