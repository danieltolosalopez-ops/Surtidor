#!/usr/bin/env node
// Descarga los precios oficiales de cada país, los normaliza y genera teselas JSON
// en public/data para que la app solo descargue la zona que está mirando.
//
// Uso:  node scripts/build-data.mjs [carpeta_salida]
// Variables de entorno opcionales:
//   COUNTRIES=ES,FR      países a procesar (por defecto todos los proveedores)
//   SITE_URL=https://…   web ya publicada; si una fuente falla, se reutilizan sus datos anteriores
//   FIXTURES_DIR=test/fixtures   lee <PAÍS>.json de esa carpeta en lugar de internet (tests)

import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { FUELS, SUMMARY_FUELS, TILE_DEG, tileKey } from '../public/core.js';
import * as es from './providers/es.mjs';
import * as fr from './providers/fr.mjs';

const ALL_PROVIDERS = [es, fr];
const OUT = path.resolve(process.argv[2] || 'public/data');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const FIXTURES_DIR = process.env.FIXTURES_DIR;
const ONLY = (process.env.COUNTRIES || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const USER_AGENT = 'Mozilla/5.0 (compatible; SurtidorApp/1.0; +https://github.com/)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, { headers = {}, timeoutMs = 120000, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error(`tiempo de espera agotado (${timeoutMs / 1000}s)`) : err;
      if (attempt < retries) await sleep(5000 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function fixtureFetcher(code) {
  return async () => readFile(path.join(FIXTURES_DIR, `${code}.json`), 'utf8');
}

/** Formato compacto que viaja a la app (claves cortas = archivos más pequeños). */
function compact(s) {
  const o = { i: s.id, a: +s.lat.toFixed(5), o: +s.lon.toFixed(5), p: s.prices };
  if (s.name) o.n = s.name;
  if (s.address) o.d = s.address;
  if (s.city) o.c = s.city;
  if (s.hours) o.h = s.hours;
  if (s.restricted) o.r = 1;
  if (s.updated) o.u = s.updated;
  return o;
}

function buildTiles(stations) {
  const tiles = new Map();
  const seen = new Set();
  // Fecha más habitual: se guarda una vez por país y solo se repite en las estaciones que difieren.
  const freq = new Map();
  for (const s of stations) freq.set(s.updated, (freq.get(s.updated) || 0) + 1);
  const common = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const s of stations) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const key = tileKey(s.lat, s.lon);
    if (!tiles.has(key)) tiles.set(key, []);
    const c = compact(s);
    if (c.u === common) delete c.u;
    tiles.get(key).push(c);
  }
  return { tiles, common };
}

/** Resumen por tesela: nº de estaciones, centro y precio mínimo por combustible (para la vista general). */
function summarize(list) {
  let lat = 0, lon = 0;
  const min = {};
  for (const s of list) {
    lat += s.a; lon += s.o;
    if (s.r) continue; // las de venta restringida no cuentan para "la más barata"
    for (const f of SUMMARY_FUELS) {
      const p = s.p[f];
      if (p !== undefined && (min[f] === undefined || p < min[f])) min[f] = p;
    }
  }
  return { n: list.length, lat: +(lat / list.length).toFixed(4), lon: +(lon / list.length).toFixed(4), min };
}

async function writeCountry(meta, tiles, common = null, extra = {}) {
  const dir = path.join(OUT, meta.code);
  await mkdir(dir, { recursive: true });
  const summary = {};
  const notAfter = new Date(Date.now() + 10 * 60000).toISOString(); // ignora fechas futuras erróneas
  let count = 0, latest = common && common <= notAfter ? common : null;
  for (const [key, list] of tiles) {
    await writeFile(path.join(dir, `${key}.json`), JSON.stringify({ country: meta.code, tile: key, stations: list }));
    summary[key] = summarize(list);
    count += list.length;
    for (const s of list) if (s.u && s.u <= notAfter && (!latest || s.u > latest)) latest = s.u;
  }
  return {
    code: meta.code, name: meta.name, currency: meta.currency,
    source: meta.source, sourceUrl: meta.sourceUrl, license: meta.license,
    updated: latest, stationsUpdated: common, count, tiles: summary, ...extra,
  };
}

/** Si la fuente oficial falla, reutiliza los datos que ya estaban publicados (mejor algo antiguo que nada). */
async function recoverPrevious(meta) {
  if (!SITE_URL) return null;
  const prev = JSON.parse(await fetchText(`${SITE_URL}/data/index.json`, { retries: 2, timeoutMs: 30000 }));
  const entry = prev.countries?.find((c) => c.code === meta.code);
  if (!entry) return null;
  const tiles = new Map();
  const keys = Object.keys(entry.tiles);
  for (let i = 0; i < keys.length; i += 8) {
    await Promise.all(keys.slice(i, i + 8).map(async (key) => {
      const t = JSON.parse(await fetchText(`${SITE_URL}/data/${meta.code}/${key}.json`, { retries: 2, timeoutMs: 30000 }));
      tiles.set(key, t.stations);
    }));
  }
  return { tiles, common: entry.stationsUpdated || null };
}

async function main() {
  const providers = ALL_PROVIDERS.filter((p) => !ONLY.length || ONLY.includes(p.meta.code));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const countries = [];
  for (const provider of providers) {
    const { meta } = provider;
    const t0 = Date.now();
    try {
      const fetcher = FIXTURES_DIR ? fixtureFetcher(meta.code) : fetchText;
      const stations = await provider.fetchStations({ fetchText: fetcher });
      const { tiles, common } = buildTiles(stations);
      const entry = await writeCountry(meta, tiles, common);
      countries.push(entry);
      console.log(`[${meta.code}] ${entry.count} estaciones en ${Object.keys(entry.tiles).length} teselas (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (err) {
      console.error(`[${meta.code}] ERROR: ${err.message}`);
      try {
        const prev = await recoverPrevious(meta);
        if (prev?.tiles.size) {
          const entry = await writeCountry(meta, prev.tiles, prev.common, { stale: true });
          countries.push(entry);
          console.warn(`[${meta.code}] Se reutilizan los datos publicados anteriormente (${entry.count} estaciones).`);
        }
      } catch (err2) {
        console.error(`[${meta.code}] Tampoco se pudieron recuperar datos anteriores: ${err2.message}`);
      }
    }
  }

  if (!countries.length) {
    console.error('No hay datos de ningún país: no se publica nada para no dejar la app vacía.');
    process.exit(1);
  }

  const fuels = Object.fromEntries(Object.entries(FUELS).map(([k, v]) => [k, { label: v.label, short: v.short, unit: v.unit }]));
  const index = { generated: new Date().toISOString(), tileDeg: TILE_DEG, fuels, countries };
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index));
  console.log(`Listo: ${countries.reduce((a, c) => a + c.count, 0)} estaciones en total -> ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
