const endpoint = 'https://geo.weather.gc.ca/geomet';
const bbox = '-12880000,6470000,-12520000,6780000'; // Calgary / southern Alberta, EPSG:3857

const checks = [
  { id:'RADAR_1KM_RRAI', style:'RADARURPPRECIPR14-LINEAR', label:'Official radar' },
  { id:'Radar_1km_RainPrecipRate-Extrapolation', style:'', label:'Official radar nowcast' },
  { id:'Radar_1km_SfcPrecipType', style:'', label:'Observed precip type' },
  { id:'HRDPS-WEonG_2.5km_Precip-Prob', style:'', label:'Precipitation probability' },
  { id:'HRDPS.CONTINENTAL_RN', style:'', label:'Rain accumulation' },
  { id:'Lightning_2.5km_Density', style:'Lightning', label:'Lightning density' },
  { id:'HRDPS-WEonG_2.5km_Thunderstorm-Prob', style:'', label:'Thunderstorm probability Canada' },
  { id:'HRDPS.CONTINENTAL.CONV_SHWINX.500', style:'', label:'Showalter index' },
  { id:'Current-Alerts', style:'Current-Alerts', label:'Official alerts' },
  { id:'HRDPS.CONTINENTAL_SN', style:'', label:'Snow accumulation' },
  { id:'HRDPS.CONTINENTAL_SD', style:'', label:'Snow depth' },
  { id:'AQHI-OBS', style:'', label:'AQHI' },
  { id:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', style:'', label:'Wildfire smoke PM2.5' }
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchWithTimeout(url, options={}, timeoutMs=30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal:controller.signal }); }
  finally { clearTimeout(timer); }
}

async function layerMetadata(def) {
  const q = new URLSearchParams({ service:'WMS', version:'1.3.0', request:'GetCapabilities', layer:def.id, _:String(Date.now()) });
  const response = await fetchWithTimeout(`${endpoint}?${q}`, { headers:{'User-Agent':'StormLens-Smoke/1.0'} });
  if (!response.ok) throw new Error(`capabilities HTTP ${response.status}`);
  const text = await response.text();
  const escaped = escapeRegex(def.id);
  if (!new RegExp(`<Name>\\s*${escaped}\\s*<\\/Name>`).test(text)) throw new Error('layer not published');

  const nameIndex = text.search(new RegExp(`<Name>\\s*${escaped}\\s*<\\/Name>`));
  const scope = nameIndex >= 0 ? text.slice(nameIndex, Math.min(text.length, nameIndex + 40000)) : text;
  const dimension = scope.match(/<(?:Dimension|Extent)[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/(?:Dimension|Extent)>/i);
  const tag = dimension?.[0] || '';
  const defaultTime = tag.match(/default=["']([^"']+)["']/i)?.[1] || '';
  const content = dimension?.[1]?.trim() || '';
  let time = defaultTime;
  if (!time && content) {
    const lastPart = content.split(',').map(v=>v.trim()).filter(Boolean).at(-1) || '';
    time = lastPart.includes('/') ? (lastPart.split('/')[1] || '') : lastPart;
  }
  return { time };
}

async function render(def) {
  const meta = await layerMetadata(def);
  await sleep(350);
  const q = new URLSearchParams({
    SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap',
    LAYERS:def.id, STYLES:def.style || '',
    CRS:'EPSG:3857', BBOX:bbox,
    WIDTH:'640', HEIGHT:'640', FORMAT:'image/png', TRANSPARENT:'TRUE'
  });
  if (meta.time) q.set('TIME', meta.time);
  const response = await fetchWithTimeout(`${endpoint}?${q}`, { headers:{'User-Agent':'StormLens-Smoke/1.0'} });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!response.ok || !png) throw new Error(`GetMap HTTP ${response.status}, ${response.headers.get('content-type') || 'unknown type'}, ${bytes.length} bytes`);
  return { bytes:bytes.length, time:meta.time || 'provider default' };
}

const results=[];
for (const def of checks) {
  try {
    const result=await render(def);
    results.push({ok:true,def,...result});
    console.log(`OK   ${def.label.padEnd(33)} ${String(result.bytes).padStart(8)} bytes  ${result.time}`);
  } catch(error) {
    results.push({ok:false,def,error:error.message});
    console.error(`FAIL ${def.label.padEnd(33)} ${error.message}`);
  }
  await sleep(850);
}

const failures=results.filter(r=>!r.ok);
console.log(`\nRendered ${results.length-failures.length}/${results.length} ECCC layers successfully.`);
console.log('A valid quiet/transparent PNG means the service works even when there is no weather activity in the Calgary viewport.');
if (failures.length) process.exit(1);
