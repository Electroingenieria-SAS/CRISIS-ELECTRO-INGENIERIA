import * as THREE from 'three';
import type { AssetLibrary } from '../game/AssetLibrary';
import { CAPA_CHOICES, CAUSES, FIVE_WHYS, INVENTORY, ISHIKAWA_CATEGORIES, LOTS, NPC_DIALOGUES, PRODUCTION_ORDER, PRODUCTION_STATIONS, ZONE_META } from './content';
import type { AdventureAudio } from './Audio';
import type { AdventureUI } from './UI';
import type { Collider, GameProgress, Interactable, IshikawaCategory, PlayerProfile, ZoneId } from './types';

type Gate = {
  id: string;
  left: THREE.Mesh;
  right: THREE.Mesh;
  open: boolean;
  opening: boolean;
  collider: Collider;
};

type MixerEntry = { mixer: THREE.AnimationMixer; object: THREE.Object3D };

const DUNGEON = '/assets/kaykit/dungeon';
const CHARACTERS = '/assets/kaykit/characters';
const ANIMATIONS = '/assets/kaykit/animations';

export class AdventureWorld {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly interactables: Interactable[] = [];
  private gates = new Map<string, Gate>();
  private mixers: MixerEntry[] = [];
  private markerClock = 0;
  private finalizing = false;

  constructor(
    private scene: THREE.Scene,
    private assets: AssetLibrary,
    private ui: AdventureUI,
    private progress: GameProgress,
    private profile: PlayerProfile,
    private audio: AdventureAudio,
    private onFinish: () => void
  ) {
    this.scene.add(this.group);
  }

  async init(): Promise<void> {
    this.buildFacilityShell();
    await Promise.all([
      this.buildControlZone(),
      this.buildWarehouseZone(),
      this.buildProductionZone(),
      this.buildQualityZone(),
      this.buildDispatchZone(),
      this.buildCapaZone()
    ]);
    this.buildGates();
  }

  update(dt: number): void {
    this.markerClock += dt;
    for (const entry of this.mixers) entry.mixer.update(dt);

    for (const gate of this.gates.values()) {
      if (!gate.opening || gate.open) continue;
      gate.left.position.z = THREE.MathUtils.lerp(gate.left.position.z, -3.25, 1 - Math.exp(-dt * 5));
      gate.right.position.z = THREE.MathUtils.lerp(gate.right.position.z, 3.25, 1 - Math.exp(-dt * 5));
      if (Math.abs(gate.left.position.z + 3.25) < 0.04 && Math.abs(gate.right.position.z - 3.25) < 0.04) {
        gate.open = true;
        gate.opening = false;
      }
    }

    for (const item of this.interactables) {
      if (!item.marker) continue;
      const enabled = item.enabled ? item.enabled() : true;
      item.marker.visible = enabled;
      if (!enabled) continue;
      item.marker.position.y = 2.6 + Math.sin(this.markerClock * 2.8 + item.object.position.x * 0.13) * 0.16;
      item.marker.rotation.y += dt * 0.7;
    }
  }

  nearestInteractable(position: THREE.Vector3): Interactable | null {
    let nearest: Interactable | null = null;
    let nearestDistance = Infinity;
    for (const item of this.interactables) {
      if (item.enabled && !item.enabled()) continue;
      const distance = position.distanceTo(item.object.getWorldPosition(new THREE.Vector3()));
      if (distance <= item.radius && distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  zoneForPosition(position: THREE.Vector3): ZoneId {
    const x = position.x;
    if (x < -21) return 'control';
    if (x < -5) return 'warehouse';
    if (x < 13) return 'production';
    if (x < 35) return 'quality';
    if (x < 51) return 'dispatch';
    return 'capa';
  }

  private buildFacilityShell(): void {
    const zones: Array<[ZoneId, number, number, number]> = [
      ['control', -34, -22, 0x102a3d],
      ['warehouse', -20, -6, 0x2c2a21],
      ['production', -4, 12, 0x183126],
      ['quality', 14, 34, 0x1a2940],
      ['dispatch', 36, 50, 0x34261d],
      ['capa', 52, 68, 0x281f38]
    ];

    for (const [zone, fromX, toX, color] of zones) {
      const width = toX - fromX;
      const floor = this.box(width, 0.2, 18, color, (fromX + toX) / 2, -0.15, 0, false);
      floor.receiveShadow = true;
      const accent = new THREE.Color(ZONE_META[zone].accent).getHex();
      this.box(width - 1, 0.025, 0.12, accent, (fromX + toX) / 2, 0.02, -7.7, false);
      this.box(width - 1, 0.025, 0.12, accent, (fromX + toX) / 2, 0.02, 7.7, false);
      this.addFloorArrows(fromX + 2, toX - 2, accent);
    }

    // Exterior walls.
    this.box(104, 3.2, 0.45, 0x26323c, 17, 1.6, -9.4);
    this.box(104, 3.2, 0.45, 0x26323c, 17, 1.6, 9.4);
    this.box(0.45, 3.2, 19.2, 0x26323c, -35.2, 1.6, 0);
    this.box(0.45, 3.2, 19.2, 0x26323c, 69.2, 1.6, 0);
    this.colliders.push(
      { minX: -36, maxX: -34.7, minZ: -10, maxZ: 10 },
      { minX: 68.7, maxX: 70, minZ: -10, maxZ: 10 },
      { minX: -36, maxX: 70, minZ: -10, maxZ: -8.9 },
      { minX: -36, maxX: 70, minZ: 8.9, maxZ: 10 }
    );

    // Separators. The center is reserved for sliding gates.
    for (const x of [-21, -5, 13, 35, 51]) {
      this.box(0.45, 3.2, 7.2, 0x26323c, x, 1.6, -5.8);
      this.box(0.45, 3.2, 7.2, 0x26323c, x, 1.6, 5.8);
      this.colliders.push(
        { minX: x - 0.35, maxX: x + 0.35, minZ: -9.2, maxZ: -2.15 },
        { minX: x - 0.35, maxX: x + 0.35, minZ: 2.15, maxZ: 9.2 }
      );
      this.box(0.7, 0.04, 4.2, 0xf4c542, x, 0.03, 0, false);
    }

    // Ceiling-like light bars keep the scene industrial without closing the camera.
    for (let x = -31; x <= 65; x += 8) {
      const lightBar = this.box(3.8, 0.08, 0.16, 0xcbeaff, x, 5.7, 0, false);
      const light = new THREE.PointLight(0xb9dcff, 10, 12, 2.2);
      light.position.set(x, 5.3, 0);
      this.group.add(light);
      lightBar.material = new THREE.MeshStandardMaterial({ color: 0xdaf2ff, emissive: 0x8acaff, emissiveIntensity: 2.4 });
    }

    this.addSign('CENTRO DE CONTROL EI', -28, 2.35, -9.08, 0, '#0B5EA8');
    this.addSign('ALMACÉN · TRAZABILIDAD', -13, 2.35, -9.08, 0, '#F4C542');
    this.addSign('PRODUCCIÓN', 4, 2.35, -9.08, 0, '#55B985');
    this.addSign('LABORATORIO DE CALIDAD', 24, 2.35, -9.08, 0, '#8DB8FF');
    this.addSign('DESPACHO', 43, 2.35, -9.08, 0, '#FFB36B');
    this.addSign('CAPA · MEJORA CONTINUA', 60, 2.35, -9.08, 0, '#C49BFF');
  }

  private async buildControlZone(): Promise<void> {
    const laura = await this.spawnNpc('laura-control', -29, 0, -3.6, '#4A94D0');
    this.addInteractable({
      id: 'laura-control',
      label: 'Hablar con Laura · Calidad',
      object: laura,
      radius: 2.4,
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.capaLead.map((line) => ({ ...line, text: 'Antes de ir a planta, abre el pedido original del cliente en la terminal azul. Ese documento será tu referencia maestra durante toda la investigación.' })));
        this.progress.flags.add('control-briefing');
        this.setObjective('Verifica el pedido original', 'Consulta la terminal azul y registra la referencia, revisión y cantidad solicitadas por el cliente.');
      }
    });

    const terminal = this.makeTerminal(-25.6, 0, 2.8, '#0B5EA8', 'PEDIDO CLIENTE');
    this.addInteractable({
      id: 'customer-order',
      label: 'Consultar pedido del cliente',
      object: terminal,
      radius: 2.3,
      onInteract: async () => {
        const item = INVENTORY.customerOrder;
        await this.ui.inspectDocument(item, [
          ['Cliente', 'Proyecto industrial / prioridad A'],
          ['Referencia', 'CT-48'],
          ['Revisión requerida', 'B'],
          ['Cantidad', '24 unidades'],
          ['Fecha requerida', '14/09/2026']
        ]);
        if (!this.progress.inventory.has(item.id)) {
          this.progress.inventory.set(item.id, item);
          this.progress.evidence.add(item.id);
          this.progress.score += 120;
          this.audio.success();
        }
        this.progress.flags.add('control-cleared');
        this.setObjective('Ingresa a Almacén', 'Usa el control de acceso amarillo. El pedido original queda guardado en tu mochila de investigación.');
      }
    });

    // Visual command table.
    await this.placeAsset(`${DUNGEON}/table_medium_decorated_A.gltf`, -31.4, 0, 4.8, 0);
    this.addSign('NC-26-0914\nREV. SOLICITADA: B', -31.4, 1.65, 3.7, Math.PI, '#D84A4A', 2.6, 0.9);
  }

  private async buildWarehouseZone(): Promise<void> {
    const mateo = await this.spawnNpc('mateo', -18, 0, -4.5, '#D6A82F');
    this.addInteractable({
      id: 'mateo', label: 'Hablar con Mateo · Almacén', object: mateo, radius: 2.4,
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.warehouseChief);
        this.progress.flags.add('warehouse-dialogue');
        this.setObjective('Escanea las etiquetas de lote', 'Recoge el escáner y registra las tres estibas. Tu meta es descubrir qué lote correspondía realmente a la OT liberada.');
      }
    });

    const scannerDock = this.makeTerminal(-18, 0, 5.7, '#F4C542', 'ESCÁNER');
    this.addInteractable({
      id: 'scanner', label: 'Retirar escáner de trazabilidad', object: scannerDock, radius: 2.0,
      enabled: () => !this.progress.inventory.has('scanner'),
      onInteract: async () => {
        this.progress.inventory.set('scanner', INVENTORY.scanner);
        this.progress.score += 40;
        this.audio.scan();
        this.ui.showToast('ESCÁNER ASIGNADO', 'Acércate a cada estiba y registra su etiqueta.', 'success');
      }
    });

    const cratePositions = [
      { x: -16.2, z: -0.8, lot: LOTS[0] },
      { x: -12.6, z: 3.8, lot: LOTS[1] },
      { x: -8.7, z: -3.8, lot: LOTS[2] }
    ];
    for (const { x, z, lot } of cratePositions) {
      const crate = await this.placeAsset(`${DUNGEON}/crates_stacked.gltf`, x, 0, z, Math.PI / 2);
      this.addSign(`${lot.id}\n${lot.ref}`, x, 1.35, z + 1.0, Math.PI, lot.correctForOT ? '#F4C542' : '#607A8A', 2.25, 0.72);
      this.addInteractable({
        id: `lot-${lot.id}`,
        label: `Escanear ${lot.id}`,
        object: crate,
        radius: 2.3,
        enabled: () => !this.progress.scannedLots.has(lot.id),
        onInteract: async () => {
          if (!this.progress.inventory.has('scanner')) {
            this.ui.showToast('FALTA HERRAMIENTA', 'Retira primero el escáner de trazabilidad.', 'danger');
            return;
          }
          this.progress.scannedLots.add(lot.id);
          this.progress.score += 45;
          this.audio.scan();
          this.ui.showToast('ETIQUETA REGISTRADA', `${lot.id} · ${lot.ref} · estado ${lot.status}.`, 'success');
          if (this.progress.scannedLots.size === LOTS.length) {
            this.setObjective('Contrasta lote vs. OT', 'Has leído las tres estibas. Usa la terminal de trazabilidad al fondo del almacén.');
          }
        }
      });
    }

    await this.placeAsset(`${DUNGEON}/shelf_large.gltf`, -10.4, 0, 7.0, 0);
    await this.placeAsset(`${DUNGEON}/barrel_large_decorated.gltf`, -7.4, 0, 6.3, 0);

    const traceTerminal = this.makeTerminal(-7.1, 0, 5.6, '#F4C542', 'TRAZABILIDAD');
    this.addInteractable({
      id: 'warehouse-analysis', label: 'Analizar trazabilidad de almacén', object: traceTerminal, radius: 2.2,
      enabled: () => this.progress.scannedLots.size === LOTS.length && !this.progress.flags.has('warehouse-cleared'),
      onInteract: async () => {
        const first = await this.ui.choose(
          '¿Qué lote debía entregar Almacén?',
          'La OT liberada indica CT-48 Rev. A. Has escaneado L-0908-A (Rev. A), L-0908-B (Rev. B retenido) y L-0906-C (CT-44).',
          LOTS.map((lot) => ({ id: lot.id, text: `${lot.id} · ${lot.ref}`, detail: `Estado: ${lot.status}` })),
          'TRAZABILIDAD'
        );
        if (first !== 'L-0908-A') return this.penalize('SELECCIÓN INCONSISTENTE', 'Almacén trabaja contra la OT liberada, no contra una suposición.', 80);

        const second = await this.ui.choose(
          '¿Qué demuestra este hallazgo?',
          'El lote L-0908-A sí coincide con la OT, aunque la OT no coincide con el pedido del cliente.',
          [
            { id: 'warehouse-root', text: 'Almacén originó la desviación al seleccionar el lote.' },
            { id: 'upstream', text: 'Almacén siguió correctamente una OT que ya contenía la revisión equivocada.' },
            { id: 'client', text: 'El pedido del cliente no era suficientemente claro.' }
          ],
          'CONCLUSIÓN'
        );
        if (second !== 'upstream') return this.penalize('CONCLUSIÓN DÉBIL', 'Diferencia entre ejecutar un documento incorrecto y crear el error documental.', 90);

        const workOrder = INVENTORY.workOrder;
        this.progress.inventory.set(workOrder.id, workOrder);
        this.progress.evidence.add(workOrder.id);
        this.progress.flags.add('warehouse-cleared');
        this.progress.score += 260;
        this.audio.success();
        await this.ui.inspectDocument(workOrder, [
          ['Referencia', 'CT-48'],
          ['Revisión', 'A'],
          ['Cantidad', '24'],
          ['Origen de plantilla', 'OT_BASE_2025_v3'],
          ['Estado', 'Liberada']
        ]);
        this.setObjective('Reconstruye el flujo de Producción', 'La OT ya contiene la revisión incorrecta. En Producción demuestra si el proceso siguió o no la secuencia definida.');
      }
    });
  }

  private async buildProductionZone(): Promise<void> {
    const operator = await this.spawnNpc('operator', -1.8, 0, -5.0, '#5BAE7A');
    this.addInteractable({
      id: 'operator', label: 'Hablar con Andrés · Producción', object: operator, radius: 2.4,
      enabled: () => this.progress.flags.has('warehouse-cleared'),
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.operator);
        this.setObjective('Activa la secuencia de producción', 'Recorre las cuatro estaciones y actívalas en el orden real: liberación documental, material, set-up y primera pieza.');
      }
    });

    const stations = [
      { id: 'ot', x: 0, z: 3.8, color: '#49A6E9' },
      { id: 'material', x: 4, z: -3.8, color: '#F4C542' },
      { id: 'setup', x: 8, z: 3.8, color: '#55B985' },
      { id: 'first-piece', x: 11, z: -3.8, color: '#9B72E5' }
    ];
    for (const station of stations) {
      const pedestal = this.makePedestal(station.x, station.z, station.color, PRODUCTION_STATIONS[station.id].title);
      this.addInteractable({
        id: `prod-${station.id}`,
        label: `Activar ${PRODUCTION_STATIONS[station.id].title}`,
        object: pedestal,
        radius: 2.15,
        enabled: () => this.progress.flags.has('warehouse-cleared') && !this.progress.flags.has('production-cleared'),
        onInteract: async () => {
          const expected = PRODUCTION_ORDER[this.progress.productionSequence.length];
          if (station.id === expected) {
            if (!this.progress.productionSequence.includes(station.id)) this.progress.productionSequence.push(station.id);
            this.progress.score += 60;
            this.audio.interact();
            this.ui.showToast('SECUENCIA VALIDADA', PRODUCTION_STATIONS[station.id].hint, 'success');
            if (this.progress.productionSequence.length === PRODUCTION_ORDER.length) {
              this.progress.flags.add('production-cleared');
              this.progress.score += 180;
              this.audio.success();
              this.setObjective('Continúa hacia Calidad', 'La ejecución de Producción fue coherente con la OT. La desviación documental atravesó el proceso sin ser detectada.');
            }
          } else {
            this.progress.productionSequence = [];
            this.penalize('SECUENCIA REINICIADA', 'El flujo debe representar una liberación controlada. Observa los letreros y vuelve a empezar.', 60);
          }
        }
      });
    }

    // Visual manufacturing cells.
    for (const [x, z] of [[1.2, 6.6], [6.0, 6.6], [10.6, 6.6]] as Array<[number, number]>) {
      this.box(2.4, 1.4, 1.8, 0x3d4f55, x, 0.7, z);
      this.box(1.5, 0.12, 1.1, 0xf4c542, x, 1.45, z, false);
    }
    this.addSign('FLUJO CONTROLADO →', 4.2, 2.1, -8.95, 0, '#55B985', 3.5, 0.8);
  }

  private async buildQualityZone(): Promise<void> {
    const tech = await this.spawnNpc('quality-tech', 16.4, 0, -5.0, '#658CD7');
    this.addInteractable({
      id: 'quality-tech', label: 'Hablar con Daniela · Calidad', object: tech, radius: 2.4,
      enabled: () => this.progress.flags.has('production-cleared'),
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.qualityTech);
        this.setObjective('Construye el Ishikawa', 'Primero recoge las seis tarjetas de evidencia causal distribuidas en el laboratorio. Luego llévalas a los pedestales 6M.');
      }
    });

    const inspectionBench = this.makeTerminal(18.5, 0, 5.5, '#8DB8FF', 'INSPECCIÓN');
    this.addInteractable({
      id: 'inspection-doc', label: 'Revisar registro de inspección', object: inspectionBench, radius: 2.2,
      enabled: () => this.progress.flags.has('production-cleared'),
      onInteract: async () => {
        const item = INVENTORY.inspection;
        await this.ui.inspectDocument(item, [
          ['Dimensional', 'Conforme'],
          ['Cantidad', 'Conforme'],
          ['Revisión vs. plano OT', 'Conforme'],
          ['Pedido vs. OT', 'No verificado'],
          ['Doble validación documental', 'No ejecutada']
        ]);
        if (!this.progress.inventory.has(item.id)) {
          this.progress.inventory.set(item.id, item);
          this.progress.evidence.add(item.id);
          this.progress.score += 130;
          this.audio.success();
        }
      }
    });

    const causePositions: Array<[number, number]> = [[17, 0], [20, -4], [22.5, 4.5], [25, -4.5], [28, 4.5], [31, 0.4]];
    for (let i = 0; i < CAUSES.length; i++) {
      const cause = CAUSES[i];
      const [x, z] = causePositions[i];
      const token = this.makeEvidenceCard(x, z, cause.title, i);
      this.addInteractable({
        id: `cause-${cause.id}`,
        label: `Recoger evidencia: ${cause.title}`,
        object: token,
        radius: 2.0,
        enabled: () => this.progress.flags.has('production-cleared') && !this.progress.causesFound.has(cause.id),
        onInteract: async () => {
          this.progress.causesFound.add(cause.id);
          this.progress.inventory.set(`cause-${cause.id}`, {
            id: `cause-${cause.id}`,
            title: cause.title,
            category: 'cause',
            description: cause.description
          });
          token.visible = false;
          this.progress.score += 45;
          this.audio.scan();
          this.ui.showToast('EVIDENCIA CAUSAL REGISTRADA', `${this.progress.causesFound.size}/6 tarjetas encontradas.`, 'success');
          if (this.progress.causesFound.size === CAUSES.length) this.setObjective('Clasifica las 6M', 'Todas las evidencias están en tu expediente. Usa los pedestales del muro norte para construir el Ishikawa.');
        }
      });
    }

    this.addSign('ISHIKAWA · 6M', 24, 2.7, -9.05, 0, '#8DB8FF', 4.8, 0.95);
    for (let i = 0; i < ISHIKAWA_CATEGORIES.length; i++) {
      const category = ISHIKAWA_CATEGORIES[i];
      const x = 16.4 + i * 3.0;
      const pedestal = this.makePedestal(x, -6.8, ZONE_META.quality.accent, category);
      this.addInteractable({
        id: `ishikawa-${category}`,
        label: `Clasificar evidencia en ${category}`,
        object: pedestal,
        radius: 1.9,
        enabled: () => this.progress.causesFound.size === CAUSES.length && !this.progress.ishikawaPlaced.has(category),
        onInteract: async () => this.placeIshikawa(category)
      });
    }

    const whyTerminal = this.makeTerminal(32.1, 0, 5.6, '#8DB8FF', '5 PORQUÉS');
    this.addInteractable({
      id: 'five-whys', label: 'Ejecutar análisis de 5 Porqués', object: whyTerminal, radius: 2.2,
      enabled: () => this.progress.ishikawaPlaced.size === ISHIKAWA_CATEGORIES.length && !this.progress.flags.has('quality-cleared'),
      onInteract: async () => this.runFiveWhys()
    });
  }

  private async buildDispatchZone(): Promise<void> {
    const dispatcher = await this.spawnNpc('dispatcher', 38.5, 0, -5.0, '#D8894A');
    this.addInteractable({
      id: 'dispatcher', label: 'Hablar con Camilo · Despacho', object: dispatcher, radius: 2.4,
      enabled: () => this.progress.flags.has('quality-cleared'),
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.dispatcher);
        this.setObjective('Ejecuta la contención', 'Revisa la remisión y activa las tres acciones inmediatas necesarias para contener el incidente.');
      }
    });

    const dispatchTerminal = this.makeTerminal(40.5, 0, 5.4, '#FFB36B', 'REMISIÓN');
    this.addInteractable({
      id: 'dispatch-doc', label: 'Revisar remisión de despacho', object: dispatchTerminal, radius: 2.2,
      enabled: () => this.progress.flags.has('quality-cleared'),
      onInteract: async () => {
        const item = INVENTORY.dispatch;
        await this.ui.inspectDocument(item, [
          ['Documento', 'REM-7784'],
          ['Referencia despachada', 'CT-48 Rev. A'],
          ['Cantidad', '24'],
          ['Conforme contra OT', 'Sí'],
          ['Conforme contra pedido', 'No']
        ]);
        if (!this.progress.inventory.has(item.id)) {
          this.progress.inventory.set(item.id, item);
          this.progress.evidence.add(item.id);
          this.progress.score += 120;
        }
        this.progress.flags.add('dispatch-doc-read');
      }
    });

    const actions = [
      { id: 'contain-block', title: 'BLOQUEAR SALDO', detail: 'Inmovilizar producto relacionado y evitar nuevos despachos.' },
      { id: 'contain-client', title: 'GESTIONAR CLIENTE', detail: 'Notificar, acordar reposición y preservar la relación comercial.' },
      { id: 'contain-record', title: 'PRESERVAR EVIDENCIA', detail: 'Conservar OT, lotes, inspección y remisión para investigación.' }
    ];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const station = this.makePedestal(42 + i * 3.4, i % 2 === 0 ? -1.8 : 2.2, '#FFB36B', action.title);
      this.addInteractable({
        id: action.id,
        label: `Activar: ${action.title}`,
        object: station,
        radius: 2.0,
        enabled: () => this.progress.flags.has('dispatch-doc-read') && !this.progress.flags.has(action.id),
        onInteract: async () => {
          this.progress.flags.add(action.id);
          this.progress.score += 75;
          this.audio.interact();
          this.ui.showToast(action.title, action.detail, 'success');
          if (actions.every((entry) => this.progress.flags.has(entry.id))) {
            this.progress.flags.add('dispatch-cleared');
            this.progress.score += 160;
            this.audio.success();
            this.setObjective('Define la CAPA', 'La crisis está contenida. Pasa a Mejora Continua y elimina la causa para evitar recurrencia.');
          }
        }
      });
    }
  }

  private async buildCapaZone(): Promise<void> {
    const lead = await this.spawnNpc('capa-lead', 55, 0, -4.5, '#8F6BC4');
    this.addInteractable({
      id: 'capa-lead', label: 'Hablar con Laura · CAPA', object: lead, radius: 2.4,
      enabled: () => this.progress.flags.has('dispatch-cleared'),
      onInteract: async () => {
        await this.ui.dialogue(NPC_DIALOGUES.capaLead);
        this.setObjective('Aprueba la acción correctiva', 'Usa la mesa CAPA. Debes atacar la causa raíz y definir cómo comprobarás su eficacia.');
      }
    });

    const capaTerminal = this.makeTerminal(61, 0, 1.2, '#C49BFF', 'CAPA');
    this.addInteractable({
      id: 'capa-terminal', label: 'Abrir expediente CAPA', object: capaTerminal, radius: 2.4,
      enabled: () => this.progress.flags.has('dispatch-cleared') && !this.finalizing,
      onInteract: async () => {
        const action = await this.ui.choose(
          'Selecciona la acción correctiva',
          'La causa raíz es control de versiones y validación pedido–OT insuficientes. ¿Qué intervención cambia el sistema?',
          CAPA_CHOICES,
          'CAPA'
        );
        if (action !== 'systemic') return this.penalize('ACCIÓN NO SISTÉMICA', 'Una CAPA debe reducir la probabilidad de recurrencia atacando el mecanismo causal.', 120);

        const efficacy = await this.ui.choose(
          '¿Cómo verificarás la eficacia?',
          'La acción se implementó. Falta demostrar que funciona en operación real.',
          [
            { id: 'audit', text: 'Auditar las próximas 10 OT y comprobar coincidencia pedido–revisión–OT, sin excepciones.' },
            { id: 'email', text: 'Enviar un correo informando que la acción ya fue ejecutada.' },
            { id: 'meeting', text: 'Realizar una reunión y cerrar el caso de inmediato.' }
          ],
          'EFICACIA'
        );
        if (efficacy !== 'audit') return this.penalize('VERIFICACIÓN INSUFICIENTE', 'La eficacia requiere evidencia objetiva posterior a la implementación.', 100);

        this.finalizing = true;
        this.progress.flags.add('capa-cleared');
        this.progress.score += 500;
        this.audio.success();
        this.onFinish();
      }
    });

    this.addSign('CAUSA → ACCIÓN → EFICACIA', 61, 2.4, -8.95, 0, '#C49BFF', 5.8, 0.85);
    await this.placeAsset(`${DUNGEON}/table_medium_decorated_A.gltf`, 57.8, 0, 4.8, 0);
  }

  private buildGates(): void {
    this.createGate('gate-control', -21, () => this.progress.flags.has('control-cleared'), 'ALMACÉN', 'Verifica primero el pedido original del cliente.');
    this.createGate('gate-warehouse', -5, () => this.progress.flags.has('warehouse-cleared'), 'PRODUCCIÓN', 'Completa el análisis de lotes y determina dónde estaba ya presente la desviación.');
    this.createGate('gate-production', 13, () => this.progress.flags.has('production-cleared'), 'CALIDAD', 'Reconstruye correctamente la secuencia de producción.');
    this.createGate('gate-quality', 35, () => this.progress.flags.has('quality-cleared'), 'DESPACHO', 'Completa Ishikawa y 5 Porqués antes de continuar.');
    this.createGate('gate-dispatch', 51, () => this.progress.flags.has('dispatch-cleared'), 'CAPA', 'Ejecuta la contención completa del incidente.');
  }

  private createGate(id: string, x: number, requirement: () => boolean, destination: string, denial: string): void {
    const left = this.box(0.38, 2.7, 2.05, 0x607384, x, 1.35, -1.02);
    const right = this.box(0.38, 2.7, 2.05, 0x607384, x, 1.35, 1.02);
    const collider: Collider = { minX: x - 0.5, maxX: x + 0.5, minZ: -2.15, maxZ: 2.15, enabled: () => !gate.open };
    const gate: Gate = { id, left, right, open: false, opening: false, collider };
    this.gates.set(id, gate);
    this.colliders.push(collider);

    const consoleObject = this.makeTerminal(x - 1.5, 0, 2.9, '#F4C542', `ACCESO ${destination}`);
    this.addInteractable({
      id: `${id}-console`,
      label: `Control de acceso · ${destination}`,
      object: consoleObject,
      radius: 2.1,
      enabled: () => !gate.open,
      onInteract: async () => {
        if (!requirement()) {
          this.audio.error();
          this.ui.showToast('ACCESO RESTRINGIDO', denial, 'danger');
          return;
        }
        gate.opening = true;
        this.audio.gate();
        this.progress.score += 60;
        this.ui.showToast(`ACCESO A ${destination}`, 'Puerta de seguridad desbloqueada.', 'success');
      }
    });
  }

  private async placeIshikawa(category: IshikawaCategory): Promise<void> {
    const available = CAUSES.filter((cause) => this.progress.causesFound.has(cause.id) && !Array.from(this.progress.ishikawaPlaced.values()).includes(cause.id));
    const selected = await this.ui.choose(
      `Categoría: ${category}`,
      'Selecciona la evidencia que corresponde a esta rama del Ishikawa.',
      available.map((cause) => ({ id: cause.id, text: cause.title, detail: cause.description })),
      'ISHIKAWA 6M'
    );
    const cause = CAUSES.find((entry) => entry.id === selected)!;
    if (cause.category !== category) {
      this.penalize('CLASIFICACIÓN INCORRECTA', `“${cause.title}” no corresponde a ${category}. Revisa qué dimensión del proceso representa.`, 55);
      return;
    }
    this.progress.ishikawaPlaced.set(category, cause.id);
    this.progress.score += 90;
    this.audio.success();
    this.ui.showToast(`${category.toUpperCase()} COMPLETADO`, cause.title, 'success');
    if (this.progress.ishikawaPlaced.size === ISHIKAWA_CATEGORIES.length) {
      this.setObjective('Profundiza con 5 Porqués', 'El Ishikawa ordenó las causas potenciales. Ahora demuestra la cadena causal en la terminal de análisis.');
    }
  }

  private async runFiveWhys(): Promise<void> {
    for (let index = this.progress.fiveWhysStep; index < FIVE_WHYS.length; index++) {
      const step = FIVE_WHYS[index];
      const answer = await this.ui.choose(`5 Porqués · Paso ${index + 1}/5`, step.question, step.choices, 'ANÁLISIS CAUSAL');
      if (answer !== step.correct) {
        this.penalize('RESPUESTA SUPERFICIAL', 'La respuesta no mantiene la cadena causal soportada por las evidencias encontradas.', 70);
        return;
      }
      this.progress.fiveWhysStep = index + 1;
      this.progress.score += 95;
      this.audio.success();
      this.ui.showToast('CADENA CAUSAL VALIDADA', step.explanation, 'success');
    }

    this.progress.inventory.set('qualitySeal', INVENTORY.qualitySeal);
    this.progress.flags.add('quality-cleared');
    this.progress.score += 220;
    this.setObjective('Contén el incidente en Despacho', 'La causa raíz está soportada. Antes de definir la CAPA, controla el riesgo inmediato y revisa qué salió al cliente.');
  }

  private setObjective(title: string, detail: string): void {
    this.progress.objective = title;
    this.progress.objectiveDetail = detail;
    this.ui.setObjective(title, detail);
  }

  private penalize(title: string, body: string, points: number): void {
    this.progress.errors += 1;
    this.progress.score = Math.max(0, this.progress.score - points);
    this.progress.remainingSeconds = Math.max(0, this.progress.remainingSeconds - 20);
    this.audio.error();
    this.ui.showToast(title, `${body} · penalización: -${points} puntos / -20 s`, 'danger');
  }

  private addInteractable(item: Omit<Interactable, 'marker'>): void {
    const marker = this.makeMarker(item.object.position.x, item.object.position.z);
    this.interactables.push({ ...item, marker });
  }

  private makeMarker(x: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    group.position.set(x, 2.6, z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf4c542, transparent: true, opacity: 0.92 })
    );
    ring.rotation.x = Math.PI / 2;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color: 0x8ee6ff })
    );
    diamond.position.y = 0.42;
    group.add(ring, diamond);
    this.group.add(group);
    return group;
  }

  private makeTerminal(x: number, y: number, z: number, color: string, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x263541, roughness: 0.65, metalness: 0.35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.72), baseMat);
    base.position.y = 0.6;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const screenMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 1.25, roughness: 0.25 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.46, 0.06), screenMat);
    screen.position.set(0, 1.03, 0.39);
    screen.rotation.x = -0.12;
    group.add(screen);

    const top = this.makeCanvasPlane(label, color, 1.28, 0.34);
    top.position.set(0, 1.58, 0);
    top.rotation.x = -Math.PI / 2;
    group.add(top);
    this.group.add(group);
    this.colliders.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.55, maxZ: z + 0.55 });
    return group;
  }

  private makePedestal(x: number, z: number, color: string, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.82, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: 0x283640, metalness: 0.25, roughness: 0.7 })
    );
    base.position.y = 0.21;
    base.castShadow = true;
    group.add(base);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 0.55 })
    );
    pad.position.y = 0.47;
    group.add(pad);
    const sign = this.makeCanvasPlane(label, color, 1.85, 0.45);
    sign.position.set(0, 1.25, -0.36);
    group.add(sign);
    this.group.add(group);
    return group;
  }

  private makeEvidenceCard(x: number, z: number, title: string, index: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const colors = ['#F4C542', '#79BDEE', '#55B985', '#E58D7B', '#A78BE4', '#7FC7B7'];
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.08, 0.96),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[index % colors.length]), emissive: new THREE.Color(colors[index % colors.length]), emissiveIntensity: 0.32 })
    );
    card.position.y = 0.72;
    card.rotation.x = 0.08;
    group.add(card);
    const label = this.makeCanvasPlane(title, colors[index % colors.length], 2.15, 0.5);
    label.position.set(0, 1.6, 0);
    group.add(label);
    this.group.add(group);
    return group;
  }

  private async spawnNpc(id: string, x: number, z: number, color: string): Promise<THREE.Object3D> {
    const model = await this.assets.cloneSkinned(`${CHARACTERS}/Knight.glb`);
    model.position.set(x, 0, z);
    model.rotation.y = Math.PI;
    model.name = id;
    this.tintModel(model, color);
    this.group.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clips = await this.assets.animations(`${ANIMATIONS}/Rig_Medium_General.glb`);
    const idle = clips.find((clip) => clip.name === 'Idle_B') ?? clips.find((clip) => clip.name === 'Idle_A');
    if (idle) mixer.clipAction(idle).play();
    this.mixers.push({ mixer, object: model });
    this.colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
    return model;
  }

  private async placeAsset(path: string, x: number, y: number, z: number, rotationY = 0): Promise<THREE.Object3D> {
    const object = await this.assets.cloneStatic(path);
    object.position.set(x, y, z);
    object.rotation.y = rotationY;
    this.group.add(object);
    return object;
  }

  private tintModel(object: THREE.Object3D, color: string): void {
    const tint = new THREE.Color(color);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const clone = material.clone();
          if ('color' in clone && clone.color instanceof THREE.Color) clone.color.lerp(tint, 0.42);
          return clone;
        });
      } else if (child.material) {
        const clone = child.material.clone();
        if ('color' in clone && clone.color instanceof THREE.Color) clone.color.lerp(tint, 0.42);
        child.material = clone;
      }
    });
  }

  private box(width: number, height: number, depth: number, color: number, x: number, y: number, z: number, shadows = true): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    this.group.add(mesh);
    return mesh;
  }

  private addFloorArrows(fromX: number, toX: number, color: number): void {
    for (let x = fromX; x <= toX; x += 4) {
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.7, 3),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
      );
      arrow.rotation.x = -Math.PI / 2;
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.set(x, 0.03, 0);
      this.group.add(arrow);
    }
  }

  private addSign(text: string, x: number, y: number, z: number, rotationY: number, color: string, width = 4.2, height = 0.72): void {
    const plane = this.makeCanvasPlane(text, color, width, height);
    plane.position.set(x, y, z);
    plane.rotation.y = rotationY;
    this.group.add(plane);
  }

  private makeCanvasPlane(text: string, color: string, width: number, height: number): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#07131E';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.fillRect(0, 0, 18, canvas.height);
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.fillStyle = '#F5FAFF';
    context.font = '700 56px "Century Gothic", Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const lines = text.split('\n');
    const spacing = 68;
    const start = canvas.height / 2 - ((lines.length - 1) * spacing) / 2;
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2 + 8, start + index * spacing, 910));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  }
}
