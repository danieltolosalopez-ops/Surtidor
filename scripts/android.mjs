// Prepara el proyecto Android con Capacitor. Se ejecuta en GitHub Actions (no hace falta Android Studio).
// 1) crea la carpeta android/ si no existe, 2) copia la web, 3) pone iconos, pantalla de inicio y permisos,
// 4) fija el número de versión. Uso: VERSION_CODE=12 node scripts/android.mjs
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync, cpSync, statSync } from 'node:fs';
import path from 'node:path';

const sh = (c) => execSync(c, { stdio: 'inherit' });
// Runtime de Capacitor para la app (la web no lo usa): se empaqueta con esbuild desde @capacitor/core.
execSync('npx esbuild --bundle --format=esm --minify --log-level=warning --outfile=public/vendor/capacitor-core.js', {
  input: "import '@capacitor/core';", stdio: ['pipe', 'inherit', 'inherit'],
});
if (!existsSync('android')) sh('npx cap add android');
sh('npx cap sync android');

const res = 'android/app/src/main/res';
// La pantalla de inicio de Capacitor trae su propio logo en PNG: se quita y se usa la nuestra (drawable/splash.xml).
for (const dir of readdirSync(res)) {
  const p = path.join(res, dir, 'splash.png');
  if (dir.startsWith('drawable') && existsSync(p)) rmSync(p);
}
cpSync('android-res', res, { recursive: true, force: true });

// Permisos: avisos (Android 13+), volver a programarlos al reiniciar el móvil y los propios de cada app
// (marca/android.json: { "permisos": [...], "metadatos": { "nombre": "valor" } }).
const extra = existsSync('marca/android.json') ? JSON.parse(readFileSync('marca/android.json', 'utf8')) : {};
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
for (const [nombre, valor] of Object.entries(extra.metadatos || {})) {
  if (!manifest.includes(`android:name="${nombre}"`)) {
    manifest = manifest.replace(/(<application[^>]*>)/, `$1\n        <meta-data android:name="${nombre}" android:value="${valor}" />`);
  }
}
// Los permisos de avisos solo se piden si la app usa avisos (@capacitor/local-notifications).
const usaAvisos = !!JSON.parse(readFileSync('package.json', 'utf8')).dependencies?.['@capacitor/local-notifications'];
const avisos = usaAvisos ? ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'] : [];
for (const permiso of [...avisos, ...(extra.permisos || [])]) {
  if (!manifest.includes(permiso)) manifest = manifest.replace('</manifest>', `    <uses-permission android:name="${permiso}" />\n</manifest>`);
}
writeFileSync(manifestPath, manifest);

// Color de fondo de la pantalla de inicio en Android 12 o superior.
const stylesPath = path.join(res, 'values/styles.xml');
if (existsSync(stylesPath)) {
  let styles = readFileSync(stylesPath, 'utf8');
  if (!styles.includes('windowSplashScreenBackground')) {
    styles = styles.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/, '$1\n        <item name="windowSplashScreenBackground">@color/splash_fondo</item>');
    writeFileSync(stylesPath, styles);
  }
}

// Versión: versionCode sube con cada compilación de GitHub; versionName sale de package.json.
const gradlePath = 'android/app/build.gradle';
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const code = Number(process.env.VERSION_CODE || 1);
let gradle = readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);

const tam = (d) => readdirSync(d).reduce((s, f) => s + (statSync(path.join(d, f)).isDirectory() ? tam(path.join(d, f)) : 1), 0);
console.log(`Proyecto Android listo: versión ${version} (${code}), ${tam(res)} recursos.`);
