// Genera datos de prueba con el MISMO formato que publican los ministerios,
// para probar el generador sin conexión: node test/make-fixtures.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures');
await mkdir(dir, { recursive: true });

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const es = (n) => n.toFixed(3).replace('.', ',');
const coord = (n) => n.toFixed(6).replace('.', ',');

const brands = ['REPSOL', 'CEPSA', 'BP', 'GALP', 'SHELL', 'PLENOIL', 'BALLENOIL', 'PETROPRIX', 'AVIA', 'Nº 10.935'];
const cities = [
  ['MADRID', 'MADRID', 40.42, -3.70], ['BARCELONA', 'BARCELONA', 41.39, 2.17], ['VALENCIA', 'VALENCIA / VALÈNCIA', 39.47, -0.38],
  ['SEVILLA', 'SEVILLA', 37.39, -5.98], ['ZARAGOZA', 'ZARAGOZA', 41.65, -0.88], ['MÓSTOLES', 'MADRID', 40.32, -3.86],
  ['LAS PALMAS DE GRAN CANARIA', 'PALMAS (LAS)', 28.12, -15.43],
];

const fuelKeys = ['Precio Adblue', 'Precio Amoniaco', 'Precio Biodiesel', 'Precio Bioetanol', 'Precio Biogas Natural Comprimido',
  'Precio Biogas Natural Licuado', 'Precio Diésel Renovable', 'Precio Gas Natural Comprimido', 'Precio Gas Natural Licuado',
  'Precio Gases licuados del petróleo', 'Precio Gasoleo A', 'Precio Gasoleo B', 'Precio Gasoleo Premium', 'Precio Gasolina 95 E10',
  'Precio Gasolina 95 E25', 'Precio Gasolina 95 E5', 'Precio Gasolina 95 E5 Premium', 'Precio Gasolina 95 E85',
  'Precio Gasolina 98 E10', 'Precio Gasolina 98 E5', 'Precio Gasolina Renovable', 'Precio Hidrogeno'];

const list = [];
for (let i = 0; i < 1500; i++) {
  const [loc, prov, la, lo] = pick(cities);
  const low = /PLENOIL|BALLENOIL|PETROPRIX/.test(pick(brands));
  const base = 1.40 + rnd() * 0.25 - (low ? 0.08 : 0);
  const rec = {
    'C.P.': String(28000 + i), 'Dirección': `CALLE DE LA PRUEBA, ${i}`, 'Horario': pick(['L-D: 24H', 'L-D: 06:00-22:00', 'L-V: 07:00-21:00; S: 08:00-14:00']),
    'Latitud': coord(la + (rnd() - 0.5) * 0.6), 'Localidad': loc, 'Longitud (WGS84)': coord(lo + (rnd() - 0.5) * 0.6),
    'Margen': 'D', 'Municipio': loc, 'Provincia': prov, 'Remisión': 'dm', 'Rótulo': pick(brands),
    'Tipo Venta': i % 50 === 0 ? 'R' : 'P', '% BioEtanol': '0,0', '% Éster metílico': '0,0',
    'IDEESS': String(1000 + i), 'IDMunicipio': '4354', 'IDProvincia': '28', 'IDCCAA': '13',
  };
  for (const k of fuelKeys) rec[k] = '';
  rec['Precio Gasolina 95 E5'] = es(base);
  rec['Precio Gasoleo A'] = es(base - 0.06);
  if (rnd() < 0.6) rec['Precio Gasolina 98 E5'] = es(base + 0.14);
  else if (rnd() < 0.3) rec['Precio Gasolina 98 E10'] = es(base + 0.12);
  if (rnd() < 0.15) rec['Precio Gases licuados del petróleo'] = es(0.85 + rnd() * 0.15);
  if (rnd() < 0.02) rec['Precio Hidrogeno'] = es(12 + rnd() * 3);
  if (rnd() < 0.4) rec['Precio Adblue'] = es(0.9 + rnd() * 0.5);
  list.push(rec);
}
// Repartidas por toda la península para probar la vista general
for (let i = 0; i < 900; i++) {
  const base = 1.42 + rnd() * 0.22;
  const rec = { ...list[i % 100], IDEESS: String(50000 + i), 'Latitud': coord(36.2 + rnd() * 7.3), 'Longitud (WGS84)': coord(-8.8 + rnd() * 11.5), 'Localidad': 'PUEBLO', 'Tipo Venta': 'P' };
  rec['Precio Gasolina 95 E5'] = es(base);
  rec['Precio Gasoleo A'] = es(base - 0.05);
  list.push(rec);
}
// Casos raros: sin coordenadas, precio absurdo, sin precios
list.push({ ...list[0], IDEESS: '999991', 'Latitud': '', 'Longitud (WGS84)': '' });
list.push({ ...list[1], IDEESS: '999992', 'Precio Gasolina 95 E5': '0,001', 'Precio Gasoleo A': '' });
list.push({ ...Object.fromEntries(Object.entries(list[2]).map(([k, v]) => [k, k.startsWith('Precio') ? '' : v])), IDEESS: '999993' });

await writeFile(path.join(dir, 'ES.json'), '﻿' + JSON.stringify({
  Fecha: '24/11/2026 16:23:45', ListaEESSPrecio: list,
  Nota: 'Archivo de todos los productos en todas las estaciones de servicio. La actualización de precios se realiza cada media hora, con los precios en vigor en ese momento.',
  ResultadoConsulta: 'OK',
}));

const fr = [];
for (let i = 0; i < 1200; i++) {
  const [la, lo] = pick([[48.86, 2.35], [45.76, 4.84], [43.30, 5.37], [43.48, -1.56]]);
  const base = 1.70 + rnd() * 0.2;
  const lat = la + (rnd() - 0.5) * 0.8, lon = lo + (rnd() - 0.5) * 0.8;
  fr.push({
    id: 10000000 + i, latitude: String(Math.round(lat * 100000)), longitude: String(Math.round(lon * 100000)),
    cp: '75001', pop: i % 30 === 0 ? 'A' : 'R', adresse: `${i} RUE DE TEST`, ville: pick(['PARIS', 'LYON', 'MARSEILLE', 'BAYONNE']),
    horaires_automate_24_24: i % 4 === 0 ? 'Oui' : 'Non',
    geom: { lon, lat },
    gazole_maj: '2026-11-24T15:01:00+00:00', gazole_prix: +(base - 0.05).toFixed(3),
    sp95_maj: '2026-11-24T15:01:00+00:00', sp95_prix: rnd() < 0.5 ? +base.toFixed(3) : null,
    e10_maj: '2026-11-24T15:05:00+00:00', e10_prix: +(base - 0.04).toFixed(3),
    sp98_maj: null, sp98_prix: rnd() < 0.7 ? +(base + 0.1).toFixed(3) : null,
    e85_prix: rnd() < 0.2 ? 0.799 : null, gplc_prix: rnd() < 0.1 ? 0.999 : null,
  });
}
await writeFile(path.join(dir, 'FR.json'), JSON.stringify(fr));
console.log(`Fixtures: ${list.length} ES, ${fr.length} FR -> ${dir}`);
