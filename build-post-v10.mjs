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

await fs.writeFile(file, source, 'utf8');
console.log('StormLens V10 post-build patches applied.');
