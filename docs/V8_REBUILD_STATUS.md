# Operación Aurora V8 — Estado de reconstrucción

V8 es la línea oficial de desarrollo. No se permiten art-passes superpuestos sobre versiones anteriores.

## Arquitectura activa
- Un runtime V8 independiente.
- Un sistema de input.
- Un controlador de personaje.
- Un mundo.
- Un sistema de interacción.
- Un sistema de UI.
- Un sistema de audio.
- Zonas reconstruidas como módulos únicos.

## Vertical slice actual: Recepción / Almacén
- Sector reconstruido con un kit industrial común (`IndustrialKit`).
- Muelles, racks, montacargas, control documental, inspección, cuarentena, gabinetes, luminarias y señalización comparten materiales, escala y lenguaje visual.
- Los pallets A/B/C se inspeccionan, interpretan y transportan físicamente.
- La evidencia del scanner no revela la respuesta; el jugador debe decidir la segregación correcta.

## Personaje
- Ingeniero articulado con casco, visor, EPP, radio, credencial, mochila y scanner.
- Máquina de estados de animación independiente.
- Estados: idle, walk, run, carry, pickup, drop, scan e interact.
- Piernas con cadera/rodilla y brazos con hombro/codo para evitar animación rígida de bloque único.

## Rendimiento
- Sin UnrealBloomPass.
- Sin postprocesado pesado.
- Sin GLB remotos en runtime V8.
- Pixel ratio limitado.
- Geometrías/materiales del kit reutilizados donde es viable.
- GitHub Actions compila y aplica presupuesto de bundle antes de aceptar una iteración.

## CI
`.github/workflows/v8-build.yml` ejecuta:
1. Node 22.
2. Instalación de dependencias.
3. TypeScript + build de producción.
4. Presupuesto máximo del bundle JS principal.
5. Publicación de `dist/` como artefacto descargable por 7 días.

## Siguiente reconstrucción
Producción debe dejar de usar cuatro terminales abstractos y convertirse en una línea jugable completa: OT → preparación → material → set-up → primera pieza → inspección → liberación.
