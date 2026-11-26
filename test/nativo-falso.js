// Imitación de la app nativa (Capacitor) para las pruebas: avisos, archivos, compartir y botón Atrás.
// Guarda lo que pasa en localStorage para poder comprobarlo desde las pruebas, incluso tras recargar.
(() => {
  const leer = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
  const escribir = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const anotar = (p, m, a) => {
    const l = leer('__llamadas', []);
    l.push([p, m, a === undefined ? null : JSON.parse(JSON.stringify(a))]);
    escribir('__llamadas', l);
  };
  const Plugins = {
    LocalNotifications: {
      async checkPermissions() { return { display: 'granted' }; },
      async requestPermissions() { anotar('LocalNotifications', 'requestPermissions'); return { display: 'granted' }; },
      async getPending() { return { notifications: leer('__avisos', []).map((n) => ({ id: n.id })) }; },
      async cancel({ notifications }) { const ids = notifications.map((n) => n.id); escribir('__avisos', leer('__avisos', []).filter((n) => !ids.includes(n.id))); },
      async schedule({ notifications }) { const actuales = leer('__avisos', []).filter((n) => !notifications.some((x) => x.id === n.id)); escribir('__avisos', [...actuales, ...JSON.parse(JSON.stringify(notifications))]); anotar('LocalNotifications', 'schedule', notifications.length); return { notifications }; },
    },
    Filesystem: {
      async writeFile({ path, data, directory }) { localStorage.setItem(`__fs:${directory}/${path}`, data); return { uri: `file:///${directory}/${path}` }; },
      async readFile({ path, directory }) { const v = localStorage.getItem(`__fs:${directory}/${path}`); if (v === null) throw new Error('No existe'); return { data: v }; },
      async deleteFile({ path, directory }) { localStorage.removeItem(`__fs:${directory}/${path}`); },
    },
    Share: { async share(o) { anotar('Share', 'share', { title: o.title, files: o.files, hayTexto: !!o.text }); return {}; } },
    App: {
      addListener(evento, fn) { if (evento === 'backButton') window.__atras = fn; return { remove() {} }; },
      exitApp() { anotar('App', 'exitApp'); },
    },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins, registerPlugin: (n) => Plugins[n] };
})();
