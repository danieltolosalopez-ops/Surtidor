// Imitación mínima de Leaflet SOLO para pruebas visuales sin internet (proyección Mercator real,
// marcadores en su sitio, sin teselas). No se publica.
(function () {
  const T = 256;
  const proj = (lat, lon, z) => { const s = T * 2 ** z, si = Math.sin(lat * Math.PI / 180); return { x: (lon + 180) / 360 * s, y: (0.5 - Math.log((1 + si) / (1 - si)) / (4 * Math.PI)) * s }; };
  const unproj = (x, y, z) => { const s = T * 2 ** z, n = Math.PI - 2 * Math.PI * y / s; return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: x / s * 360 - 180 }; };
  const ll = (c) => (Array.isArray(c) ? { lat: c[0], lng: c[1] } : c);
  class Bounds {
    constructor(s, w, n, e) { Object.assign(this, { s, w, n, e }); }
    getSouth() { return this.s; } getWest() { return this.w; } getNorth() { return this.n; } getEast() { return this.e; }
    pad(r) { const a = (this.n - this.s) * r, b = (this.e - this.w) * r; return new Bounds(this.s - a, this.w - b, this.n + a, this.e + b); }
    contains(c) { const p = ll(c); return p.lat >= this.s && p.lat <= this.n && p.lng >= this.w && p.lng <= this.e; }
  }
  class Evented { on(ev, fn) { (this._h ??= {})[ev] ??= []; this._h[ev].push(fn); return this; } fire(ev, e = {}) { (this._h?.[ev] || []).forEach((f) => f(e)); return this; } }
  class MapS extends Evented {
    constructor(id) {
      super(); this.el = document.getElementById(id); this.children = new Set();
      this.el.style.backgroundImage = 'linear-gradient(#d9e2ec 1px, transparent 1px), linear-gradient(90deg, #d9e2ec 1px, transparent 1px)';
      this.el.style.backgroundSize = '64px 64px'; this.el.style.overflow = 'hidden';
      this.el.addEventListener('click', (e) => { if (e.target === this.el) this.fire('click'); });
    }
    setView(c, z) { this.c = ll(c); this.z = Math.round(z); this.redraw(); clearTimeout(this._t); this._t = setTimeout(() => this.fire('moveend'), 0); return this; }
    getCenter() { return { ...this.c }; } getZoom() { return this.z; } setZoom(z) { return this.setView(this.c, z); }
    getBounds() { const w = this.el.clientWidth, h = this.el.clientHeight, p = proj(this.c.lat, this.c.lng, this.z); const a = unproj(p.x - w / 2, p.y - h / 2, this.z), b = unproj(p.x + w / 2, p.y + h / 2, this.z); return new Bounds(b.lat, a.lng, a.lat, b.lng); }
    point(c) { const p = proj(this.c.lat, this.c.lng, this.z), q = proj(c.lat, c.lng, this.z); return { x: q.x - p.x + this.el.clientWidth / 2, y: q.y - p.y + this.el.clientHeight / 2 }; }
    flyTo(c, z) { return this.setView(c, z ?? this.z); } panTo(c) { return this.setView(c, this.z); }
    fitBounds(b) { const [[s, w], [n, e]] = b; return this.setView([(s + n) / 2, (w + e) / 2], 13); }
    invalidateSize() { return this; }
    add(l) { this.children.add(l); l._map = this; l.draw?.(this); }
    redraw() { this.children.forEach((l) => l.draw?.(this)); }
  }
  class Group { constructor() { this.items = []; } addTo(t) { t.add(this); return this; } add(l) { this.items.push(l); if (this._map) l.draw(this._map); }
    draw(m) { this._map = m; this.items.forEach((l) => l.draw(m)); } clearLayers() { this.items.forEach((l) => l.el?.remove()); this.items = []; return this; } }
  class Marker extends Evented {
    constructor(c, o = {}) { super(); this.c = ll(c); this.o = o; }
    addTo(t) { t.add(this); return this; } setLatLng(c) { this.c = ll(c); if (this._map) this.draw(this._map); return this; }
    makeEl() { const d = document.createElement('div'); d.className = `leaflet-marker-icon ${this.o.icon?.o.className || ''}`; d.innerHTML = this.o.icon?.o.html || ''; return d; }
    draw(m) {
      this._map = m; this.el?.remove(); const el = (this.el = this.makeEl()); const p = m.point(this.c);
      el.style.cssText += `;position:absolute;left:${p.x}px;top:${p.y}px;width:0;height:0;z-index:${400 + (this.o.zIndexOffset || 0) / 10 | 0}`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.fire('click'); }); m.el.appendChild(el);
    }
  }
  class Circle extends Marker {
    makeEl() { const d = document.createElement('div'); const r = this.o.radius || 6; d.style.cssText = `margin:-${r}px 0 0 -${r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:${this.o.fillColor};border:${this.o.weight}px solid ${this.o.color};cursor:pointer`; return d; }
    draw(m) { super.draw(m); this.el.style.width = this.el.style.height = `${2 * (this.o.radius || 6)}px`; }
  }
  window.L = {
    map: (id, o) => new MapS(id, o),
    tileLayer: () => ({ addTo() { return this; } }),
    control: { zoom: () => ({ addTo() { return this; } }) },
    layerGroup: () => new Group(),
    canvas: () => ({}),
    marker: (c, o) => new Marker(c, o),
    circleMarker: (c, o) => new Circle(c, o),
    divIcon: (o) => ({ o }),
  };
})();
