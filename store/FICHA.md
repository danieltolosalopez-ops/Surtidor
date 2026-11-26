# Ficha de Surtidor para Google Play y App Store

Textos listos para copiar y pegar. Las imágenes están en esta carpeta (`store/`).

## Google Play

| Campo | Texto (25/30, 79/80, 1376/4000 caracteres) |
|---|---|
| Nombre de la app | Surtidor: gasolina barata |
| Descripción breve | Precios oficiales de todas las gasolineras en un mapa. Encuentra la más barata. |
| Categoría | Mapas y navegación |
| Icono | `store/play-icon-512.png` |
| Imagen destacada | `store/play-feature-1024x500.png` |
| Capturas de teléfono | `store/capturas/android/` (1080 × 2160; las genera el workflow «Capturas de las tiendas») |
| Política de privacidad | https://danieltolosalopez-ops.github.io/Surtidor/privacy.html |
| Sitio web | https://danieltolosalopez-ops.github.io/Surtidor/ |

**Descripción completa:**

```
Encuentra la gasolinera más barata cerca de ti con los precios oficiales, actualizados cada 30 minutos.

QUÉ HACE
• Mapa con todas las gasolineras de España y de Francia y sus precios oficiales.
• Gasolina 95 y 98, diésel, diésel premium, GLP, gas natural, AdBlue, HVO y más.
• Lista de las más baratas en el radio que elijas, ordenadas por precio o por distancia.
• Colores para ver de un vistazo qué es barato y qué es caro en cada zona.

¿COMPENSA EL DESVÍO?
• Surtidor calcula lo que te ahorras de verdad: compara con la gasolinera más cercana y descuenta el combustible que gastas en ir. Te dice «Ahorras 3,20 €» o «No compensa».
• Calcula también lo que te cuesta llenar el depósito.

TUS GASOLINERAS
• Guarda tus favoritas y ve su precio al momento.
• Comparte una gasolinera por WhatsApp.
• Busca por ciudad, calle o código postal.

DATOS OFICIALES
• España: Ministerio para la Transición Ecológica y el Reto Demográfico (Geoportal de Gasolineras).
• Francia: prix-carburants.gouv.fr (datos abiertos del Gobierno francés).

SIN REGISTRO
Tu ubicación se usa solo en tu móvil para ordenar las gasolineras: no la guardamos ni la enviamos a ningún sitio. Incluye anuncios para mantener la app gratis.

Surtidor no es una aplicación oficial ni está vinculada a ninguna administración. Los precios son los que comunican las propias gasolineras; pueden variar en el surtidor.
```

**Formularios de Play Console**
- Seguridad de los datos: **ID de dispositivo u otros identificadores** recogidos y compartidos con fines publicitarios (AdMob). Ubicación: **no se recoge** (se usa solo en el dispositivo). Datos cifrados en tránsito: sí.
- Anuncios: **sí** contiene anuncios.
- Clasificación de contenido: cuestionario IARC → apta para todos (PEGI 3).
- Público objetivo: **mayores de 18 años** (evita los requisitos de Familias por los anuncios).
- Aplicación gubernamental: no (la descripción lo indica).

## App Store (iPhone)

| Campo | Texto |
|---|---|
| Nombre | Surtidor: gasolina barata (25/30) |
| Subtítulo | Gasolineras baratas cerca (25/30) |
| Texto promocional | Los precios oficiales del Ministerio, actualizados cada 30 minutos. Te decimos si compensa desviarte para repostar más barato. (126/170) |
| Palabras clave | gasolina,diésel,gasolinera,precio,carburante,combustible,ahorro,mapa,repostar,Francia (85/100) |
| Categoría | Navegación (secundaria: Viajes) |
| URL de soporte | https://github.com/danieltolosalopez-ops/Surtidor/issues |
| URL de marketing | https://danieltolosalopez-ops.github.io/Surtidor/ |
| URL de la política de privacidad | https://danieltolosalopez-ops.github.io/Surtidor/privacy.html |
| Capturas iPhone 6,9" | `store/capturas/iphone-6.9/` (1320 × 2868) |
| Capturas iPhone 6,3" | `store/capturas/iphone-6.3/` (1206 × 2622) |
| Clasificación por edad | 4+ |
| Precio | Gratis |
| Privacidad de la app | **Identificadores → ID del dispositivo**, usado para **publicidad de terceros** y **vinculado al seguimiento** (AdMob). Ubicación: no recopilada. |
| Seguimiento (ATT) | Sí: la app pide permiso de seguimiento antes de mostrar anuncios personalizados. |
| Cifrado (exportación) | No usa cifrado propio (`ITSAppUsesNonExemptEncryption = NO`). |

**Descripción** (la misma que en Google Play, 1376/4000).

**Notas para la revisión de Apple:**

```
No hay cuentas ni contenido de pago. La app muestra en un mapa los precios oficiales de las gasolineras de España y Francia (datos abiertos del Ministerio y del Gobierno francés). Para probarla: permite la ubicación o busca «Madrid», elige un combustible arriba y abre la lista inferior. Cada gasolinera indica el ahorro real frente a la más cercana. La ubicación solo se usa en el dispositivo.
```

**Antes de enviar:** cambia los identificadores de prueba de AdMob por los tuyos y pon la clave de MapTiler (ver README, apartados 6 y 7).
