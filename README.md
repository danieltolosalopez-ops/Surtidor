# Surtidor — mapa de gasolineras baratas

Web y app que muestran en un mapa **todas las gasolineras de España y Francia** con sus **precios oficiales**, actualizados cada 30 minutos. Ordena por precio, por distancia o por **ahorro real** (descuenta el combustible que gastas en el desvío), y muestra cuánto cuesta llenar el depósito.

- **Coste de funcionamiento: 0 €.** No hay servidor: GitHub descarga los precios cada 30 min y publica la web gratis.
- **Una sola base de código** para la web, la app instalable desde el navegador (PWA), Android e iPhone.
- **Ampliable a más países**: cada país es un archivo en `scripts/providers/`.

> «Surtidor» es un nombre provisional. Antes de publicar, comprueba que no está registrado como marca (OEPM / EUIPO) ni usado por otra app.

---

## 1. Dónde va cada archivo

Respeta esta estructura de carpetas al subirlos (los nombres que empiezan por punto, como `.github`, también):

```
surtidor/
├── README.md
├── package.json
├── capacitor.config.json
├── .github/workflows/actualizar-precios.yml   ← actualiza precios y publica cada 30 min
├── scripts/
│   ├── build-data.mjs        ← descarga y prepara los datos
│   ├── make-icons.mjs        ← genera iconos e imágenes para las tiendas
│   └── providers/
│       ├── es.mjs            ← España (Ministerio)
│       └── fr.mjs            ← Francia (Ministère de l'Économie)
├── public/                   ← la app (esto es lo que ve el usuario)
│   ├── index.html  app.js  core.js  config.js  styles.css
│   ├── ads.js  sw.js  manifest.webmanifest  icon.svg  privacy.html
│   └── icons/ icon-192.png  icon-512.png  maskable-512.png
├── store/                    ← imágenes para Google Play / App Store
└── test/                     ← pruebas (opcional)
```

La carpeta `public/data/` **no se sube**: la crea GitHub automáticamente con los precios.

---

## 2. Publicar la web gratis (≈ 20 minutos, sin programar)

1. Crea una cuenta en **github.com** (gratis).
2. Pulsa **New repository** → nombre `surtidor` → **Public** → *Create repository*.
3. Pulsa **uploading an existing file** y arrastra todas las carpetas y archivos.
   - Si la carpeta `.github` no se sube al arrastrar: **Add file → Create new file**, escribe como nombre `.github/workflows/actualizar-precios.yml`, pega el contenido del archivo y guarda.
4. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
5. Pestaña **Actions** → «Actualizar precios y publicar» → **Run workflow**. Tarda 1–3 minutos.
6. Tu web queda en `https://TU-USUARIO.github.io/surtidor/`.
7. **Settings → Secrets and variables → Actions → Variables → New variable**: nombre `SITE_URL`, valor la dirección del paso 6. (Sirve para que, si un día falla el Ministerio, se sigan mostrando los últimos precios en lugar de nada.)
8. En `public/config.js` cambia `publicUrl` por esa misma dirección.

A partir de aquí se actualiza sola cada 30 minutos. GitHub pausa las tareas programadas de un repositorio público tras **60 días sin cambios**: si te llega un aviso por email, entra en *Actions* y pulsa *Enable workflow* (o haz cualquier pequeño cambio cada mes).

### Comprobar que los datos llegan
En *Actions* abre la última ejecución → paso «Descargar precios y generar teselas». Debe decir algo como:
`[ES] 12000 estaciones en 95 teselas` y `[FR] 9800 estaciones…`.

### Si aparece `[ES] ERROR` (el Ministerio bloquea servidores en la nube)
El servicio del Ministerio a veces rechaza conexiones desde centros de datos. El script ya reintenta y prueba una segunda dirección, pero si sigue fallando:

- **Opción A (gratis):** usa un ordenador o una Raspberry Pi en tu casa que esté siempre encendido.
  1. *Settings → Actions → Runners → New self-hosted runner* y sigue los comandos que te da GitHub en ese ordenador.
  2. Instala Node.js 22 en ese ordenador.
  3. *Settings → Secrets and variables → Actions → Variables*: crea `DATA_RUNNER` con valor `self-hosted`.
  La descarga de precios se hará desde tu conexión de casa y la publicación sigue en GitHub.
  (Seguridad: no añadas nunca `pull_request` a los disparadores del workflow mientras uses un runner propio.)
- **Opción B:** un servidor virtual barato en España ejecutando `node scripts/build-data.mjs` cada 30 minutos.

---

## 3. Instalar en el móvil sin tiendas (gratis, inmediato)

- **Android (Chrome):** abre tu web → menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abre tu web → botón Compartir → *Añadir a pantalla de inicio*.

Es la forma más rápida de que la usen amigos y de conseguir los primeros usuarios y opiniones.

---

## 4. Publicar en Google Play

### Ruta fácil (sin anuncios dentro de la app)
1. Entra en **pwabuilder.com**, pega la dirección de tu web y pulsa *Package for stores → Android*.
2. Descarga el paquete: incluye el archivo `.aab` y una **clave de firma**. Guarda la clave en un lugar seguro: sin ella no podrás actualizar la app nunca más.
3. PWABuilder también te da un archivo `assetlinks.json`. Debe estar en `https://TU-DOMINIO/.well-known/assetlinks.json` para que la app se vea a pantalla completa (sin barra del navegador). En una dirección `github.io/surtidor` no se puede poner en la raíz, así que para esta ruta conviene un **dominio propio** (≈ 10 €/año) conectado a GitHub Pages (*Settings → Pages → Custom domain*).
4. Sube el `.aab` a Google Play Console (ver «Cuenta de Google Play» abajo).

### Ruta completa (con anuncios AdMob) — necesita un ordenador con Android Studio
```bash
npm install
npm run icons
npx cap add android
```
Edita `android/app/src/main/AndroidManifest.xml` y añade antes de `<application>`:
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```
y dentro de `<application>` (con TU id de aplicación de AdMob, el que lleva `~`):
```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
           android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```
Después:
```bash
npx cap sync
npx cap open android
```
En Android Studio: *File → New → Image Asset* con `store/icon-1024.png` para los iconos, y *Build → Generate Signed App Bundle* para crear el `.aab`.

### Cuenta de Google Play
- Alta única de **25 $** y verificación de identidad.
- Si la cuenta es **personal y nueva**, Google exige una **prueba cerrada con al menos 12 personas durante 14 días seguidos** antes de publicar. Busca 15–20 voluntarios (familia, amigos, grupos de conductores) para no quedarte corto.
- En la ficha: icono `store/play-icon-512.png`, imagen destacada `store/play-feature-1024x500.png`, 2–8 capturas del móvil, y la **URL de privacidad**: `https://TU-USUARIO.github.io/surtidor/privacy.html` (rellena antes los [corchetes] de `privacy.html`).
- Formulario de **seguridad de los datos**: la ubicación se usa solo en el dispositivo; si activas AdMob, declara «ID de dispositivo u otros identificadores» recogidos y compartidos con fines publicitarios.
- Público objetivo: mayores de 18 años (evita requisitos extra de apps para familias).

---

## 5. Publicar en el App Store (iPhone)

Requisitos: **99 $/año** (Apple Developer Program) y un **Mac con Xcode** (o un servicio de Mac en la nube).
```bash
npx cap add ios
npx cap sync
npx cap open ios
```
En `ios/App/App/Info.plist` añade:
- `NSLocationWhenInUseUsageDescription` → «Para mostrarte las gasolineras más baratas cerca de ti.»
- `GADApplicationIdentifier` → tu id de app de AdMob para iOS.
- `NSUserTrackingUsageDescription` → «Para mostrarte anuncios más relevantes.»
- `SKAdNetworkItems` → copia la lista de la guía de AdMob para iOS.

En Xcode: *Product → Archive → Distribute App*. Apple revisa que la app aporte algo más que una web metida en una caja; esta tiene ubicación, favoritos, cálculo de ahorro y mapa, pero conviene describir bien esas funciones en la ficha.

---

## 6. Anuncios (AdMob)

1. Crea cuenta en **admob.google.com**, añade la app (Android e iOS por separado) y crea un bloque **Banner**.
2. Copia los ids de bloque en `public/config.js` → `ads.android.banner` / `ads.ios.banner`, y el id de aplicación en los archivos nativos (apartados 4 y 5).
3. En AdMob → **Privacidad y mensajes**, crea el mensaje de **RGPD** (obligatorio en la UE). La app lo muestra sola.
4. Mientras pruebas, deja `testing: true` (anuncios de prueba). **Nunca pulses tus propios anuncios reales**: Google suspende cuentas por eso. Al publicar, pon `testing: false`.

---

## 7. Mapa base para producción

`tile.openstreetmap.org` vale para empezar, pero sus servidores son de voluntarios y no admiten uso intensivo. Antes de tener muchos usuarios, crea una clave gratuita en **maptiler.com** y cámbiala en `public/config.js` (la línea ya está preparada como comentario).

---

## 8. Añadir más países

1. Copia `scripts/providers/fr.mjs` como `scripts/providers/xx.mjs`.
2. Rellena `meta` (código, nombre, fuente, licencia) y haz que `fetchStations()` devuelva una lista de estaciones con `{ id, lat, lon, name, address, city, hours, prices: { g95, diesel, … }, updated }`.
3. Añádelo a `ALL_PROVIDERS` en `scripts/build-data.mjs`.

Fuentes oficiales candidatas (revisa sus condiciones de uso antes): Italia (MIMIT «Osservaprezzi carburanti», actualización diaria), Alemania (Tankerkönig, con clave gratuita, licencia CC BY 4.0), Reino Unido (Fuel Finder, API con registro), Portugal (DGEG), Austria (E-Control), Australia (NSW FuelCheck, WA FuelWatch). EE. UU. y la mayoría de países no publican precios oficiales por gasolinera.

---

## 9. Probar en tu ordenador

```bash
npm test                      # pruebas de cálculo y del generador con datos simulados
npm run data                  # descarga los precios reales a public/data
npx serve public              # abre http://localhost:3000
```

---

## 10. Avisos legales

- Cita siempre la fuente de los precios (la app ya lo hace al pie de la lista y en cada ficha).
- Los precios son informativos: los comunica cada gasolinera y pueden tener errores o retrasos.
- No uses logotipos del Ministerio ni de las marcas de gasolineras.
- `privacy.html` es una plantilla: complétala con tus datos y revísala.
