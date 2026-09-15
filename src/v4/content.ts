import type { Choice, DialogueLine } from '../v3/types';
import type { CinematicSequence } from '../v3/CinematicDirector';

export const V4_OPENING: CinematicSequence = {
  id: 'v4-opening',
  skippable: true,
  shots: [
    {
      duration: 4.2,
      position: [-4, 18, 32],
      target: [0, 0, 0],
      kicker: 'ELECTROINGENIERÍA S.A.S. · SIMULACRO OPERATIVO',
      title: 'PROYECTO AURORA',
      caption: '07:18. El cliente detiene la puesta en servicio: una entrega crítica presenta inconsistencias de revisión, trazabilidad y control metrológico. No hay una única respuesta. Hay que reconstruir el sistema.'
    },
    {
      duration: 3.5,
      position: [-44, 11, 18],
      target: [-36, 0, 8],
      kicker: 'MUELLE DE RECEPCIÓN',
      title: 'LO QUE ENTRA DEFINE LO QUE PUEDE SALIR',
      caption: 'Tres contenedores llegaron del proveedor. Sólo uno debe entrar al proceso. Tendrás que escanearlos, moverlos y decidir físicamente cuál se libera y cuál va a cuarentena.'
    },
    {
      duration: 3.5,
      position: [-16, 13, -43],
      target: [-7, 0, -35],
      kicker: 'PRODUCCIÓN',
      title: 'UN PROCESO CONTROLADO TIENE INTERLOCKS',
      caption: 'La línea no debe arrancar por memoria. El tablero de control exige restaurar una lógica de cuatro interlocks antes de habilitar la primera pieza.'
    },
    {
      duration: 3.6,
      position: [35, 12, -34],
      target: [34, 0, -20],
      kicker: 'LABORATORIO DE CALIDAD',
      title: 'MEDIR NO ES LO MISMO QUE CONFIAR',
      caption: 'Tres instrumentos reportan resultados distintos. Usa patrones maestros, compara el error y retira del servicio el equipo que no puede sostener la inspección.'
    },
    {
      duration: 3.3,
      position: [48, 11, 20],
      target: [38, 0, 20],
      kicker: 'MANTENIMIENTO Y SST',
      title: 'ENERGÍA CERO ANTES DE INTERVENIR',
      caption: 'Una alarma de equipo obliga a aplicar una secuencia LOTO. El orden importa: parar, aislar, bloquear y verificar.'
    },
    {
      duration: 3.5,
      position: [9, 12, 48],
      target: [5, 0, 36],
      kicker: 'DESPACHO',
      title: 'LA TRAZABILIDAD TERMINA EN EL CLIENTE',
      caption: 'El pallet final debe cargarse por serial y revisión. Tendrás que transportar cajas reales a posiciones concretas y validar el conjunto antes de liberar.'
    },
    {
      duration: 4.3,
      position: [48, 15, 50],
      target: [43, 0, 42],
      kicker: 'CENTRO CAPA',
      title: 'LA MISIÓN NO TERMINA AL CONTENER',
      caption: 'Cada área entregará un sello de evidencia. El cierre exige integrarlos en un único mapa causal y demostrar una acción que cambie el sistema.'
    }
  ]
};

export const PROLOGUE: DialogueLine[] = [
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Directora de la investigación',
    text: 'El cliente no necesita que adivinemos quién falló. Necesita evidencia. Tu misión es recorrer la operación completa y separar ejecución, detección, contención y causa raíz.'
  },
  {
    speaker: 'SISTEMA EI',
    role: 'Protocolo de simulación',
    text: 'Cada zona tiene un reto físico. E permite hablar, tomar, accionar o colocar. Si llevas un objeto, acércate a una estación compatible y vuelve a pulsar E.'
  },
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Directora de la investigación',
    text: 'No todas las zonas están bloqueadas. Explora. Algunas herramientas obtenidas en una zona hacen visibles o utilizables mecanismos de otra, como en una investigación real.'
  }
];

export const ZONE_DIALOGUES: Record<string, DialogueLine[]> = {
  control: [
    { speaker: 'LAURA · CALIDAD', role: 'Control de Crisis', text: 'Empieza por Recepción. El proveedor entregó tres contenedores con etiquetas parecidas. Necesito saber cuál puede liberarse sin comprometer trazabilidad.' }
  ],
  warehouse: [
    { speaker: 'MATEO · ALMACÉN', role: 'Coordinador de Almacén', text: 'Aquí no basta leer una etiqueta desde lejos. Usa el escáner, revisa lote, revisión y estado. Después mueve físicamente el contenedor que deba quedar en cuarentena.' }
  ],
  production: [
    { speaker: 'ANDRÉS · PRODUCCIÓN', role: 'Líder de línea', text: 'El tablero quedó en un estado imposible tras una intervención. Cada pulsador cambia su propio interlock y el adyacente. Déjalos todos verdes y valida la primera pieza.' }
  ],
  quality: [
    { speaker: 'DANIELA · CALIDAD', role: 'Metrología', text: 'Tenemos tres equipos y un patrón maestro de 50,00 mm. Lleva el patrón a cada bancada. El instrumento cuyo error supere ±0,05 mm no puede usarse para liberar producto.' }
  ],
  maintenance: [
    { speaker: 'SERGIO · MANTENIMIENTO', role: 'Mantenimiento / SST', text: 'Antes de tocar el equipo aplica LOTO. La secuencia correcta es parte del control: detener, aislar, bloquear-etiquetar y verificar energía cero.' }
  ],
  dispatch: [
    { speaker: 'CAMILO · DESPACHO', role: 'Despachos', text: 'Hay cuatro cajas para un pallet de cliente. Cada posición exige un serial concreto. Cárgalas una por una y no liberes hasta que el lector confirme revisión y secuencia.' }
  ],
  capa: [
    { speaker: 'LAURA · CALIDAD', role: 'Mejora Continua', text: 'Trae los sellos de cada área. El centro CAPA no acepta opiniones: sólo evidencia que ya superó una prueba operativa.' }
  ]
};

export const RECEIVING_ITEMS = [
  { id: 'mat-a', label: 'Contenedor L-260914-A', ref: 'MC-17 Rev. C', coa: 'COA válido', disposition: 'release' },
  { id: 'mat-b', label: 'Contenedor L-260914-B', ref: 'MC-17 Rev. B', coa: 'COA válido', disposition: 'quarantine' },
  { id: 'mat-c', label: 'Contenedor L-260914-C', ref: 'MC-17 Rev. C', coa: 'COA ausente', disposition: 'quarantine' }
] as const;

export const INTERLOCK_TARGET = [1, 1, 1, 1];
export const INTERLOCK_START = [0, 1, 0, 1];

export const GAUGES = [
  { id: 'gauge-a', name: 'Comparador A', reading: 50.02, error: 0.02, conforming: true },
  { id: 'gauge-b', name: 'Comparador B', reading: 49.93, error: -0.07, conforming: false },
  { id: 'gauge-c', name: 'Comparador C', reading: 50.01, error: 0.01, conforming: true }
] as const;

export const LOTO_ORDER = ['stop', 'isolate', 'lock', 'verify'] as const;
export const LOTO_LABELS: Record<(typeof LOTO_ORDER)[number], string> = {
  stop: '1 · DETENER EQUIPO',
  isolate: '2 · AISLAR ENERGÍA',
  lock: '3 · BLOQUEAR + ETIQUETAR',
  verify: '4 · VERIFICAR ENERGÍA CERO'
};

export const DISPATCH_PACKAGES = [
  { id: 'pkg-001', label: 'SERIAL AUR-2401', slot: 'slot-a' },
  { id: 'pkg-002', label: 'SERIAL AUR-2402', slot: 'slot-b' },
  { id: 'pkg-003', label: 'SERIAL AUR-2403', slot: 'slot-c' },
  { id: 'pkg-004', label: 'SERIAL AUR-2404', slot: 'slot-d' }
] as const;

export const CAPA_CHOICES_V4: Choice[] = [
  {
    id: 'retrain',
    text: 'Capacitar nuevamente al personal y reforzar la atención.',
    detail: 'Puede ayudar, pero deja intactas las condiciones que permitieron la recurrencia.'
  },
  {
    id: 'inspect-more',
    text: 'Agregar una inspección final adicional a cada despacho.',
    detail: 'Añade detección tardía y costo; no corrige los controles de entrada, versión y metrología.'
  },
  {
    id: 'system',
    text: 'Integrar bloqueo de revisión/lote, estado metrológico y liberación de despacho en un flujo digital obligatorio.',
    detail: 'Convierte evidencias de varias áreas en controles preventivos y trazables.'
  }
];

export const V4_ASSET_RESEARCH = {
  architecture: [
    'Three64: inventario, eventos, navegación, audio y pipeline Blender.',
    'three-pathfinding: navegación por navmesh para NPC y agentes.',
    'Sky Isles: exploración amplia, coleccionables y puzzles ambientales.',
    'TetraForce / GOAT: gating de aventura, herramientas y estructura de misión.'
  ],
  art: [
    'Quaternius Universal Base Characters + Universal Animation Library (CC0).',
    'Kenney 3D packs (CC0) para props y señalización.',
    'Poly Haven / ambientCG (CC0) para materiales y HDRI cuando el pipeline los incorpore.'
  ]
};
