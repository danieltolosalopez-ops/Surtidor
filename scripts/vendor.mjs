// Copia la librería del mapa (Leaflet) dentro de public/vendor para no depender de servidores externos.
// npm verifica la integridad del paquete al descargarlo. Uso: node scripts/vendor.mjs
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VERSION = '1.9.4';
const tmp = mkdtempSync(path.join(tmpdir(), 'leaflet-'));
try {
  execSync(`npm pack leaflet@${VERSION} --silent --pack-destination "${tmp}"`, { stdio: 'inherit' });
  execSync(`tar -xzf "leaflet-${VERSION}.tgz"`, { cwd: tmp, stdio: 'inherit' });
  const dest = path.resolve('public/vendor/leaflet');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(path.join(tmp, 'package', 'dist'), dest, { recursive: true });
  console.log(`Leaflet ${VERSION} copiado en ${dest}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
