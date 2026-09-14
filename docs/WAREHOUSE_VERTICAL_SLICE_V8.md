# V8 · Vertical Slice — Recepción / Almacén

Esta zona es el primer sector reconstruido bajo la regla V8: **reemplazar, no superponer**.

## Flujo jugable

1. Recibir el briefing de Calidad.
2. Obtener el Escáner EI.
3. Entrar a Recepción/Almacén y hablar con Mateo.
4. Revisar el expediente PO-AUR-2417 / REC-0914.
5. Auditar físicamente Pallet A, B y C con el escáner.
6. Interpretar referencia, revisión, cantidad y COA sin que la UI entregue la conclusión.
7. Elegir físicamente uno de los tres pallets.
8. Transportarlo a la jaula de CUARENTENA.
9. Si la decisión es incorrecta, penalizar y devolver el pallet a su puesto de inspección.
10. Si se segrega CT-48 Rev. A (Pallet B), cerrar trazabilidad de entrada y habilitar Producción.

## Dirección espacial

El sector incluye un único escenario funcional: tres muelles, mesa documental, racks con colisión, carril de inspección, tres posiciones de pallet, jaula de cuarentena, montacargas estático, señalización y flujo peatonal. No existe un escenario anterior renderizado debajo.

## Rendimiento

- Sin postprocesado.
- Sin assets remotos en runtime.
- Sin físicas generales.
- Materiales y geometrías simples reutilizables.
- Una sola animación ambiental ligera: baliza del montacargas.
- Iluminación y sombras heredadas del presupuesto global V8.

## Criterio para las siguientes áreas

Producción, Calidad, Mantenimiento, Despacho y CAPA deben reconstruirse con el mismo patrón: módulo propietario de zona, una mecánica principal clara, evidencia previa, decisión física y sustitución completa del prototipo anterior.
