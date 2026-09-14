import type { CauseToken, Choice, DialogueLine, InventoryItem, IshikawaCategory, RoleId, ZoneId } from './types';

export const BRAND = {
  blue: '#0B5EA8',
  yellow: '#F4C542',
  navy: '#071B2D',
  cyan: '#59C7FF',
  danger: '#FF5D5D',
  success: '#63D18A'
};

export const ROLE_META: Record<RoleId, { title: string; subtitle: string; perk: string }> = {
  inspector: {
    title: 'Inspector de Calidad',
    subtitle: 'Observación y verificación',
    perk: 'Las pistas de inspección resaltan durante más tiempo.'
  },
  analyst: {
    title: 'Analista de Causa Raíz',
    subtitle: 'Trazabilidad y análisis',
    perk: 'Recibe una pista adicional en el Ishikawa.'
  },
  engineer: {
    title: 'Ingeniero de Proceso',
    subtitle: 'Secuencia y control',
    perk: 'Tiene una tolerancia adicional en el puzzle de producción.'
  }
};

export const ZONE_META: Record<ZoneId, { name: string; short: string; accent: string }> = {
  control: { name: 'Centro de Control EI', short: 'CONTROL', accent: '#59C7FF' },
  warehouse: { name: 'Almacén y Trazabilidad', short: 'ALMACÉN', accent: '#F4C542' },
  production: { name: 'Producción', short: 'PRODUCCIÓN', accent: '#77D6A3' },
  quality: { name: 'Laboratorio de Calidad', short: 'CALIDAD', accent: '#8DB8FF' },
  dispatch: { name: 'Despacho', short: 'DESPACHO', accent: '#FFB36B' },
  capa: { name: 'Sala CAPA', short: 'CAPA', accent: '#C49BFF' }
};

export const OPENING_DIALOGUE: DialogueLine[] = [
  {
    speaker: 'CENTRO DE CONTROL EI',
    role: 'Sistema de incidentes',
    text: 'Incidente NC-26-0914. El cliente reporta que recibió 24 conjuntos CT-48 revisión A, pero su pedido original especifica revisión B.'
  },
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Líder de investigación',
    text: 'No busques culpables. Reconstruye la trazabilidad completa: pedido, orden de trabajo, material, producción, inspección y despacho.'
  },
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Líder de investigación',
    text: 'Cada área tiene una parte de la historia. Habla con las personas, inspecciona físicamente el entorno y conserva sólo las evidencias que puedas sostener.'
  }
];

export const NPC_DIALOGUES: Record<string, DialogueLine[]> = {
  warehouseChief: [
    {
      speaker: 'MATEO · ALMACÉN',
      role: 'Coordinador de almacén',
      text: 'Nosotros alistamos contra la OT liberada. El lote L-0908-A coincidía con la referencia que decía el sistema. Revisa las etiquetas antes de concluir que aquí nació el error.'
    }
  ],
  operator: [
    {
      speaker: 'ANDRÉS · PRODUCCIÓN',
      role: 'Operario líder',
      text: 'Fabricamos exactamente la revisión que decía la OT. Antes de iniciar hicimos set-up, material y primera pieza. Si quieres entender el flujo, activa las estaciones en el orden real del proceso.'
    }
  ],
  qualityTech: [
    {
      speaker: 'DANIELA · CALIDAD',
      role: 'Inspectora',
      text: 'Las dimensiones salieron conformes contra el plano asociado a la OT. El punto débil fue documental: nadie contrastó la revisión de la OT contra el pedido original del cliente.'
    }
  ],
  dispatcher: [
    {
      speaker: 'CAMILO · DESPACHO',
      role: 'Despachos',
      text: 'La remisión y el físico coincidían. Cuando recibimos el producto, toda la cadena documental ya decía revisión A. Aquí detectamos tarde el problema porque el cliente comparó contra su pedido.'
    }
  ],
  capaLead: [
    {
      speaker: 'LAURA · CALIDAD',
      role: 'Líder de investigación',
      text: 'Ya tienes el mapa causal. Ahora separa contención de acción correctiva. Contener resuelve el incidente de hoy; la CAPA debe impedir que el sistema permita repetirlo mañana.'
    }
  ]
};

export const INVENTORY: Record<string, InventoryItem> = {
  customerOrder: {
    id: 'customerOrder',
    title: 'Pedido del cliente',
    category: 'document',
    code: 'PC-45817',
    description: 'CT-48 · Revisión B · 24 unidades · prioridad crítica.'
  },
  workOrder: {
    id: 'workOrder',
    title: 'Orden de trabajo',
    category: 'document',
    code: 'OT-260914-017',
    description: 'CT-48 · Revisión A · generada desde OT_BASE_2025_v3.'
  },
  inspection: {
    id: 'inspection',
    title: 'Registro de inspección',
    category: 'evidence',
    code: 'CAL-FT-021',
    description: 'Dimensional conforme. No registra verificación pedido–OT ni revisión documental cruzada.'
  },
  dispatch: {
    id: 'dispatch',
    title: 'Remisión de despacho',
    category: 'evidence',
    code: 'REM-7784',
    description: '24 unidades CT-48 Rev. A. Coincide con OT, no con pedido original.'
  },
  qualitySeal: {
    id: 'qualitySeal',
    title: 'Sello de investigación',
    category: 'key',
    description: 'Autoriza el acceso a la sala de análisis causal y CAPA.'
  },
  scanner: {
    id: 'scanner',
    title: 'Escáner de trazabilidad',
    category: 'tool',
    description: 'Permite registrar etiquetas de lote y contrastarlas con la OT.'
  }
};

export const LOTS = [
  { id: 'L-0908-A', ref: 'CT-48 Rev. A', status: 'liberado', correctForOT: true },
  { id: 'L-0908-B', ref: 'CT-48 Rev. B', status: 'retenido', correctForOT: false },
  { id: 'L-0906-C', ref: 'CT-44 Rev. C', status: 'liberado', correctForOT: false }
];

export const PRODUCTION_ORDER = ['ot', 'material', 'setup', 'first-piece'];
export const PRODUCTION_STATIONS: Record<string, { title: string; hint: string }> = {
  ot: { title: '1 · Liberar OT', hint: 'El proceso no debe iniciar sin una orden vigente y liberada.' },
  material: { title: '2 · Verificar material', hint: 'Contrasta lote y referencia antes de consumir material.' },
  setup: { title: '3 · Configurar proceso', hint: 'Ajusta equipo, herramientas y parámetros contra la OT.' },
  'first-piece': { title: '4 · Primera pieza', hint: 'Valida el primer resultado antes de continuar el lote.' }
};

export const CAUSES: CauseToken[] = [
  {
    id: 'obsolete-template',
    title: 'Plantilla obsoleta disponible',
    category: 'Método',
    description: 'La OT se creó desde una plantilla antigua que aún podía seleccionarse.'
  },
  {
    id: 'lot-correct-to-ot',
    title: 'Lote correcto respecto a la OT',
    category: 'Material',
    description: 'El material seleccionado coincidía con la OT, por lo que no es la causa raíz.'
  },
  {
    id: 'erp-no-block',
    title: 'ERP sin bloqueo de revisión',
    category: 'Máquina',
    description: 'El sistema no compara automáticamente revisión del pedido y revisión de la OT.'
  },
  {
    id: 'manual-transcription',
    title: 'Transcripción manual',
    category: 'Mano de obra',
    description: 'El usuario pudo copiar una revisión incorrecta sin una segunda validación.'
  },
  {
    id: 'no-cross-check',
    title: 'Sin verificación pedido–OT',
    category: 'Medición',
    description: 'La inspección dimensional no incluía un control de coherencia documental.'
  },
  {
    id: 'rush-pressure',
    title: 'Pedido crítico con presión de tiempo',
    category: 'Entorno',
    description: 'La urgencia redujo la probabilidad de detectar una inconsistencia antes de liberar producción.'
  }
];

export const ISHIKAWA_CATEGORIES: IshikawaCategory[] = ['Método', 'Material', 'Máquina', 'Mano de obra', 'Medición', 'Entorno'];

export const FIVE_WHYS: Array<{
  question: string;
  choices: Choice[];
  correct: string;
  explanation: string;
}> = [
  {
    question: '1. ¿Por qué el cliente recibió CT-48 revisión A en lugar de revisión B?',
    choices: [
      { id: 'a', text: 'Porque producción fabricó revisión A.' },
      { id: 'b', text: 'Porque despacho cambió la referencia.' },
      { id: 'c', text: 'Porque el cliente cambió de opinión.' }
    ],
    correct: 'a',
    explanation: 'Producción fabricó A porque era la revisión liberada en la OT.'
  },
  {
    question: '2. ¿Por qué producción fabricó revisión A?',
    choices: [
      { id: 'a', text: 'Porque la OT-260914-017 especificaba revisión A.' },
      { id: 'b', text: 'Porque faltaba material revisión B.' },
      { id: 'c', text: 'Porque el operario eligió al azar.' }
    ],
    correct: 'a',
    explanation: 'El proceso siguió la OT. El siguiente porqué debe explicar cómo la OT quedó incorrecta.'
  },
  {
    question: '3. ¿Por qué la OT especificaba revisión A si el pedido decía revisión B?',
    choices: [
      { id: 'a', text: 'Porque se generó desde una plantilla obsoleta y el dato se transcribió manualmente.' },
      { id: 'b', text: 'Porque la referencia B no existe.' },
      { id: 'c', text: 'Porque almacén cambió la OT.' }
    ],
    correct: 'a',
    explanation: 'La plantilla antigua introdujo una condición de error reproducible.'
  },
  {
    question: '4. ¿Por qué esa inconsistencia no fue detectada antes de producir?',
    choices: [
      { id: 'a', text: 'Porque no existía un control obligatorio pedido–OT ni un bloqueo automático por revisión.' },
      { id: 'b', text: 'Porque el turno era de mañana.' },
      { id: 'c', text: 'Porque la remisión aún no estaba creada.' }
    ],
    correct: 'a',
    explanation: 'El sistema permitía liberar una OT documentalmente incoherente.'
  },
  {
    question: '5. ¿Cuál es entonces la causa raíz sistémica?',
    choices: [
      { id: 'a', text: 'Falta de cuidado del operario.' },
      { id: 'b', text: 'Control de versiones y validación pedido–OT insuficientes en el proceso de liberación.' },
      { id: 'c', text: 'Error de despacho.' }
    ],
    correct: 'b',
    explanation: 'La causa raíz está en el diseño del proceso: documentos obsoletos accesibles y ausencia de una verificación obligatoria.'
  }
];

export const CAPA_CHOICES: Choice[] = [
  {
    id: 'training',
    text: 'Recordar al personal que debe tener más cuidado.',
    detail: 'Sensibilización sin cambiar el mecanismo que permitió el error.'
  },
  {
    id: 'final-inspection',
    text: 'Aumentar únicamente la inspección final.',
    detail: 'Detecta tarde y no evita que la OT incorrecta sea liberada.'
  },
  {
    id: 'systemic',
    text: 'Retirar plantillas obsoletas, controlar versiones y bloquear la liberación de OT si la revisión no coincide con el pedido.',
    detail: 'Actúa directamente sobre la causa y previene recurrencia.'
  }
];
