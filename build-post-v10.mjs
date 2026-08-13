import { promises as fs } from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'map-core-v10.js');
let source = await fs.readFile(file, 'utf8');

function replaceRequired(find, replacement, label) {
  if (!source.includes(find)) throw new Error(`StormLens post-build patch missing: ${label}`);
  source = source.replace(find, replacement);
}

replaceRequired(
  "if (def.provider==='maptiler') return 'FORECAST · SMOOTH';",
  "if (def.provider==='maptiler') return 'FORECAST';",
  'timeline smooth wording'
);

source = source.replace(/return'SMOOTH · 4D'/g, "return'FORECAST · 4D'");

replaceRequired(
  "officialNowcast: { title:'Official radar nowcast', category:'Precipitation', icon:'scan-line', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:'RADARURPPRECIPR14-LINEAR'",
  "officialNowcast: { title:'Official radar nowcast', category:'Precipitation', icon:'scan-line', provider:'eccc', layer:'Radar_1km_RainPrecipRate-Extrapolation', style:''",
  'official nowcast default WMS style'
);

// Make light precipitation visible. MapTiler's default precipitation ramp spans 0–50 mm/h,
// which can make common light rain/drizzle nearly disappear on a dark mobile map.
replaceRequired(
  "    if (def.type === 'temperature' && maptilerweather.ColorRamp?.builtin?.TEMPERATURE_3) base.colorramp = maptilerweather.ColorRamp.builtin.TEMPERATURE_3;\n    return base;",
  "    if (def.type === 'temperature' && maptilerweather.ColorRamp?.builtin?.TEMPERATURE_3) base.colorramp = maptilerweather.ColorRamp.builtin.TEMPERATURE_3;\n    if (def.type === 'precipitation' && maptilerweather.ColorRamp) base.colorramp = new maptilerweather.ColorRamp({ stops:[\n      { value:0, color:[0,0,0,0] },\n      { value:0.05, color:[72,166,255,125] },\n      { value:0.2, color:[55,184,255,180] },\n      { value:0.5, color:[31,205,133,210] },\n      { value:1.5, color:[250,204,21,225] },\n      { value:4, color:[249,115,22,238] },\n      { value:8, color:[239,68,68,248] },\n      { value:15, color:[168,85,247,255] }\n    ], smooth:true });\n    return base;",
  'visible light precipitation color ramp'
);

// 1024px WMS tiles were overkill on mobile and made ECCC model layers feel stuck.
replaceRequired(
  "const highRes=/^(HRDPS|RAQDPS)/.test(def.layer||'');const size=highRes?'1024':'512';",
  "const size='512';",
  'mobile friendly ECCC tile size'
);

// A raster layer can draw useful tiles before MapLibre considers the whole source fully loaded.
// Do not leave the UI in a permanent buffering state waiting for isSourceLoaded().
replaceRequired(
  "if(!map?.getLayer(frame.layer)||!frame.ready){if(!quiet)setStatus(`${active.def.title} · buffering`,'loading');return false;}",
  "if(!map?.getLayer(frame.layer))return false;",
  'non-blocking ECCC raster display'
);

// Do not block playback while preloading five large frames. Prefetch two quietly in the background.
replaceRequired(
  "if(timeline.mode==='raster'&&timeline.times.length>1){setPlayUI(true);await bufferRaster(5);if(!playing)return;rasterTick();return;}",
  "if(timeline.mode==='raster'&&timeline.times.length>1){setPlayUI(true);bufferRaster(2).catch(()=>{});rasterTick();return;}",
  'non-blocking raster playback buffer'
);

replaceRequired(
  "async function bufferRaster(count=3){const indices=[];const jump=rasterJump();for(let n=1;n<=count;n++){let i=timeline.index+n*jump;if(i>=timeline.times.length)i%=timeline.times.length;indices.push(i);}for(let n=0;n<indices.length;n++){setStatus(`${active.def.title} · buffering ${n+1}/${indices.length}`,'loading');const f=await ensureRasterFrame(indices[n]);if(f)await Promise.race([f.promise,sleep(1600)]);}setStatus(`${active.def.title} · READY`,'live');}",
  "async function bufferRaster(count=2){const indices=[];const jump=rasterJump();for(let n=1;n<=count;n++){let i=timeline.index+n*jump;if(i>=timeline.times.length)i%=timeline.times.length;indices.push(i);}for(const i of indices){const f=await ensureRasterFrame(i);if(f)await Promise.race([f.promise,sleep(900)]);}}",
  'quiet raster prefetch'
);

// Showalter is a specialist stability diagnostic. Keep the underlying product available in code,
// but remove it from the consumer-facing layer picker.
replaceRequired(
  "Object.entries(defs).filter(([id,d])=>d.category===category&&(d.provider!=='tomorrow'||tomorrowConfigured)&&id!=='lightningForecast')",
  "Object.entries(defs).filter(([id,d])=>d.category===category&&(d.provider!=='tomorrow'||tomorrowConfigured)&&id!=='lightningForecast'&&id!=='showalter')",
  'hide specialist Showalter layer'
);

// Do not use ECCC GetLegendGraphic images for probability products. A compact numeric legend is
// clearer on a phone and avoids the legend looking like a random embedded picture.
replaceRequired(
  "    if(def.provider==='maptiler'&&renderMapTilerLegend(el,def)){}\n    else if(def.provider==='eccc'&&renderEcccLegend(el,def)){}",
  "    if(def.layer==='HRDPS-WEonG_2.5km_Thunderstorm-Prob') el.innerHTML='<span><b class=\"legend-dot v10-blue\"></b>0%</span><span><b class=\"legend-dot v10-yellow\"></b>25%</span><span><b class=\"legend-dot v10-red\"></b>50%</span><span><b class=\"legend-dot v10-purple\"></b>100%</span>';\n    else if(def.layer==='HRDPS-WEonG_2.5km_Precip-Prob') el.innerHTML='<span><b class=\"legend-dot v10-blue\"></b>0%</span><span><b class=\"legend-dot v10-yellow\"></b>25%</span><span><b class=\"legend-dot v10-red\"></b>50%</span><span><b class=\"legend-dot v10-purple\"></b>100%</span>';\n    else if(def.provider==='maptiler'&&renderMapTilerLegend(el,def)){}\n    else if(def.provider==='eccc'&&renderEcccLegend(el,def)){}",
  'clean probability legends'
);

await fs.writeFile(file, source, 'utf8');
console.log('StormLens V10 post-build patches applied.');
