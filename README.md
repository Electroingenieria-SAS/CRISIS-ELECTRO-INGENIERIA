# Crisis en Electroingeniería — Quality Dungeon V2

Videojuego 3D para navegador inspirado en dungeon RPG + escape room empresarial. La experiencia convierte herramientas de calidad (trazabilidad, Ishikawa, 5 Porqués y CAPA) en mecánicas físicas de exploración, combate y resolución de retos.

## V2: experiencia jugable

- Registro de jugador/equipo, indicativo, color y especialización: Inspector, Analista o Ingeniero.
- Controles relativos a cámara: `W/↑` siempre avanza visualmente hacia arriba y `S/↓` hacia abajo.
- Mazmorra ampliada a cinco sectores conectados por compuertas y objetivos progresivos.
- Cofres físicos con tapa animada, pedestales, coleccionables e inventario visual.
- Tres evidencias documentales reales dentro del escenario.
- Minijuego de reconstrucción de trazabilidad.
- Cámara de Riesgo con enemigos “Error”, integridad, penalizaciones y ataque/verificación.
- Ishikawa construido físicamente en la sala, seis fichas de causa y clasificación interactiva.
- Secuencia completa de 5 Porqués con retroalimentación causal.
- Minijuego final de ventana de verificación y acción correctiva CAPA.
- Audio procedural Web Audio: ambiente, pasos, impactos, cofres, puertas y feedback.
- Puntuación, tiempo, integridad, errores y telemetría de misión.
- Multiequipo + Game Master opcional mediante Supabase Realtime.

## Controles

- `WASD` / flechas: mover relativo a la cámara.
- `Shift`: correr.
- `E`: interactuar, recoger, abrir y activar.
- `Space`: neutralizar errores a corta distancia.
- `I`: abrir/cerrar inventario.
- `M`: activar/silenciar audio.

## Ejecutar local

Requiere Node.js 22+.

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

## Vercel

El proyecto es Vite estático. Vercel debe ejecutar `npm run build` y publicar `dist`.

Para jugar sin Supabase no se requiere ninguna variable de entorno. Para multiequipo/Game Master agrega en Vercel:

```text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca uses `service_role` en variables `VITE_*`: todo valor `VITE_*` termina en el navegador.

## Supabase / Multiequipo

1. Usa un proyecto Supabase dedicado al juego.
2. Habilita **Anonymous Sign-ins** para los equipos jugadores.
3. Ejecuta `supabase/migrations/20260914103000_game_master.sql`.
4. Crea el usuario del Game Master mediante Supabase Auth y asigna `app_metadata.role = "game_master"` desde una operación administrativa segura.
5. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. Juego normal: `/`.
7. Centro Game Master: `/?gm=1`.

El esquema habilita RLS en las tres tablas. Un equipo sólo puede ver/modificar su propia sesión; el Game Master sólo obtiene acceso global cuando su JWT contiene `app_metadata.role = game_master`. Los comandos `pause`, `resume`, `add_time`, `remove_time`, `message` y `finish` viajan por Supabase Realtime.

### Tablas

- `game_sessions`: estado vivo por equipo, fase, tiempo, puntaje, salud y progreso.
- `game_events`: telemetría de eventos pedagógicos/gameplay.
- `gm_commands`: órdenes del Game Master hacia sesiones específicas.

## Arquitectura

- `src/game/Game.ts`: loop principal, cámara, estado, controles y comandos Game Master.
- `src/game/Player.ts`: personaje, movimiento relativo a cámara, animación y ataque.
- `src/game/World.ts`: dungeon, cofres, enemigos, Ishikawa, puzzles y progresión.
- `src/game/UI.ts`: onboarding, HUD, inventario, minijuegos, documentos y resultados.
- `src/game/AudioManager.ts`: audio procedural sin dependencias de archivos externos.
- `src/game/Multiplayer.ts`: Supabase, sesiones, Realtime y consola Game Master.
- `src/game/AssetLibrary.ts`: cache/clonado de GLTF/GLB KayKit.

## Licencias

Los assets KayKit incluidos están bajo CC0 y sus licencias se conservan en `public/assets/licenses/`. Three.js, Vite y Supabase JS se distribuyen bajo sus respectivas licencias open source.
