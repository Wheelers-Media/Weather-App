const layers = [
  'RADAR_1KM_RRAI',
  'Radar_1km_RainPrecipRate-Extrapolation',
  'Radar_1km_SfcPrecipType',
  'HRDPS.CONTINENTAL_RT',
  'HRDPS-WEonG_2.5km_Precip-Prob',
  'HRDPS.CONTINENTAL_RN',
  'GOES-West_1km_DayVis-NightIR',
  'GOES-West_1km_VisibleIRSandwich-NightMicrophysicsIR',
  'GOES-West_1km_FireTemperature-SWIR',
  'Lightning_2.5km_Density',
  'HRDPS-WEonG_2.5km_Thunderstorm-Prob',
  'HRDPS.CONTINENTAL.CONV_SHWINX.500',
  'Current-Alerts',
  'HRDPS.CONTINENTAL_TT',
  'HRDPS.CONTINENTAL_TD',
  'HRDPS.CONTINENTAL_HR',
  'HRDPS.CONTINENTAL_PN-SLP',
  'HRDPS.CONTINENTAL_NT',
  'HRDPS.CONTINENTAL_WSPD',
  'HRDPS.CONTINENTAL_WGE',
  'HRDPS.CONTINENTAL_SN',
  'HRDPS.CONTINENTAL_SD',
  'HRDPS.CONTINENTAL_FR',
  'HRDPS.CONTINENTAL.DIAG_PTYPE',
  'AQHI-OBS',
  'RAQDPS.Sfc_PM2.5-WildfireSmokePlume'
];

const endpoint = 'https://geo.weather.gc.ca/geomet';

async function check(layer) {
  const query = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${endpoint}?${query}`, { signal:controller.signal, headers:{ 'User-Agent':'StormLens-CI/1.0' } });
    const text = await response.text();
    const escaped = layer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = response.ok && new RegExp(`<Name>\\s*${escaped}\\s*<\\/Name>`).test(text);
    return { layer, ok:found, status:response.status, contentType:response.headers.get('content-type') || '' };
  } catch (error) {
    return { layer, ok:false, status:0, error:error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let i = 0; i < layers.length; i += 5) {
  results.push(...await Promise.all(layers.slice(i, i + 5).map(check)));
}

for (const result of results) {
  console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${result.layer} ${result.status || ''} ${result.error || ''}`.trim());
}

const failures = results.filter(result => !result.ok);
if (failures.length) {
  console.error(`\n${failures.length} GeoMet layer(s) are unavailable or renamed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} StormLens GeoMet layers are currently published.`);
