import { promises as fs } from 'node:fs';
import path from 'node:path';

const file=path.join(process.cwd(),'dist','map-core-v10.js');
let source=await fs.readFile(file,'utf8');
const find="const api={get map(){return map;},get selectedLayer(){return selected;},get tomorrowEnabled(){return tomorrowReady;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,recenter};";
const replacement="const api={get map(){return map;},get weatherLayer(){return weatherLayer;},get timeline(){return timeline;},get selectedLayer(){return selected;},get tomorrowEnabled(){return tomorrowReady;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,recenter};";
if(!source.includes(find))throw new Error('StormLens V13 map API patch target missing');
source=source.replace(find,replacement);
await fs.writeFile(file,source,'utf8');
console.log('StormLens V13 runtime hooks applied.');
