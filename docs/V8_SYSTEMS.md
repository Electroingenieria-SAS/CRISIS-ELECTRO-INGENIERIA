# Operación Aurora V8 — Sistemas de la vertical slice

Este documento describe la arquitectura activa de la vertical slice V8. La fuente de verdad del mundo es `src/v8/WorldEnvironmentCore.ts`, expuesta por `src/v8/World.ts`.

## 1. Colisiones

`CollisionSystem` resuelve movimiento 2D sobre el plano X/Z con AABB y radio del jugador. Todas las cajas se almacenan en un único arreglo mutable para que mundo, debug y gameplay observen la misma fuente.

La pasada final de la vertical slice añade `world/ZoneCollisionProfiles.ts`, con cuerpos identificados para mobiliario y equipos de las tres zonas auditadas:

- **Almacén:** estación de recepción, gabinete de control, racks existentes, montacargas, barreras, gabinetes de servicio y jaula de cuarentena.
- **Producción:** estación de briefing, celda CT-48, transportador, barreras, cuatro estaciones de interlock, tablero de estado y estación de primera pieza.
- **Calidad:** estación metrológica, gabinete, pedestal de patrón, bancos M-01/M-02/M-03, terminales de bloqueo y área de aislamiento.

Cada collider del perfil tiene ID y `debugLabel`, por lo que puede inspeccionarse con F3. Los radios de interacción permanecen accesibles desde el lado caminable de cada equipo.

## 2. Animación y combate KayKit

El protagonista definitivo usa el rig KayKit cargado por `RiggedCharacterLibrary` y controlado por `RiggedHeroAnimator`.

Locomoción:
- idle;
- walk;
- run.

Acciones one-shot:
- interact;
- pickup;
- scan;
- drop;
- **attack**.

El clip de combate se resuelve primero por nombres conocidos (`Punch`, `Unarmed_Attack`, `Attack`, etc.) y después por búsqueda semántica del nombre del clip. El ataque se clona como acción independiente, se reproduce una sola vez y hace crossfade de regreso a la locomoción. Si una variante del personaje no contiene un clip compatible, se conserva `interact` como fallback seguro.

`Space` activa el golpe cuando el jugador no transporta un objeto; cuando transporta un objeto ambiental conserva la lógica de lanzamiento.

## 3. Integridad de pivotes funcionales

`KayKitEnvironmentLibrary` trata todos los GLTF de entorno como **decoración**, nunca como autoridad de gameplay.

Para vestir una puerta, palanca, botón u otro mecanismo se debe usar `attachDecoration(functionalPivot, assetId, placement)`. El método:

1. conserva el objeto/pivote funcional original;
2. no reemplaza su referencia en el registro de interacción;
3. no altera su relación con collider/estado;
4. crea un `V8_DECORATION_SLOT_*` hijo;
5. monta el GLTF únicamente dentro de ese slot visual.

Los clones llevan `userData.decorativeOnly = true` y el pivote se marca con `userData.functionalPivot = true`.

## 4. Debug F3

`DebugWorldOverlay` ya no reconstruye geometrías cada frame.

La implementación final mantiene pools por ID para:
- colliders;
- radios de interacción;
- zonas de combate.

Se reutilizan una `BoxGeometry` y una `CylinderGeometry` unitarias. En cada actualización solo cambian posición, escala y visibilidad. Esto elimina las asignaciones y `dispose()` continuos del debug anterior.

Colores:
- rojo: collider;
- cian: interacción;
- ámbar: zona de combate.

## 5. Inventario

`InventorySystem` mantiene los objetos de campo y cantidades. `I` abre un panel específico de inventario con:
- contador total;
- tarjetas por objeto;
- cantidad;
- descripción;
- iconografía contextual;
- estado vacío.

Se cierra con `I`, `Esc`, `Enter` o el botón de cierre.

## 6. Mundo y zonas

Arquitectura definitiva:

- `GameCore.ts`: orquestación de misión y estados.
- `World.ts`: punto de entrada público del mundo.
- `WorldEnvironmentCore.ts`: compositor/runtime definitivo.
- `CollisionSystem.ts`: resolución física del jugador.
- `WorldObjectRegistry.ts`: objetos interactivos tipados.
- `WorldInteractionSystem.ts`: pickups, contenedores, puertas, objetos rompibles y ataque.
- `InventorySystem.ts`: inventario persistente durante la sesión.
- `DebugWorldOverlay.ts`: depuración visual.
- `ZoneCollisionProfiles.ts`: auditoría final de colisiones de la vertical slice.
- `zones/*`: ownership visual y lógico por sector.

`WorldCore.ts` es legado y debe eliminarse una vez que el CI del runtime definitivo sea verde.

## 7. Controles de la vertical slice

| Control | Acción |
|---|---|
| WASD / flechas | Mover |
| Shift | Correr |
| E | Interactuar / levantar / colocar |
| F | Escáner EI |
| Q | Mapa |
| I | Inventario |
| Space | Golpe / lanzar objeto transportado |
| F3 | Debug de mundo |
| Esc | Cerrar modal |

## 8. Despliegue

`v8-build.yml` valida TypeScript/build y presupuesto de bundle.

`v8-pages.yml` publica `dist/` en GitHub Pages desde `feature/adventure-v8-rebuild`. El despliegue definitivo debe corresponder al HEAD que haya pasado el CI después de retirar el `WorldCore.ts` legado.
