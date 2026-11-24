// Pruebas rápidas sin dependencias: node test/core.test.mjs
import assert from 'node:assert/strict';
import { parsePrice, tileKey, tilesForBounds, distanceKm, netSaving, priceScale, normKey, titleCase, formatPrice, timeAgo, esc } from '../public/core.js';
import { madridToISO, parse as parseES } from '../scripts/providers/es.mjs';

assert.equal(parsePrice('1,589', 'g95'), 1.589);
assert.equal(parsePrice('1589', 'g95'), 1.589, 'milésimas');
assert.equal(parsePrice('0,001', 'g95'), null, 'fuera de rango');
assert.equal(parsePrice('', 'g95'), null);
assert.equal(parsePrice('13,5', 'h2'), 13.5, 'hidrógeno €/kg');

assert.equal(tileKey(40.42, -3.70), '40_-4');
assert.equal(tileKey(-33.9, 151.2), '-34_151');
assert.deepEqual(tilesForBounds(40.1, -3.9, 40.8, -3.1), ['40_-4']);
assert.equal(tilesForBounds(39.5, -4.5, 41.5, -2.5).length, 9);

const madBcn = distanceKm(40.4168, -3.7038, 41.3874, 2.1686);
assert.ok(madBcn > 495 && madBcn < 510, `Madrid-Barcelona ${madBcn}`);

// 50 L, 6 L/100 km: 10 cts más barata pero 5 km más lejos (13 km extra ida+vuelta) -> 5 € - 0,78 l*1,5 = 3,83 €
assert.equal(netSaving({ price: 1.5, distKm: 6, refPrice: 1.6, refDistKm: 1, liters: 50, consumption: 6 }), 3.83);
assert.ok(netSaving({ price: 1.59, distKm: 30, refPrice: 1.6, refDistKm: 1, liters: 40, consumption: 7 }) < 0, 'no compensa');

const sc = priceScale([1.4, 1.5, 1.6, 1.7, 1.8]);
assert.ok(sc(1.4).t === 0 && sc(1.8).t === 1);

assert.equal(normKey('Longitud (WGS84)'), 'longitud wgs84');
assert.equal(normKey('Precio Gases licuados del petróleo'), 'precio gases licuados del petroleo');
assert.equal(normKey('C.P.'), 'c p');
assert.equal(titleCase('AVENIDA DE LA CONSTITUCIÓN, 12'), 'Avenida de la Constitución, 12');
assert.equal(formatPrice(1.5), '1,500');
assert.equal(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
assert.equal(timeAgo(new Date(Date.now() - 12 * 60000).toISOString()), 'hace 12 min');

// Hora peninsular -> UTC (invierno UTC+1, verano UTC+2)
assert.equal(madridToISO('24/11/2026 16:23:45'), '2026-11-24T15:23:45.000Z');
assert.equal(madridToISO('15/07/2026 10:00:00'), '2026-07-15T08:00:00.000Z');

assert.throws(() => parseES('<html>error</html>'), /XML/);

console.log('core: todas las pruebas OK');
