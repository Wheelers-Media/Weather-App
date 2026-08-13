import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
await fs.rm(out, { recursive:true, force:true });
await fs.mkdir(out, { recursive:true });

const allowedExt = new Set(['.html','.css','.js','.json','.png','.jpg','.jpeg','.webp','.svg','.ico','.txt']);
const excluded = new Set(['vercel.json','package.json','package-lock.json','build.mjs']);
const entries = await fs.readdir(root, { withFileTypes:true });
for (const entry of entries) {
  if (!entry.isFile() || excluded.has(entry.name)) continue;
  if (!allowedExt.has(path.extname(entry.name).toLowerCase())) continue;
  await fs.copyFile(path.join(root, entry.name), path.join(out, entry.name));
}

const mapTilerKey = process.env.MAPTILER_API_KEY || '';
const publicConfig = `window.STORMLENS_PUBLIC_CONFIG = Object.freeze({\n  mapTilerApiKey: ${JSON.stringify(mapTilerKey)},\n  mapTilerEnabled: ${Boolean(mapTilerKey)}\n});\n`;
await fs.writeFile(path.join(out, 'maptiler-env.js'), publicConfig, 'utf8');

function replaceRequired(source, find, replacement, label) {
  if (!source.includes(find)) throw new Error(`StormLens build patch missing: ${label}`);
  return source.replace(find, replacement);
}

const indexPath = path.join(out, 'index.html');
let html = await fs.readFile(indexPath, 'utf8');
html = html.replace(
  'width=device-width, initial-scale=1, viewport-fit=cover',
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
);
html = html.replace(/\s*<link rel="stylesheet" href="https:\/\/unpkg\.com\/leaflet@[^>]+>\s*/i, '\n');
html = html.replace(/\s*<script src="https:\/\/unpkg\.com\/leaflet@[^>]+><\/script>\s*/i, '\n  ');
html = html.replace('<span>Nowcast</span>', '<span>Next 6h</span>');
html = html.replace('<span>Storm risk</span>', '<span>Storm</span>');
if (!html.includes('maptiler-env.js')) {
  html = html.replace('<script src="radar-fix.js"></script>', '<script src="maptiler-env.js"></script>\n  <script src="radar-fix.js"></script>');
}
await fs.writeFile(indexPath, html, 'utf8');

// Keep the original weather/home application, but remove its legacy Leaflet map ownership.
const appPath = path.join(out, 'app.js');
let app = await fs.readFile(appPath, 'utf8');
app = app.replace(
  'initMap();\n        state.map && state.map.invalidateSize();',
  "document.dispatchEvent(new CustomEvent('stormlens:map-screen-visible'));"
);
app = app.replace(
  "$('#openStormMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>setMapLayer('storms'),120); });",
  "$('#openStormMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>document.dispatchEvent(new CustomEvent('stormlens:map-select-layer',{detail:{id:'storms'}})),120); });"
);
app = app.replace(
  "$('#openLightningMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>setMapLayer('lightning'),120); });",
  "$('#openLightningMap')?.addEventListener('click',()=>{ switchScreen('map'); setTimeout(()=>document.dispatchEvent(new CustomEvent('stormlens:map-select-layer',{detail:{id:'lightning'}})),120); });"
);

app = replaceRequired(
  app,
  '  function useGeolocation(options = {}) {',
  `  function getBestDevicePosition(success, error) {
    let best = null;
    let watchId = null;
    let timer = null;
    let finished = false;
    const finish = (ok, value) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      ok ? success(value) : error(value);
    };
    const accept = pos => {
      const accuracy = Number(pos?.coords?.accuracy || Infinity);
      if (!best || accuracy < Number(best.coords.accuracy || Infinity)) best = pos;
      if (accuracy <= 35) finish(true, pos);
    };
    watchId = navigator.geolocation.watchPosition(
      accept,
      err => {
        if (err?.code === 1) finish(false, err);
        else if (!best && err?.code === 2) return;
      },
      { enableHighAccuracy:true, timeout:20000, maximumAge:0 }
    );
    timer = setTimeout(() => {
      if (best) finish(true, best);
      else finish(false, { code:2, message:'No reliable device location fix received.' });
    }, 12000);
  }

  function useGeolocation(options = {}) {`,
  'high accuracy geolocation sampler'
);
app = replaceRequired(
  app,
  '    navigator.geolocation.getCurrentPosition(async pos => {',
  '    getBestDevicePosition(async pos => {',
  'use best geolocation sample'
);
app = replaceRequired(
  app,
  "    }, { enableHighAccuracy:true, timeout:15000, maximumAge:120000 });",
  '    });',
  'remove stale one-shot geolocation options'
);
await fs.writeFile(appPath, app, 'utf8');

// Production map polish. Keep the checked-in V10 core frozen and apply small, asserted transforms here.
const corePath = path.join(out, 'map-core-v10.js');
let core = await fs.readFile(corePath, 'utf8');

core = replaceRequired(
  core,
  "    nowcast: { title:'Radar nowcast', category:'Precipitation', icon:'cloud-rain-wind', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', horizonHours:1, horizon:'short range', mode:'forecast', description:'Official extrapolated precipitation nowcast.' },",
  "    nowcast: { title:'Short-range radar', category:'Precipitation', icon:'cloud-rain-wind', provider:'maptiler', type:'radar', horizonHours:6, horizon:'6 hours', mode:'forecast', description:'Smooth forecast radar focused on the next 6 hours.' },\n    officialNowcast: { title:'Official radar nowcast', category:'Precipitation', icon:'scan-line', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR', horizonHours:1, horizon:'short range', mode:'forecast', description:'Official ECCC extrapolated precipitation nowcast.' },",
  'honest short-range radar definition'
);

core = replaceRequired(
  core,
  "    thunderstorms: { title:'Thunderstorms · 14d', category:'Storms', icon:'cloud-lightning', provider:'tomorrow', field:'thunderstormProbability', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended thunderstorm probability forecast.' },",
  "    storm: { title:'Storm', category:'Storms', icon:'cloud-lightning', provider:'maptiler', type:'precipitation', horizonHours:96, horizon:'4 days', mode:'forecast', description:'Animated precipitation with Canadian lightning context in one storm view.' },\n    thunderstorms: { title:'Thunderstorms · 14d', category:'Storms', icon:'cloud-lightning', provider:'tomorrow', field:'thunderstormProbability', horizonHours:336, horizon:'14 days', mode:'forecast', description:'Extended thunderstorm probability forecast.' },",
  'storm composite definition'
);

core = replaceRequired(
  core,
  "    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', provider:'eccc', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', horizonHours:72, horizon:'forecast', mode:'forecast', description:'Canadian wildfire-smoke PM2.5 forecast.' },",
  "    smoke: { title:'Wildfire smoke PM2.5', category:'Environment', icon:'cloud-fog', provider:'eccc', layer:'RAQDPS.Sfc_PM2.5-WildfireSmokePlume', horizonHours:72, horizon:'forecast', mode:'forecast', opacity:0.58, description:'Canadian wildfire-smoke PM2.5 model. Smoothed for display; native model grid is coarser than radar.' },",
  'smoke display settings'
);

core = replaceRequired(
  core,
  "    const ready=new Promise((resolve,reject)=>{let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(new Error('Weather data timed out'));};layer.on('sourceReady',()=>finish(true));const timer=setTimeout(()=>finish(false),12000);});",
  "    const ready=new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};layer.on('sourceReady',finish);const timer=setTimeout(finish,def.type==='wind'?8000:5000);});",
  'non-blocking MapTiler weather readiness'
);

core = replaceRequired(
  core,
  "  function buildEcccTemplate(def,date){const p=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:def.layer,STYLES:def.style||'',FORMAT:'image/png',TRANSPARENT:'true',SRS:'EPSG:3857',WIDTH:'512',HEIGHT:'512'});if(date)p.set('TIME',normalizedTime(date));return`${WMS}${p.toString()}&BBOX={bbox-epsg-3857}`;}",
  "  function buildEcccTemplate(def,date){const highRes=/^(HRDPS|RAQDPS)/.test(def.layer||'');const size=highRes?'1024':'512';const p=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:def.layer,STYLES:def.style||'',FORMAT:'image/png',TRANSPARENT:'true',SRS:'EPSG:3857',WIDTH:size,HEIGHT:size});if(date)p.set('TIME',normalizedTime(date));return`${WMS}${p.toString()}&BBOX={bbox-epsg-3857}`;}",
  'higher resolution ECCC model rendering'
);

core = replaceRequired(
  core,
  "      const spec={id:layer,type:'raster',source,paint:{'raster-opacity':0,'raster-resampling':'linear','raster-fade-duration':120}};const before=firstLabelLayer();if(before)map.addLayer(spec,before);else map.addLayer(spec);",
  "      const spec={id:layer,type:'raster',source,paint:{'raster-opacity':0,'raster-resampling':'linear','raster-fade-duration':220}};const before=firstLabelLayer();if(before)map.addLayer(spec,before);else map.addLayer(spec);",
  'raster crossfade'
);

core = replaceRequired(
  core,
  "    if(!map?.getLayer(frame.layer))return false;\n    const old=currentRasterKey?rasterFrames.get(currentRasterKey):null;map.setPaintProperty(frame.layer,'raster-opacity',opacity());",
  "    if(!map?.getLayer(frame.layer)||!frame.ready){if(!quiet)setStatus(`${active.def.title} · buffering`,'loading');return false;}\n    const old=currentRasterKey?rasterFrames.get(currentRasterKey):null;map.setPaintProperty(frame.layer,'raster-opacity',Number.isFinite(active.def.opacity)?active.def.opacity:opacity());",
  'do not show unloaded raster frames'
);

core = replaceRequired(
  core,
  "  async function rasterTick(){if(!playing||timeline.mode!=='raster')return;let next=timeline.index+rasterJump();if(next>=timeline.times.length)next=0;await showRasterIndex(next,{quiet:true});if(!playing)return;const ahead=next+rasterJump();if(ahead<timeline.times.length)ensureRasterFrame(ahead).catch?.(()=>{});playbackTimer=setTimeout(rasterTick,speedDelay());}",
  "  async function rasterTick(){if(!playing||timeline.mode!=='raster')return;let next=timeline.index+rasterJump();if(next>=timeline.times.length)next=0;const shown=await showRasterIndex(next,{quiet:true});if(!playing)return;if(!shown){playbackTimer=setTimeout(rasterTick,220);return;}const ahead=next+rasterJump();if(ahead<timeline.times.length)ensureRasterFrame(ahead).catch?.(()=>{});playbackTimer=setTimeout(rasterTick,speedDelay());}",
  'raster playback waits for buffered frame'
);

core = replaceRequired(
  core,
  "if(timeline.mode==='raster'&&timeline.times.length>1){setPlayUI(true);await bufferRaster(3);if(!playing)return;rasterTick();return;}",
  "if(timeline.mode==='raster'&&timeline.times.length>1){setPlayUI(true);await bufferRaster(5);if(!playing)return;rasterTick();return;}",
  'larger raster playback buffer'
);

core = replaceRequired(
  core,
  "  let sliderTimer=null;\n  function bindController(){const slider=$('#radarTimeline');if(slider&&!slider.dataset.v10Bound){slider.dataset.v10Bound='true';slider.addEventListener('input',()=>{stopPlayback();clearTimeout(sliderTimer);if(timeline.mode==='maptiler'&&weatherLayer){const t=Math.max(timeline.start,Math.min(timeline.end,Number(slider.value)));timeline.current=t;weatherLayer.setAnimationTime(Math.round(t/1000));updateSliderProgress();}else if(timeline.mode==='raster'){const i=Math.max(0,Math.min(timeline.times.length-1,Number(slider.value)));updateTimelineText(timeline.times[i],active?.def.mode==='observed'?`PAST ${currentRangeId?.toUpperCase()||''}`:'NOW',rangeEndLabel(timeline.end),active?modeLabel(active.def):'WEATHER');updateSliderProgress();sliderTimer=setTimeout(()=>showRasterIndex(i).catch(()=>{}),90);}});}\n    $('#radarPlay')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();togglePlayback();},true);$('#radarStepBack')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(-1);},true);$('#radarStepForward')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(1);},true);ensureRangeBar();ensureSpeedBar();}",
  "  let sliderRaf=0;let sliderPendingTime=0;\n  function bindController(){const slider=$('#radarTimeline');if(slider&&!slider.dataset.v10Bound){slider.dataset.v10Bound='true';slider.addEventListener('input',()=>{stopPlayback();updateSliderProgress();if(timeline.mode==='maptiler'&&weatherLayer){const t=Math.max(timeline.start,Math.min(timeline.end,Number(slider.value)));timeline.current=t;sliderPendingTime=t;updateTimelineText(t,'NOW',rangeEndLabel(timeline.end),active?modeLabel(active.def):'WEATHER');if(!sliderRaf)sliderRaf=requestAnimationFrame(()=>{sliderRaf=0;if(weatherLayer&&sliderPendingTime)weatherLayer.setAnimationTime(Math.round(sliderPendingTime/1000));});}else if(timeline.mode==='raster'){const i=Math.max(0,Math.min(timeline.times.length-1,Number(slider.value)));updateTimelineText(timeline.times[i],active?.def.mode==='observed'?`PAST ${currentRangeId?.toUpperCase()||''}`:'NOW',rangeEndLabel(timeline.end),active?modeLabel(active.def):'WEATHER');}});slider.addEventListener('change',()=>{if(timeline.mode==='maptiler'&&weatherLayer){const t=Math.max(timeline.start,Math.min(timeline.end,Number(slider.value)));timeline.current=t;weatherLayer.setAnimationTime(Math.round(t/1000));}else if(timeline.mode==='raster'){const i=Math.max(0,Math.min(timeline.times.length-1,Number(slider.value)));showRasterIndex(i,{quiet:true}).catch(()=>{});}});}\n    $('#radarPlay')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();togglePlayback();},true);$('#radarStepBack')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(-1);},true);$('#radarStepForward')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();stepFrame(1);},true);ensureRangeBar();ensureSpeedBar();}",
  'smooth timeline scrubbing'
);

core = replaceRequired(
  core,
  "  function quickTarget(key){if(key==='radar')return'radar';if(key==='nowcast')return'nowcast';if(key==='lightning')return tomorrowReady?'lightningForecast':'lightning';if(key==='storms')return tomorrowReady?'thunderstorms':'thunderRisk';if(key==='alerts')return'alerts';return null;}",
  "  function quickTarget(key){if(key==='radar')return'radar';if(key==='nowcast')return'nowcast';if(key==='lightning')return'lightning';if(key==='storms')return'storm';if(key==='alerts')return'alerts';return null;}",
  'stable quick-layer targets'
);

core = replaceRequired(
  core,
  "setTimeout(()=>selectLayer(tomorrowReady?'thunderstorms':'thunderRisk'),160)",
  "setTimeout(()=>selectLayer('storm'),160)",
  'storm screen target'
);
core = replaceRequired(
  core,
  "setTimeout(()=>selectLayer(tomorrowReady?'lightningForecast':'lightning'),160)",
  "setTimeout(()=>selectLayer('lightning'),160)",
  'lightning screen target'
);

core = replaceRequired(
  core,
  "Object.entries(defs).filter(([,d])=>d.category===category&&(d.provider!=='tomorrow'||tomorrowConfigured))",
  "Object.entries(defs).filter(([id,d])=>d.category===category&&(d.provider!=='tomorrow'||tomorrowConfigured)&&id!=='lightningForecast')",
  'hide unavailable Tomorrow lightning product'
);

core = replaceRequired(
  core,
  `  function renderLegend(def) {
    const el=$('#radarLegend'); if(!el)return;
    if (def.type==='radar' || def.layer==='RADAR_1KM_RRAI' || def.layer==='Radar_1km_RainPrecipRate-Extrapolation') {
      el.innerHTML='<span><b class="legend-dot v10-l1"></b>Light</span><span><b class="legend-dot v10-l2"></b>Moderate</span><span><b class="legend-dot v10-l3"></b>Heavy</span><span><b class="legend-dot v10-l4"></b>Very heavy</span><span><b class="legend-dot v10-l5"></b>Extreme</span>';
    } else if (def.type==='wind') el.innerHTML='<span>Animated wind speed + direction</span>';
    else if (def.field==='thunderstormProbability') el.innerHTML='<span><b class="legend-dot v10-blue"></b>Low</span><span><b class="legend-dot v10-yellow"></b>Moderate</span><span><b class="legend-dot v10-red"></b>High</span><span><b class="legend-dot v10-purple"></b>Severe signal</span>';
    else el.innerHTML=\`<span>\${escapeHtml(def.title)}</span>\`;
    const source=$('#radarSourceLine');
    if(source) source.textContent=\`\${def.title} · \${def.provider==='maptiler'?'MapTiler Weather':def.provider==='tomorrow'?'Tomorrow.io':'Environment and Climate Change Canada'}\`;
  }`,
  `  function legendUnit(def) {
    if (def.type==='radar') return 'dBZ';
    if (def.type==='precipitation') return 'mm/h';
    if (def.type==='temperature') return '°C';
    if (def.type==='pressure') return 'hPa';
    if (def.type==='wind') return 'm/s';
    return '';
  }

  function renderMapTilerLegend(el, def) {
    try {
      const ramp=weatherLayer?.getColorRamp?.();
      if(!ramp)return false;
      const bounds=ramp.getBounds?.()||{};
      const min=Number(bounds.min), max=Number(bounds.max);
      const unit=legendUnit(def);
      const canvas=ramp.getCanvasStrip?.({horizontal:true,size:420,smooth:true});
      if(!canvas)return false;
      canvas.className='v10-legend-canvas';
      el.innerHTML='<div class="v10-live-legend"><div class="v10-live-legend-labels"><span></span><strong></strong><span></span></div></div>';
      const wrap=el.querySelector('.v10-live-legend');
      wrap.insertBefore(canvas,wrap.firstChild);
      const labels=wrap.querySelector('.v10-live-legend-labels');
      labels.children[0].textContent=Number.isFinite(min)?(Math.round(min)+' '+unit).trim():'';
      labels.children[1].textContent=def.title;
      labels.children[2].textContent=Number.isFinite(max)?(Math.round(max)+' '+unit).trim():'';
      return true;
    } catch (_) { return false; }
  }

  function renderEcccLegend(el, def) {
    if(!def.layer)return false;
    const p=new URLSearchParams({version:'1.3.0',service:'WMS',request:'GetLegendGraphic',sld_version:'1.1.0',layer:def.layer,format:'image/png',LANG:'en'});
    if(def.style)p.set('STYLE',def.style);
    const img=document.createElement('img');
    img.className='v10-eccc-legend';
    img.alt=def.title+' legend';
    img.src=WMS+p.toString();
    el.innerHTML='';el.appendChild(img);return true;
  }

  function renderLegend(def) {
    const el=$('#radarLegend'); if(!el)return;
    if(def.provider==='maptiler'&&renderMapTilerLegend(el,def)){}
    else if(def.provider==='eccc'&&renderEcccLegend(el,def)){}
    else if(def.field==='thunderstormProbability') el.innerHTML='<span><b class="legend-dot v10-blue"></b>10%</span><span><b class="legend-dot v10-yellow"></b>55%</span><span><b class="legend-dot v10-red"></b>85%</span><span><b class="legend-dot v10-purple"></b>100%</span>';
    else if(def.field==='precipitationIntensity') el.innerHTML='<span><b class="legend-dot v10-blue"></b>1 mm/h</span><span><b class="legend-dot v10-yellow"></b>8 mm/h</span><span><b class="legend-dot v10-red"></b>30 mm/h</span><span><b class="legend-dot v10-purple"></b>50+ mm/h</span>';
    else el.innerHTML='<span>'+escapeHtml(def.title)+'</span>';
    const source=$('#radarSourceLine');
    if(source) source.textContent=def.title+' · '+(def.provider==='maptiler'?'MapTiler Weather':def.provider==='tomorrow'?'Tomorrow.io':'Environment and Climate Change Canada');
  }`,
  'provider accurate legends'
);

await fs.writeFile(corePath, core, 'utf8');

console.log(`StormLens V10.2 build complete. MapTiler: ${mapTilerKey ? 'configured' : 'not configured'}`);
