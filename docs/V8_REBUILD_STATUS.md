# Operación Aurora V8 — Estado de reconstrucción

V8 es la línea oficial de desarrollo. No se permiten art-passes superpuestos sobre versiones anteriores.

## Estado de la vertical slice

La integración funcional de **Almacén → Producción → Calidad** está cerrada a nivel de sistemas. El único gate restante antes de declarar el HEAD definitivo es CI + eliminación del `WorldCore.ts` legado + segundo CI + Pages.

## Arquitectura activa
- Runtime V8 independiente.
- `WorldEnvironmentCore.ts` como compositor/runtime definitivo.
- `World.ts` como punto de entrada público y capa de instalación de perfiles finales.
- Sistema único de input.
- Controlador de personaje con rig KayKit.
- Sistema único de colisiones.
- Registro/interacción tipada de objetos.
- UI, audio, inventario y debug independientes.
- Zonas reconstruidas como módulos con ownership visual y lógico.

## Almacén
- Muelles, racks, montacargas, control documental, inspección, cuarentena, gabinetes, luminarias y señalización comparten materiales, escala y lenguaje visual.
- Los pallets A/B/C se inspeccionan, interpretan y transportan físicamente.
- La evidencia del scanner no revela la respuesta; el jugador debe decidir la segregación correcta.
- Pasada final de colliders para estación de recepción, gabinetes, barreras y jaula de cuarentena.

## Producción
- La celda CT-48 reemplaza la antigua lectura de terminales abstractos por OT/set-up, interlocks, transportador, tablero de estado y primera pieza.
- Pasada final de colliders para estación de briefing, transportador, barreras, cuatro mecanismos, tablero y puesto de primera pieza.

## Calidad
- Patrón maestro transportable.
- Tres bancos metrológicos con lectura independiente.
- Decisión de retiro de equipo no conforme.
- Pasada final de colliders para control metrológico, patrón, bancos, terminales y aislamiento.

## Personaje y combate
- Ingeniero KayKit con casco, gafas opcionales, chaleco EI, uniforme industrial y scanner.
- Estados de locomoción: idle, walk y run.
- Acciones one-shot: interact, pickup, scan, drop y **attack**.
- `Space` reproduce un clip KayKit real de golpe/ataque cuando existe; `interact` queda únicamente como fallback.
- Crossfade limpio de la acción de combate hacia locomoción.

## Integridad de objetos funcionales
- Los GLTF de entorno se consideran decoración.
- `KayKitEnvironmentLibrary.attachDecoration()` monta la malla bajo un slot hijo sin sustituir el pivote funcional de puertas, palancas o botones.
- Se preservan referencias de interacción, collider, estado y transform del pivote.

## Inventario
- `I` abre una interfaz específica de inventario de campo.
- Contador total, tarjetas, cantidades, descripción e iconografía contextual.
- Cierre con `I`, `Esc`, `Enter` o botón.

## Debug y rendimiento
- Sin UnrealBloomPass.
- Sin postprocesado pesado.
- Pixel ratio limitado.
- Geometrías/materiales reutilizados donde es viable.
- F3 usa pools de meshes y geometrías unitarias: ya no reconstruye ni destruye geometría cada frame.
- GitHub Actions compila y aplica presupuesto de bundle antes de aceptar una iteración.

## Documentación
La arquitectura y contratos finales están documentados en `docs/V8_SYSTEMS.md`.

## Gate de cierre
1. Ejecutar `v8-build.yml` sobre esta integración.
2. Si es verde, eliminar `src/v8/WorldCore.ts` legado.
3. Ejecutar nuevamente CI sobre el HEAD sin legado.
4. Confirmar `v8-pages.yml` verde y validar el sitio publicado.

Solo después del punto 4 la vertical slice se considera desplegada definitivamente.
