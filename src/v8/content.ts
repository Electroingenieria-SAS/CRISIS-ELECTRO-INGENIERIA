import type { ZoneId } from './types';

export const ZONES: Record<ZoneId, { name: string; short: string; accent: string; center: [number, number] }> = {
  control: { name: 'Centro de Control', short: 'CONTROL', accent: '#61C6F2', center: [0, 0] },
  warehouse: { name: 'Recepción y Almacén', short: 'ALMACÉN', accent: '#F4C542', center: [-34, 10] },
  production: { name: 'Producción', short: 'PRODUCCIÓN', accent: '#55B985', center: [-24, -27] },
  quality: { name: 'Laboratorio de Calidad', short: 'CALIDAD', accent: '#7EB7FF', center: [24, -28] },
  maintenance: { name: 'Mantenimiento y SST', short: 'MANTENIMIENTO', accent: '#E8984A', center: [39, 5] },
  dispatch: { name: 'Despacho', short: 'DESPACHO', accent: '#FFB36B', center: [0, 35] },
  capa: { name: 'Centro CAPA', short: 'CAPA', accent: '#AE8CE8', center: [38, 35] }
};

export const STORY = [
  {
    title: 'OPERACIÓN AURORA',
    body: 'Un cliente detuvo la puesta en servicio de un suministro crítico. La referencia física no coincide con la revisión aprobada y la trazabilidad no permite explicar todavía dónde se originó la desviación.'
  },
  {
    title: 'TU MISIÓN',
    body: 'Reconstruye el flujo completo. No busques culpables: busca evidencia. Cada área contiene una parte del sistema y cada herramienta abre una forma distinta de investigar.'
  },
  {
    title: 'REGLA DE INVESTIGACIÓN',
    body: 'Pedido → recepción → producción → medición → mantenimiento → despacho → CAPA. La misión termina únicamente cuando una acción correctiva controla la causa y puede verificarse.'
  }
];

export const WAREHOUSE_SCANS: Record<string, { title: string; detail: string; result: string }> = {
  'pallet-a': { title: 'Pallet A · L-0908-A', detail: 'CT-48 Rev. B · COA vigente · 24 unidades', result: 'Conforme para el pedido investigado.' },
  'pallet-b': { title: 'Pallet B · L-0908-B', detail: 'CT-48 Rev. A · COA vigente · 24 unidades', result: 'Revisión incompatible con el pedido: requiere cuarentena.' },
  'pallet-c': { title: 'Pallet C · L-0906-C', detail: 'CT-47 Rev. C · COA vigente · 12 unidades', result: 'Otro producto. No pertenece al pedido investigado.' }
};

export const GAUGE_READINGS: Record<string, { name: string; reading: string; error: string; conforming: boolean }> = {
  'gauge-1': { name: 'Banco M-01', reading: '50,02 mm', error: '+0,02 mm', conforming: true },
  'gauge-2': { name: 'Banco M-02', reading: '49,93 mm', error: '-0,07 mm', conforming: false },
  'gauge-3': { name: 'Banco M-03', reading: '50,01 mm', error: '+0,01 mm', conforming: true }
};

export const LOTO_ORDER = ['loto-stop', 'loto-isolate', 'loto-lock', 'loto-zero'];

export const CAPA_OPTIONS: Record<string, { label: string; detail: string; correct: boolean }> = {
  'capa-a': { label: 'Recordatorio al personal', detail: 'Reforzar verbalmente la atención al diligenciar referencias.', correct: false },
  'capa-b': { label: 'Control sistémico de versión', detail: 'Retirar plantillas obsoletas, controlar versiones y bloquear liberación sin validación Pedido ↔ OT.', correct: true },
  'capa-c': { label: 'Más inspección final', detail: 'Incrementar muestreo al final sin cambiar el origen documental.', correct: false }
};
