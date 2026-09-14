import type { DialogueLine, ZoneId } from './types';
import type { CinematicSequence } from './CinematicDirector';

export const OPENING_CINEMATIC: CinematicSequence = {
  id: 'opening',
  skippable: true,
  shots: [
    {
      duration: 3.8,
      position: [-41, 13, 18],
      target: [-12, 0.8, 0],
      kicker: 'ELECTROINGENIERÍA S.A.S. · 14 SEPTIEMBRE 2026',
      title: '07:42 A. M. · LA LLAMADA',
      caption: 'Una entrega prioritaria acaba de convertirse en una no conformidad crítica. El cliente recibió 24 conjuntos CT-48 Revisión A. Su pedido exigía Revisión B.'
    },
    {
      duration: 3.4,
      position: [-22, 7.5, 12],
      target: [-13, 0.8, 0],
      kicker: 'ÁREA 01 · ALMACÉN',
      title: 'EL MATERIAL TIENE MEMORIA',
      caption: 'Tres lotes permanecen en bodega. Uno alimentó la orden liberada. Las etiquetas dirán si el error nació en el material… o llegó desde antes.'
    },
    {
      duration: 3.4,
      position: [-2, 7.8, 12],
      target: [4, 0.7, 0],
      kicker: 'ÁREA 02 · PRODUCCIÓN',
      title: 'SE FABRICÓ LO QUE DECÍA LA OT',
      caption: 'La línea siguió una secuencia controlada. Tu trabajo será reconstruirla y comprobar si producción desobedeció el proceso o ejecutó correctamente una instrucción equivocada.'
    },
    {
      duration: 3.6,
      position: [19, 8.6, 13],
      target: [24, 0.8, 0],
      kicker: 'ÁREA 03 · CALIDAD',
      title: 'UNA PIEZA PUEDE ESTAR BIEN… Y EL PEDIDO MAL',
      caption: 'Las dimensiones fueron conformes contra el plano asociado a la OT. El laboratorio contiene las causas que explican por qué nadie detectó la inconsistencia documental.'
    },
    {
      duration: 3.3,
      position: [39, 7.3, 11],
      target: [43, 0.7, 0],
      kicker: 'ÁREA 04 · DESPACHO',
      title: 'CONTENER ANTES DE CORREGIR',
      caption: 'El incidente sigue vivo mientras exista saldo por liberar. Antes de hablar de causa raíz tendrás que proteger al cliente y preservar la evidencia.'
    },
    {
      duration: 3.7,
      position: [56, 8.8, 13],
      target: [60, 0.8, 0],
      kicker: 'ÁREA 05 · CAPA',
      title: 'LA CAUSA RAÍZ NO ES UNA PERSONA',
      caption: 'La misión termina sólo cuando conviertas evidencia en una acción sistémica y definas cómo demostrarás que el problema no vuelve a ocurrir.'
    },
    {
      duration: 4.2,
      position: [-35, 6.6, 9.5],
      target: [-29, 1.25, 0],
      kicker: 'OPERACIÓN TRAZABILIDAD',
      title: 'TU TURNO',
      caption: 'Investiga. Contrasta. No adivines. Cada puerta exige evidencia del área anterior. La puntuación premia decisiones técnicamente defendibles, no velocidad ciega.'
    }
  ]
};

export const PROLOGUE_BRIEFING: DialogueLine[] = [
  {
    speaker: 'SISTEMA EI',
    role: 'Protocolo de incidentes',
    text: 'Se abre el expediente NC-26-0914. La referencia maestra será siempre el pedido original del cliente. Todo lo demás debe contrastarse contra él.'
  },
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Líder de investigación',
    text: 'No vayas buscando al culpable. Quiero una cadena de evidencia: qué pidió el cliente, qué liberó la OT, qué lote se consumió, qué fabricó producción, qué verificó Calidad y qué salió por Despachos.'
  },
  {
    speaker: 'LAURA · CALIDAD',
    role: 'Líder de investigación',
    text: 'Cuando una zona se abra, primero observa el entorno y habla con su responsable. Después usa terminales, etiquetas y estaciones. Si una conclusión no puede sostenerse con evidencia, el sistema la penalizará.'
  },
  {
    speaker: 'SISTEMA EI',
    role: 'Controles',
    text: 'W o ↑ siempre mueven hacia la parte superior de la pantalla. S o ↓ hacia abajo. A/D izquierda y derecha. E interactúa. I abre el expediente. Q abre el plano. Mantén Shift para correr.'
  }
];

export const CHAPTER_CINEMATICS: Partial<Record<ZoneId, CinematicSequence>> = {
  warehouse: {
    id: 'chapter-warehouse',
    skippable: true,
    shots: [
      {
        duration: 3.2,
        position: [-22, 5.8, 9.8],
        target: [-15, 0.8, 0],
        kicker: 'CAPÍTULO I · ALMACÉN',
        title: 'SIGUE EL LOTE',
        caption: 'Objetivo: habla con Mateo, retira el escáner, registra las tres estibas y demuestra qué lote correspondía a la OT liberada.'
      },
      {
        duration: 2.6,
        position: [-11, 5.1, -7.5],
        target: [-13, 0.9, 1.2],
        kicker: 'REGLA DE INVESTIGACIÓN',
        title: 'NO CONFUNDAS “CORRECTO PARA LA OT” CON “CORRECTO PARA EL CLIENTE”',
        caption: 'El almacén puede haber ejecutado correctamente una orden documentalmente incorrecta. Tu conclusión debe distinguir esas dos cosas.'
      }
    ]
  },
  production: {
    id: 'chapter-production',
    skippable: true,
    shots: [
      {
        duration: 3.0,
        position: [-3, 6.2, 10.8],
        target: [5, 0.8, 0],
        kicker: 'CAPÍTULO II · PRODUCCIÓN',
        title: 'RECONSTRUYE EL PROCESO',
        caption: 'Objetivo: habla con Andrés y activa las cuatro estaciones en el orden operativo real. Una secuencia incorrecta reinicia el análisis.'
      },
      {
        duration: 2.8,
        position: [9, 5.2, -7.8],
        target: [4.5, 0.7, 0],
        kicker: 'PREGUNTA CLAVE',
        title: '¿PRODUCCIÓN CREÓ EL ERROR O LO HEREDÓ?',
        caption: 'No basta con saber qué se fabricó. Debes determinar qué información estaba vigente cuando se liberó el trabajo.'
      }
    ]
  },
  quality: {
    id: 'chapter-quality',
    skippable: true,
    shots: [
      {
        duration: 3.1,
        position: [15, 6.5, 11],
        target: [24, 0.8, 0],
        kicker: 'CAPÍTULO III · CALIDAD',
        title: 'CONSTRUYE EL MAPA CAUSAL',
        caption: 'Objetivo: encuentra seis tarjetas causales distribuidas en el laboratorio y llévalas a los pedestales del Ishikawa.'
      },
      {
        duration: 3.0,
        position: [30, 7.1, -10],
        target: [27, 0.9, 0],
        kicker: 'MÉTODO · MATERIAL · MÁQUINA · PERSONAS · MEDICIÓN · ENTORNO',
        title: 'CLASIFICAR NO ES CULPAR',
        caption: 'Una causa puede contribuir sin ser la causa raíz. El Ishikawa organiza el problema; los 5 Porqués decidirán qué condición sistémica permitió que atravesara toda la cadena.'
      }
    ]
  },
  dispatch: {
    id: 'chapter-dispatch',
    skippable: true,
    shots: [
      {
        duration: 3.1,
        position: [35, 5.9, 10],
        target: [43, 0.8, 0],
        kicker: 'CAPÍTULO IV · DESPACHO',
        title: 'DETÉN EL DAÑO',
        caption: 'Objetivo: revisa la remisión y ejecuta tres acciones de contención antes de continuar: bloquear saldo, gestionar cliente y preservar evidencia.'
      }
    ]
  },
  capa: {
    id: 'chapter-capa',
    skippable: true,
    shots: [
      {
        duration: 3.3,
        position: [52, 6.8, 11],
        target: [60, 0.8, 0],
        kicker: 'CAPÍTULO V · CAPA',
        title: 'CORRIGE EL SISTEMA',
        caption: 'Objetivo: selecciona una acción que ataque la causa raíz y define una verificación de eficacia que pueda demostrar, con datos, que el riesgo disminuyó.'
      },
      {
        duration: 2.8,
        position: [65, 5.4, -7.5],
        target: [60, 0.8, 0],
        kicker: 'CIERRE DE MISIÓN',
        title: 'CONTENER ≠ CORREGIR',
        caption: 'Reponer el pedido resuelve hoy. Eliminar plantillas obsoletas, controlar revisiones y bloquear liberaciones incoherentes evita mañana.'
      }
    ]
  }
};

export const CHAPTER_DIALOGUES: Partial<Record<ZoneId, DialogueLine[]>> = {
  warehouse: [
    { speaker: 'SISTEMA EI', role: 'Objetivo de capítulo', text: 'Tu entregable de esta zona es una conclusión defendible sobre el material: cuál lote fue usado y si Almacén incumplió o siguió la OT vigente.' }
  ],
  production: [
    { speaker: 'SISTEMA EI', role: 'Objetivo de capítulo', text: 'Reconstruye el orden operativo. Si producción siguió correctamente una OT incorrecta, el origen del incidente está aguas arriba.' }
  ],
  quality: [
    { speaker: 'LAURA · CALIDAD', role: 'Líder de investigación', text: 'Aquí quiero que dejes de seguir documentos y empieces a explicar el sistema. Reúne causas, clasifícalas y después profundiza hasta una condición controlable.' }
  ],
  dispatch: [
    { speaker: 'SISTEMA EI', role: 'Objetivo de capítulo', text: 'Antes de continuar el análisis debes contener el incidente. Ninguna investigación está completa si el mismo producto puede seguir saliendo mientras la causa se estudia.' }
  ],
  capa: [
    { speaker: 'LAURA · CALIDAD', role: 'Líder de investigación', text: 'La acción que elijas debe cambiar el mecanismo que permitió la falla. Después tendrás que decir cómo medirás su eficacia. Si no puede verificarse, no es un cierre sólido.' }
  ]
};
