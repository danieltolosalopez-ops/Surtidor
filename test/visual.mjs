// Prueba visual sin internet: sirve la app con datos de prueba y una imitación de Leaflet.
// Uso: npm test && PW_PATH=/ruta/a/node_modules/ node test/visual.mjs  (requiere playwright y Chrome)
// Hace capturas en test/screens y falla (código 1) si hay errores de JavaScript o algo no aparece.
import { createRequire } from 'node:module';
import { cp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const require = createRequire(process.env.PW_PATH || import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve('test/site');
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp('public', root, { recursive: true });
await cp('test/out', path.join(root, 'data'), { recursive: true });
const stub = await readFile('test/leaflet-stub.js', 'utf8');
// La librería real del mapa no está en el repositorio (se copia al publicar): aquí se usa la imitación.
await mkdir(path.join(root, 'vendor/leaflet'), { recursive: true });
await writeFile(path.join(root, 'vendor/leaflet/leaflet.js'), stub);
await writeFile(path.join(root, 'vendor/leaflet/leaflet.css'), '');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const file = path.join(root, p.endsWith('/') ? `${p}index.html` : p);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(5199);

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { executablePath: '/usr/bin/google-chrome' });
const errors = [];
async function page(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('https://unpkg.com/**', (r) => r.fulfill({ status: 200, contentType: r.request().url().endsWith('.css') ? 'text/css' : 'text/javascript', body: r.request().url().endsWith('.css') ? '' : stub }));
  await ctx.route('http://localhost:5199/', async (r) => {
    const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replace(/\s+integrity="[^"]+"/g, '');
    r.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return pg;
}

const out = 'test/screens';
await mkdir(out, { recursive: true });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' };

// 1) Primera visita, sin permiso de ubicación: vista general de España
let pg = await page(mobile);
await pg.goto('http://localhost:5199/');
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${out}/1-overview.png` });

// 2) Con ubicación en Madrid
pg = await page({ ...mobile, geolocation: { latitude: 40.4168, longitude: -3.7038 }, permissions: ['geolocation'] });
await pg.goto('http://localhost:5199/');
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${out}/2-cerca.png` });
await pg.click('#sheet-handle');
await pg.waitForTimeout(500);
await pg.click('.seg [data-sort="saving"]');
await pg.waitForTimeout(500);
await pg.screenshot({ path: `${out}/3-lista-ahorro.png` });
await pg.click('#list .row');
await pg.waitForTimeout(500);
await pg.screenshot({ path: `${out}/4-ficha.png` });
await pg.click('[data-act="fav"]');
await pg.click('[data-act="back"]');
await pg.click('#btn-favs');
await pg.waitForTimeout(400);
const favText = await pg.textContent('#list');
await pg.click('#btn-settings');
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${out}/5-ajustes.png` });

// 3) Escritorio
pg = await page({ viewport: { width: 1280, height: 800 }, geolocation: { latitude: 41.3874, longitude: 2.1686 }, permissions: ['geolocation'], locale: 'es-ES' });
await pg.goto('http://localhost:5199/');
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${out}/6-escritorio.png` });

// 4) Enlace compartido directo a una gasolinera de Francia
pg = await page(mobile);
const frIndex = JSON.parse(await readFile('test/out/index.json', 'utf8')).countries.find((c) => c.code === 'FR');
const frTile = Object.keys(frIndex.tiles)[0];
const frId = JSON.parse(await readFile(`test/out/FR/${frTile}.json`, 'utf8')).stations[0].i;
await pg.goto(`http://localhost:5199/#FR/${frTile}/${frId}`);
await pg.waitForTimeout(1000);
const deepTitle = await pg.textContent('#detail h2').catch(() => null);

// 5) La lista del radio incluye las gasolineras de las zonas vecinas aunque no se vean en pantalla
//    (el este de Sevilla está junto al límite de zona del meridiano 6° O).
const { distanceKm } = await import('../public/core.js');
const allStations = [];
for (const cc of ['ES', 'FR']) for (const f of await readdir(`test/out/${cc}`)) allStations.push(...JSON.parse(await readFile(`test/out/${cc}/${f}`, 'utf8')).stations);
const [sevLat, sevLon] = [37.39, -5.94];
pg = await page({ ...mobile, geolocation: { latitude: sevLat, longitude: sevLon }, permissions: ['geolocation'] });
await pg.goto('http://localhost:5199/');
await pg.waitForTimeout(1200);
const radiusShown = Number((/(\d+) gasolineras/.exec(await pg.textContent('#sheet-sub')) || [])[1]);
const radiusReal = allStations.filter((s) => s.p.g95 !== undefined && !s.r && distanceKm(sevLat, sevLon, s.a, s.o) <= 10).length;

// 6) Con las favoritas abiertas, al llegar precios nuevos (recarga cada 10 min) siguen mostrando su precio
const frFav = JSON.parse(await readFile(`test/out/FR/${frTile}.json`, 'utf8')).stations.find((s) => s.p.g95 !== undefined);
pg = await page({ ...mobile, geolocation: { latitude: 40.4168, longitude: -3.7038 }, permissions: ['geolocation'] });
await pg.addInitScript((k) => localStorage.setItem('surtidor:favorites', JSON.stringify([{ key: k, name: 'Favorita', place: 'Francia' }])), `FR/${frTile}/${frFav.i}`);
let generation = 0;
await pg.route('**/data/index.json*', async (r) => { const res = await r.fetch(); const j = await res.json(); j.generated = `prueba-${generation++}`; await r.fulfill({ response: res, json: j }); });
await pg.clock.install();
await pg.goto('http://localhost:5199/');
await pg.clock.runFor(3000);
await pg.click('#btn-favs');
await pg.clock.runFor(2000);
await pg.waitForTimeout(800);
await pg.clock.runFor(10 * 60000 + 2000);
await pg.waitForTimeout(800);
await pg.clock.runFor(3000);
await pg.waitForTimeout(800);
const favAfterReload = await pg.textContent('#list');

await browser.close();
server.close();
console.log('Favoritas:', favText.replace(/\s+/g, ' ').trim().slice(0, 120));
console.log('Enlace directo abre:', deepTitle);
const problems = [...errors];
if (!deepTitle) problems.push('El enlace directo a una gasolinera no abrió su ficha');
if (!/€\/L/.test(favText)) problems.push('La lista de favoritas no muestra precio');
console.log(`Radio 10 km en Sevilla: la app muestra ${radiusShown}, hay ${radiusReal}`);
if (radiusShown !== radiusReal) problems.push('La lista del radio no incluye todas las gasolineras cercanas');
if (generation < 2) problems.push('No se llegó a probar la recarga automática de precios');
if (!/€\/L/.test(favAfterReload)) problems.push('Las favoritas pierden el precio tras la recarga automática');
console.log(problems.length ? `PROBLEMAS:\n${problems.join('\n')}` : 'Prueba visual OK: sin errores de JavaScript');
process.exit(problems.length ? 1 : 0);
