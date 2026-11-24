// Francia — "Prix des carburants en France - Flux instantané v2" (Ministère de l'Économie).
// Datos abiertos (Licence Ouverte / Etalab), actualizados cada ~10 minutos.

import { normKey, parseCoord, parsePrice, validLatLon, titleCase } from '../../public/core.js';
import { localToISO } from './_time.mjs';

export const meta = {
  code: 'FR',
  name: 'Francia',
  currency: 'EUR',
  source: 'Ministère de l’Économie — Prix des carburants (flux instantané v2)',
  sourceUrl: 'https://www.prix-carburants.gouv.fr/',
  license: 'Licence Ouverte / Open Licence (Etalab)',
};

const ENDPOINTS = [
  'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json',
];

// Campo oficial -> código de la app
const FUEL_FIELDS = {
  sp95: 'g95',
  e10: 'g95e10',
  sp98: 'g98',
  gazole: 'diesel',
  e85: 'e85',
  gplc: 'glp',
};

export async function fetchStations({ fetchText }) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      return parse(await fetchText(url, { headers: { Accept: 'application/json' } }));
    } catch (err) {
      lastErr = err;
      console.warn(`[FR] ${url} falló: ${err.message}`);
    }
  }
  throw lastErr;
}

export function parse(text) {
  const json = JSON.parse(text.replace(/^﻿/, ''));
  const list = Array.isArray(json) ? json : json.results;
  if (!Array.isArray(list) || list.length < 1000) {
    throw new Error(`Respuesta incompleta (${Array.isArray(list) ? list.length : 0} estaciones)`);
  }
  const stations = [];
  for (const raw of list) {
    const r = {};
    for (const [k, v] of Object.entries(raw)) r[normKey(k)] = v;

    let lat = parseCoord(r.geom?.lat), lon = parseCoord(r.geom?.lon);
    if (!validLatLon(lat, lon)) {
      // En el flujo antiguo las coordenadas vienen multiplicadas por 100 000
      lat = parseCoord(r.latitude); lon = parseCoord(r.longitude);
      if (lat !== null && Math.abs(lat) > 90) lat /= 100000;
      if (lon !== null && Math.abs(lon) > 180) lon /= 100000;
    }
    if (!validLatLon(lat, lon)) continue;

    const prices = {};
    let updated = null;
    for (const [field, code] of Object.entries(FUEL_FIELDS)) {
      const p = parsePrice(r[`${field} prix`], code);
      if (p === null) continue;
      prices[code] = p;
      const maj = r[`${field} maj`];
      if (maj && (!updated || String(maj) > updated)) updated = String(maj);
    }
    if (!Object.keys(prices).length) continue;

    const is24 = /oui|yes|true/i.test(String(r['horaires automate 24 24'] ?? ''));
    stations.push({
      id: String(r.id ?? `${lat},${lon}`),
      lat, lon,
      name: r.pop === 'A' ? 'Estación de autopista' : '',
      address: titleCase(r.adresse || ''),
      city: titleCase(r.ville || ''),
      province: '',
      postcode: String(r.cp || ''),
      hours: is24 ? 'Automático 24 h' : '',
      restricted: false,
      prices,
      updated: toISO(updated),
    });
  }
  return stations;
}

/** Fechas francesas: con zona horaria se respetan; sin ella se interpretan como hora de París. */
function toISO(value) {
  const str = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (m) return localToISO(m[1], m[2], m[3], m[4], m[5], m[6] || 0, 'Europe/Paris');
  const t = str ? Date.parse(str) : NaN;
  return new Date(Number.isFinite(t) ? t : Date.now()).toISOString();
}
