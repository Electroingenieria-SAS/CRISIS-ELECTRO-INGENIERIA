# CRISIS ELECTRO-INGENIERÍA

Escape room / dungeon RPG 3D para navegador, ambientado en una crisis operativa de **Electroingeniería S.A.S.**. La experiencia combina exploración cenital/isométrica con retos de trazabilidad, no conformidades, análisis de causa raíz y acciones correctivas.

## Vertical Slice 01

La primera entrega incluye:

- Dungeon 3D cenital/isométrico con assets KayKit.
- Personaje `Knight` animado: idle, caminar, correr e interactuar.
- Cámara ortográfica con seguimiento suave.
- Colisiones y puertas/rejas condicionadas por progreso.
- Tres evidencias de trazabilidad inspeccionables como documentos.
- Cámara de riesgo con penalización de tiempo.
- Guardián de Calidad (`Skeleton Warrior`) con reto de trazabilidad.
- Llave de Calidad y segunda puerta bloqueada.
- Reto final de causa raíz + selección de acción correctiva.
- Cronómetro continuo, registro de errores, objetivo dinámico, HUD y pantalla de resultados.

## Stack

- **Three.js** para renderizado 3D y animación.
- **TypeScript** para la lógica del juego.
- **Vite** para desarrollo y build.
- **Vercel** como destino de despliegue.

## Requisitos

Vite 8 requiere Node.js `20.19+` o `22.12+`. El proyecto declara Node.js `>=20.19.0` y deja `.nvmrc` en Node 22.

## Ejecutar localmente

En Windows puedes usar:

```text
INICIAR_JUEGO.bat
```

O manualmente:

```bash
npm install
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

## Build de producción

```bash
npm install
npm run build
npm run preview
```

La salida estática queda en `dist/`.

## Despliegue en Vercel

El repositorio incluye `vercel.json`. En Vercel basta con importar este repositorio; la configuración esperada es:

- Framework: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

No se requieren variables de entorno en esta primera versión.

## Controles

- `WASD` o flechas: mover.
- `Shift`: correr.
- `E`: interactuar.

## Arquitectura

```text
src/
├── main.ts
├── styles.css
└── game/
    ├── AssetLibrary.ts
    ├── Game.ts
    ├── Input.ts
    ├── Player.ts
    ├── UI.ts
    ├── World.ts
    └── types.ts

public/assets/
└── kaykit + licencias
```

- `Game.ts`: renderer, cámara, reloj y ciclo principal.
- `Player.ts`: movimiento, colisiones, orientación y AnimationMixer.
- `World.ts`: dungeon, props, puertas, puzzles, evidencias y guardián.
- `UI.ts`: HUD, documentos, diálogos, preguntas y resultados.
- `AssetLibrary.ts`: carga, caché y clonado de GLTF/GLB.

## Assets y licencias

Los assets KayKit incluidos provienen de los paquetes suministrados para este proyecto y están bajo licencia **CC0**. Las licencias originales están conservadas en `public/assets/licenses/`.

Three.js y Vite se distribuyen bajo licencia MIT.

## Roadmap inmediato

1. Inventario visual de evidencias.
2. Ishikawa como puzzle espacial de seis categorías.
3. Secuencia completa de 5 Porqués.
4. Cofres, mecanismos, NPC y eventos narrativos adicionales.
5. Múltiples equipos, sesiones y ranking mediante Supabase.
6. Panel de Game Master y eventos en tiempo real.
7. QR físicos para pruebas híbridas dentro de la empresa.
8. Audio, partículas, transiciones y cinemáticas.
