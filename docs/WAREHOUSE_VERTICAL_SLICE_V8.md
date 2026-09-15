# V8 Vertical Slice — Recepción / Almacén

Esta zona define el estándar mínimo que deben alcanzar las demás áreas antes de reconstruirse.

## Flujo jugable
1. Briefing de Calidad.
2. Obtención del Escáner EI.
3. Entrada a Recepción / Almacén.
4. Conversación con Mateo.
5. Revisión del expediente PO-AUR-2417 / REC-0914.
6. Escaneo físico de Pallet A, B y C.
7. Interpretación del dato crudo.
8. Toma física del pallet elegido.
9. Traslado hasta la jaula de cuarentena.
10. Consecuencia inmediata de la decisión.

## Regla de diseño
El escenario no debe revelar la respuesta correcta por color, disponibilidad o bloqueo artificial. Todos los pallets son manipulables después de completar la investigación documental y física.

## Estándar visual
- Kit industrial compartido con geometrías y materiales consistentes.
- Racks, muelles, luminarias, montacargas, gabinetes, barreras, señalización y estación documental con escala común.
- Señalética renderizada como textura de Canvas local; no depende de recursos remotos.
- Props relevantes integrados al puzzle, no colocados como decoración encima de otra geometría.

## Estándar de animación
- El jugador es un ingeniero articulado.
- Idle, walk, run y carry son locomoción continua.
- Pickup, drop, scan e interact son acciones temporizadas separadas.
- Scanner visible en la mano durante la acción de lectura.

## Rendimiento
- Sin postprocesado pesado.
- Sin modelos remotos.
- Sombras limitadas a objetos que aportan lectura espacial.
- Materiales y geometrías reutilizados dentro del kit.
- CI aplica presupuesto de bundle y genera un artefacto `dist/` jugable.
