import * as THREE from 'three';
import type { Collider, InventoryItem } from '../v3/types';
import type { AdventureUI } from '../v3/UI';
import type { AdventureAudio } from '../v3/Audio';
import { EngineerAvatar } from '../v3/EngineerAvatar';
import {
  CAPA_CHOICES_V4,
  DISPATCH_PACKAGES,
  GAUGES,
  INTERLOCK_START,
  INTERLOCK_TARGET,
  LOTO_LABELS,
  LOTO_ORDER,
  RECEIVING_ITEMS,
  ZONE_DIALOGUES
} from './content';
import type { CarryableSpec, DropSocket, PatrolAgent, V4Interactable, V4Progress, V4Zone } from './types';

type Worker = PatrolAgent & { avatar: EngineerAvatar };

type Gate = {
  object: THREE.Group;
  collider: Collider;
  open: boolean;
  requirement: () => boolean;
};

const COLORS = {
  blue: '#0B5EA8',
  yellow: '#F4C542',
  navy: '#102A3A',
  steel: '#344854',
  green: '#55B985',
  red: '#D85B5B',
  orange: '#E8984A',
  purple: '#9876D4',
  cyan: '#66C7F2'
};

export class V4World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly interactables: V4Interactable[] = [];
  readonly carryables = new Map<string, CarryableSpec>();
  readonly sockets = new Map<string, DropSocket>();

  private workers: Worker[] = [];
  private gates: Gate[] = [];
  private clock = 0;
  private interlocks = [...INTERLOCK_START];
  private lotoIndex = 0;
  private gaugeReturn = new THREE.Vector3(28, 0.8, -11);

  constructor(
    private scene: THREE.Scene,
    private ui: AdventureUI,
    private audio: AdventureAudio,
    private progress: V4Progress,
    private onFinish: () => void
  ) {
    this.scene.add(this.group);
  }

  async init(): Promise<void> {
    this.buildTerrain();
    this.buildRoadNetwork();
    this.buildControlHub();
    this.buildWarehouse();
    this.buildProduction();
    this.buildQualityLab();
    this.buildMaintenance();
    this.buildDispatch();
    this.buildCapaCenter();
    this.buildCampusDetails();
    this.spawnAmbientWorkers();
  }

  update(dt: number): void {
    this.clock += dt;
    this.updateWorkers(dt);
    this.updateGates(dt);
    for (const socket of this.sockets.values()) {
      const pad = socket.object.userData.pad as THREE.Mesh | undefined;
      if (!pad) continue;
      const mat = pad.material;
      if (mat instanceof THREE.MeshStandardMaterial) mat.emissiveIntensity = 0.34 + Math.sin(this.clock * 3 + socket.object.position.x) * 0.12;
    }
  }

  zoneForPosition(position: THREE.Vector3): V4Zone {
    const centers: Array<[V4Zone, THREE.Vector2]> = [
      ['control', new THREE.Vector2(0, 0)],
      ['warehouse', new THREE.Vector2(-38, 10)],
      ['production', new THREE.Vector2(-8, -36)],
      ['quality', new THREE.Vector2(32, -22)],
      ['maintenance', new THREE.Vector2(42, 18)],
      ['dispatch', new THREE.Vector2(4, 38)],
      ['capa', new THREE.Vector2(43, 43)]
    ];
    let best: V4Zone = 'control';
    let distance = Infinity;
    for (const [zone, center] of centers) {
      const d = center.distanceTo(new THREE.Vector2(position.x, position.z));
      if (d < distance) {
        distance = d;
        best = zone;
      }
    }
    return best;
  }

  nearestInteractable(position: THREE.Vector3): V4Interactable | null {
    let best: V4Interactable | null = null;
    let distance = Infinity;
    for (const item of this.interactables) {
      if (item.enabled && !item.enabled()) continue;
      const world = item.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= item.radius && d < distance) {
        best = item;
        distance = d;
      }
    }
    return best;
  }

  nearestCarryable(position: THREE.Vector3): CarryableSpec | null {
    let best: CarryableSpec | null = null;
    let distance = Infinity;
    for (const item of this.carryables.values()) {
      if (item.placed || !item.object.visible) continue;
      const world = item.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      const radius = item.pickupRadius ?? 2.2;
      if (d <= radius && d < distance) {
        best = item;
        distance = d;
      }
    }
    return best;
  }

  nearestSocket(position: THREE.Vector3, carriedId: string): DropSocket | null {
    const item = this.carryables.get(carriedId);
    if (!item) return null;
    let best: DropSocket | null = null;
    let distance = Infinity;
    for (const socket of this.sockets.values()) {
      if (!socket.accepts(item)) continue;
      const world = socket.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= socket.radius && d < distance) {
        best = socket;
        distance = d;
      }
    }
    return best;
  }

  onPickup(item: CarryableSpec): void {
    item.object.userData.originalScale = item.object.scale.clone();
    this.audio.interact();
    if (item.kind === 'material') {
      const meta = item.metadata ?? {};
      this.ui.showToast('ETIQUETA ESCANEADA', `${meta.ref ?? ''} · ${meta.coa ?? ''}`, 'normal');
    } else if (item.kind === 'sample') {
      this.ui.showToast('PATRÓN MAESTRO', '50,00 mm · certificado vigente. Llévalo a una bancada metrológica.', 'success');
    } else if (item.kind === 'package') {
      this.ui.showToast('CAJA EN MANOS', item.label, 'normal');
    }
  }

  async onPlaced(itemId: string, socketId: string): Promise<void> {
    const item = this.carryables.get(itemId);
    const socket = this.sockets.get(socketId);
    if (!item || !socket) return;
    await socket.onPlace(item);
  }

  getSocketPosition(socketId: string): THREE.Vector3 {
    const socket = this.sockets.get(socketId);
    return socket ? socket.object.getWorldPosition(new THREE.Vector3()).setY(0.62) : new THREE.Vector3();
  }

  private buildTerrain(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 135),
      new THREE.MeshStandardMaterial({ color: 0x244634, roughness: 0.96 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.group.add(ground);

    const campus = this.box(116, 0.16, 105, 0x29353b, 3, -0.02, 3, false);
    campus.receiveShadow = true;

    this.addFence(-55, 0, 2, 104, true);
    this.addFence(61, 0, 2, 104, true);
    this.addFence(3, -52, 116, 2, false);
    this.addFence(3, 55, 116, 2, false);

    this.colliders.push(
      { minX: -58, maxX: -54.5, minZ: -54, maxZ: 57 },
      { minX: 60.5, maxX: 64, minZ: -54, maxZ: 57 },
      { minX: -58, maxX: 64, minZ: -55, maxZ: -51.5 },
      { minX: -58, maxX: 64, minZ: 54.5, maxZ: 58 }
    );
  }

  private buildRoadNetwork(): void {
    this.road(0, 2, 103, 7, 0);
    this.road(-17, 10, 7, 42, 0);
    this.road(-19, -20, 62, 7, 0);
    this.road(24, 8, 7, 73, 0);
    this.road(21, 33, 50, 7, 0);

    for (let x = -50; x <= 52; x += 6) this.lineMark(x, 2, 2.4, 0.13, 0);
    for (let z = -45; z <= 48; z += 6) this.lineMark(0, z, 0.13, 2.4, 0);
  }

  private buildControlHub(): void {
    this.zonePad(0, 0, 20, 18, 0x17374b, 'CENTRO DE CONTROL', COLORS.cyan);
    this.partialBuilding(0, 0, 18, 16, COLORS.blue, 'CONTROL DE CRISIS EI');

    const laura = this.spawnStaticEngineer(-2.6, 0, -2.4, '#4B91CE', '#F4C542');
    this.addInteractable('laura-v4', 'Hablar con Laura · Calidad', laura, 2.4, async () => {
      await this.ui.dialogue(ZONE_DIALOGUES.control);
      this.progress.flags.add('briefed');
      this.objective('Ve al muelle de recepción', 'Toma el escáner azul del Centro de Control y dirígete al Almacén. Clasifica físicamente los tres contenedores por revisión y evidencia de proveedor.');
    });

    const scanner = this.terminal(4.2, 0, -2.1, COLORS.cyan, 'ESCÁNER EI');
    this.addInteractable('master-scanner', 'Retirar escáner de investigación', scanner, 2.1, async () => {
      if (this.progress.flags.has('scanner')) return;
      this.progress.flags.add('scanner');
      this.addInventory('scanner-v4', 'Escáner EI', 'tool', 'Lee lote, revisión, serial y estado documental de los objetos de misión.');
      this.audio.success();
      this.ui.showToast('HERRAMIENTA OBTENIDA', 'Escáner EI habilitado. Ahora puedes auditar los contenedores del muelle.', 'success');
      this.objective('Audita Recepción', 'En el muelle oeste encontrarás tres contenedores. Tómalos uno por uno y colócalos en LIBERADO o CUARENTENA según su revisión y COA.');
    }, () => !this.progress.flags.has('scanner'));

    this.addSign('PROYECTO AURORA\nNC-26-0914', 0, 2.5, -7.2, 0, COLORS.cyan, 5.4, 1.05);
  }

  private buildWarehouse(): void {
    this.zonePad(-38, 10, 28, 24, 0x403b2d, 'ALMACÉN', COLORS.yellow);
    this.partialBuilding(-38, 10, 27, 23, COLORS.yellow, 'RECEPCIÓN · TRAZABILIDAD');

    const mateo = this.spawnStaticEngineer(-46, 0, 4.2, '#C99926', '#F4C542');
    this.addInteractable('mateo-v4', 'Hablar con Mateo · Almacén', mateo, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.warehouse));

    const positions = [
      new THREE.Vector3(-48, 0.65, 12),
      new THREE.Vector3(-40, 0.65, 15),
      new THREE.Vector3(-32, 0.65, 11)
    ];

    RECEIVING_ITEMS.forEach((data, index) => {
      const crate = this.makeCrate(data.label, positions[index], index === 0 ? '#4F94C8' : index === 1 ? '#C9913E' : '#8A6842');
      this.carryables.set(data.id, {
        id: data.id,
        label: data.label,
        kind: 'material',
        object: crate,
        carriedScale: 0.72,
        metadata: { ref: data.ref, coa: data.coa, disposition: data.disposition }
      });
    });

    this.makeDropSocket('receive-release', 'ZONA VERDE · LIBERAR', new THREE.Vector3(-32, 0, 2.8), COLORS.green, (item) => item.kind === 'material', async (item) => {
      const expected = item.metadata?.disposition;
      if (expected !== 'release') {
        this.penalize('LIBERACIÓN INCORRECTA', `${item.label} no cumple simultáneamente revisión y evidencia documental. Devuélvelo y clasifícalo de nuevo.`, 75);
        this.returnCarryable(item, new THREE.Vector3(-39, 0.65, 10));
        return;
      }
      item.placed = true;
      this.progress.flags.add(`sorted-${item.id}`);
      this.ui.showToast('MATERIAL LIBERADO', 'Revisión C y COA vigente: condición de entrada conforme.', 'success');
      this.checkWarehouseComplete();
    });

    this.makeDropSocket('receive-quarantine', 'ZONA ROJA · CUARENTENA', new THREE.Vector3(-45, 0, 2.8), COLORS.red, (item) => item.kind === 'material', async (item) => {
      const expected = item.metadata?.disposition;
      if (expected !== 'quarantine') {
        this.penalize('CUARENTENA INNECESARIA', `${item.label} sí cumple los criterios de recepción. Una cuarentena sin evidencia también genera costo y retraso.`, 55);
        this.returnCarryable(item, new THREE.Vector3(-39, 0.65, 10));
        return;
      }
      item.placed = true;
      this.progress.quarantinedItems.add(item.id);
      this.progress.flags.add(`sorted-${item.id}`);
      this.ui.showToast('MATERIAL CONTENIDO', `${item.metadata?.ref} · ${item.metadata?.coa}.`, 'success');
      this.checkWarehouseComplete();
    });

    this.makeRack(-49, 18); this.makeRack(-41, 19); this.makeRack(-33, 18);
    this.makeForklift(-52, 9, Math.PI / 2);
    this.addSign('MUELLE 02 · PROYECTO AURORA', -38, 2.4, 20.9, Math.PI, COLORS.yellow, 6, 0.9);
  }

  private buildProduction(): void {
    this.zonePad(-8, -36, 34, 28, 0x1f382d, 'PRODUCCIÓN', COLORS.green);
    this.partialBuilding(-8, -36, 33, 27, COLORS.green, 'LÍNEA DE ENSAMBLE · AURORA');

    const andres = this.spawnStaticEngineer(-20, 0, -42, '#4E9B6D', '#F4C542');
    this.addInteractable('andres-v4', 'Hablar con Andrés · Producción', andres, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.production));

    const board = this.box(10.8, 3.2, 0.7, 0x1b252c, -8, 1.6, -46.5);
    board.castShadow = true;
    this.addSign('TABLERO DE INTERLOCKS', -8, 3.65, -46.1, 0, COLORS.green, 5.5, 0.82);

    for (let i = 0; i < 4; i++) {
      const x = -14 + i * 4;
      const station = this.interlockStation(i, x, -44.8);
      this.addInteractable(`interlock-${i}`, `Conmutar interlock ${i + 1}`, station, 2.0, async () => {
        if (!this.progress.flags.has('warehouse-seal')) {
          this.ui.showToast('FALTA EVIDENCIA', 'Primero completa la clasificación de Recepción.', 'danger');
          return;
        }
        this.toggleInterlock(i);
      });
    }

    const validate = this.terminal(5.5, 0, -42, COLORS.green, 'VALIDAR LÍNEA');
    this.addInteractable('validate-line', 'Validar lógica de interlocks', validate, 2.2, async () => {
      if (this.interlocks.every((state, index) => state === INTERLOCK_TARGET[index])) {
        if (!this.progress.flags.has('production-seal')) {
          this.progress.flags.add('production-seal');
          this.progress.qualitySeals.add('production');
          this.progress.score += 260;
          this.addInventory('seal-production', 'Sello · Proceso Controlado', 'key', 'La línea fue habilitada sólo después de satisfacer sus interlocks de control.');
          this.audio.success();
          this.ui.showToast('SELLO DE PRODUCCIÓN', 'Interlocks restaurados. La línea puede validar primera pieza.', 'success');
          this.objective('Audita el laboratorio', 'Ve a Calidad. Usa el patrón maestro sobre los tres instrumentos y determina cuál debe retirarse de servicio.');
        }
      } else {
        this.penalize('INTERLOCK INCOMPLETO', 'La línea no puede arrancar mientras exista al menos una condición roja.', 45);
      }
    });

    for (let x = -20; x <= 4; x += 6) this.makeMachine(x, -31, x % 12 === 0 ? COLORS.blue : COLORS.green);
    this.addSign('FLUJO: OT → MATERIAL → SET-UP → 1ª PIEZA', -8, 2.7, -24, Math.PI, COLORS.green, 8, 0.9);
  }

  private buildQualityLab(): void {
    this.zonePad(32, -22, 27, 25, 0x20374b, 'CALIDAD', '#8DB8FF');
    this.partialBuilding(32, -22, 26, 24, '#8DB8FF', 'LABORATORIO DE CALIDAD · METROLOGÍA');

    const daniela = this.spawnStaticEngineer(23, 0, -29, '#638ED1', '#F4C542');
    this.addInteractable('daniela-v4', 'Hablar con Daniela · Metrología', daniela, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.quality));

    const master = this.makeMasterBlock(this.gaugeReturn);
    this.carryables.set('master-50', {
      id: 'master-50', label: 'Patrón maestro · 50,00 mm', kind: 'sample', object: master, carriedScale: 0.84,
      metadata: { nominal: '50,00 mm', tolerance: '±0,05 mm' }
    });

    GAUGES.forEach((gauge, index) => {
      const x = 24 + index * 8;
      const z = -20;
      this.makeGaugeBench(gauge.name, x, z, index);
      this.makeDropSocket(`socket-${gauge.id}`, `MEDIR · ${gauge.name}`, new THREE.Vector3(x, 0, z - 1.3), '#8DB8FF', (item) => item.id === 'master-50', async (item) => {
        this.progress.calibratedTools.add(gauge.id);
        this.progress.flags.add(`measured-${gauge.id}`);
        this.audio.scan();
        const errorText = `${gauge.error >= 0 ? '+' : ''}${gauge.error.toFixed(2)} mm`;
        this.ui.showToast(gauge.name, `Patrón: 50,00 · lectura: ${gauge.reading.toFixed(2)} · error ${errorText}.`, gauge.conforming ? 'success' : 'danger');
        this.returnCarryable(item, this.gaugeReturn);
        if (this.progress.calibratedTools.size === GAUGES.length) {
          this.objective('Retira el instrumento no conforme', 'Ya mediste los tres equipos. Identifica cuál supera ±0,05 mm y coloca su tarjeta de estado en “FUERA DE SERVICIO”.');
        }
      });

      const tag = this.makePedestal(x, -27, '#61798A', `ETIQUETAR ${String.fromCharCode(65 + index)}`);
      this.addInteractable(`tag-${gauge.id}`, `Marcar ${gauge.name} fuera de servicio`, tag, 2.0, async () => {
        if (this.progress.calibratedTools.size < GAUGES.length) {
          this.ui.showToast('EVIDENCIA INCOMPLETA', 'Mide primero los tres instrumentos con el patrón maestro.', 'danger');
          return;
        }
        const errorText = `${gauge.error >= 0 ? '+' : ''}${gauge.error.toFixed(2)} mm`;
        if (!gauge.conforming) {
          if (!this.progress.flags.has('quality-seal')) {
            this.progress.flags.add('quality-seal');
            this.progress.qualitySeals.add('quality');
            this.progress.score += 280;
            this.addInventory('seal-quality', 'Sello · Metrología', 'key', 'Se detectó y retiró un instrumento cuyo error excedía el criterio de aceptación.');
            this.audio.success();
            this.ui.showToast('INSTRUMENTO RETIRADO', `${gauge.name} bloqueado por error ${errorText}.`, 'success');
            this.objective('Asegura Mantenimiento y SST', 'Dirígete al patio de energía. Aplica la secuencia LOTO completa antes de intervenir el equipo en alarma.');
          }
        } else {
          this.penalize('ETIQUETA INCORRECTA', `${gauge.name} está dentro de ±0,05 mm. Retirar equipos conformes no corrige el riesgo y reduce capacidad.`, 70);
        }
      });
    });
  }

  private buildMaintenance(): void {
    this.zonePad(42, 18, 24, 24, 0x40372b, 'MANTENIMIENTO', COLORS.orange);
    this.partialBuilding(42, 18, 23, 23, COLORS.orange, 'MANTENIMIENTO · ENERGÍA · SST');

    const sergio = this.spawnStaticEngineer(34, 0, 12, '#D27B38', '#F4C542');
    this.addInteractable('sergio-v4', 'Hablar con Sergio · Mantenimiento', sergio, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.maintenance));

    LOTO_ORDER.forEach((step, index) => {
      const x = 34 + (index % 2) * 9;
      const z = 19 + Math.floor(index / 2) * 7;
      const lever = this.makePedestal(x, z, COLORS.orange, LOTO_LABELS[step]);
      this.addInteractable(`loto-${step}`, `Ejecutar: ${LOTO_LABELS[step]}`, lever, 2.1, async () => {
        if (!this.progress.flags.has('quality-seal')) {
          this.ui.showToast('ACCESO CONTROLADO', 'Mantenimiento requiere el hallazgo metrológico antes de intervenir.', 'danger');
          return;
        }
        const expected = LOTO_ORDER[this.lotoIndex];
        if (step !== expected) {
          this.lotoIndex = 0;
          this.penalize('SECUENCIA LOTO REINICIADA', 'La seguridad no admite saltos. Detén → aísla → bloquea/etiqueta → verifica energía cero.', 65);
          return;
        }
        this.lotoIndex += 1;
        this.audio.interact();
        this.ui.showToast('PASO LOTO CONFIRMADO', `${this.lotoIndex}/4 · ${LOTO_LABELS[step]}`, 'success');
        if (this.lotoIndex === LOTO_ORDER.length && !this.progress.flags.has('maintenance-seal')) {
          this.progress.flags.add('maintenance-seal');
          this.progress.qualitySeals.add('maintenance');
          this.progress.score += 240;
          this.addInventory('seal-maintenance', 'Sello · Energía Cero', 'key', 'La intervención fue protegida con una secuencia LOTO completa y verificable.');
          this.audio.success();
          this.objective('Prepara el despacho', 'Ve al patio de Despacho. Carga las cuatro cajas en el pallet respetando el serial asignado a cada posición.');
        }
      });
    });

    this.makeElectricalPanel(50, 14);
    this.makeElectricalPanel(50, 22);
    this.addSign('PELIGRO · ENERGÍA CONTROLADA', 42, 2.5, 28.8, Math.PI, COLORS.orange, 6, 0.9);
  }

  private buildDispatch(): void {
    this.zonePad(4, 38, 30, 23, 0x463529, 'DESPACHO', COLORS.orange);
    this.partialBuilding(4, 38, 29, 22, COLORS.orange, 'DESPACHO · CONSOLIDACIÓN');

    const camilo = this.spawnStaticEngineer(-7, 0, 31, '#C98245', '#F4C542');
    this.addInteractable('camilo-v4', 'Hablar con Camilo · Despacho', camilo, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.dispatch));

    DISPATCH_PACKAGES.forEach((pkg, index) => {
      const x = -7 + index * 4;
      const box = this.makePackage(pkg.label, new THREE.Vector3(x, 0.6, 43));
      this.carryables.set(pkg.id, {
        id: pkg.id, label: pkg.label, kind: 'package', object: box, carriedScale: 0.75,
        metadata: { slot: pkg.slot, revision: 'Rev. C' }
      });
    });

    const slotPositions = [
      new THREE.Vector3(6, 0, 33), new THREE.Vector3(10, 0, 33),
      new THREE.Vector3(6, 0, 37), new THREE.Vector3(10, 0, 37)
    ];
    DISPATCH_PACKAGES.forEach((pkg, index) => {
      this.makeDropSocket(pkg.slot, `PALLET ${index + 1} · ${pkg.label}`, slotPositions[index], COLORS.yellow, (item) => item.kind === 'package', async (item) => {
        const expected = item.metadata?.slot;
        if (expected !== pkg.slot) {
          this.penalize('SERIAL EN POSICIÓN INCORRECTA', `${item.label} no corresponde a esta posición del pallet. La trazabilidad física debe coincidir con el plan de carga.`, 55);
          this.returnCarryable(item, new THREE.Vector3(-2, 0.6, 43));
          return;
        }
        item.placed = true;
        this.progress.dispatchSlots.add(pkg.slot);
        this.progress.flags.add(`loaded-${item.id}`);
        this.ui.showToast('POSICIÓN VALIDADA', `${item.label} · Rev. C · posición ${index + 1}.`, 'success');
        if (this.progress.dispatchSlots.size === DISPATCH_PACKAGES.length && !this.progress.flags.has('dispatch-seal')) {
          this.progress.flags.add('dispatch-seal');
          this.progress.qualitySeals.add('dispatch');
          this.progress.score += 260;
          this.addInventory('seal-dispatch', 'Sello · Liberación de Despacho', 'key', 'El pallet fue construido y verificado contra serial, revisión y posición.');
          this.audio.success();
          this.objective('Integra la evidencia en CAPA', 'Ve al Centro CAPA. Los sellos de Recepción, Producción, Calidad, Mantenimiento y Despacho deben converger en una acción sistémica.');
        }
      });
    });

    this.makeForklift(-10, 38, 0);
    this.addSign('PALLET AURORA · 4 POSICIONES', 8, 2.4, 29.2, 0, COLORS.orange, 6.2, 0.9);
  }

  private buildCapaCenter(): void {
    this.zonePad(43, 43, 25, 21, 0x332a46, 'CAPA', COLORS.purple);
    this.partialBuilding(43, 43, 24, 20, COLORS.purple, 'CENTRO CAPA · MEJORA CONTINUA');

    const laura = this.spawnStaticEngineer(35, 0, 39, '#7C65B7', '#F4C542');
    this.addInteractable('laura-capa-v4', 'Hablar con Laura · CAPA', laura, 2.5, () => this.ui.dialogue(ZONE_DIALOGUES.capa));

    const sealNames = [
      ['warehouse', 'RECEPCIÓN'], ['production', 'PRODUCCIÓN'], ['quality', 'CALIDAD'], ['maintenance', 'MANTENIMIENTO'], ['dispatch', 'DESPACHO']
    ] as const;
    sealNames.forEach(([key, label], index) => {
      const x = 35 + (index % 3) * 6.2;
      const z = 45 + Math.floor(index / 3) * 5;
      const pedestal = this.makePedestal(x, z, COLORS.purple, label);
      this.addInteractable(`seal-check-${key}`, `Verificar sello de ${label}`, pedestal, 1.9, async () => {
        if (this.progress.qualitySeals.has(key)) this.ui.showToast(`SELLO ${label}`, 'Evidencia disponible para el cierre CAPA.', 'success');
        else this.ui.showToast(`SELLO ${label} AUSENTE`, 'Completa el reto operativo de esa área.', 'danger');
      });
    });

    const finalTerminal = this.terminal(49, 0, 39, COLORS.purple, 'CAPA MAESTRA');
    this.addInteractable('final-capa', 'Abrir análisis CAPA maestro', finalTerminal, 2.3, async () => {
      if (this.progress.qualitySeals.size < 5) {
        this.ui.showToast('EXPEDIENTE INCOMPLETO', `${this.progress.qualitySeals.size}/5 sellos disponibles. El cierre requiere evidencia de toda la cadena.`, 'danger');
        return;
      }
      const answer = await this.ui.choose(
        '¿Qué acción transforma los hallazgos en prevención sistémica?',
        'Recepción evidenció fallas de revisión/COA; Producción dependía de interlocks; Calidad encontró un instrumento fuera de tolerancia; Mantenimiento confirmó la necesidad de LOTO; Despacho dependía de serialización física.',
        CAPA_CHOICES_V4,
        'CAPA · CAUSA SISTÉMICA'
      );
      if (answer !== 'system') {
        this.penalize('CAPA INSUFICIENTE', 'La acción propuesta aumenta vigilancia pero no modifica el mecanismo que permite que información/estado inválido atraviese la cadena.', 110);
        return;
      }
      this.progress.flags.add('capa-complete');
      this.progress.qualitySeals.add('capa');
      this.progress.score += 450;
      this.audio.success();
      this.onFinish();
    });
  }

  private buildCampusDetails(): void {
    for (const [x, z] of [[-51,-41],[-43,-42],[49,-42],[55,-34],[-50,43],[52,50],[25,48],[-25,48],[18,9],[-25,25]] as Array<[number, number]>) {
      this.makeTree(x, z);
    }
    for (const [x, z, rot] of [[-29,30,0],[-23,30,0],[20,42,Math.PI],[27,42,Math.PI]] as Array<[number, number, number]>) {
      this.makeCar(x, z, rot);
    }
    this.addSign('← ALMACÉN', -17, 1.3, 2, 0, COLORS.yellow, 3.4, 0.65);
    this.addSign('PRODUCCIÓN ↓', -1, 1.3, -17, Math.PI / 2, COLORS.green, 3.6, 0.65);
    this.addSign('CALIDAD →', 22, 1.3, -18, 0, '#8DB8FF', 3.3, 0.65);
    this.addSign('MANTENIMIENTO →', 24, 1.3, 12, 0, COLORS.orange, 4.5, 0.65);
    this.addSign('DESPACHO ↑', 2, 1.3, 24, Math.PI / 2, COLORS.orange, 3.6, 0.65);
    this.addSign('CAPA ↗', 26, 1.3, 34, 0, COLORS.purple, 3.2, 0.65);
  }

  private spawnAmbientWorkers(): void {
    const routes: Array<{ id: string; color: string; helmet: string; points: Array<[number, number]> }> = [
      { id: 'worker-warehouse', color: '#A98231', helmet: '#F4C542', points: [[-49,7],[-31,7],[-31,17],[-49,17]] },
      { id: 'worker-production', color: '#4D8F6A', helmet: '#FFFFFF', points: [[-20,-30],[4,-30],[4,-41],[-20,-41]] },
      { id: 'worker-quality', color: '#557FC4', helmet: '#F4C542', points: [[22,-16],[42,-16],[42,-27],[22,-27]] },
      { id: 'worker-yard', color: '#9B784D', helmet: '#F4C542', points: [[-18,3],[-18,29],[18,29],[18,4]] }
    ];
    for (const route of routes) {
      const avatar = new EngineerAvatar({ accent: route.color, shirt: route.color, vest: '#D8B92C', helmet: route.helmet, pants: '#303B42' });
      avatar.group.scale.setScalar(0.92);
      const group = new THREE.Group();
      group.add(avatar.group);
      group.position.set(route.points[0][0], 0, route.points[0][1]);
      this.group.add(group);
      this.workers.push({
        id: route.id, group, avatar, waypoints: route.points.map(([x,z]) => new THREE.Vector3(x,0,z)), waypointIndex: 1, speed: 1.25 + Math.random() * 0.35
      });
    }
  }

  private updateWorkers(dt: number): void {
    for (const worker of this.workers) {
      const target = worker.waypoints[worker.waypointIndex];
      if (!target) continue;
      const delta = target.clone().sub(worker.group.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance < 0.35) {
        worker.waypointIndex = (worker.waypointIndex + 1) % worker.waypoints.length;
        continue;
      }
      delta.normalize();
      worker.group.position.addScaledVector(delta, worker.speed * dt);
      worker.group.rotation.y = Math.atan2(delta.x, delta.z);
      worker.avatar.update(dt, 0.72, false, false);
    }
  }

  private updateGates(dt: number): void {
    for (const gate of this.gates) {
      if (!gate.open && gate.requirement()) {
        gate.open = true;
        gate.object.userData.opening = true;
      }
      if (gate.object.userData.opening) {
        gate.object.position.y = THREE.MathUtils.damp(gate.object.position.y, 3.4, 5, dt);
        if (gate.object.position.y > 3.25) gate.object.userData.opening = false;
      }
    }
  }

  private checkWarehouseComplete(): void {
    if (RECEIVING_ITEMS.every((entry) => this.progress.flags.has(`sorted-${entry.id}`)) && !this.progress.flags.has('warehouse-seal')) {
      this.progress.flags.add('warehouse-seal');
      this.progress.qualitySeals.add('warehouse');
      this.progress.score += 300;
      this.addInventory('seal-warehouse', 'Sello · Recepción Controlada', 'key', 'Se liberó únicamente material conforme y se contuvieron las desviaciones de revisión/COA.');
      this.audio.success();
      this.ui.showToast('SELLO DE RECEPCIÓN', 'Clasificación completada sin perder trazabilidad física.', 'success');
      this.objective('Restaura los interlocks de Producción', 'Dirígete a la línea sur. Cada pulsador conmuta dos condiciones; deja los cuatro indicadores en verde y valida la línea.');
    }
  }

  private toggleInterlock(index: number): void {
    const next = (index + 1) % this.interlocks.length;
    this.interlocks[index] = this.interlocks[index] ? 0 : 1;
    this.interlocks[next] = this.interlocks[next] ? 0 : 1;
    this.audio.interact();
    this.refreshInterlockVisuals();
    const state = this.interlocks.map((v) => v ? '●' : '○').join('  ');
    this.ui.showToast('TABLERO DE INTERLOCKS', state, this.interlocks.every(Boolean) ? 'success' : 'normal');
  }

  private refreshInterlockVisuals(): void {
    for (let i = 0; i < this.interlocks.length; i++) {
      const mesh = this.group.getObjectByName(`interlock-light-${i}`) as THREE.Mesh | undefined;
      const mat = mesh?.material;
      if (mat instanceof THREE.MeshStandardMaterial) {
        const on = Boolean(this.interlocks[i]);
        mat.color.set(on ? 0x55b985 : 0xd85b5b);
        mat.emissive.set(on ? 0x287a4c : 0x7a2626);
      }
    }
  }

  private returnCarryable(item: CarryableSpec, position: THREE.Vector3): void {
    item.placed = false;
    item.object.visible = true;
    item.object.position.copy(position);
    const original = item.object.userData.originalScale as THREE.Vector3 | undefined;
    if (original) item.object.scale.copy(original);
  }

  private objective(title: string, detail: string): void {
    this.progress.objective = title;
    this.progress.objectiveDetail = detail;
    this.ui.setObjective(title, detail);
  }

  private penalize(title: string, body: string, points: number): void {
    this.progress.errors += 1;
    this.progress.score = Math.max(0, this.progress.score - points);
    this.progress.remainingSeconds = Math.max(0, this.progress.remainingSeconds - 25);
    this.audio.error();
    this.ui.showToast(title, `${body} · −${points} pts · −25 s`, 'danger');
  }

  private addInventory(id: string, title: string, category: InventoryItem['category'], description: string): void {
    if (this.progress.inventory.has(id)) return;
    this.progress.inventory.set(id, { id, title, category, description });
    this.progress.evidence.add(id);
  }

  private addInteractable(id: string, label: string, object: THREE.Object3D, radius: number, onInteract: () => void | Promise<void>, enabled?: () => boolean): void {
    this.interactables.push({ id, label, object, radius, onInteract, enabled });
  }

  private makeDropSocket(id: string, label: string, position: THREE.Vector3, color: string, accepts: (item: CarryableSpec) => boolean, onPlace: (item: CarryableSpec) => void | Promise<void>): void {
    const group = new THREE.Group();
    group.position.copy(position);
    const padMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 0.35, roughness: 0.45 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.22, 24), padMat);
    pad.position.y = 0.11;
    pad.receiveShadow = true;
    group.add(pad);
    group.userData.pad = pad;
    const sign = this.makeCanvasPlane(label, color, 3.1, 0.6);
    sign.position.set(0, 1.7, -0.9);
    group.add(sign);
    this.group.add(group);
    this.sockets.set(id, { id, label, object: group, radius: 2.5, accepts, onPlace });
  }

  private zonePad(x: number, z: number, width: number, depth: number, color: number, label: string, accent: string): void {
    this.box(width, 0.12, depth, color, x, 0, z, false);
    this.addSign(label, x, 0.07, z - depth / 2 + 1.0, 0, accent, Math.min(8, width - 2), 0.65);
  }

  private partialBuilding(x: number, z: number, width: number, depth: number, accent: string, title: string): void {
    const wallColor = 0x50606a;
    const h = 3.2;
    this.box(width, h, 0.5, wallColor, x, h / 2, z - depth / 2);
    this.box(width, h, 0.5, wallColor, x, h / 2, z + depth / 2);
    this.box(0.5, h, depth * 0.36, wallColor, x - width / 2, h / 2, z - depth * 0.32);
    this.box(0.5, h, depth * 0.36, wallColor, x - width / 2, h / 2, z + depth * 0.32);
    this.box(0.5, h, depth, wallColor, x + width / 2, h / 2, z);
    this.colliders.push(
      { minX: x - width/2, maxX: x + width/2, minZ: z - depth/2 - 0.35, maxZ: z - depth/2 + 0.35 },
      { minX: x - width/2, maxX: x + width/2, minZ: z + depth/2 - 0.35, maxZ: z + depth/2 + 0.35 },
      { minX: x + width/2 - 0.35, maxX: x + width/2 + 0.35, minZ: z - depth/2, maxZ: z + depth/2 },
      { minX: x - width/2 - 0.35, maxX: x - width/2 + 0.35, minZ: z - depth/2, maxZ: z - depth*0.14 },
      { minX: x - width/2 - 0.35, maxX: x - width/2 + 0.35, minZ: z + depth*0.14, maxZ: z + depth/2 }
    );
    const accentBar = this.box(width * 0.75, 0.16, 0.18, new THREE.Color(accent).getHex(), x, 3.35, z - depth/2 + 0.3, false);
    accentBar.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.45 });
    this.addSign(title, x, 2.35, z - depth/2 + 0.31, 0, accent, Math.min(8.5, width - 2), 0.75);
  }

  private interlockStation(index: number, x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const console = this.boxLocal(2.3, 1.35, 1.25, 0x35454f);
    console.position.y = 0.67;
    group.add(console);
    const initialOn = Boolean(this.interlocks[index]);
    const lightMat = new THREE.MeshStandardMaterial({ color: initialOn ? 0x55b985 : 0xd85b5b, emissive: initialOn ? 0x287a4c : 0x7a2626, emissiveIntensity: 0.9 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), lightMat);
    light.name = `interlock-light-${index}`;
    light.position.set(0, 1.5, 0.45);
    group.add(light);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,0.11,16), new THREE.MeshStandardMaterial({ color: 0xf4c542, roughness: 0.4 }));
    button.rotation.x = Math.PI / 2;
    button.position.set(0, 1.12, 0.68);
    group.add(button);
    this.group.add(group);
    return group;
  }

  private makeGaugeBench(name: string, x: number, z: number, index: number): void {
    const bench = this.box(4.8, 1.1, 2.4, 0x465762, x, 0.55, z);
    bench.castShadow = true;
    const stand = this.box(0.22, 1.5, 0.22, 0x1d262d, x, 1.85, z, false);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.16,24), new THREE.MeshStandardMaterial({ color: 0xe7edf0, roughness: 0.35 }));
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(x, 2.25, z + 0.15);
    this.group.add(gauge);
    this.addSign(`${name}\nBANCO ${index + 1}`, x, 2.8, z - 0.7, 0, '#8DB8FF', 3.3, 0.72);
    void stand;
  }

  private makeMasterBlock(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    const metal = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.5,0.8), new THREE.MeshStandardMaterial({ color: 0xcbd6dc, metalness: 0.72, roughness: 0.2 }));
    metal.castShadow = true;
    group.add(metal);
    const label = this.makeCanvasPlane('PATRÓN 50,00 mm', '#8DB8FF', 2.5, 0.5);
    label.position.set(0,0.75,0);
    group.add(label);
    this.group.add(group);
    return group;
  }

  private makeCrate(label: string, position: THREE.Vector3, color: string): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.3,1.7), new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.75 }));
    box.castShadow = true; box.receiveShadow = true; group.add(box);
    const bands = new THREE.Mesh(new THREE.BoxGeometry(2.28,0.12,1.78), new THREE.MeshStandardMaterial({ color: 0x20272b, metalness: 0.25 }));
    group.add(bands);
    const tag = this.makeCanvasPlane(label, '#F4C542', 2.8,0.55);
    tag.position.set(0,1.15,0.88);
    group.add(tag);
    this.group.add(group);
    return group;
  }

  private makePackage(label: string, position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group(); group.position.copy(position);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.05,1.35), new THREE.MeshStandardMaterial({ color: 0x9d754c, roughness: 0.88 }));
    box.castShadow = true; group.add(box);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.18,1.08,1.38), new THREE.MeshStandardMaterial({ color: 0xf4c542 }));
    group.add(tape);
    const tag = this.makeCanvasPlane(label, '#F4C542', 2.7,0.5); tag.position.set(0,0.9,0.7); group.add(tag);
    this.group.add(group); return group;
  }

  private makeRack(x: number, z: number): void {
    const frame = new THREE.MeshStandardMaterial({ color: 0x263842, metalness: 0.5, roughness: 0.35 });
    for (const dx of [-2.3,2.3]) for (const dz of [-0.55,0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14,3.2,0.14), frame); post.position.set(x+dx,1.6,z+dz); this.group.add(post);
    }
    for (const y of [0.45,1.55,2.65]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.8,0.14,1.35), frame); shelf.position.set(x,y,z); shelf.castShadow = true; this.group.add(shelf);
    }
  }

  private makeForklift(x: number, z: number, rotation: number): void {
    const group = new THREE.Group(); group.position.set(x,0,z); group.rotation.y = rotation;
    const body = this.boxLocal(2.4,1.1,1.5,0xe0b52e); body.position.y=0.7; group.add(body);
    const cabin = this.boxLocal(1.15,1.5,1.35,0x27333a); cabin.position.set(-0.25,1.65,0); group.add(cabin);
    const mast = this.boxLocal(0.18,2.7,1.45,0x172127); mast.position.set(1.3,1.5,0); group.add(mast);
    for (const zz of [-0.48,0.48]) { const fork=this.boxLocal(1.6,0.09,0.12,0x20272c); fork.position.set(1.9,0.15,zz); group.add(fork); }
    this.group.add(group);
  }

  private makeMachine(x: number, z: number, accent: string): void {
    const group = new THREE.Group(); group.position.set(x,0,z);
    const base = this.boxLocal(3.8,2.2,2.6,0x43525a); base.position.y=1.1; group.add(base);
    const panel = this.boxLocal(1.2,0.8,0.08,new THREE.Color(accent).getHex()); panel.position.set(0,1.45,1.34); group.add(panel);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.42,12), new THREE.MeshStandardMaterial({ color:new THREE.Color(accent), emissive:new THREE.Color(accent), emissiveIntensity:0.8 })); beacon.position.set(1.3,2.45,0); group.add(beacon);
    this.group.add(group);
  }

  private makeElectricalPanel(x: number, z: number): void {
    const panel = this.box(2.8,3.6,0.9,0x394950,x,1.8,z); panel.castShadow=true;
    this.addSign('440 V\nLOTO', x,2.2,z+0.48,0,COLORS.orange,1.9,0.75);
  }

  private makePedestal(x: number, z: number, color: string, label: string): THREE.Group {
    const group = new THREE.Group(); group.position.set(x,0,z);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.88,0.48,10),new THREE.MeshStandardMaterial({color:0x2f3e47,metalness:0.18,roughness:0.65})); base.position.y=0.24; base.castShadow=true; group.add(base);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.09,20),new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:0.4})); pad.position.y=0.53; group.add(pad);
    const sign=this.makeCanvasPlane(label,color,2.8,0.62); sign.position.set(0,1.45,-0.4); group.add(sign); this.group.add(group); return group;
  }

  private terminal(x:number,y:number,z:number,color:string,label:string): THREE.Group {
    const group=new THREE.Group(); group.position.set(x,y,z);
    const body=this.boxLocal(1.4,1.35,1.0,0x263640); body.position.y=0.68; group.add(body);
    const screen=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.56,0.07),new THREE.MeshStandardMaterial({color:new THREE.Color(color),emissive:new THREE.Color(color),emissiveIntensity:0.8,roughness:0.25})); screen.position.set(0,1.1,0.53); screen.rotation.x=-0.12; group.add(screen);
    const sign=this.makeCanvasPlane(label,color,2.25,0.48); sign.position.set(0,1.8,0); group.add(sign); this.group.add(group); return group;
  }

  private spawnStaticEngineer(x:number,y:number,z:number,shirt:string,helmet:string): THREE.Group {
    const avatar=new EngineerAvatar({accent:shirt,shirt,vest:'#DDBB31',helmet,pants:'#303B42'}); avatar.group.scale.setScalar(0.94);
    const group=new THREE.Group(); group.position.set(x,y,z); group.add(avatar.group); this.group.add(group); return group;
  }

  private road(x:number,z:number,width:number,depth:number,rotation:number): void {
    const road=new THREE.Mesh(new THREE.BoxGeometry(width,0.035,depth),new THREE.MeshStandardMaterial({color:0x313b40,roughness:0.94})); road.position.set(x,0.055,z); road.rotation.y=rotation; road.receiveShadow=true; this.group.add(road);
  }

  private lineMark(x:number,z:number,width:number,depth:number,rotation:number): void {
    const mark=new THREE.Mesh(new THREE.BoxGeometry(width,0.02,depth),new THREE.MeshBasicMaterial({color:0xe8d04a})); mark.position.set(x,0.08,z); mark.rotation.y=rotation; this.group.add(mark);
  }

  private addFence(x:number,z:number,width:number,depth:number,vertical:boolean): void {
    const mat=new THREE.MeshStandardMaterial({color:0x4e5e66,metalness:0.6,roughness:0.35});
    const length=vertical?depth:width; const count=Math.floor(length/4);
    for(let i=0;i<=count;i++) { const t=-length/2+i*4; const post=new THREE.Mesh(new THREE.BoxGeometry(0.13,2.2,0.13),mat); post.position.set(vertical?x:x+t,1.1,vertical?z+t:z); this.group.add(post); }
  }

  private makeTree(x:number,z:number): void {
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.42,2.4,10),new THREE.MeshStandardMaterial({color:0x6c4d34,roughness:0.9})); trunk.position.set(x,1.2,z); trunk.castShadow=true; this.group.add(trunk);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.75,1),new THREE.MeshStandardMaterial({color:0x3f7451,roughness:0.9})); crown.position.set(x,3.1,z); crown.castShadow=true; this.group.add(crown);
  }

  private makeCar(x:number,z:number,rot:number): void {
    const group=new THREE.Group(); group.position.set(x,0,z); group.rotation.y=rot;
    const body=this.boxLocal(3.6,0.75,1.75,0x395f7c); body.position.y=0.65; group.add(body);
    const roof=this.boxLocal(1.9,0.65,1.55,0x1d2c36); roof.position.set(-0.25,1.25,0); group.add(roof); this.group.add(group);
  }

  private addSign(text:string,x:number,y:number,z:number,rotationY:number,color:string,width=4.2,height=0.72): void {
    const plane=this.makeCanvasPlane(text,color,width,height); plane.position.set(x,y,z); plane.rotation.y=rotationY; this.group.add(plane);
  }

  private makeCanvasPlane(text:string,color:string,width:number,height:number): THREE.Mesh {
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=256; const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='rgba(9,20,29,0.94)'; ctx.fillRect(0,0,1024,256); ctx.strokeStyle=color; ctx.lineWidth=12; ctx.strokeRect(6,6,1012,244);
    ctx.fillStyle='#f7fbfd'; ctx.font='700 54px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const lines=text.split('\n'); lines.forEach((line,index)=>ctx.fillText(line,512,128+(index-(lines.length-1)/2)*62));
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    return new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  }

  private box(width:number,height:number,depth:number,color:number,x:number,y:number,z:number,shadows=true): THREE.Mesh {
    const mesh=this.boxLocal(width,height,depth,color); mesh.position.set(x,y,z); mesh.castShadow=shadows; mesh.receiveShadow=shadows; this.group.add(mesh); return mesh;
  }

  private boxLocal(width:number,height:number,depth:number,color:number): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),new THREE.MeshStandardMaterial({color,roughness:0.72,metalness:0.08}));
  }
}
