# Crisis en Electroingeniería — Vertical Slice 01

Primera entrega jugable de un escape room / dungeon RPG 3D para navegador.

## Qué incluye

- Dungeon 3D cenital/isométrico construido con assets KayKit.
- Personaje Knight animado (idle, caminar, correr e interactuar).
- Cámara ortográfica con seguimiento suave.
- Colisiones y puertas/rejas con requisitos.
- Tres evidencias de trazabilidad que se consultan como documentos.
- Cámara de riesgo con penalización de tiempo.
- Guardián de Calidad (Skeleton Warrior) con reto de trazabilidad.
- Llave de Calidad y segunda puerta.
- Reto final de causa raíz + acción correctiva.
- Cronómetro continuo (también mientras se leen documentos), errores, objetivo dinámico, HUD y pantalla de resultados.

## Ejecutar

Requiere Node.js 20+. En Windows puedes hacer doble clic en `INICIAR_JUEGO.bat`; instalará dependencias la primera vez y abrirá el navegador.

Ejecución manual:

```bash
npm install
npm run dev
```

Abrir la URL que muestre Vite (normalmente http://localhost:5173).

## Build de producción

```bash
npm run build
npm run preview
```

## Controles

- `WASD` o flechas: mover.
- `Shift`: correr.
- `E`: interactuar.

## Arquitectura

- `src/game/Game.ts`: bucle principal, renderer, cámara, tiempo y finalización.
- `src/game/Player.ts`: movimiento, colisión, rotación y AnimationMixer.
- `src/game/World.ts`: mapa, props, puertas, puzzles, evidencias y guardián.
- `src/game/UI.ts`: HUD, documentos, diálogos, preguntas y resultados.
- `src/game/AssetLibrary.ts`: caché y clonado de GLTF/GLB.

## Licencias

Los assets KayKit incluidos provienen de los ZIP entregados para el proyecto y están licenciados CC0. Se conservaron las licencias originales en `public/assets/licenses/`.

Three.js y Vite se distribuyen bajo licencia MIT.

## Siguiente iteración propuesta

1. Diseñador de niveles basado en JSON/Tiled o editor propio.
2. Inventario visual de evidencias con drag & drop.
3. Ishikawa como puzzle espacial de 6 pedestales.
4. Secuencia completa de 5 Porqués.
5. Múltiples equipos y ranking vía Supabase.
6. Panel de Game Master y eventos en tiempo real.
7. QR físicos para pistas externas.
8. Audio, partículas, cinemáticas y transición de batalla/reto.
