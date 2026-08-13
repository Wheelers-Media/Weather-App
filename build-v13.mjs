import { promises as fs } from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const coreFile=path.join(root,'dist','map-core-v10.js');
let source=await fs.readFile(coreFile,'utf8');
const find="const api={get map(){return map;},get selectedLayer(){return selected;},get tomorrowEnabled(){return tomorrowReady;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,recenter};";
const replacement="const api={get map(){return map;},get weatherLayer(){return weatherLayer;},get timeline(){return timeline;},get selectedLayer(){return selected;},get tomorrowEnabled(){return tomorrowReady;},defs,selectLayer,setBaseMap,openLayers,stopPlayback,recenter};";
if(!source.includes(find))throw new Error('StormLens V13 map API patch target missing');
source=source.replace(find,replacement);
await fs.writeFile(coreFile,source,'utf8');

const indexFile=path.join(root,'dist','index.html');
let html=await fs.readFile(indexFile,'utf8');
if(!html.includes('responsive-v13.css')){
  html=html.replace('</head>','  <link rel="stylesheet" href="responsive-v13.css?v=20260813-1">\n</head>');
}
if(!html.includes('responsive-v13.js')){
  html=html.replace('<script src="maptiler-env.js"></script>','<script src="responsive-v13.js?v=20260813-1"></script>\n  <script src="maptiler-env.js"></script>');
}
await fs.writeFile(indexFile,html,'utf8');
console.log('StormLens V13 responsive shell and timeline hooks applied.');
