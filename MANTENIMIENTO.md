# Registro de mantenimiento

Revisión automática dos veces al día (≈ 8:40 y 20:40, hora de España). Aquí solo se anotan los días en que se corrigió algo o se detectó un problema.

| Fecha | Qué pasó | Qué se hizo |
|---|---|---|
| 24/11/2026 | Publicación inicial | Web en GitHub Pages; 11.461 gasolineras (ES) y 9.649 (FR). |
| 24/11/2026 | Los datos del Ministerio traían al menos una gasolinera de España con la latitud y la longitud intercambiadas: salía en el mapa frente a la costa de África (tesela «-9_42») en lugar de en Galicia. | El generador ahora corrige las coordenadas intercambiadas y descarta las que caen fuera de España. Prueba añadida. |
