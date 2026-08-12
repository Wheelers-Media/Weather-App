const endpoint = 'https://geo.weather.gc.ca/geomet';
const bbox = '-12880000,6470000,-12520000,6780000'; // Calgary / southern Alberta in EPSG:3857
const checks = [
  { id:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR' },
  { id:'GOES-West_1km_VisibleIRSandwich-NightMicrophysicsIR', style:'' },
  { id:'Lightning_2.5km_Density', style:'Lightning' },
  { id:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', style:'' }
];

async function capabilities(id) {
  const q = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer:id, t:String(Date.now()) });
  const r = await fetch(`${endpoint}?${q}`, { headers:{'User-Agent':'StormLens-CI/1.0'} });
  if (!r.ok) throw new Error(`capabilities ${r.status}`);
  const text = await r.text();
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const layerMatch = text.match(new RegExp(`<Layer[^>]*>[\\s\\S]*?<Name>\\s*${escaped}\\s*<\\/Name>[\\s\\S]*?<\\/Layer>`, 'i'));
  const scope = layerMatch?.[0] || text;
  const dim = scope.match(/<(?:Dimension|Extent)[^>]*name=["']time["'][^>]*>/i)?.[0] || '';
  const defaultTime = dim.match(/default=["']([^"']+)["']/i)?.[1] || '';
  return { text, defaultTime };
}

async function check(def) {
  const cap = await capabilities(def.id);
  const q = new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap',
    LAYERS:def.id, STYLES:def.style,
    CRS:'EPSG:3857', BBOX:bbox, WIDTH:'512', HEIGHT:'512',
    FORMAT:'image/png', TRANSPARENT:'TRUE'
  });
  if (cap.defaultTime) q.set('TIME', cap.defaultTime);
  const r = await fetch(`${endpoint}?${q}`, { headers:{'User-Agent':'StormLens-CI/1.0'} });
  const bytes = new Uint8Array(await r.arrayBuffer());
  const type = r.headers.get('content-type') || '';
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return { id:def.id, ok:r.ok && png, status:r.status, type, bytes:bytes.length, defaultTime:cap.defaultTime };
}

let failed = false;
for (const def of checks) {
  try {
    const result = await check(def);
    console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${result.id} HTTP ${result.status} ${result.type} ${result.bytes} bytes TIME=${result.defaultTime || 'default'}`);
    if (!result.ok) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${def.id}: ${error.message}`);
  }
}
if (failed) process.exit(1);
