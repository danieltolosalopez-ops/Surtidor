// España — Geoportal de Hidrocarburos (Ministerio para la Transición Ecológica y el Reto Demográfico).
// Datos abiertos y gratuitos, reutilizables citando la fuente. Se actualizan cada ~30 minutos.

import { normKey, parseCoord, parsePrice, validLatLon, titleCase } from '../../public/core.js';
import { localToISO } from './_time.mjs';

export const meta = {
  code: 'ES',
  name: 'España',
  currency: 'EUR',
  source: 'Ministerio para la Transición Ecológica y el Reto Demográfico — Geoportal de Hidrocarburos',
  sourceUrl: 'https://geoportalgasolineras.es/',
  license: 'Datos abiertos del Gobierno de España (reutilización citando la fuente)',
};

// Dos direcciones del mismo servicio: si una falla o bloquea, se prueba la otra.
const ENDPOINTS = [
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
  'https://energia.serviciosmin.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/',
];

// Nombre oficial del campo (normalizado) -> código de combustible de la app.
const FUEL_FIELDS = {
  'precio gasolina 95 e5': 'g95',
  'precio gasolina 95 e10': 'g95e10',
  'precio gasolina 95 e5 premium': 'g95p',
  'precio gasolina 98 e5': 'g98',
  'precio gasoleo a': 'diesel',
  'precio gasoleo premium': 'dieselp',
  'precio diesel renovable': 'hvo',
  'precio gasolina 95 e85': 'e85',
  'precio gases licuados del petroleo': 'glp',
  'precio gas natural comprimido': 'gnc',
  'precio gas natural licuado': 'gnl',
  'precio hidrogeno': 'h2',
  'precio adblue': 'adblue',
};
// Si una estación no tiene 98 E5 pero sí 98 E10, se usa como "Gasolina 98".
const FALLBACKS = { g98: 'precio gasolina 98 e10' };

// Zona de España con margen (península, Baleares, Canarias, Ceuta y Melilla).
const inSpain = (lat, lon) => lat >= 27 && lat <= 44.5 && lon >= -19 && lon <= 5;

export async function fetchStations({ fetchText }) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const text = await fetchText(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'es-ES,es;q=0.9',
          Referer: 'https://geoportalgasolineras.es/',
        },
      });
      return parse(text);
    } catch (err) {
      lastErr = err;
      console.warn(`[ES] ${url} falló: ${err.message}`);
    }
  }
  throw lastErr;
}

/** Convierte la respuesta oficial (JSON) en estaciones normalizadas. Exportada para los tests. */
export function parse(text) {
  const clean = text.replace(/^﻿/, '').trim();
  if (clean.startsWith('<')) throw new Error('El servicio devolvió XML/HTML en lugar de JSON');
  const json = JSON.parse(clean);
  const list = json.ListaEESSPrecio;
  if (!Array.isArray(list) || list.length < 1000) {
    throw new Error(`Respuesta incompleta (${Array.isArray(list) ? list.length : 0} estaciones)`);
  }
  const updated = madridToISO(json.Fecha) || new Date().toISOString();

  const stations = [];
  for (const raw of list) {
    const r = {};
    for (const [k, v] of Object.entries(raw)) r[normKey(k)] = typeof v === 'string' ? v.trim() : v;

    let lat = parseCoord(r.latitud);
    let lon = parseCoord(r['longitud wgs84'] ?? firstStartingWith(r, 'longitud'));
    if (!validLatLon(lat, lon)) continue;
    // Algunas estaciones llegan con latitud y longitud intercambiadas: se corrigen.
    // Las que siguen fuera de España se descartan (aparecerían en otro continente).
    if (!inSpain(lat, lon)) {
      if (!inSpain(lon, lat)) continue;
      [lat, lon] = [lon, lat];
    }

    const prices = {};
    for (const [field, code] of Object.entries(FUEL_FIELDS)) {
      const p = parsePrice(r[field], code);
      if (p !== null) prices[code] = p;
    }
    for (const [code, field] of Object.entries(FALLBACKS)) {
      if (prices[code] === undefined) {
        const p = parsePrice(r[field], code);
        if (p !== null) prices[code] = p;
      }
    }
    if (!Object.keys(prices).length) continue;

    stations.push({
      id: String(r.ideess ?? `${lat},${lon}`),
      lat, lon,
      name: titleCase(r.rotulo || ''),
      address: titleCase(r.direccion || ''),
      city: titleCase(r.localidad || r.municipio || ''),
      province: titleCase(r.provincia || ''),
      postcode: r['c p'] || '',
      hours: r.horario || '',
      restricted: String(r['tipo venta'] || '').toUpperCase() === 'R', // R = solo socios/clientes (cooperativas)
      prices,
      updated,
    });
  }
  return stations;
}

function firstStartingWith(obj, prefix) {
  for (const k of Object.keys(obj)) if (k.startsWith(prefix)) return obj[k];
  return undefined;
}

/** "24/11/2026 16:23:45" (hora peninsular) -> ISO en UTC. */
export function madridToISO(fecha) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(fecha || '').trim());
  if (!m) return null;
  const [, d, mo, y, h, mi, s = '0'] = m;
  return localToISO(y, mo, d, h, mi, s, 'Europe/Madrid');
}
