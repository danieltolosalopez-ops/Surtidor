// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN — lo único que necesitas tocar antes de publicar.
// ─────────────────────────────────────────────────────────────────────────────
window.APP_CONFIG = {
  appName: 'Surtidor',

  // Dirección pública de tu web (la que te da GitHub Pages). Se usa para compartir enlaces
  // y para que la app móvil descargue los precios. Ejemplo: 'https://tunombre.github.io/surtidor'
  publicUrl: 'https://danieltolosalopez-ops.github.io/Surtidor',

  // Datos de precios: en la web basta con 'data'. La app móvil usa publicUrl + '/data'.
  dataUrl: 'data',

  // Mapa base. OpenStreetMap vale para empezar y para pocos usuarios.
  // Con tráfico real (o al publicar en las tiendas), usa un proveedor con clave gratuita, p. ej. MapTiler:
  //   url: 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=TU_CLAVE',
  //   attribution: '© MapTiler © OpenStreetMap contributors'
  tiles: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },

  // Buscador de lugares (OpenStreetMap Nominatim: gratis, máximo 1 búsqueda por segundo).
  geocoder: 'https://nominatim.openstreetmap.org/search',

  defaultView: { center: [40.3, -3.7], zoom: 6 },
  detailZoom: 9, // a partir de este zoom se ven las gasolineras una a una

  // Anuncios (solo en la app de Android/iOS). Déjalo así hasta tener cuenta de AdMob.
  // testing: true muestra anuncios de prueba de Google; ponlo en false al publicar.
  ads: {
    testing: true,
    android: { banner: '' }, // ej. 'ca-app-pub-1234567890123456/1234567890'
    ios: { banner: '' },
  },

  privacyUrl: 'privacy.html',
};
