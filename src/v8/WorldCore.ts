import * as THREE from 'three';
import { NPCLifeController } from './characters/NPCLifeController';
import { ZONES } from './content';
import type { Carryable, Collider, DropSocket, WorldAction, ZoneId } from './types';
import { CharacterFactory, type CharacterStyle } from './visual/CharacterFactory';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from './visual/IndustrialKit';
import { WarehouseZone } from './zones/WarehouseZone';
import { ProductionZone } from './zones/ProductionZone';
import { QualityZone } from './zones/QualityZone';

/**
 * Clean V8 world composition. Reconstructed sectors own their geometry and
 * gameplay affordances. Provisional sectors stay intentionally simple until
 * their replacement module is ready.
 */
export class World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly scannables: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();

  private readonly kit = new IndustrialKit();
  private readonly characterFactory = new CharacterFactory();
  private readonly npcLife = new NPCLifeController();
  private readonly localMarkers: THREE.Mesh[] = [];
  private readonly rotators: THREE.Object3D[] = [];
  private readonly noPlayer = new THREE.Vector3(999, 0, 999);
  private warehouse!: WarehouseZone;
  private production!: ProductionZone;
  private quality!: QualityZone;
  private clock = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'V8_WORLD_CORE';
    scene.add(this.group);
  }

  init(): void {
    this.buildTerrain();
    this.buildRoutes();
    this.buildControl();
    this.composeWarehouse();
    this.composeProduction();
    this.composeQuality();
    this.buildMaintenanceProvisional();
    this.buildDispatchProvisional();
    this.buildCapaProvisional();
    this.buildLandscape();
    this.rebuildPrimaryStaff();
    this.addAmbientStaff();
  }

  update(dt: number, playerPosition?: THREE.Vector3): void {
    this.clock += dt;
    this.warehouse?.update(dt);
    this.production?.update(dt);
    this.quality?.update(dt);
    this.npcLife.update(dt, playerPosition ?? this.noPlayer);
    for (const rotor of this.rotators) rotor.rotation.y += dt * 0.72;
    for (const marker of this.localMarkers) {
      marker.position.y = Number(marker.userData.baseY ?? 2.5) + Math.sin(this.clock * 2.4 + Number(marker.userData.phase ?? 0)) * 0.075;
      marker.rotation.y += dt * 0.75;
    }
  }

  focusNPC(id: string, active: boolean): void {
    this.npcLife.setFocus(id, active);
  }

  setProductionState(state: boolean[]): void {
    this.production?.setInterlocks(state);
  }

  zoneFor(position: THREE.Vector3): ZoneId {
    let best: ZoneId = 'control';
    let bestDistance = Infinity;
    for (const [id, meta] of Object.entries(ZONES) as Array<[ZoneId, (typeof ZONES)[ZoneId]]>) {
      const dx = position.x - meta.center[0];
      const dz = position.z - meta.center[1];
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }

  nearestAction(position: THREE.Vector3): WorldAction | null {
    return this.nearest(this.actions, position);
  }

  nearestScan(position: THREE.Vector3): WorldAction | null {
    return this.nearest(this.scannables, position);
  }

  nearestCarryable(position: THREE.Vector3, enabled: (id: string) => boolean): Carryable | null {
    let best: Carryable | null = null;
    let distance = Infinity;
    for (const item of this.carryables.values()) {
      if (!enabled(item.id) || item.object.userData.carried) continue;
      const d = item.object.getWorldPosition(new THREE.Vector3()).distanceTo(position);
      if (d <= item.radius && d < distance) {
        best = item;
        distance = d;
      }
    }
    return best;
  }

  nearestSocket(position: THREE.Vector3): DropSocket | null {
    let best: DropSocket | null = null;
    let distance = Infinity;
    for (const socket of this.sockets.values()) {
      const d = socket.object.getWorldPosition(new THREE.Vector3()).distanceTo(position);
      if (d <= socket.radius && d < distance) {
        best = socket;
        distance = d;
      }
    }
    return best;
  }

  socketPosition(id: string): THREE.Vector3 {
    const socket = this.sockets.get(id);
    return socket ? socket.object.getWorldPosition(new THREE.Vector3()).setY(0.58) : new THREE.Vector3();
  }

  private nearest(actions: WorldAction[], position: THREE.Vector3): WorldAction | null {
    let best: WorldAction | null = null;
    let distance = Infinity;
    for (const action of actions) {
      if (!action.object.visible) continue;
      const d = action.object.getWorldPosition(new THREE.Vector3()).distanceTo(position);
      if (d <= action.radius && d < distance) {
        best = action;
        distance = d;
      }
    }
    return best;
  }

  private composeWarehouse(): void {
    this.warehouse = new WarehouseZone();
    this.warehouse.init();
    this.group.add(this.warehouse.group);
    for (const action of this.warehouse.actions) {
      if (!action.object.parent) this.warehouse.group.add(action.object);
    }
    this.colliders.push(...this.warehouse.colliders);
    this.actions.push(...this.warehouse.actions);
    this.scannables.push(...this.warehouse.scannables);
    for (const [id, value] of this.warehouse.carryables) this.carryables.set(id, value);
    for (const [id, value] of this.warehouse.sockets) this.sockets.set(id, value);
  }

  private composeProduction(): void {
    this.production = new ProductionZone();
    this.production.init();
    this.group.add(this.production.group);
    for (const action of this.production.actions) {
      if (!action.object.parent) this.production.group.add(action.object);
    }
    this.colliders.push(...this.production.colliders);
    this.actions.push(...this.production.actions);
  }

  private composeQuality(): void {
    this.quality = new QualityZone();
    this.quality.init();
    this.group.add(this.quality.group);
    for (const action of this.quality.actions) {
      if (!action.object.parent) this.quality.group.add(action.object);
    }
    this.colliders.push(...this.quality.colliders);
    this.actions.push(...this.quality.actions);
    for (const [id, value] of this.quality.carryables) this.carryables.set(id, value);
    for (const [id, value] of this.quality.sockets) this.sockets.set(id, value);
  }

  private buildTerrain(): void {
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x31513b, roughness: 0.98 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(142, 126), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    ground.receiveShadow = true;
    this.group.add(ground);

    const campus = this.kit.box(116, 0.14, 104, this.kit.materials.floor, false, true);
    campus.position.set(2, -0.01, 4);
    this.group.add(campus);

    const fenceMaterial = this.kit.materials.steelDark;
    const fence = (x: number, z: number, width: number, depth: number) => {
      const mesh = this.kit.box(width, 1.25, depth, fenceMaterial);
      mesh.position.set(x, 0.62, z);
      this.group.add(mesh);
    };
    fence(-56, 4, 0.35, 106);
    fence(60, 4, 0.35, 106);
    fence(2, -49, 116, 0.35);
    fence(2, 57, 116, 0.35);
    this.colliders.push(
      { minX: -58, maxX: -55.5, minZ: -51, maxZ: 59 },
      { minX: 59.5, maxX: 62, minZ: -51, maxZ: 59 },
      { minX: -58, maxX: 62, minZ: -51, maxZ: -48.5 },
      { minX: -58, maxX: 62, minZ: 56.5, maxZ: 59 }
    );
  }

  private buildRoutes(): void {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x232c31, roughness: 0.94 });
    const road = (x: number, z: number, width: number, depth: number) => {
      const mesh = this.kit.box(width, 0.05, depth, roadMaterial, false, true);
      mesh.position.set(x, 0.065, z);
      this.group.add(mesh);
    };
    road(0, 5, 105, 7);
    road(-17, 9, 7, 40);
    road(-10, -17, 40, 7);
    road(22, 4, 7, 68);
    road(18, 31, 48, 7);

    for (let x = -48; x <= 48; x += 6) {
      const stripe = this.kit.box(2.5, 0.018, 0.1, this.kit.materials.yellow, false, false);
      stripe.position.set(x, 0.1, 5);
      this.group.add(stripe);
    }

    const direction = this.kit.sign('ALMACÉN  ←   |   PRODUCCIÓN  ↙   |   CALIDAD  ↘', 10.2, 0.68, '#173346', '#ffffff', '#f3c83f');
    direction.position.set(-6, 3.45, 8.8);
    this.group.add(direction);
  }

  private buildControl(): void {
    this.openBuilding(0, 0, 19, 17, C.blue, 'CENTRO DE CONTROL');
    const laura = this.worker(-3.2, -2.7);
    this.addAction('npc-laura', 'Hablar con Laura · Calidad', laura, 2.2);

    const scanner = this.controlTerminal(3.6, -2.2, C.blue, 'ESCÁNER EI');
    this.addAction('scanner-terminal', 'Retirar Escáner EI', scanner, 2.0);
  }

  private buildMaintenanceProvisional(): void {
    this.openBuilding(39, 5, 23, 22, C.yellowDark, 'MANTENIMIENTO / SST');
    const machine = this.machine(39, 5);
    const rotor = machine.userData.rotor as THREE.Object3D | undefined;
    if (rotor) this.rotators.push(rotor);
    const steps: Array<[string, string, number, number]> = [
      ['loto-stop', '1 · DETENER', 31, -1],
      ['loto-isolate', '2 · AISLAR', 47, -1],
      ['loto-lock', '3 · BLOQUEAR', 31, 12],
      ['loto-zero', '4 · ENERGÍA CERO', 47, 12]
    ];
    for (const [id, label, x, z] of steps) {
      const terminal = this.controlTerminal(x, z, C.yellowDark, label);
      this.addAction(id, `LOTO · ${label}`, terminal, 2.0);
    }
  }

  private buildDispatchProvisional(): void {
    this.openBuilding(0, 35, 27, 20, 0xb77042, 'DESPACHO');
    const boxes: Array<[string, number, number, string]> = [
      ['pkg-2401', -8, 31, 'AUR-2401'],
      ['pkg-2402', 0, 31, 'AUR-2402'],
      ['pkg-2403', 8, 31, 'AUR-2403']
    ];
    for (const [id, x, z, label] of boxes) {
      const box = this.packageBox(x, z, label);
      this.carryables.set(id, { id, label, object: box, radius: 1.8, home: [x, 0, z] });
    }
    for (let index = 0; index < 3; index++) {
      const socket = this.socketPad(-8 + index * 8, 42, 0xb77042, `POS ${index + 1}`);
      this.sockets.set(`dispatch-${index + 1}`, { id: `dispatch-${index + 1}`, label: `Posición ${index + 1}`, object: socket, radius: 2.1 });
    }
  }

  private buildCapaProvisional(): void {
    this.openBuilding(38, 35, 23, 20, 0x9c7ad8, 'CENTRO CAPA');
    const options: Array<[string, string, number]> = [
      ['capa-a', 'RECORDAR', 30],
      ['capa-b', 'CONTROLAR', 38],
      ['capa-c', 'INSPECCIONAR', 46]
    ];
    for (const [id, label, x] of options) {
      const terminal = this.controlTerminal(x, 35, 0x9c7ad8, label);
      this.addAction(id, `Evaluar estrategia · ${label}`, terminal, 2.0);
    }
    const beaconMaterial = new THREE.MeshStandardMaterial({ color: 0x9c7ad8, emissive: 0x9c7ad8, emissiveIntensity: 0.16, roughness: 0.42 });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 3.6, 12), beaconMaterial);
    beacon.position.set(38, 1.8, 43);
    beacon.castShadow = true;
    this.group.add(beacon);
  }

  private buildLandscape(): void {
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 1.5, 7);
    const crownGeometry = new THREE.ConeGeometry(1.15, 2.5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x604832, roughness: 0.95 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x3d714c, roughness: 0.96 });
    const spots: Array<[number, number]> = [[-50,-42],[-40,-43],[-26,-44],[-7,-45],[12,-44],[35,-43],[52,-38],[-50,48],[-37,50],[-20,50],[18,51],[53,47],[-51,-18],[54,-16]];
    const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(([x, z], index) => {
      dummy.position.set(x, 0.75, z);
      dummy.rotation.y = index * 0.71;
      dummy.updateMatrix();
      trunks.setMatrixAt(index, dummy.matrix);
      dummy.position.y = 2.5;
      dummy.updateMatrix();
      crowns.setMatrixAt(index, dummy.matrix);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.group.add(trunks, crowns);
  }

  private rebuildPrimaryStaff(): void {
    const primary: Array<{ id: string; style: CharacterStyle; phase: number }> = [
      {
        id: 'npc-laura',
        phase: 0.2,
        style: { name: 'Laura', role: 'quality', accent: C.blue, skin: 0xd9a985, hair: 0x3b2b27, eye: 0x5b7183, hairStyle: 'bun', feminine: true, glasses: true, helmet: false, labCoat: true, radio: false, tablet: true }
      },
      {
        id: 'npc-mateo',
        phase: 1.3,
        style: { name: 'Mateo', role: 'warehouse', accent: C.yellow, skin: 0xc88d69, hair: 0x2d211d, eye: 0x5a6a63, hairStyle: 'buzz', beard: true, helmet: true, vest: true, radio: true }
      },
      {
        id: 'npc-andres',
        phase: 2.1,
        style: { name: 'Andrés', role: 'production', accent: C.green, skin: 0xd4a079, hair: 0x211d1b, eye: 0x465f69, hairStyle: 'short', glasses: true, helmet: true, vest: true, radio: true }
      }
    ];

    for (const entry of primary) {
      const action = this.actions.find((candidate) => candidate.id === entry.id);
      if (action) this.replaceWorkerVisual(entry.id, action.object, entry.style, entry.phase);
    }

    // Daniela was initially an ambient laboratory worker rather than an action.
    // Locate that legacy worker and rebuild it as a full metrology character.
    const danielaAnchor = this.findLegacyWorker(this.quality.group);
    if (danielaAnchor) {
      this.replaceWorkerVisual('npc-daniela', danielaAnchor, {
        name: 'Daniela', role: 'metrology', accent: 0x7eb7ff, skin: 0xe0ad8d, hair: 0x51372c, eye: 0x496c75,
        hairStyle: 'ponytail', feminine: true, glasses: true, helmet: false, labCoat: true, radio: false, tablet: true
      }, 3.0);
    }
  }

  private addAmbientStaff(): void {
    this.createAmbientNPC('npc-maintenance', 34.4, 7.6, {
      name: 'Samuel', role: 'maintenance', accent: C.yellowDark, skin: 0xc9906d, hair: 0x2b2522, eye: 0x536f78,
      hairStyle: 'buzz', helmet: true, vest: true, radio: true
    }, 3.8);

    this.createAmbientNPC('npc-dispatch', -9.6, 38.8, {
      name: 'Valentina', role: 'dispatch', accent: 0xb77042, skin: 0xd8a17e, hair: 0x402b26, eye: 0x4e6d79,
      hairStyle: 'bun', feminine: true, helmet: true, vest: true, radio: true, tablet: true
    }, 4.5);

    this.createAmbientNPC('npc-capa-lead', 43.2, 39.5, {
      name: 'Camila', role: 'lead', accent: 0x9c7ad8, skin: 0xd5a083, hair: 0x342822, eye: 0x556f80,
      hairStyle: 'side', feminine: true, glasses: true, helmet: false, vest: false, radio: false, tablet: true
    }, 5.2);
  }

  private createAmbientNPC(id: string, x: number, z: number, style: CharacterStyle, phase: number): void {
    const anchor = new THREE.Group();
    anchor.position.set(x, 0, z);
    anchor.name = `${id}-anchor`;
    this.group.add(anchor);
    const model = this.characterFactory.create(style);
    anchor.add(model.root);
    this.npcLife.register(id, anchor, model, style.role, phase);
  }

  private replaceWorkerVisual(id: string, anchor: THREE.Object3D, style: CharacterStyle, phase: number): void {
    const marker = anchor.userData.marker as THREE.Object3D | undefined;
    for (const child of [...anchor.children]) {
      if (child !== marker) anchor.remove(child);
    }
    const model = this.characterFactory.create(style);
    anchor.add(model.root);
    this.npcLife.register(id, anchor, model, style.role, phase);
  }

  private findLegacyWorker(root: THREE.Object3D): THREE.Group | null {
    let match: THREE.Group | null = null;
    root.traverse((node) => {
      if (match || !(node instanceof THREE.Group)) return;
      if (node.getObjectByName('worker-head')) match = node;
    });
    return match;
  }

  private openBuilding(x: number, z: number, width: number, depth: number, accent: number, label: string): void {
    const floor = this.kit.box(width, 0.12, depth, this.kit.materials.concrete, false, true);
    floor.position.set(x, 0.02, z);
    this.group.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xdbe2e3, roughness: 0.9 });
    const rear = this.kit.box(width, 3.8, 0.24, wallMaterial);
    rear.position.set(x, 1.9, z - depth / 2);
    const left = this.kit.box(0.24, 3.8, depth, wallMaterial);
    left.position.set(x - width / 2, 1.9, z);
    const right = left.clone();
    right.position.x = x + width / 2;
    this.group.add(rear, left, right);
    const sign = this.kit.sign(label, Math.min(width - 2, 7.2), 0.66, '#173346', '#ffffff', `#${accent.toString(16).padStart(6, '0')}`);
    sign.position.set(x, 3.25, z - depth / 2 + 0.14);
    this.group.add(sign);
    this.colliders.push(
      { minX: x - width / 2 - 0.5, maxX: x - width / 2 + 0.5, minZ: z - depth / 2, maxZ: z + depth / 2 },
      { minX: x + width / 2 - 0.5, maxX: x + width / 2 + 0.5, minZ: z - depth / 2, maxZ: z + depth / 2 },
      { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2 - 0.5, maxZ: z - depth / 2 + 0.5 }
    );
  }

  private worker(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.name = 'staff-anchor';
    this.group.add(group);
    return group;
  }

  private controlTerminal(x: number, z: number, color: number, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const stem = this.kit.box(0.36, 1.45, 0.36, this.kit.materials.steelDark);
    stem.position.y = 0.72;
    const panel = this.kit.box(1.6, 1.05, 0.28, this.kit.materials.navy);
    panel.position.y = 1.62;
    const screenMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.28 });
    const screen = this.kit.box(1.28, 0.62, 0.025, screenMaterial, false, false);
    screen.position.set(0, 1.66, 0.155);
    const sign = this.kit.sign(label, 1.35, 0.28, '#f3c83f', '#17232a', '#173346');
    sign.position.set(0, 2.35, 0.1);
    group.add(stem, panel, screen, sign);
    this.group.add(group);
    return group;
  }

  private machine(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = this.kit.box(6.5, 0.65, 5.2, this.kit.materials.steelDark);
    base.position.y = 0.34;
    const body = this.kit.box(4.8, 3.0, 3.8, this.kit.materials.navy);
    body.position.y = 2.0;
    group.add(base, body);
    const rotor = new THREE.Group();
    rotor.position.set(0, 2.0, 2.0);
    for (let i = 0; i < 4; i++) {
      const blade = this.kit.box(1.5, 0.12, 0.3, this.kit.materials.steel, false, false);
      blade.position.x = 0.75;
      const arm = new THREE.Group();
      arm.rotation.z = i * Math.PI / 2;
      arm.add(blade);
      rotor.add(arm);
    }
    group.userData.rotor = rotor;
    group.add(rotor);
    this.group.add(group);
    return group;
  }

  private packageBox(x: number, z: number, label: string): THREE.Group {
    const group = this.kit.crate(1.15, 0.82, 0.95, this.kit.materials.cardboard);
    group.position.set(x, 0, z);
    const sign = this.kit.sign(label, 1.0, 0.28, '#f7f7f2', '#17232a', '#b77042');
    sign.position.set(0, 0.55, 0.5);
    group.add(sign);
    this.group.add(group);
    return group;
  }

  private socketPad(x: number, z: number, color: number, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.08 });
    const pad = this.kit.box(3.0, 0.12, 3.0, material, false, true);
    pad.position.y = 0.06;
    const sign = this.kit.sign(label, 1.7, 0.34, '#173346', '#ffffff', `#${color.toString(16).padStart(6, '0')}`);
    sign.position.set(0, 1.1, -1.35);
    group.add(pad, sign);
    this.group.add(group);
    return group;
  }

  private addAction(id: string, prompt: string, object: THREE.Object3D, radius: number): void {
    const markerMaterial = new THREE.MeshStandardMaterial({ color: C.yellow, emissive: C.yellow, emissiveIntensity: 0.42, roughness: 0.28 });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), markerMaterial);
    marker.position.y = 2.52;
    marker.userData.baseY = 2.52;
    marker.userData.phase = object.position.x * 0.21 + object.position.z * 0.13;
    object.add(marker);
    object.userData.marker = marker;
    this.localMarkers.push(marker);
    this.actions.push({ id, prompt, object, radius });
  }
}
