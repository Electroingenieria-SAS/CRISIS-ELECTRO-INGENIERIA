# Operación Aurora V6 — Dirección premium

## Visión

**Operación Aurora** es una aventura 3D original de Electroingeniería S.A.S. cuyo lenguaje de juego se apoya en exploración, descubrimiento, herramientas, gating, puzzles ambientales, lectura espacial y recompensas opcionales. La referencia de calidad es el nivel de claridad y pulido de una aventura premium; no se copian personajes, mapas, nombres, interfaces, música, assets ni puzzles de Nintendo.

La fantasía del jugador es: **soy un ingeniero-investigador que recorre una planta viva, reúne evidencia, manipula objetos físicos y reconstruye una desviación hasta cerrar una CAPA defendible**.

## Pilares de diseño

1. **El mundo enseña.** Señalización, color, silueta y arquitectura deben explicar dónde estoy y qué puedo hacer antes que un texto flotante.
2. **La calidad se juega.** Trazabilidad, metrología, LOTO, liberación, causa raíz y CAPA se expresan mediante acciones dentro del mundo, no mediante cuestionarios aislados.
3. **Herramientas abren posibilidades.** El Escáner EI, patrones, sellos y evidencias funcionan como capacidades de aventura que habilitan nuevas lecturas/interacciones.
4. **Camino crítico + curiosidad.** La misión principal siempre es comprensible, pero explorar debe revelar evidencia secundaria, puntuación, lore operativo y recompensas.
5. **Identidad EI.** Azul, amarillo, acero, vidrio, señalización industrial, EPP y lenguaje técnico reemplazan cualquier estética medieval o genérica.
6. **Pulido antes que cantidad.** Una interacción debe tener animación, sonido, feedback y lógica antes de multiplicarse por veinte.

## Sistemas V6

- Campus industrial abierto heredado de V4/V5.
- Art pass PBR / cielo / iluminación / assets GLB CC0 de V5.
- Postprocesado sutil con bloom restringido a elementos emisivos.
- Dron compañero EI que aparece al obtener el escáner.
- Pulso de escaneo con `F` para localizar señales secundarias sin convertirlas en marcadores permanentes.
- Cinco gabinetes/lockers opcionales con apertura animada y evidencia secundaria.
- Recompensa `Sello · Explorador Sistémico` al completar los cinco hallazgos.
- Vehículos/logística real para reforzar escala del campus.
- Vapor, iluminación de zona, hitos y señalización física para mejorar profundidad y orientación.

## Campaña

### Prólogo — Incidente Aurora
El cliente detiene una puesta en servicio. La investigación debe seguir la cadena real de evidencia, no buscar culpables.

### Capítulo I — Recepción / Almacén
Clasificar físicamente entradas conformes y no conformes mediante revisión, lote y COA.

### Capítulo II — Producción
Restaurar la lógica de interlocks antes de validar la primera pieza.

### Capítulo III — Calidad / Metrología
Transportar un patrón maestro, comparar errores de medición y retirar el instrumento no conforme.

### Capítulo IV — Mantenimiento / SST
Ejecutar LOTO conservando el orden y verificando energía cero.

### Capítulo V — Despacho
Construir físicamente el pallet correcto respetando serial y posición.

### Capítulo final — CAPA
Conectar evidencia transversal y seleccionar una intervención sistémica cuya eficacia pueda verificarse.

## Regla para puzzles futuros

Cada puzzle nuevo debe responder cinco preguntas:

1. ¿Qué proceso real representa?
2. ¿Qué observa el jugador antes de actuar?
3. ¿Qué manipula físicamente?
4. ¿Qué estado del mundo cambia al resolverlo?
5. ¿Qué nueva capacidad, ruta o conocimiento obtiene?

Si la única respuesta es «elige una opción en una ventana», el puzzle necesita otra iteración.

## Dirección visual

- 3D estilizado de alta legibilidad, no fotorrealismo inconsistente.
- Materiales industriales: acero pintado, concreto, vidrio, plástico técnico, caucho, pintura de seguridad.
- Luz natural clara en exteriores y pools de luz diferenciados por área.
- Emisivos controlados: indicadores, scanners, balizas y señalización; evitar estética cyberpunk.
- Props repetidos mediante instancing cuando sea posible.
- Siluetas grandes y landmarks visibles entre zonas.
- Props pequeños sólo cuando apoyen navegación, historia o credibilidad operativa.

## Personajes

Objetivo del siguiente character pass:

- protagonista ingeniero con rig humanoide y animaciones completas;
- PPE diferenciado por rol;
- idle contextual por oficio;
- caminar/correr/cargar/colocar/escanear/operar/inspeccionar/señalar/hablar;
- NPCs que miran al jugador durante conversación y retoman una rutina de trabajo al terminar;
- mantener escala, paleta y nivel de detalle coherentes con el campus.

## Fuentes visuales y licencias

V6 prioriza material CC0 y fuentes verificables. El nuevo set logístico usa modelos del repositorio oficial `KenneyNL/Starter-Kit-Racing` fijado al commit `2f2e5f2646dda89cb21d4e8539bab60c6e955dc8`; sus modelos/sonidos se distribuyen como CC0 según la documentación del proyecto. V5 mantiene su matriz de procedencia en `docs/ASSET_PROVENANCE_V5.md`.

## Criterio de release

Una V6 se considera candidata a producción sólo si:

- compila en Vercel;
- no rompe movimiento, colisiones ni puzzles V4;
- los assets decorativos tienen fallback;
- onboarding, objetivo y salida del primer capítulo son comprensibles sin explicación externa;
- cada área tiene landmark, feedback y sonido;
- la ruta principal se completa sin depender de los hallazgos opcionales;
- el preview recibe una prueba manual antes de promoverse a `main`.
