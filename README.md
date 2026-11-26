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
│   ├── vendor.mjs            ← copia la librería del mapa (Leaflet) en public/vendor
│   └── providers/
│       ├── _time.mjs         ← conversión de horas locales
│       ├── es.mjs            ← España (Ministerio)
│       └── fr.mjs            ← Francia (Ministère de l'Économie)
├── public/                   ← la app (esto es lo que ve el usuario)
│   ├── index.html  app.js  core.js  config.js  styles.css
│   ├── ads.js  sw.js  manifest.webmanifest  icon.svg  privacy.html
│   └── icons/ icon-192.png  icon-512.png  maskable-512.png
├── store/                    ← imágenes para Google Play / App Store
└── test/                     ← pruebas (opcional)
```

Las carpetas `public/data/` y `public/vendor/` **no se suben**: las crea GitHub automáticamente en cada publicación.

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

## 4. Publicar en Google Play (sin Android Studio)

Cada vez que se sube un cambio a `main`, GitHub compila la app solo (workflow **App Android**, pestaña *Actions*). Cuando termina (unos 8-10 minutos), en la pestaña **Releases** del repositorio aparece **«App Android (última versión)»** con:

- `Surtidor-prueba.apk` (o `Surtidor.apk` si hay firma): ábrelo desde el móvil para instalar la app y probarla. Android te pedirá permitir «instalar apps de origen desconocido» solo esa vez.
- `Surtidor-google-play.aab`: el archivo que se sube a Google Play (solo aparece cuando la firma está configurada).

La app usa **Capacitor 8**, que apunta a **Android 16 (API 36)**: lo que Google Play exige desde el 31 de agosto de 2026 para apps nuevas.

### Firma (necesaria para Google Play)

La firma está guardada en los *secrets* del repositorio (*Settings → Secrets and variables → Actions*):

| Secret | Qué es |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | el archivo de firma (`.jks`) en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del archivo |
| `ANDROID_KEY_ALIAS` | nombre de la clave |
| `ANDROID_KEY_PASSWORD` | contraseña de la clave |

**Guarda una copia del archivo `.jks` y de sus contraseñas fuera de GitHub** (por ejemplo, en tu gestor de contraseñas). Es tu «clave de subida» a Google Play: si la pierdes, hay que pedir a Google que la cambie.

Para crear una firma nueva: `keytool -genkeypair -v -keystore firma.jks -alias subida -keyalg RSA -keysize 2048 -validity 10000` y `base64 -w0 firma.jks` para el primer secret.

### Publicar en Google Play

1. Cuenta de desarrollador de Google Play (25 $, una sola vez; sirve para todas tus apps).
2. *Crear aplicación* → nombre, idioma español, gratuita.
3. **Prueba cerrada** con al menos **12 testers durante 14 días seguidos** (obligatorio en cuentas personales nuevas). Puedes usar el mismo grupo de testers para todas tus apps.
4. Sube el `.aab` de *Releases*. Activa *Firma de apps de Google Play* (Google guarda la clave final; la tuya es solo la de subida).
5. Ficha de la tienda: icono `store/play-icon-512.png`, imagen destacada `store/play-destacada-1024x500.png`, 2-8 capturas hechas con el móvil, y la política de privacidad: `https://danieltolosalopez-ops.github.io/Surtidor/privacy.html`.
6. Formularios: *Seguridad de los datos* → «ID de dispositivo u otros identificadores» recogidos y compartidos con fines publicitarios (por AdMob); la ubicación se usa solo en el móvil y no se recoge. *Anuncios* → sí. *Clasificación de contenido* → cuestionario (apta para todos). *Público objetivo* → mayores de 18 (evita requisitos extra de apps para familias).
7. Los textos de la ficha están en `store/FICHA.md`.

---

## 5. Publicar en el App Store (iPhone) sin Mac

El workflow **App iPhone** compila la app en un Mac de GitHub (macOS 26 con Xcode 26, lo que exige App Store desde abril de 2026):

- **Sin configurar nada:** en cada cambio comprueba que la app de iPhone compila.
- **Con tu cuenta de Apple configurada:** la firma y la sube a App Store Connect. Aparece en **TestFlight** y desde ahí la envías a revisión.

La app es solo para iPhone y en vertical, así que App Store no pide capturas de iPad.

### Lo que hay que hacer una vez (vale para todas tus apps)

1. Darte de alta en el **Apple Developer Program** (99 $/año) en developer.apple.com.
2. **App Store Connect → Usuarios y acceso → Integraciones → App Store Connect API → Generar clave**, con acceso **Admin** (lo necesita Xcode para crear los certificados él solo). Descarga el archivo `.p8` (solo se puede descargar una vez) y apunta el **Key ID** y el **Issuer ID**.
3. Tu **Team ID**: developer.apple.com → Account → Membership details.
4. En este repositorio, *Settings → Secrets and variables → Actions*:

| Secret | Qué es |
|---|---|
| `APPLE_TEAM_ID` | el Team ID |
| `ASC_KEY_ID` | el Key ID de la clave |
| `ASC_ISSUER_ID` | el Issuer ID |
| `ASC_KEY_P8` | el contenido completo del archivo `.p8` (desde `-----BEGIN PRIVATE KEY-----` hasta el final) |

5. **App Store Connect → Apps → «+» → Nueva app**: iOS, nombre, idioma español, Bundle ID `io.github.danieltolosalopezops.surtidor` y un SKU cualquiera (por ejemplo, `surtidor-ios`). Si el Bundle ID aún no aparece, lanza una vez el workflow *App iPhone*: Xcode lo registra solo.
6. *Actions → App iPhone → Run workflow*. En unos 15-20 minutos la versión aparece en TestFlight. Rellena la ficha con los textos de `store/FICHA.md`, añade las capturas de `store/capturas/iphone-6.9/` y `store/capturas/iphone-6.3/` y envía a revisión.

## Ficha de las tiendas

`store/FICHA.md` tiene todos los textos para Google Play y App Store (nombre, descripciones, palabras clave, categoría, URLs, respuestas de privacidad y notas para la revisión), ya ajustados a los límites de caracteres. Las capturas están en `store/capturas/` a los tamaños que piden las tiendas. Para rehacerlas: `bash test/capturas.sh public test/capturas.pasos.mjs store`.

### Antes de publicar en las tiendas (Surtidor)

- **AdMob:** los identificadores que trae son los de **prueba** de Google (enseñan anuncios de prueba). Cuando tengas cuenta de AdMob, pon tu id de aplicación (el que lleva `~`) en `marca/android.json` y `marca/ios.json`, y los ids de bloque en `public/config.js` con `testing: false` (apartado 6).
- **Mapa:** para una app en las tiendas hace falta un proveedor de mapas propio, porque los servidores de OpenStreetMap no admiten apps con muchos usuarios. Crea una clave gratuita en maptiler.com y ponla en `public/config.js` (apartado 7).

---

## 6. Anuncios (AdMob)

1. Crea cuenta en **admob.google.com**, añade la app (Android e iOS por separado) y crea un bloque **Banner**.
2. Copia los ids de bloque en `public/config.js` → `ads.android.banner` / `ads.ios.banner`, y el id de aplicación (el que lleva `~`) en `marca/android.json` (Android) y en `GADApplicationIdentifier` de `marca/ios.json` (iPhone). GitHub los mete solos en la app al compilarla.
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
npm run serve                 # copia la librería del mapa y abre http://localhost:5173
```

---

## 10. Avisos legales

- Cita siempre la fuente de los precios (la app ya lo hace al pie de la lista y en cada ficha).
- Los precios son informativos: los comunica cada gasolinera y pueden tener errores o retrasos.
- No uses logotipos del Ministerio ni de las marcas de gasolineras.
- `privacy.html` es una plantilla: complétala con tus datos y revísala.
