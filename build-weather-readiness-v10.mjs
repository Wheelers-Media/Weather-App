import { promises as fs } from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'map-core-v10.js');
let source = await fs.readFile(file, 'utf8');

function replaceRequired(find, replacement, label) {
  if (!source.includes(find)) throw new Error(`StormLens weather-readiness patch missing: ${label}`);
  source = source.replace(find, replacement);
}

// MapTiler documents that most Weather layer methods should only be used after sourceReady.
// The previous build deliberately resolved after 5-8 seconds even when sourceReady had not
// fired, which allowed getAnimationStartDate/getAnimationEndDate to run on an unready layer.
replaceRequired(
  "    const ready=new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};layer.on('sourceReady',finish);const timer=setTimeout(finish,def.type==='wind'?8000:5000);});",
  "    const sourceReadyPromise=(typeof layer.onSourceReadyAsync==='function'?layer.onSourceReadyAsync():new Promise(resolve=>layer.on('sourceReady',resolve)));\n    const ready=Promise.race([sourceReadyPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Weather layer failed to initialize')),def.type==='wind'?25000:18000))]);",
  'Weather SDK sourceReady lifecycle'
);

// Conservative particle settings keep Wind smooth on phones while remaining visually useful.
replaceRequired(
  "if (def.type === 'wind') return { ...base, density:matchMedia('(pointer:coarse)').matches ? 1.6 : 2.1, maxAmount:matchMedia('(pointer:coarse)').matches ? 72 : 140, size:1.35, speed:.0011 };",
  "if (def.type === 'wind') return { ...base, density:matchMedia('(pointer:coarse)').matches ? 1.35 : 1.8, maxAmount:matchMedia('(pointer:coarse)').matches ? 64 : 128, size:1.4, speed:.001 };",
  'Wind particle settings'
);

await fs.writeFile(file, source, 'utf8');
console.log('StormLens Weather SDK readiness patches applied.');
