export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    maptiler: Boolean(process.env.MAPTILER_API_KEY),
    xweather: Boolean(process.env.XWEATHER_CLIENT_ID && process.env.XWEATHER_CLIENT_SECRET),
    accuweather: Boolean(process.env.ACCUWEATHER_API_KEY),
    tomorrow: Boolean(process.env.TOMORROW_API_KEY),
    googlePollen: Boolean(process.env.GOOGLE_POLLEN_API_KEY),
    nasaFirms: Boolean(process.env.NASA_FIRMS_MAP_KEY),
    openMeteoCommercial: Boolean(process.env.OPEN_METEO_API_KEY)
  });
}
