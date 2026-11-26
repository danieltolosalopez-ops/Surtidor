// Prepara el proyecto de iPhone con Capacitor. Se ejecuta en GitHub Actions (Mac con Xcode), no hace falta un Mac propio.
// 1) crea ios/ si no existe, 2) copia la web, 3) permisos y ajustes de Info.plist, solo iPhone y solo vertical,
// 4) icono y pantalla de inicio, 5) versión. Uso: BUILD_NUMBER=12 node scripts/ios.mjs
import { execSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const sh = (c) => execSync(c, { stdio: 'inherit' });
// Runtime de Capacitor para la app (la web no lo usa): se empaqueta con esbuild desde @capacitor/core.
execSync('npx esbuild --bundle --format=esm --minify --log-level=warning --outfile=public/vendor/capacitor-core.js', {
  input: "import '@capacitor/core';", stdio: ['pipe', 'inherit', 'inherit'],
});
if (!existsSync('ios')) sh('npx cap add ios');
sh('npx cap sync ios');

const capConfig = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const ajustes = existsSync('marca/ios.json') ? JSON.parse(readFileSync('marca/ios.json', 'utf8')) : {};
const plist = 'ios/App/App/Info.plist';
const plutil = (...args) => execFileSync('plutil', [...args, plist]);
const quitar = (clave) => { try { plutil('-remove', clave); } catch { /* no estaba */ } };

plutil('-replace', 'CFBundleDisplayName', '-string', capConfig.appName);
// La app no usa cifrado propio (solo HTTPS del sistema): evita la pregunta de exportación en cada versión.
plutil('-replace', 'ITSAppUsesNonExemptEncryption', '-bool', 'NO');
plutil('-replace', 'UISupportedInterfaceOrientations', '-json', '["UIInterfaceOrientationPortrait"]');
quitar('UISupportedInterfaceOrientations~ipad');
plutil('-replace', 'UIStatusBarStyle', '-string', ajustes.estiloBarra || 'UIStatusBarStyleDarkContent');
for (const [clave, texto] of Object.entries(ajustes.permisos || {})) plutil('-replace', clave, '-string', texto);
// Otras claves de Info.plist propias de la app (por ejemplo, el identificador de AdMob).
for (const [clave, valor] of Object.entries(ajustes.plist || {})) {
  if (typeof valor === 'string') plutil('-replace', clave, '-string', valor);
  else plutil('-replace', clave, '-json', JSON.stringify(valor));
}

// Solo iPhone (así App Store no pide capturas de iPad) y número de versión.
const pbx = 'ios/App/App.xcodeproj/project.pbxproj';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
let proyecto = readFileSync(pbx, 'utf8');
proyecto = proyecto
  .replace(/TARGETED_DEVICE_FAMILY = "?[\d,]+"?;/g, 'TARGETED_DEVICE_FAMILY = 1;')
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${Number(process.env.BUILD_NUMBER || 1)};`);
writeFileSync(pbx, proyecto);

// Icono: todas las casillas del AppIcon con el icono de 1024 px (sin transparencia), redimensionado con sips.
const iconos = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const contenidoIconos = JSON.parse(readFileSync(path.join(iconos, 'Contents.json'), 'utf8'));
for (const img of contenidoIconos.images) {
  if (!img.filename) continue;
  const base = Number(String(img.size || '1024x1024').split('x')[0]);
  const escala = Number(String(img.scale || '1x').replace('x', ''));
  const px = Math.round(base * escala);
  const destino = path.join(iconos, img.filename);
  copyFileSync('store/icon-1024.png', destino);
  if (px !== 1024) execFileSync('sips', ['-z', String(px), String(px), destino], { stdio: 'ignore' });
}

// Pantalla de inicio: el color de la marca con el dibujo en el centro.
const splash = 'ios/App/App/Assets.xcassets/Splash.imageset';
if (existsSync(path.join(splash, 'Contents.json')) && existsSync('ios-res/splash-2732x2732.png')) {
  const c = JSON.parse(readFileSync(path.join(splash, 'Contents.json'), 'utf8'));
  for (const img of c.images) if (img.filename) copyFileSync('ios-res/splash-2732x2732.png', path.join(splash, img.filename));
}

console.log(`Proyecto de iPhone listo: ${capConfig.appName} ${version} (${process.env.BUILD_NUMBER || 1}).`);
