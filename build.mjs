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

const indexPath = path.join(out, 'index.html');
let html = await fs.readFile(indexPath, 'utf8');
html = html.replace(
  'width=device-width, initial-scale=1, viewport-fit=cover',
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
);
if (!html.includes('maptiler-env.js')) {
  html = html.replace('<script src="radar-fix.js"></script>', '<script src="maptiler-env.js"></script>\n  <script src="radar-fix.js"></script>');
}
await fs.writeFile(indexPath, html, 'utf8');

console.log(`StormLens build complete. MapTiler: ${mapTilerKey ? 'configured' : 'not configured'}`);
