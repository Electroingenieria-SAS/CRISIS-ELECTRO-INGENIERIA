import * as THREE from 'three';
import { ZONES } from './content';
import type { Carryable, Collider, DropSocket, WorldAction, ZoneId } from './types';

const C = {
  blue: 0x1769a6,
  yellow: 0xf4c542,
  green: 0x55b985,
  orange: 0xe8984a,
  purple: 0x9c7ad8,
  steel: 0x40535d,
  dark: 0x1d2a31,
  floor: 0x33434b,
  concrete: 0x7f8c90,
  white: 0xe5ecee,
  red: 0xd55a5a
};

export class World {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly scannables: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();
  private rotators: THREE.Object3D[] = [];
  private clock = 0;

  constructor(private scene: THREE.Scene) {
    this.group.name = 'V8_WORLD';
    scene.add(this.group);
  }

  init(): void {
    this.buildTerrain();
    this.buildRoutes();
    this.buildControl();
    this.buildWarehouse();
    this.buildProduction();
    this.buildQuality();
    this.buildMaintenance();
    this.buildDispatch();
    this.buildCapa();
    this.buildLandscape();
  }

  update(dt: number): void {
    this.clock += dt;
    for (const rotor of this.rotators) rotor.rotation.y += dt * 0.65;
    for (const action of this.actions) {
      const marker = action.object.userData.marker as THREE.Mesh | undefined;
      if (!marker) continue;
      marker.position.y = 2.55 + Math.sin(this.clock * 2.3 + action.object.position.x * 0.1) * 0.08;
      marker.rotation.y += dt * 0.6;
    }
  }

  zoneFor(position: THREE.Vector3): ZoneId {
    let best: ZoneId = 'control';
    let distance = Infinity;
    for (const [id, meta] of Object.entries(ZONES) as Array<[ZoneId, (typeof ZONES)[ZoneId]]>) {
      const dx = position.x - meta.center[0];
      const dz = position.z - meta.center[1];
      const d = dx * dx + dz * dz;
      if (d < distance) { distance = d; best = id; }
    }
    return best;
  }

  nearestAction(position: THREE.Vector3): WorldAction | null {
    let best: WorldAction | null = null;
    let bestD = Infinity;
    for (const action of this.actions) {
      if (!action.object.visible) continue;
      const world = action.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= action.radius && d < bestD) { best = action; bestD = d; }
    }
    return best;
  }

  nearestScan(position: THREE.Vector3): WorldAction | null {
    let best: WorldAction | null = null;
    let bestD = Infinity;
    for (const action of this.scannables) {
      const world = action.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= action.radius && d < bestD) { best = action; bestD = d; }
    }
    return best;
  }

  nearestCarryable(position: THREE.Vector3, enabled: (id: string) => boolean): Carryable | null {
    let best: Carryable | null = null;
    let bestD = Infinity;
    for (const item of this.carryables.values()) {
      if (!enabled(item.id) || item.object.userData.carried) continue;
      const world = item.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= item.radius && d < bestD) { best = item; bestD = d; }
    }
    return best;
  }

  nearestSocket(position: THREE.Vector3): DropSocket | null {
    let best: DropSocket | null = null;
    let bestD = Infinity;
    for (const socket of this.sockets.values()) {
      const world = socket.object.getWorldPosition(new THREE.Vector3());
      const d = world.distanceTo(position);
      if (d <= socket.radius && d < bestD) { best = socket; bestD = d; }
    }
    return best;
  }

  socketPosition(id: string): THREE.Vector3 {
    const socket = this.sockets.get(id);
    return socket ? socket.object.getWorldPosition(new THREE.Vector3()).setY(0.58) : new THREE.Vector3();
  }

  private buildTerrain(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(142, 126), new THREE.MeshStandardMaterial({ color: 0x31513b, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.09;
    ground.receiveShadow = true;
    this.group.add(ground);

    const campus = this.meshBox(116, 0.14, 104, C.floor);
    campus.position.set(2, -0.01, 4);
    campus.receiveShadow = true;
    this.group.add(campus);

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3f5059, roughness: 0.7, metalness: 0.25 });
    const fence = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, d), fenceMat);
      m.position.set(x, 0.62, z); m.castShadow = true; this.group.add(m);
    };
    fence(-56, 4, 0.35, 106); fence(60, 4, 0.35, 106); fence(2, -49, 116, 0.35); fence(2, 57, 116, 0.35);
    this.colliders.push(
      { minX: -58, maxX: -55.5, minZ: -51, maxZ: 59 },
      { minX: 59.5, maxX: 62, minZ: -51, maxZ: 59 },
      { minX: -58, maxX: 62, minZ: -51, maxZ: -48.5 },
      { minX: -58, maxX: 62, minZ: 56.5, maxZ: 59 }
    );
  }

  private buildRoutes(): void {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x232c31, roughness: 0.94 });
    const road = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), roadMat);
      m.position.set(x, 0.06, z); m.receiveShadow = true; this.group.add(m);
    };
    road(0, 5, 105, 7); road(-17, 9, 7, 40); road(-10, -17, 40, 7); road(22, 4, 7, 68); road(18, 31, 48, 7);

    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd6b934 });
    for (let x = -48; x <= 48; x += 6) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 0.1), stripeMat);
      stripe.position.set(x, 0.1, 5); this.group.add(stripe);
    }
  }

  private buildControl(): void {
    this.zoneBuilding('control', 0, 0, 19, 17, C.blue, 'CENTRO DE CONTROL');
    const laura = this.worker(-3.2, -2.7, C.blue);
    this.action('npc-laura', 'Hablar con Laura · Calidad', laura, 2.2);
    const scanner = this.terminal(3.6, -2.2, C.blue, 'ESCÁNER');
    this.action('scanner-terminal', 'Retirar Escáner EI', scanner, 2.0);
  }

  private buildWarehouse(): void {
    this.zoneBuilding('warehouse', -34, 10, 25, 22, C.yellow, 'RECEPCIÓN / ALMACÉN');
    const mateo = this.worker(-43, 4, C.yellow);
    this.action('npc-mateo', 'Hablar con Mateo · Almacén', mateo, 2.2);

    const palletA = this.pallet(-43, 11, 0x507fa1, 'A');
    const palletB = this.pallet(-34, 14, 0xa46c3e, 'B');
    const palletC = this.pallet(-26, 10, 0x665b52, 'C');
    this.scan('pallet-a', 'Escanear Pallet A', palletA, 4.0);
    this.scan('pallet-b', 'Escanear Pallet B', palletB, 4.0);
    this.scan('pallet-c', 'Escanear Pallet C', palletC, 4.0);
    this.carryables.set('pallet-b', { id: 'pallet-b', label: 'Pallet B · L-0908-B', object: palletB, radius: 2.0 });

    const quarantine = this.socketPad(-44, 19, C.red, 'CUARENTENA');
    this.sockets.set('quarantine', { id: 'quarantine', label: 'Zona de Cuarentena', object: quarantine, radius: 2.7 });
  }

  private buildProduction(): void {
    this.zoneBuilding('production', -24, -27, 28, 22, C.green, 'PRODUCCIÓN');
    this.addConveyor(-27, -26, 18);
    const labels = ['ENERGÍA', 'GUARDA', 'FIJACIÓN', 'PROGRAMA'];
    for (let i = 0; i < 4; i++) {
      const x = -34 + i * 6.3;
      const terminal = this.terminal(x, -19.5, C.green, labels[i] ?? 'INT');
      this.action(`prod-sw-${i}`, `Accionar interlock · ${labels[i]}`, terminal, 2.0);
    }
  }

  private buildQuality(): void {
    this.zoneBuilding('quality', 24, -28, 26, 22, 0x5287b7, 'LABORATORIO DE CALIDAD');
    const block = this.masterBlock(15, -28);
    this.carryables.set('master-block', { id: 'master-block', label: 'Patrón maestro 50,00 mm', object: block, radius: 2.0 });
    const positions: Array<[number, number]> = [[19, -21], [26, -21], [33, -21]];
    positions.forEach(([x, z], i) => {
      const gauge = this.gaugeStation(x, z, i + 1);
      this.sockets.set(`gauge-${i + 1}`, { id: `gauge-${i + 1}`, label: `Banco M-0${i + 1}`, object: gauge, radius: 2.4 });
      const tag = this.terminal(x, -34.5, 0x5287b7, `M-0${i + 1}`);
      this.action(`tag-gauge-${i + 1}`, `Retirar de servicio M-0${i + 1}`, tag, 1.8);
    });
  }

  private buildMaintenance(): void {
    this.zoneBuilding('maintenance', 39, 5, 23, 22, C.orange, 'MANTENIMIENTO / SST');
    const machine = this.machine(39, 5);
    this.rotators.push(machine.userData.rotor as THREE.Object3D);
    const steps: Array<[string, string, number, number]> = [
      ['loto-stop', '1 · DETENER', 31, -1],
      ['loto-isolate', '2 · AISLAR', 47, -1],
      ['loto-lock', '3 · BLOQUEAR', 31, 12],
      ['loto-zero', '4 · ENERGÍA CERO', 47, 12]
    ];
    for (const [id, label, x, z] of steps) {
      const terminal = this.terminal(x, z, C.orange, label);
      this.action(id, `LOTO · ${label}`, terminal, 2.0);
    }
  }

  private buildDispatch(): void {
    this.zoneBuilding('dispatch', 0, 35, 27, 20, 0xb77042, 'DESPACHO');
    const boxes: Array<[string, number, number, string]> = [
      ['pkg-2401', -8, 31, 'AUR-2401'], ['pkg-2402', 0, 31, 'AUR-2402'], ['pkg-2403', 8, 31, 'AUR-2403']
    ];
    for (const [id, x, z, label] of boxes) {
      const box = this.packageBox(x, z, label);
      this.carryables.set(id, { id, label, object: box, radius: 1.8 });
    }
    for (let i = 0; i < 3; i++) {
      const socket = this.socketPad(-8 + i * 8, 42, 0xb77042, `POS ${i + 1}`);
      this.sockets.set(`dispatch-${i + 1}`, { id: `dispatch-${i + 1}`, label: `Posición ${i + 1}`, object: socket, radius: 2.1 });
    }
  }

  private buildCapa(): void {
    this.zoneBuilding('capa', 38, 35, 23, 20, C.purple, 'CENTRO CAPA');
    const options: Array<[string, string, number]> = [['capa-a', 'RECORDAR', 30], ['capa-b', 'CONTROLAR', 38], ['capa-c', 'INSPECCIONAR', 46]];
    for (const [id, label, x] of options) {
      const terminal = this.terminal(x, 35, C.purple, label);
      this.action(id, `Evaluar estrategia · ${label}`, terminal, 2.0);
    }
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 3.6, 12), new THREE.MeshStandardMaterial({ color: C.purple, emissive: C.purple, emissiveIntensity: 0.22, roughness: 0.42 }));
    beacon.position.set(38, 1.8, 43); beacon.castShadow = true; this.group.add(beacon);
  }

  private buildLandscape(): void {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.5, 7);
    const crownGeo = new THREE.ConeGeometry(1.15, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x604832, roughness: 0.95 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x3d714c, roughness: 0.96 });
    const spots: Array<[number, number]> = [[-50,-42],[-40,-43],[-26,-44],[-7,-45],[12,-44],[35,-43],[52,-38],[-50,48],[-37,50],[-20,50],[18,51],[53,47],[-51,-18],[54,-16]];
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(([x,z], i) => { dummy.position.set(x, 0.75, z); dummy.rotation.y = i * 0.71; dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); dummy.position.y = 2.5; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix); });
    trunks.castShadow = true; crowns.castShadow = true; this.group.add(trunks, crowns);
  }

  private zoneBuilding(id: ZoneId, x: number, z: number, w: number, d: number, accent: number, title: string): void {
    const floor = this.meshBox(w, 0.12, d, 0x45535a); floor.position.set(x, 0.04, z); floor.receiveShadow = true; this.group.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc1c8ca, roughness: 0.82 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.08 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 3.1, 0.35), wallMat); back.position.set(x, 1.55, z - d / 2); back.castShadow = true; this.group.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.1, d), wallMat); left.position.set(x - w / 2, 1.55, z); left.castShadow = true; this.group.add(left);
    const right = left.clone(); right.position.x = x + w / 2; this.group.add(right);
    const header = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.45), accentMat); header.position.set(x, 3.05, z - d / 2 + 0.12); this.group.add(header);
    this.addSign(title, x, 2.55, z - d / 2 + 0.25, accent, Math.min(6.8, w * 0.34));
    this.colliders.push(
      { minX: x - w / 2 - 0.3, maxX: x + w / 2 + 0.3, minZ: z - d / 2 - 0.5, maxZ: z - d / 2 + 0.5 },
      { minX: x - w / 2 - 0.5, maxX: x - w / 2 + 0.5, minZ: z - d / 2, maxZ: z + d / 2 },
      { minX: x + w / 2 - 0.5, maxX: x + w / 2 + 0.5, minZ: z - d / 2, maxZ: z + d / 2 }
    );
    floor.userData.zone = id;
  }

  private worker(x: number, z: number, accent: number): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pants = new THREE.MeshStandardMaterial({ color: 0x34414a, roughness: 0.82 });
    const vest = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd4a078, roughness: 0.78 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), vest); torso.position.y = 1.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin); head.position.y = 2.1;
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.36, 0.2, 12), new THREE.MeshStandardMaterial({ color: C.yellow, roughness: 0.5 })); helmet.position.y = 2.37;
    const legs = [-0.19, 0.19].map((dx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants); m.position.set(dx, 0.65, 0); return m; });
    g.add(torso, head, helmet, ...legs); g.traverse((n) => { if (n instanceof THREE.Mesh) n.castShadow = true; }); this.group.add(g); return g;
  }

  private terminal(x: number, z: number, accent: number, label: string): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.25, 0.72), new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.6, metalness: 0.25 })); base.position.y = 0.63; base.castShadow = true;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.04), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25, roughness: 0.38 })); screen.position.set(0, 0.82, 0.38);
    g.add(base, screen); this.addLocalLabel(g, label, 1.45, accent); this.group.add(g); return g;
  }

  private pallet(x: number, z: number, color: number, label: string): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1.6), new THREE.MeshStandardMaterial({ color: 0x75573b, roughness: 0.92 })); pallet.position.y = 0.12;
    const boxMat = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
    for (let iy = 0; iy < 2; iy++) for (let ix = -1; ix <= 1; ix += 2) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 1.25), boxMat); b.position.set(ix * 0.5, 0.55 + iy * 0.72, 0); b.castShadow = true; g.add(b); }
    g.add(pallet); this.addLocalLabel(g, `PALLET ${label}`, 2.2, color); this.group.add(g); return g;
  }

  private masterBlock(x: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 0.55), new THREE.MeshStandardMaterial({ color: 0xd9e2e5, roughness: 0.3, metalness: 0.72 }));
    m.position.set(x, 0.48, z); m.castShadow = true; this.group.add(m); return m;
  }

  private gaugeStation(x: number, z: number, index: number): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.82, 1.65), new THREE.MeshStandardMaterial({ color: 0x65747b, roughness: 0.7, metalness: 0.2 })); bench.position.y = 0.42; bench.castShadow = true;
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 18), new THREE.MeshStandardMaterial({ color: 0xe5ecee, roughness: 0.4 })); gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 1.12, 0);
    g.add(bench, gauge); this.addLocalLabel(g, `M-0${index}`, 1.85, 0x5287b7); this.group.add(g); return g;
  }

  private machine(x: number, z: number): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.5, 3.6), new THREE.MeshStandardMaterial({ color: 0x53646c, roughness: 0.58, metalness: 0.28 })); body.position.y = 1.25; body.castShadow = true;
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.26, 14), new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.45, metalness: 0.2 })); rotor.rotation.x = Math.PI / 2; rotor.position.set(0, 1.6, 1.95); g.userData.rotor = rotor;
    g.add(body, rotor); this.group.add(g); return g;
  }

  private packageBox(x: number, z: number, label: string): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.15, 1.25), new THREE.MeshStandardMaterial({ color: 0x9a7147, roughness: 0.86 })); b.position.y = 0.58; b.castShadow = true; g.add(b); this.addLocalLabel(g, label, 1.5, 0xb77042); this.group.add(g); return g;
  }

  private socketPad(x: number, z: number, color: number, label: string): THREE.Group {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 20), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.65 })); pad.position.y = 0.05; g.add(pad); this.addLocalLabel(g, label, 0.42, color); this.group.add(g); return g;
  }

  private addConveyor(x: number, z: number, length: number): void {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(length, 0.75, 2.0), new THREE.MeshStandardMaterial({ color: 0x3f5059, roughness: 0.55, metalness: 0.3 })); frame.position.set(x, 0.52, z); frame.castShadow = true; this.group.add(frame);
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0xaab3b6, roughness: 0.32, metalness: 0.7 });
    for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.7, 8), rollerMat); r.rotation.x = Math.PI / 2; r.position.set(x - length / 2 + 1 + i * ((length - 2) / 11), 0.96, z); this.group.add(r); }
  }

  private action(id: string, prompt: string, object: THREE.Object3D, radius: number): void {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 20), new THREE.MeshBasicMaterial({ color: 0xf4c542 })); marker.rotation.x = Math.PI / 2; marker.position.y = 2.55; object.add(marker); object.userData.marker = marker;
    this.actions.push({ id, prompt, object, radius });
  }

  private scan(id: string, prompt: string, object: THREE.Object3D, radius: number): void { this.scannables.push({ id, prompt, object, radius }); }

  private addSign(text: string, x: number, y: number, z: number, color: number, width: number): void {
    const sprite = this.labelSprite(text, color, width); sprite.position.set(x, y, z); this.group.add(sprite);
  }

  private addLocalLabel(parent: THREE.Object3D, text: string, y: number, color: number): void { const sprite = this.labelSprite(text, color, 2.7); sprite.position.set(0, y, 0); parent.add(sprite); }

  private labelSprite(text: string, color: number, width: number): THREE.Sprite {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'rgba(8,18,24,.86)'; ctx.roundRect(6, 10, 500, 108, 18); ctx.fill();
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = '#f4f7f8'; ctx.font = '700 38px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 65, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true })); sprite.scale.set(width, width * 0.25, 1); return sprite;
  }

  private meshBox(w: number, h: number, d: number, color: number): THREE.Mesh { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.82 })); }
}
