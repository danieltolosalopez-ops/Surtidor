// En la app (Android/iPhone), Capacitor necesita su runtime de JavaScript (@capacitor/core) para hablar con los
// plugins (ubicación, anuncios). Se genera al compilar la app (scripts/android.mjs y scripts/ios.mjs →
// public/vendor/capacitor-core.js) y solo se carga dentro de la app: en la web no existe ni hace falta.
const enApp = !!(window.androidBridge || window.webkit?.messageHandlers?.bridge || window.Capacitor?.isNativePlatform?.());
if (enApp && !window.Capacitor?.registerPlugin) {
  try { await import('./vendor/capacitor-core.js'); } catch (e) { console.warn('No se pudo cargar Capacitor', e); }
}
export {};
