// Capturas para Google Play y App Store (las hace GitHub: Actions → Capturas de las tiendas).
// Necesita internet: precios de la web publicada, mapa y buscador.
export default async ({ ir, js, captura, escribir, esperar }) => {
  await ir(''); await js('localStorage.clear(); true'); await ir(''); await esperar(5000);
  await escribir('#q', 'Madrid, España');
  await js("document.querySelector('#search').requestSubmit()");
  await esperar(7000);
  await captura('01-mapa');
  await js("document.querySelector('#sheet-handle').click()"); await esperar(2000);
  await captura('02-lista');
  await js("(document.querySelector('#list li button') || document.querySelector('#list li a') || document.querySelector('#list li')).click()");
  await esperar(2500);
  await captura('03-detalle');
  await js("document.querySelector('#btn-settings').click()"); await esperar(800);
  await captura('04-ajustes');
};
