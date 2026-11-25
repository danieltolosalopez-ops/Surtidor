// app.js — mapa de gasolineras con precios oficiales.
import {
  FUELS, tilesForBounds, distanceKm, priceScale, netSaving, quantile,
  formatPrice, formatMoney, formatKm, timeAgo, esc,
} from './core.js';

const CFG = window.APP_CONFIG || {};
const isNative = !!window.Capacitor?.isNativePlatform?.();
const PUBLIC_URL = (CFG.publicUrl || '').replace(/\/$/, '');
const DATA_URL = isNative ? `${PUBLIC_URL}/data` : (CFG.dataUrl || 'data');
const FUEL_ORDER = ['g95', 'diesel', 'g98', 'g95e10', 'dieselp', 'g95p', 'glp', 'hvo', 'e85', 'gnc', 'gnl', 'h2', 'adblue'];
const DEFAULT_SETTINGS = { liters: 50, consumption: 6.5, radius: 10, hideRestricted: true };

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`surtidor:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`surtidor:${k}`, JSON.stringify(v)); } catch { /* modo privado */ } },
};

const state = {
  fuel: FUELS[store.get('fuel', 'g95')] ? store.get('fuel', 'g95') : 'g95',
  sort: store.get('sort', 'price'),
  settings: { ...DEFAULT_SETTINGS, ...store.get('settings', {}) },
  favorites: store.get('favorites', []), // [{ key, name, place }]
  index: null,
  tiles: new Map(),   // 'ES/40_-4' -> estaciones
  pending: new Map(),
  user: null,
  ref: null,
  ranked: [],
  nearest: null,
  median: null,
  view: 'list',       // list | favs | detail
  selectedKey: null,
  loadedAt: 0,
};

// ── Mapa ─────────────────────────────────────────────────────────────────────
const savedView = store.get('view', null);
const map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 3 })
  .setView(savedView?.center || CFG.defaultView.center, savedView?.zoom ?? CFG.defaultView.zoom);
if (matchMedia('(min-width: 900px)').matches) L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer(CFG.tiles.url, { maxZoom: CFG.tiles.maxZoom || 19, attribution: CFG.tiles.attribution }).addTo(map);
const layer = L.layerGroup().addTo(map);
const renderer = L.canvas({ padding: 0.4 });
let userMarker = null;

// ── Utilidades de interfaz ───────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}
function setLoading(on) { $('#bar').hidden = !on; }
function openSheet(open) {
  $('#sheet').classList.toggle('open', open);
  document.body.classList.toggle('sheet-open', open);
  $('#sheet-handle').setAttribute('aria-expanded', String(open));
}
function splitKey(key) {
  const [cc, tile, ...rest] = String(key).split('/');
  return { cc, tile, id: rest.join('/') };
}
function findStation(key) {
  const { cc, tile, id } = splitKey(key);
  return state.tiles.get(`${cc}/${tile}`)?.find((s) => String(s.i) === id) || null;
}
function countryOf(cc) { return state.index?.countries.find((c) => c.code === cc); }
function stationName(st) { return st.n || 'Gasolinera'; }
function stationPlace(st) { return [st.d, st.c].filter(Boolean).join(', '); }

// ── Datos ────────────────────────────────────────────────────────────────────
async function loadIndex() {
  const res = await fetch(`${DATA_URL}/index.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const idx = await res.json();
  if (state.index && state.index.generated !== idx.generated) state.tiles.clear();
  state.index = idx;
  state.loadedAt = Date.now();
  renderCredits();
}

function getTile(cc, key) {
  const id = `${cc}/${key}`;
  if (state.tiles.has(id)) return Promise.resolve(state.tiles.get(id));
  if (state.pending.has(id)) return state.pending.get(id);
  const p = fetch(`${DATA_URL}/${cc}/${key}.json?v=${encodeURIComponent(state.index.generated)}`)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((j) => {
      const list = j.stations.map((s) => Object.assign(s, { cc, tile: key, key: `${id}/${s.i}` }));
      state.tiles.set(id, list);
      return list;
    })
    .finally(() => state.pending.delete(id));
  state.pending.set(id, p);
  return p;
}

// ── Pintar el mapa y la lista ────────────────────────────────────────────────
let seq = 0;
let refreshTimer;
function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 120); }

async function refresh() {
  if (!state.index) return;
  const my = ++seq;
  const c = map.getCenter();
  store.set('view', { center: [+c.lat.toFixed(5), +c.lng.toFixed(5)], zoom: map.getZoom() });
  const b = map.getBounds().pad(0.15);
  const keys = tilesForBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), state.index.tileDeg);
  const needed = [];
  for (const country of state.index.countries) for (const k of keys) if (country.tiles[k]) needed.push([country.code, k]);

  if (map.getZoom() < (CFG.detailZoom || 9) || needed.length > 16) { renderOverview(b); return; }
  // La lista "cerca de ti" abarca todo el radio elegido, aunque parte quede fuera de la pantalla.
  const ref = refPoint(), dLat = state.settings.radius / 110, dLon = dLat / Math.max(0.2, Math.cos((ref.lat * Math.PI) / 180));
  const around = tilesForBounds(ref.lat - dLat, ref.lon - dLon, ref.lat + dLat, ref.lon + dLon, state.index.tileDeg);
  for (const country of state.index.countries) for (const k of around) if (!keys.includes(k) && country.tiles[k]) needed.push([country.code, k]);
  setLoading(true);
  try {
    const lists = await Promise.all(needed.map(([cc, k]) => getTile(cc, k).catch(() => [])));
    if (my !== seq) return;
    renderStations(lists.flat(), b);
  } finally {
    if (my === seq) setLoading(false);
  }
}

function renderOverview(b) {
  layer.clearLayers();
  // Agrupa teselas para que las burbujas no se pisen: ~130 px entre burbujas a cualquier zoom.
  const z = map.getZoom();
  const pxPerDeg = (256 * 2 ** z) / 360;
  const g = Math.max(state.index.tileDeg, Math.ceil(130 / pxPerDeg));
  const groups = new Map();
  for (const country of state.index.countries) {
    for (const [key, t] of Object.entries(country.tiles)) {
      const p = t.min?.[state.fuel];
      if (p === undefined) continue;
      const [la, lo] = key.split('_').map(Number);
      const gk = `${Math.floor(la / g)}_${Math.floor(lo / g)}`;
      const cur = groups.get(gk) || { n: 0, lat: 0, lon: 0, p: Infinity };
      cur.lat += t.lat * t.n; cur.lon += t.lon * t.n; cur.n += t.n; cur.p = Math.min(cur.p, p);
      groups.set(gk, cur);
    }
  }
  const items = [...groups.values()]
    .map((x) => ({ ...x, lat: x.lat / x.n, lon: x.lon / x.n }))
    .filter((x) => b.contains([x.lat, x.lon]));
  const scale = priceScale(items.map((i) => i.p));
  const target = g > 1 ? z + 2 : Math.max(CFG.detailZoom || 9, 11);
  for (const it of items) {
    const html = `<div class="zone" style="--c:${scale(it.p).color}"><b>${formatPrice(it.p)}</b><span>${it.n.toLocaleString('es-ES')} gasolineras</span></div>`;
    L.marker([it.lat, it.lon], { icon: L.divIcon({ className: 'pin-w', html, iconSize: [0, 0] }), keyboard: false })
      .on('click', () => map.flyTo([it.lat, it.lon], target))
      .addTo(layer);
  }
  state.ranked = [];
  state.overview = { zones: items.length };
  if (state.view === 'list') renderList();
}

/** Punto desde el que se mide el radio: tu ubicación si está a la vista; si no, el centro del mapa. */
function refPoint() {
  const c = map.getCenter();
  const useUser = state.user && map.getBounds().pad(0.5).contains([state.user.lat, state.user.lon]);
  return useUser ? { lat: state.user.lat, lon: state.user.lon, kind: 'user' } : { lat: c.lat, lon: c.lng, kind: 'center' };
}

function pinIcon(price, color, best, sel) {
  const cls = `pin${best ? ' best' : ''}${sel ? ' sel' : ''}`;
  const html = `<div class="${cls}" style="--c:${color}">${best ? '<i>Más barata</i>' : ''}<b>${formatPrice(price)}</b></div>`;
  return L.divIcon({ className: 'pin-w', html, iconSize: [0, 0] });
}

function renderStations(all, b) {
  state.overview = null;
  const f = state.fuel, s = state.settings;
  const withFuel = all.filter((st) => st.p[f] !== undefined && !(s.hideRestricted && st.r));
  const inView = withFuel.filter((st) => b.contains([st.a, st.o]));

  state.ref = refPoint();

  for (const st of withFuel) st.dist = distanceKm(state.ref.lat, state.ref.lon, st.a, st.o);
  const near = withFuel.filter((st) => st.dist <= s.radius);
  const nearest = near.reduce((m, st) => (!m || st.dist < m.dist ? st : m), null);
  for (const st of near) {
    st.saving = nearest ? netSaving({
      price: st.p[f], distKm: st.dist, refPrice: nearest.p[f], refDistKm: nearest.dist,
      liters: +s.liters, consumption: +s.consumption,
    }) : null;
  }
  const sorters = {
    price: (x, y) => x.p[f] - y.p[f] || x.dist - y.dist,
    dist: (x, y) => x.dist - y.dist,
    saving: (x, y) => (y.saving ?? -1e9) - (x.saving ?? -1e9) || x.p[f] - y.p[f],
  };
  near.sort(sorters[state.sort] || sorters.price);
  state.ranked = near;
  state.nearest = nearest;
  state.median = quantile(near.map((x) => x.p[f]).sort((x, y) => x - y), 0.5);
  state.scale = priceScale(near.length >= 5 ? near.map((x) => x.p[f]) : inView.map((x) => x.p[f]));
  const best = near.length ? near.reduce((m, x) => (x.p[f] < m.p[f] ? x : m)) : null;

  layer.clearLayers();
  const viewScale = priceScale(inView.map((x) => x.p[f]));
  const dense = inView.length > 220 || map.getZoom() < 12;
  for (const st of inView) {
    const color = viewScale(st.p[f]).color;
    const isBest = st === best, isSel = st.key === state.selectedKey;
    const m = dense && !isBest && !isSel
      ? L.circleMarker([st.a, st.o], { renderer, radius: 6, weight: 1.5, color: '#fff', fillColor: color, fillOpacity: 1, bubblingMouseEvents: false })
      : L.marker([st.a, st.o], { icon: pinIcon(st.p[f], color, isBest, isSel), zIndexOffset: isBest ? 1000 : isSel ? 900 : 0, keyboard: false });
    m.on('click', () => select(st.key)).addTo(layer);
  }
  if (state.view === 'detail') renderDetail(); else renderList();
}

function savingTag(st) {
  if (!Number.isFinite(st.saving)) return '';
  if (st === state.nearest) return '<span class="tag">La más cercana</span>';
  if (st.saving >= 0.2) return `<span class="tag good">Ahorras ${formatMoney(st.saving)}</span>`;
  if (st.saving <= -0.2) return '<span class="tag bad">No compensa</span>';
  return '<span class="tag">Casi igual</span>';
}

function rowHTML(st, i) {
  const f = state.fuel;
  const color = state.scale ? state.scale(st.p[f]).color : 'currentColor';
  return `<li><button type="button" class="row${st.key === state.selectedKey ? ' is-sel' : ''}" data-key="${esc(st.key)}">
    <span class="rank">${i + 1}</span>
    <span class="main"><strong>${esc(stationName(st))}</strong>
      <span class="addr">${esc(stationPlace(st))}</span>
      <span class="meta">${formatKm(st.dist)} ${savingTag(st)}</span></span>
    <span class="price" style="--c:${color}"><b>${formatPrice(st.p[f])}</b><small>${FUELS[f].unit}</small></span>
  </button></li>`;
}

function renderList() {
  $('#listview').hidden = false;
  $('#detail').hidden = true;
  const f = state.fuel, fuel = FUELS[f];
  const title = $('#sheet-title'), sub = $('#sheet-sub'), list = $('#list');
  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));
  $('#btn-favs').setAttribute('aria-pressed', String(state.view === 'favs'));
  $('#btn-favs').textContent = state.favorites.length ? `Favoritas (${state.favorites.length})` : 'Favoritas';

  if (state.view === 'favs') return renderFavs();
  if (!state.index) return;
  if (state.overview) {
    title.textContent = 'Acerca el mapa';
    sub.textContent = state.overview.zones
      ? `Cada burbuja es el precio más bajo de ${fuel.label} en esa zona. Púlsala para acercarte.`
      : `Acércate o pulsa “Mi ubicación” para ver las gasolineras con ${fuel.label}.`;
    list.innerHTML = '<li class="empty"><button type="button" class="btn primary" data-act="locate">Ver las más baratas cerca de mí</button></li>';
    return;
  }
  const r = state.ranked;
  title.textContent = r.length ? `${fuel.label}: las más baratas` : `Sin ${fuel.label} a menos de ${state.settings.radius} km`;
  sub.textContent = `${state.ref?.kind === 'user' ? 'Cerca de ti' : 'Alrededor del centro del mapa'} · radio ${state.settings.radius} km · ${r.length} gasolineras`
    + (Number.isFinite(state.median) ? ` · media ${formatPrice(state.median)} ${fuel.unit}` : '');
  list.innerHTML = r.slice(0, 50).map(rowHTML).join('')
    || '<li class="empty">No hay resultados aquí. Mueve el mapa, cambia de combustible o amplía el radio en Ajustes.</li>';
}

function renderFavs() {
  $('#sheet-title').textContent = 'Tus favoritas';
  $('#sheet-sub').textContent = 'Toca una para ver su precio de hoy.';
  const f = state.fuel;
  $('#list').innerHTML = state.favorites.map((fav, i) => {
    const st = findStation(fav.key);
    const price = st?.p[f];
    return `<li><button type="button" class="row" data-key="${esc(fav.key)}">
      <span class="rank">${i + 1}</span>
      <span class="main"><strong>${esc(fav.name)}</strong><span class="addr">${esc(fav.place)}</span></span>
      <span class="price"><b>${price !== undefined ? formatPrice(price) : '—'}</b><small>${price !== undefined ? FUELS[f].unit : ''}</small></span>
    </button></li>`;
  }).join('') || '<li class="empty">Aún no tienes favoritas. Abre una gasolinera y pulsa “Guardar”.</li>';
}

function navLinks(st) {
  const ll = `${st.a},${st.o}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${ll}`,
  };
}

function renderDetail() {
  const st = findStation(state.selectedKey);
  if (!st) { state.view = 'list'; renderList(); return; }
  $('#listview').hidden = true;
  const el = $('#detail');
  el.hidden = false;
  const f = state.fuel, s = state.settings, price = st.p[f];
  const country = countryOf(st.cc);
  const updated = st.u || country?.stationsUpdated || country?.updated;
  const isFav = state.favorites.some((x) => x.key === st.key);
  const dist = state.ref ? distanceKm(state.ref.lat, state.ref.lon, st.a, st.o) : null;
  const has = price !== undefined;
  const fill = has ? price * s.liters : null;
  const vsMedian = has && Number.isFinite(state.median) ? (state.median - price) * s.liters : null;
  const color = has && state.scale ? state.scale(price).color : 'var(--brand)';
  const links = navLinks(st);
  const target = isNative ? '' : ' target="_blank" rel="noopener"';
  const isApple = /iPad|iPhone|Macintosh/.test(navigator.userAgent);
  const rows = FUEL_ORDER.filter((k) => st.p[k] !== undefined).map((k) =>
    `<tr class="${k === f ? 'cur' : ''}"><th scope="row">${esc(FUELS[k].label)}</th><td>${formatPrice(st.p[k])} <small>${FUELS[k].unit}</small></td></tr>`).join('');

  let compare = '';
  if (Number.isFinite(vsMedian)) {
    compare = Math.abs(vsMedian) < 0.25
      ? '<dd>En la media de la zona</dd>'
      : `<dd class="${vsMedian > 0 ? 'good' : 'bad'}">${vsMedian > 0 ? 'Ahorras' : 'Pagas'} ${formatMoney(Math.abs(vsMedian))}${vsMedian > 0 ? '' : ' más'}</dd>`;
  }

  el.innerHTML = `
    <div class="d-head">
      <button type="button" class="ghost" data-act="back">‹ Volver</button>
      <button type="button" class="ghost" data-act="fav" aria-pressed="${isFav}">${isFav ? '★ Guardada' : '☆ Guardar'}</button>
    </div>
    <h2>${esc(stationName(st))}</h2>
    <p class="muted">${esc(stationPlace(st))}${dist !== null ? ` · ${formatKm(dist)}` : ''}</p>
    ${st.r ? '<p class="warn">Venta restringida: solo para socios o clientes autorizados.</p>' : ''}
    ${has ? `<div class="hero" style="--c:${color}">
        <span>${esc(FUELS[f].label)}</span><b>${formatPrice(price)}</b><small>${FUELS[f].unit}</small>
      </div>
      <dl class="calc">
        <div><dt>Llenar ${s.liters} L</dt><dd>${formatMoney(fill)}</dd></div>
        ${compare ? `<div><dt>Frente a la media de la zona</dt>${compare}</div>` : ''}
      </dl>` : `<p class="warn">Esta gasolinera no vende ${esc(FUELS[f].label)}.</p>`}
    <div class="actions">
      <a class="btn primary" href="${links.google}"${target}>Cómo llegar</a>
      <a class="btn" href="${links.waze}"${target}>Waze</a>
      ${isApple ? `<a class="btn" href="${links.apple}"${target}>Mapas</a>` : ''}
      <button type="button" class="btn" data-act="share">Compartir</button>
    </div>
    <table class="prices"><caption>Todos sus precios</caption><tbody>${rows}</tbody></table>
    ${st.h ? `<p><strong>Horario:</strong> ${esc(st.h)}</p>` : ''}
    <p class="muted small">Precio comunicado por la gasolinera${country ? ` a ${esc(country.source)}` : ''}${updated ? `, actualizado ${timeAgo(updated)}` : ''}. Confírmalo en el surtidor antes de repostar.</p>`;
}

function renderCredits() {
  const parts = state.index.countries.map((c) => {
    const warn = c.stale ? ' <span class="tag bad">datos con retraso</span>' : '';
    return `<a href="${esc(c.sourceUrl)}"${isNative ? '' : ' target="_blank" rel="noopener"'}>${esc(c.name)}</a>: ${timeAgo(c.updated)}${warn}`;
  });
  $('#credits').innerHTML = `Precios oficiales · ${parts.join(' · ')} · <a href="${esc(CFG.privacyUrl || 'privacy.html')}">Privacidad</a>`;
}

function renderFuels() {
  $('#fuels').innerHTML = FUEL_ORDER.map((k) =>
    `<button type="button" class="chip" data-fuel="${k}" aria-pressed="${k === state.fuel}">${esc(FUELS[k].label)}</button>`).join('');
  $(`.chip[data-fuel="${state.fuel}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ── Acciones ─────────────────────────────────────────────────────────────────
function select(key) {
  state.selectedKey = key;
  state.view = 'detail';
  history.replaceState(null, '', `#${key}`);
  openSheet(true);
  renderDetail();
  const st = findStation(key);
  if (st && !map.getBounds().contains([st.a, st.o])) map.panTo([st.a, st.o]);
  refreshSoon();
}

async function goToKey(key) {
  const { cc, tile, id } = splitKey(key);
  if (!state.index || !countryOf(cc)?.tiles[tile]) { toast('Esa gasolinera ya no aparece en los datos oficiales.'); return; }
  const list = await getTile(cc, tile).catch(() => null);
  const st = list?.find((x) => String(x.i) === id);
  if (!st) { toast('Esa gasolinera ya no aparece en los datos oficiales.'); return; }
  map.setView([st.a, st.o], Math.max(map.getZoom(), 14));
  select(key);
}

function backToList() {
  state.view = 'list';
  state.selectedKey = null;
  history.replaceState(null, '', location.pathname + location.search);
  renderList();
  refreshSoon();
}

function toggleFav(st) {
  const i = state.favorites.findIndex((x) => x.key === st.key);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.push({ key: st.key, name: stationName(st), place: stationPlace(st) });
  store.set('favorites', state.favorites);
  renderDetail();
}

async function share(st) {
  const url = `${isNative ? PUBLIC_URL : location.href.split('#')[0]}#${st.key}`;
  const price = st.p[state.fuel];
  const text = `${stationName(st)} (${stationPlace(st)})${price !== undefined ? `: ${FUELS[state.fuel].label} a ${formatPrice(price)} ${FUELS[state.fuel].unit}` : ''}`;
  try {
    if (navigator.share) { await navigator.share({ title: CFG.appName, text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Enlace copiado');
  } catch { /* el usuario canceló */ }
}

function drawUser() {
  if (!state.user) return;
  const ll = [state.user.lat, state.user.lon];
  if (!userMarker) {
    userMarker = L.marker(ll, { icon: L.divIcon({ className: 'pin-w', html: '<div class="me"></div>', iconSize: [0, 0] }), keyboard: false, interactive: false, zIndexOffset: 2000 }).addTo(map);
  } else userMarker.setLatLng(ll);
}

function locate(auto = false) {
  // En la app móvil se usa el plugin nativo si está instalado (evita el doble aviso de permiso en iPhone).
  const nativeGeo = isNative ? window.Capacitor.Plugins?.Geolocation : null;
  if (!nativeGeo && !navigator.geolocation) { if (!auto) toast('Este dispositivo no permite obtener la ubicación.'); return; }
  const btn = $('#btn-locate');
  btn.classList.add('busy');
  const ok = (pos) => {
    btn.classList.remove('busy');
    state.user = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    drawUser();
    map.flyTo([state.user.lat, state.user.lon], Math.max(map.getZoom(), 13), { duration: 0.8 });
  };
  const fail = (err) => {
    btn.classList.remove('busy');
    if (!auto) toast(err?.code === 1 || /denied|permission/i.test(err?.message || '') ? 'Permiso de ubicación denegado. Actívalo en los ajustes del móvil o del navegador.' : 'No se pudo obtener tu ubicación. Inténtalo de nuevo.');
  };
  const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 };
  if (nativeGeo) nativeGeo.getCurrentPosition(opts).then(ok, fail);
  else navigator.geolocation.getCurrentPosition(ok, fail, opts);
}

let lastSearch = 0;
async function search(q) {
  q = q.trim();
  if (!q) return;
  if (Date.now() - lastSearch < 1100) return; // límite de uso de Nominatim
  lastSearch = Date.now();
  const cc = (state.index?.countries || []).map((c) => c.code.toLowerCase()).join(',');
  const url = `${CFG.geocoder}?format=jsonv2&limit=1&accept-language=es${cc ? `&countrycodes=${cc}` : ''}&q=${encodeURIComponent(q)}`;
  setLoading(true);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const [hit] = await res.json();
    if (!hit) { toast('No encontramos ese lugar.'); return; }
    const [s, n, w, e] = hit.boundingbox.map(Number);
    map.fitBounds([[s, w], [n, e]], { maxZoom: 14 });
    if (map.getZoom() < 11) map.setZoom(11);
    $('#q').blur();
  } catch {
    toast('El buscador no responde. Prueba en un momento.');
  } finally {
    setLoading(false);
  }
}

function openSettings() {
  const form = $('#settings-form');
  form.liters.value = state.settings.liters;
  form.consumption.value = state.settings.consumption;
  form.radius.value = String(state.settings.radius);
  form.hideRestricted.checked = !!state.settings.hideRestricted;
  $('#settings').showModal();
}

// ── Eventos ──────────────────────────────────────────────────────────────────
$('#fuels').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fuel]');
  if (!b) return;
  state.fuel = b.dataset.fuel;
  store.set('fuel', state.fuel);
  renderFuels();
  refresh();
});

document.querySelector('.seg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  state.sort = b.dataset.sort;
  store.set('sort', state.sort);
  if (state.sort === 'saving' && !state.user) toast('El ahorro real se calcula desde tu ubicación o desde el centro del mapa.');
  refresh();
});

// Carga las teselas de las favoritas para mostrar su precio actual.
function loadFavTiles() {
  Promise.all(state.favorites.map((f) => { const k = splitKey(f.key); return getTile(k.cc, k.tile).catch(() => null); }))
    .then(() => state.view === 'favs' && renderList());
}

$('#btn-favs').addEventListener('click', () => {
  state.view = state.view === 'favs' ? 'list' : 'favs';
  if (state.view === 'favs') {
    openSheet(true);
    loadFavTiles();
  }
  renderList();
});

$('#list').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="locate"]')) { locate(false); return; }
  const b = e.target.closest('[data-key]');
  if (!b) return;
  if (state.view === 'favs') goToKey(b.dataset.key); else select(b.dataset.key);
});

$('#detail').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const st = findStation(state.selectedKey);
  if (act === 'back') backToList();
  else if (act === 'fav' && st) toggleFav(st);
  else if (act === 'share' && st) share(st);
});

$('#sheet-handle').addEventListener('click', () => openSheet(!$('#sheet').classList.contains('open')));
$('#btn-locate').addEventListener('click', () => locate(false));
$('#btn-settings').addEventListener('click', openSettings);
$('#search').addEventListener('submit', (e) => { e.preventDefault(); search($('#q').value); });

$('#settings').addEventListener('close', () => {
  if ($('#settings').returnValue !== 'save') return;
  const form = $('#settings-form');
  state.settings = {
    liters: Math.min(200, Math.max(5, Number(form.liters.value) || DEFAULT_SETTINGS.liters)),
    consumption: Math.min(30, Math.max(2, Number(form.consumption.value) || DEFAULT_SETTINGS.consumption)),
    radius: Number(form.radius.value) || DEFAULT_SETTINGS.radius,
    hideRestricted: form.hideRestricted.checked,
  };
  store.set('settings', state.settings);
  refresh();
});

map.on('moveend', refreshSoon);
map.on('click', () => { if (matchMedia('(max-width: 899px)').matches) openSheet(false); });

// Al llegar precios nuevos se vacía la caché de teselas: las favoritas abiertas se vuelven a cargar.
async function reloadData() {
  try { await loadIndex(); refresh(); if (state.view === 'favs') loadFavTiles(); } catch { /* sin conexión */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || Date.now() - state.loadedAt < 10 * 60000) return;
  reloadData();
});
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  reloadData();
}, 10 * 60000);

// ── Arranque ─────────────────────────────────────────────────────────────────
async function start() {
  renderFuels();
  try {
    await loadIndex();
  } catch {
    $('#sheet-title').textContent = 'Sin conexión';
    $('#sheet-sub').textContent = 'No se pudieron descargar los precios. Revisa tu conexión y vuelve a abrir la app.';
    return;
  }
  const hash = decodeURIComponent(location.hash.slice(1));
  if (/^[A-Z]{2}\/-?\d+_-?\d+\/.+/.test(hash)) await goToKey(hash);
  else refresh();

  // Ubicación automática: en la app siempre; en la web solo si ya se dio permiso.
  if (isNative) locate(true);
  else navigator.permissions?.query({ name: 'geolocation' }).then((p) => { if (p.state === 'granted') locate(true); }).catch(() => {});

  if (isNative) import('./ads.js').then((m) => m.initAds(CFG.ads)).catch(() => {});
  else if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
