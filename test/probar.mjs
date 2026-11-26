// Prueba visual sin dependencias: sirve una carpeta, abre Chrome sin ventana y ejecuta pasos con el protocolo DevTools.
// Uso: node probar.mjs <carpeta-web> <pasos.mjs> <carpeta-capturas>
// pasos.mjs exporta default async ({ ir, js, captura, esperar, clic, escribir, errores }) => {}
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const [raiz, pasosRuta, salida] = process.argv.slice(2).map((p) => path.resolve(p));
await mkdir(salida, { recursive: true });
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const cuerpo = await readFile(path.join(raiz, p));
    res.writeHead(200, { 'Content-Type': tipos[path.extname(p)] || 'application/octet-stream' });
    res.end(cuerpo);
  } catch { res.writeHead(404); res.end('no'); }
}).listen(0);
const puertoWeb = servidor.address().port;

const puerto = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${puerto}`, '--user-data-dir=/tmp/probar-' + puerto, 'about:blank'], { stdio: 'ignore' });
let lista;
for (let i = 0; i < 50; i++) {
  try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); if (lista.length) break; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
const pagina = lista.find((t) => t.type === 'page');
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let n = 0; const pendientes = new Map(); const errores = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errores.push(`${m.params.entry.text} ${m.params.entry.url || ''}`);
});
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pendientes.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
// NATIVO=1: la página cree que es la app de Android (Capacitor) con plugins de imitación.
if (process.env.NATIVO === 'sinruntime') {
  // Como en un móvil real antes de cargar el runtime: solo existe el puente nativo.
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.androidBridge = {};' });
} else if (process.env.NATIVO) {
  const falso = await readFile(new URL('./nativo-falso.js', import.meta.url), 'utf8');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: falso });
}
// TAMANO=ancho x alto x escala (por ejemplo 440x956x3 para capturas de App Store).
if (process.env.TAMANO) {
  const [w, h, k] = process.env.TAMANO.split('x').map(Number);
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: k, mobile: true });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
const api = {
  base: `http://127.0.0.1:${puertoWeb}/`,
  errores,
  esperar,
  js,
  async ir(ruta = '') { await cdp('Page.navigate', { url: api.base + ruta }); await esperar(1200); },
  async captura(nombre, completa = false) {
    let clip;
    if (completa) {
      const alto = await js('document.documentElement.scrollHeight');
      const ancho = await js('innerWidth');
      clip = { x: 0, y: 0, width: ancho, height: Math.min(alto, 6000), scale: 1 };
    }
    const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!completa, ...(clip ? { clip } : {}) });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(salida, `${nombre}.png`), Buffer.from(r.result.data, 'base64'));
  },
  async clic(sel) { await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('No encuentro ' + ${JSON.stringify(sel)}); e.click(); })()`); await esperar(300); },
  async escribir(sel, valor) {
    await js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('No encuentro ' + ${JSON.stringify(sel)});
      e.value = ${JSON.stringify(valor)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await esperar(250);
  },
};
let fallo = null;
try {
  const pasos = (await import(pasosRuta)).default;
  await pasos(api);
} catch (e) { fallo = e; }
ws.close(); chrome.kill('SIGKILL'); servidor.close();
if (errores.length) console.log('ERRORES DE LA PÁGINA:\n' + errores.join('\n'));
if (fallo) { console.log('FALLO:', fallo.message); process.exit(1); }
console.log(errores.length ? 'Terminado con errores' : 'Todo bien');
process.exit(errores.length ? 1 : 0);
