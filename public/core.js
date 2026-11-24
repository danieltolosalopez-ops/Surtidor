// core.js — lógica compartida entre la app (navegador) y el generador de datos (Node).
// Sin dependencias. Todo lo que aquí hay se puede probar con `node test/core.test.mjs`.

/** Combustibles normalizados. Cada país traduce sus nombres oficiales a estos códigos. */
export const FUELS = {
  g95:     { label: 'Gasolina 95',              short: '95',   unit: '€/L',  min: 0.3, max: 4 },
  g95e10:  { label: 'Gasolina 95 E10',          short: 'E10',  unit: '€/L',  min: 0.3, max: 4 },
  g95p:    { label: 'Gasolina 95 Premium',      short: '95+',  unit: '€/L',  min: 0.3, max: 4 },
  g98:     { label: 'Gasolina 98',              short: '98',   unit: '€/L',  min: 0.3, max: 4 },
  diesel:  { label: 'Diésel',                   short: 'D',    unit: '€/L',  min: 0.3, max: 4 },
  dieselp: { label: 'Diésel Premium',           short: 'D+',   unit: '€/L',  min: 0.3, max: 4 },
  hvo:     { label: 'Diésel renovable (HVO)',   short: 'HVO',  unit: '€/L',  min: 0.3, max: 5 },
  e85:     { label: 'Bioetanol E85',            short: 'E85',  unit: '€/L',  min: 0.2, max: 4 },
  glp:     { label: 'GLP / Autogás',            short: 'GLP',  unit: '€/L',  min: 0.2, max: 3 },
  gnc:     { label: 'Gas natural (GNC)',        short: 'GNC',  unit: '€/kg', min: 0.2, max: 5 },
  gnl:     { label: 'Gas natural licuado (GNL)',short: 'GNL',  unit: '€/kg', min: 0.2, max: 5 },
  h2:      { label: 'Hidrógeno',                short: 'H₂',   unit: '€/kg', min: 1,   max: 40 },
  adblue:  { label: 'AdBlue',                   short: 'AdB',  unit: '€/L',  min: 0.2, max: 5 },
};

/** Combustibles que se resumen por tesela para la vista general del mapa. */
export const SUMMARY_FUELS = ['g95', 'g95e10', 'g98', 'diesel', 'glp'];

/** Tamaño de tesela en grados. 1° ≈ 111 km de alto. */
export const TILE_DEG = 1;

export function tileKey(lat, lon, deg = TILE_DEG) {
  return `${Math.floor(lat / deg) * deg}_${Math.floor(lon / deg) * deg}`;
}

/** Claves de tesela que cubren un rectángulo (south, west, north, east). */
export function tilesForBounds(s, w, n, e, deg = TILE_DEG) {
  const keys = [];
  const lat0 = Math.floor(s / deg) * deg, lat1 = Math.floor(n / deg) * deg;
  const lon0 = Math.floor(w / deg) * deg, lon1 = Math.floor(e / deg) * deg;
  for (let la = lat0; la <= lat1; la += deg) {
    for (let lo = lon0; lo <= lon1; lo += deg) keys.push(`${la}_${lo}`);
  }
  return keys;
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Convierte "1,589" / "1.589" / 1.589 en número; devuelve null si no es válido o está fuera de rango. */
export function parsePrice(value, fuel) {
  if (value === null || value === undefined || value === '') return null;
  let n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 50) n = n / 1000; // algunas fuentes publican milésimas (1589 = 1,589 €)
  const f = FUELS[fuel];
  if (f && (n < f.min || n > f.max)) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function validLatLon(lat, lon) {
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

/** Percentil (0–1) de una lista de números ya ordenada. */
export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Escala de color por precio relativo a lo que se ve en pantalla.
 * Devuelve una función price -> {color, t} con t entre 0 (barato) y 1 (caro).
 */
export function priceScale(prices) {
  const sorted = prices.filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
  const lo = quantile(sorted, 0.1), hi = quantile(sorted, 0.9);
  const stops = [[0, [22, 140, 75]], [0.5, [232, 170, 20]], [1, [205, 45, 40]]];
  return (p) => {
    if (!Number.isFinite(p) || lo === null) return { color: '#7a7f87', t: 0.5 };
    const t = hi > lo ? Math.min(1, Math.max(0, (p - lo) / (hi - lo))) : 0.5;
    const i = t <= 0.5 ? 0 : 1;
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    const k = (t - t0) / (t1 - t0);
    const rgb = c0.map((c, j) => Math.round(c + (c1[j] - c) * k));
    return { color: `rgb(${rgb.join(',')})`, t };
  };
}

/**
 * Ahorro real de ir a una gasolinera frente a la de referencia (la más cercana),
 * descontando el combustible gastado en el desvío (ida y vuelta, con factor de carretera).
 */
export function netSaving({ price, distKm, refPrice, refDistKm, liters, consumption, roadFactor = 1.3 }) {
  if (![price, distKm, refPrice, refDistKm, liters, consumption].every(Number.isFinite)) return null;
  const extraKm = Math.max(0, (distKm - refDistKm) * 2 * roadFactor);
  const detourCost = (extraKm * consumption) / 100 * price;
  return Math.round(((refPrice - price) * liters - detourCost) * 100) / 100;
}

export function formatPrice(p, digits = 3) {
  return Number.isFinite(p) ? p.toFixed(digits).replace('.', ',') : '—';
}

export function formatMoney(v) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatKm(km) {
  if (!Number.isFinite(km)) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((now - t) / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Normaliza un nombre de campo: sin tildes, minúsculas, solo letras/números y espacios. */
export function normKey(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Escapa texto para insertarlo en HTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Pone en mayúscula inicial cada palabra de un texto en MAYÚSCULAS ("AVENIDA DE LA PAZ" -> "Avenida de la Paz"). */
export function titleCase(s) {
  const small = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al', 'd', 'l']);
  return String(s ?? '').toLowerCase().replace(/[\p{L}\p{N}]+/gu, (w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}
