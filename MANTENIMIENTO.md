# Registro de mantenimiento

Revisión automática dos veces al día (≈ 8:40 y 20:40, hora de España). Aquí solo se anotan los días en que se corrigió algo o se detectó un problema.

| Fecha | Qué pasó | Qué se hizo |
|---|---|---|
| 24/11/2026 | Publicación inicial | Web en GitHub Pages; 11.461 gasolineras (ES) y 9.649 (FR). |
| 24/11/2026 | Los datos del Ministerio traían al menos una gasolinera de España con la latitud y la longitud intercambiadas: salía en el mapa frente a la costa de África (tesela «-9_42») en lugar de en Galicia. | El generador ahora corrige las coordenadas intercambiadas y descarta las que caen fuera de España. Prueba añadida. |
| 25/11/2026 | Con el mapa acercado, la lista «las más baratas» en el radio elegido solo miraba las zonas de datos que se veían en pantalla: cerca de un límite de zona (p. ej. el este de Sevilla, junto al meridiano 6° O) faltaban gasolineras dentro del radio (18 de 20 en la prueba). Además, con la lista de favoritas abierta, al llegar precios nuevos (cada 10 min) las favoritas lejanas se quedaban sin precio («—»). | La app descarga también las zonas que cubre el círculo del radio y vuelve a cargar las favoritas tras cada recarga de precios. Dos comprobaciones nuevas en la prueba visual. |
| 26/11/2026 | Para publicar en Google Play hace falta Android 16 (API 36) desde el 31/8/2026; la app usaba Capacitor 7 (API 35). Además, sin el runtime de Capacitor la app nativa no podía usar la ubicación ni los anuncios. | Capacitor 8; compilación de Android (APK/AAB) e iPhone (TestFlight) en GitHub Actions sin Android Studio ni Mac; runtime de Capacitor cargado solo dentro de la app; permisos e ids de AdMob de prueba declarados; iconos nativos; política de privacidad completada; ficha de las tiendas. |
