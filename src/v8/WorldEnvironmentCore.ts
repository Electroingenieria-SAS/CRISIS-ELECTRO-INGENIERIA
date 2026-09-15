import * as THREE from 'three';
import { NPCLifeController } from './characters/NPCLifeController';
import { ZONES } from './content';
import type {
  Carryable,
  Collider,
  CombatHitResult,
  DropSocket,
  InventoryItem,
  WorldAction,
  WorldContextTarget,
  WorldInteractionResult,
  ZoneId
} from './types';
import { InventorySystem } from './inventory/InventorySystem';
import { CharacterFactory, type CharacterStyle } from './visual/CharacterFactory';
import { EnvironmentKit } from './visual/EnvironmentKit';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from './visual/IndustrialKit';
import { CollisionSystem } from './world/CollisionSystem';
import { DebugWorldOverlay } from './world/DebugWorldOverlay';
import { WorldInteractionSystem } from './world/WorldInteractionSystem';
import { WorldObjectRegistry } from './world/WorldObjectRegistry';
import { ControlZone } from './zones/ControlZone';
import { WarehouseZone } from './zones/WarehouseZone';
import { ProductionZone } from './zones/ProductionZone';
import { QualityZone } from './zones/QualityZone';
import { MaintenanceZone } from './zones/MaintenanceZone';
import { DispatchZone } from './zones/DispatchZone';
import { CapaZone } from './zones/CapaZone';

/** Definitive V8 environment compositor and reusable gameplay runtime. */
export class World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly scannables: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();
  readonly inventory = new InventorySystem();
  readonly registry = new WorldObjectRegistry();
  readonly collisionSystem = new CollisionSystem(this.colliders);

  private readonly kit = new IndustrialKit();
  private readonly environment = new EnvironmentKit();
  private readonly characterFactory = new CharacterFactory();
  private readonly npcLife = new NPCLifeController();
  private readonly interactionSystem = new WorldInteractionSystem(this.registry, this.collisionSystem, this.inventory, this.group);
  private readonly debugOverlay = new DebugWorldOverlay(this.colliders, this.registry);
  private readonly noPlayer = new THREE.Vector3(999, 0, 999);

  private control!: ControlZone;
  private warehouse!: WarehouseZone;
  private production!: ProductionZone;
  private quality!: QualityZone;
  private maintenance!: MaintenanceZone;
  private dispatch!: DispatchZone;
  private capa!: CapaZone;
  private clock = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'V8_WORLD_ENVIRONMENT_CORE';
    scene.add(this.group);
    this.group.add(this.debugOverlay.group);
  }

  init(): void {
    this.buildTerrain();
    this.buildRoutes();
    this.composeControl();
    this.composeWarehouse();
    this.composeProduction();
    this.composeQuality();
    this.composeMaintenance();
    this.composeDispatch();
    this.composeCapa();
    this.buildLandscape();
    this.rebuildPrimaryStaff();
    this.addAmbientStaff();
  }

  update(dt: number, playerPosition?: THREE.Vector3): void {
    this.clock += dt;
    this.warehouse?.update(dt);
    this.production?.update(dt);
    this.quality?.update(dt);
    for (const rotor of this.maintenance?.rotators ?? []) rotor.rotation.y += dt * 0.72;
    this.interactionSystem.update(dt);
    this.npcLife.update(dt, playerPosition ?? this.noPlayer);
    this.debugOverlay.update();
  }

  focusNPC(id: string, active: boolean): void {
    this.npcLife.setFocus(id, active);
  }

  setProductionState(state: boolean[]): void {
    this.production?.setInterlocks(state);
  }

  resolvePlayerMovement(current: THREE.Vector3, desired: THREE.Vector3, radius = 0.42): THREE.Vector3 {
    return this.collisionSystem.resolve(current, desired, radius);
  }

  nearestContext(position: THREE.Vector3): WorldContextTarget | null {
    return this.registry.nearest(position, ['pickup', 'door', 'container', 'puzzle', 'movable', 'breakable', 'interactable'], 3.0);
  }

  interactContext(id: string): WorldInteractionResult {
    return this.interactionSystem.interact(id);
  }

  attack(origin: THREE.Vector3, forward: THREE.Vector3): CombatHitResult {
    return this.interactionSystem.attack(origin, forward);
  }

  toggleDebug(): boolean {
    return this.debugOverlay.toggle();
  }

  inventoryItems(): InventoryItem[] {
    return this.inventory.list();
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
    const worldPosition = new THREE.Vector3();
    for (const item of this.carryables.values()) {
      if (!enabled(item.id) || item.object.userData.carried) continue;
      const d = item.object.getWorldPosition(worldPosition).distanceTo(position);
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
    const worldPosition = new THREE.Vector3();
    for (const socket of this.sockets.values()) {
      const d = socket.object.getWorldPosition(worldPosition).distanceTo(position);
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
    const worldPosition = new THREE.Vector3();
    for (const action of actions) {
      if (!action.object.visible) continue;
      const d = action.object.getWorldPosition(worldPosition).distanceTo(position);
      if (d <= action.radius && d < distance) {
        best = action;
        distance = d;
      }
    }
    return best;
  }

  private composeControl(): void {
    this.control = new ControlZone();
    this.control.init();
    this.group.add(this.control.group);
    this.colliders.push(...this.control.colliders);
    this.actions.push(...this.control.actions);
    for (const [id, item] of this.control.carryables) this.carryables.set(id, item);
    this.registry.registerMany(this.control.worldObjects);
  }

  private composeWarehouse(): void {
    this.warehouse = new WarehouseZone();
    this.warehouse.init();
    this.group.add(this.warehouse.group);
    for (const action of this.warehouse.actions) if (!action.object.parent) this.warehouse.group.add(action.object);
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
    for (const action of this.production.actions) if (!action.object.parent) this.production.group.add(action.object);
    this.colliders.push(...this.production.colliders);
    this.actions.push(...this.production.actions);
  }

  private composeQuality(): void {
    this.quality = new QualityZone();
    this.quality.init();
    this.group.add(this.quality.group);
    for (const action of this.quality.actions) if (!action.object.parent) this.quality.group.add(action.object);
    this.colliders.push(...this.quality.colliders);
    this.actions.push(...this.quality.actions);
    for (const [id, value] of this.quality.carryables) this.carryables.set(id, value);
    for (const [id, value] of this.quality.sockets) this.sockets.set(id, value);
  }

  private composeMaintenance(): void {
    this.maintenance = new MaintenanceZone();
    this.maintenance.init();
    this.group.add(this.maintenance.group);
    this.colliders.push(...this.maintenance.colliders);
    this.actions.push(...this.maintenance.actions);
  }

  private composeDispatch(): void {
    this.dispatch = new DispatchZone();
    this.dispatch.init();
    this.group.add(this.dispatch.group);
    this.colliders.push(...this.dispatch.colliders);
    for (const [id, value] of this.dispatch.carryables) this.carryables.set(id, value);
    for (const [id, value] of this.dispatch.sockets) this.sockets.set(id, value);
  }

  private composeCapa(): void {
    this.capa = new CapaZone();
    this.capa.init();
    this.group.add(this.capa.group);
    this.colliders.push(...this.capa.colliders);
    this.actions.push(...this.capa.actions);
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
    const fence = (id: string, x: number, z: number, width: number, depth: number) => {
      const mesh = this.kit.box(width, 1.25, depth, fenceMaterial);
      mesh.position.set(x, 0.62, z);
      this.group.add(mesh);
      this.colliders.push({ id, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, enabled: true, object: mesh });
    };
    fence('campus-fence-west', -56, 4, 0.35, 106);
    fence('campus-fence-east', 60, 4, 0.35, 106);
    fence('campus-fence-north', 2, -49, 116, 0.35);
    fence('campus-fence-south', 2, 57, 116, 0.35);
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

    for (const [x, z] of [[-14, 11], [17.8, 10.5], [18, 27.5]] as Array<[number, number]>) {
      const planter = this.environment.planter(2.0, 0.68);
      planter.position.set(x, 0, z);
      this.group.add(planter);
      this.colliders.push({ id: `route-planter-${x}-${z}`, minX: x - 1.05, maxX: x + 1.05, minZ: z - 0.38, maxZ: z + 0.38, enabled: true, object: planter });
    }
  }

  private buildLandscape(): void {
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 1.5, 7);
    const crownGeometry = new THREE.ConeGeometry(1.15, 2.5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x604832, roughness: 0.95 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x3d714c, roughness: 0.96 });
    const spots: Array<[number, number]> = [
      [-50,-42],[-40,-43],[-26,-44],[-7,-45],[12,-44],[35,-43],[52,-38],
      [-50,48],[-37,50],[-20,50],[18,51],[53,47],[-51,-18],[54,-16],
      [-50,24],[53,23]
    ];
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
      this.colliders.push({ id: `tree-${index}`, minX: x - 0.32, maxX: x + 0.32, minZ: z - 0.32, maxZ: z + 0.32, enabled: true, debugLabel: 'Tree trunk' });
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.group.add(trunks, crowns);
  }

  private rebuildPrimaryStaff(): void {
    const primary: Array<{ id: string; style: CharacterStyle; phase: number }> = [
      { id: 'npc-laura', phase: 0.2, style: { name: 'Laura', role: 'quality', accent: C.blue, skin: 0xd9a985, hair: 0x3b2b27, eye: 0x5b7183, hairStyle: 'bun', feminine: true, glasses: true, helmet: false, labCoat: true, radio: false, tablet: true } },
      { id: 'npc-mateo', phase: 1.3, style: { name: 'Mateo', role: 'warehouse', accent: C.yellow, skin: 0xc88d69, hair: 0x2d211d, eye: 0x5a6a63, hairStyle: 'buzz', beard: true, helmet: true, vest: true, radio: true } },
      { id: 'npc-andres', phase: 2.1, style: { name: 'Andrés', role: 'production', accent: C.green, skin: 0xd4a079, hair: 0x211d1b, eye: 0x465f69, hairStyle: 'short', glasses: true, helmet: true, vest: true, radio: true } }
    ];

    for (const entry of primary) {
      const action = this.actions.find((candidate) => candidate.id === entry.id);
      if (action) this.replaceWorkerVisual(entry.id, action.object, entry.style, entry.phase);
    }

    const danielaAnchor = this.findLegacyWorker(this.quality.group);
    if (danielaAnchor) {
      this.replaceWorkerVisual('npc-daniela', danielaAnchor, {
        name: 'Daniela', role: 'metrology', accent: 0x7eb7ff, skin: 0xe0ad8d, hair: 0x51372c, eye: 0x496c75,
        hairStyle: 'ponytail', feminine: true, glasses: true, helmet: false, labCoat: true, radio: false, tablet: true
      }, 3.0);
    }
  }

  private addAmbientStaff(): void {
    this.createAmbientNPC('npc-maintenance', 34.4, 7.6, { name: 'Samuel', role: 'maintenance', accent: C.yellowDark, skin: 0xc9906d, hair: 0x2b2522, eye: 0x536f78, hairStyle: 'buzz', helmet: true, vest: true, radio: true }, 3.8);
    this.createAmbientNPC('npc-dispatch', -9.6, 38.8, { name: 'Valentina', role: 'dispatch', accent: 0xb77042, skin: 0xd8a17e, hair: 0x402b26, eye: 0x4e6d79, hairStyle: 'bun', feminine: true, helmet: true, vest: true, radio: true, tablet: true }, 4.5);
    this.createAmbientNPC('npc-capa-lead', 43.2, 39.5, { name: 'Camila', role: 'lead', accent: 0x9c7ad8, skin: 0xd5a083, hair: 0x342822, eye: 0x556f80, hairStyle: 'side', feminine: true, glasses: true, helmet: false, vest: false, radio: false, tablet: true }, 5.2);
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
    for (const child of [...anchor.children]) if (child !== marker) anchor.remove(child);
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
}
