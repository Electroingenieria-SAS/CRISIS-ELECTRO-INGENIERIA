import * as THREE from 'three';
import type { Carryable, Collider, DropSocket, WorldAction } from '../types';

const C = {
  yellow: 0xf4c542,
  yellowDark: 0xb68a1f,
  blue: 0x1769a6,
  navy: 0x162630,
  steel: 0x4a5a62,
  steelDark: 0x2f3c43,
  concrete: 0x7f8b8f,
  floor: 0x59676d,
  white: 0xe9edef,
  red: 0xc94f4f,
  green: 0x4b9b6d,
  wood: 0x795c3e,
  cardboard: 0x9b7048,
  black: 0x161b1e
};

/**
 * Premium vertical slice for Recepción / Almacén.
 * This module OWNS the warehouse geometry and interactions. Nothing else should
 * draw a second warehouse on top of it.
 */
export class WarehouseZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly scannables: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();

  private beacons: THREE.Mesh[] = [];
  private clock = 0;

  constructor() {
    this.group.name = 'V8_ZONE_WAREHOUSE';
  }

  init(): void {
    this.buildShell();
    this.buildReceivingOffice();
    this.buildDockBays();
    this.buildStorageRacks();
    this.buildInspectionLane();
    this.buildQuarantine();
    this.buildForklift();
    this.buildSafetyDetails();
  }

  update(dt: number): void {
    this.clock += dt;
    const pulse = 0.22 + (Math.sin(this.clock * 4.5) * 0.5 + 0.5) * 0.5;
    for (const beacon of this.beacons) {
      const material = beacon.material;
      if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = pulse;
      beacon.rotation.y += dt * 1.5;
    }
  }

  private buildShell(): void {
    const floor = this.box(30, 0.16, 25, C.floor, 0.82, 0.06);
    floor.position.set(-34, 0.05, 10);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Concrete apron at the front creates a clear receiving threshold.
    const apron = this.box(31.5, 0.1, 5.2, C.concrete, 0.95, 0.02);
    apron.position.set(-34, 0.03, 24.4);
    apron.receiveShadow = true;
    this.group.add(apron);

    const wallMat = this.mat(0xc9ced0, 0.8, 0.04);
    const frameMat = this.mat(C.steelDark, 0.5, 0.42);
    const back = new THREE.Mesh(new THREE.BoxGeometry(30, 4.4, 0.35), wallMat);
    back.position.set(-34, 2.2, -2.45);
    back.castShadow = true;
    back.receiveShadow = true;
    this.group.add(back);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.4, 25), wallMat);
    left.position.set(-49, 2.2, 10);
    left.castShadow = true;
    this.group.add(left);
    const right = left.clone();
    right.position.x = -19;
    this.group.add(right);

    // Structural portal frames, visible from the isometric camera without a roof.
    for (const x of [-47, -40.5, -34, -27.5, -21]) {
      const postA = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.8, 0.28), frameMat);
      postA.position.set(x, 2.4, -1.8);
      const postB = postA.clone();
      postB.position.z = 20.7;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 22.5), frameMat);
      beam.position.set(x, 4.65, 9.45);
      this.group.add(postA, postB, beam);
    }

    // Yellow perimeter stripe reads as industrial safety zoning, not a generic room.
    const stripeMat = new THREE.MeshBasicMaterial({ color: C.yellow });
    for (const z of [21.7, -1.25]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(29, 0.025, 0.14), stripeMat);
      stripe.position.set(-34, 0.15, z);
      this.group.add(stripe);
    }

    this.colliders.push(
      { minX: -49.6, maxX: -48.55, minZ: -2.8, maxZ: 22.2 },
      { minX: -19.45, maxX: -18.4, minZ: -2.8, maxZ: 22.2 },
      { minX: -49.5, maxX: -18.5, minZ: -2.9, maxZ: -1.8 }
    );

    this.sign('RECEPCIÓN / ALMACÉN', new THREE.Vector3(-34, 4.15, -2.08), C.yellow, 7.4);
    this.sign('FLUJO PEATONAL', new THREE.Vector3(-34, 0.23, 23.6), C.yellow, 3.3);
  }

  private buildReceivingOffice(): void {
    // Small glazed desk instead of a floating terminal.
    const desk = this.box(5.4, 0.82, 2.3, 0x394950, 0.62, 0.18);
    desk.position.set(-44.8, 0.42, 4.3);
    desk.castShadow = true;
    this.group.add(desk);

    const counter = this.box(5.7, 0.14, 2.55, 0xc7ced0, 0.34, 0.06);
    counter.position.set(-44.8, 0.9, 4.3);
    this.group.add(counter);

    const screen = this.box(1.5, 0.92, 0.12, C.navy, 0.42, 0.12);
    screen.position.set(-44.5, 1.55, 4.05);
    screen.rotation.x = -0.1;
    this.group.add(screen);
    const glow = this.box(1.2, 0.64, 0.025, C.blue, 0.28, 0.04);
    glow.position.set(-44.5, 1.55, 3.98);
    const glowMat = glow.material as THREE.MeshStandardMaterial;
    glowMat.emissive.setHex(C.blue);
    glowMat.emissiveIntensity = 0.22;
    this.group.add(glow);

    // Document trays physically communicate that this station is about evidence.
    for (let i = 0; i < 3; i++) {
      const sheet = this.box(0.85, 0.025, 0.58, 0xf0eee3, 0.88, 0);
      sheet.position.set(-43.0 + i * 0.24, 1.0 + i * 0.025, 4.35 - i * 0.06);
      sheet.rotation.y = -0.12 + i * 0.08;
      this.group.add(sheet);
    }

    const mateo = this.worker(-46.5, 3.2);
    this.addAction('npc-mateo', 'Hablar con Mateo · Recepción', mateo, 2.1);

    const docsAnchor = new THREE.Group();
    docsAnchor.position.set(-43.8, 0, 5.2);
    this.group.add(docsAnchor);
    this.marker(docsAnchor, C.blue, 2.25);
    this.addAction('warehouse-docs', 'Revisar Pedido / Remisión / COA', docsAnchor, 2.15, false);

    this.sign('CONTROL DOCUMENTAL', new THREE.Vector3(-44.8, 2.55, 3.2), C.blue, 3.8);
  }

  private buildDockBays(): void {
    const doorMat = this.mat(0x77868c, 0.55, 0.32);
    const rubberMat = this.mat(C.black, 0.9, 0.02);
    const bayXs = [-44, -34, -24];

    bayXs.forEach((x, index) => {
      const door = new THREE.Group();
      door.position.set(x, 0, -2.18);
      for (let y = 0; y < 6; y++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.58, 0.12), doorMat);
        slat.position.y = 0.42 + y * 0.56;
        door.add(slat);
      }
      const header = this.box(6.7, 0.26, 0.35, C.steelDark, 0.45, 0.35);
      header.position.set(0, 3.8, 0);
      door.add(header);
      const bumperL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.5), rubberMat);
      bumperL.position.set(-3.25, 0.62, 0.25);
      const bumperR = bumperL.clone(); bumperR.position.x = 3.25;
      door.add(bumperL, bumperR);
      this.group.add(door);
      this.sign(`MUELLE 0${index + 1}`, new THREE.Vector3(x, 3.42, -1.92), C.yellow, 2.35);
    });
  }

  private buildStorageRacks(): void {
    // Repeated low-poly rack system: one geometry, shared materials.
    const uprightGeo = new THREE.BoxGeometry(0.16, 3.5, 0.16);
    const beamGeo = new THREE.BoxGeometry(4.1, 0.14, 0.18);
    const uprightMat = this.mat(0x31506a, 0.55, 0.3);
    const beamMat = this.mat(C.yellowDark, 0.58, 0.22);
    const shelfMat = this.mat(0x6b7578, 0.76, 0.24);

    const buildRack = (x: number, z: number, rotation = 0) => {
      const rack = new THREE.Group();
      rack.position.set(x, 0, z);
      rack.rotation.y = rotation;
      for (const dx of [-1.95, 1.95]) {
        for (const dz of [-0.62, 0.62]) {
          const upright = new THREE.Mesh(uprightGeo, uprightMat);
          upright.position.set(dx, 1.75, dz);
          rack.add(upright);
        }
      }
      for (const y of [1.1, 2.15, 3.2]) {
        for (const dz of [-0.62, 0.62]) {
          const beam = new THREE.Mesh(beamGeo, beamMat);
          beam.position.set(0, y, dz);
          rack.add(beam);
        }
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.08, 1.1), shelfMat);
        shelf.position.set(0, y + 0.06, 0);
        rack.add(shelf);
      }
      rack.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
      this.group.add(rack);
    };

    buildRack(-45.7, 10.1);
    buildRack(-45.7, 15.0);
    buildRack(-22.7, 7.0);
    buildRack(-22.7, 12.0);

    // Rack footprints are real collision, leaving a generous central inspection lane.
    this.colliders.push(
      { minX: -48.1, maxX: -43.3, minZ: 9.1, maxZ: 11.1 },
      { minX: -48.1, maxX: -43.3, minZ: 14.0, maxZ: 16.0 },
      { minX: -25.1, maxX: -20.3, minZ: 6.0, maxZ: 8.0 },
      { minX: -25.1, maxX: -20.3, minZ: 11.0, maxZ: 13.0 }
    );
  }

  private buildInspectionLane(): void {
    // Central evidence lane with three positions and explicit raw labels.
    const lane = this.box(17.5, 0.035, 7.0, 0x46565d, 0.93, 0.02);
    lane.position.set(-34.3, 0.14, 9.4);
    this.group.add(lane);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe1c83d });
    for (const x of [-42.5, -34.2, -25.9]) {
      const outlineA = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.02, 0.08), lineMat);
      outlineA.position.set(x, 0.18, 6.65);
      const outlineB = outlineA.clone(); outlineB.position.z = 12.1;
      const sideA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 5.5), lineMat);
      sideA.position.set(x - 2.8, 0.18, 9.38);
      const sideB = sideA.clone(); sideB.position.x = x + 2.8;
      this.group.add(outlineA, outlineB, sideA, sideB);
    }

    const palletA = this.pallet(-42.5, 9.4, 0x507fa1, 'A');
    const palletB = this.pallet(-34.2, 9.4, 0xa46c3e, 'B');
    const palletC = this.pallet(-25.9, 9.4, 0x665b52, 'C');

    this.addScan('pallet-a', 'Escanear Pallet A', palletA, 4.2);
    this.addScan('pallet-b', 'Escanear Pallet B', palletB, 4.2);
    this.addScan('pallet-c', 'Escanear Pallet C', palletC, 4.2);
    this.carryables.set('pallet-b', { id: 'pallet-b', label: 'Pallet B · L-0908-B', object: palletB, radius: 2.1 });

    this.sign('ÁREA DE INSPECCIÓN DE RECIBO', new THREE.Vector3(-34.2, 2.75, 15.5), C.yellow, 5.1);
  }

  private buildQuarantine(): void {
    // Quarantine is a physical cage, not just a glowing circle.
    const x = -43.7;
    const z = 18.7;
    const floor = this.box(7.2, 0.08, 4.2, 0x5a3f42, 0.9, 0.02);
    floor.position.set(x, 0.12, z);
    this.group.add(floor);

    const cageMat = this.mat(0x555f63, 0.48, 0.58);
    const rail = (px: number, pz: number, w: number, d: number) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 1.55, d), cageMat);
      bar.position.set(px, 0.82, pz);
      bar.castShadow = true;
      this.group.add(bar);
    };
    rail(x - 3.5, z, 0.12, 4.2);
    rail(x + 3.5, z, 0.12, 4.2);
    rail(x, z + 2.0, 7.1, 0.12);

    for (let i = 0; i < 4; i++) {
      const hazard = this.box(0.65, 0.03, 0.12, i % 2 === 0 ? C.yellow : C.black, 0.8, 0);
      hazard.position.set(x - 2.4 + i * 1.6, 0.18, z - 2.0);
      hazard.rotation.y = -0.55;
      this.group.add(hazard);
    }

    const socket = new THREE.Group();
    socket.position.set(x, 0, z);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.06, 24), this.mat(C.red, 0.62, 0.08));
    pad.position.y = 0.18;
    const padMat = pad.material as THREE.MeshStandardMaterial;
    padMat.emissive.setHex(C.red);
    padMat.emissiveIntensity = 0.08;
    socket.add(pad);
    this.group.add(socket);
    this.sockets.set('quarantine', { id: 'quarantine', label: 'Cuarentena controlada', object: socket, radius: 2.9 });

    this.sign('CUARENTENA', new THREE.Vector3(x, 2.5, z + 1.85), C.red, 3.4);
  }

  private buildForklift(): void {
    // Purpose-built low-poly forklift. Kept static for this slice to avoid physics cost.
    const g = new THREE.Group();
    g.position.set(-23.6, 0, 17.6);
    g.rotation.y = Math.PI * 0.12;

    const body = this.box(2.1, 1.2, 2.5, C.yellowDark, 0.48, 0.14);
    body.position.y = 0.85;
    const counter = this.box(2.0, 0.8, 1.0, 0xd2a72f, 0.5, 0.12);
    counter.position.set(0, 1.45, 0.72);
    const mast = this.box(0.18, 3.0, 0.18, C.steelDark, 0.4, 0.62);
    mast.position.set(-0.72, 1.55, -1.35);
    const mast2 = mast.clone(); mast2.position.x = 0.72;
    const cross = this.box(1.7, 0.18, 0.18, C.steelDark, 0.4, 0.62);
    cross.position.set(0, 2.6, -1.35);
    const forkL = this.box(0.14, 0.1, 2.2, C.steelDark, 0.38, 0.7);
    forkL.position.set(-0.48, 0.24, -2.2);
    const forkR = forkL.clone(); forkR.position.x = 0.48;
    g.add(body, counter, mast, mast2, cross, forkL, forkR);

    const wheelMat = this.mat(C.black, 0.92, 0.02);
    for (const x of [-0.9, 0.9]) for (const z of [-0.72, 0.74]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      g.add(wheel);
    }

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 10), this.mat(C.yellow, 0.34, 0.04));
    beacon.position.set(0, 2.12, 0.72);
    const beaconMat = beacon.material as THREE.MeshStandardMaterial;
    beaconMat.emissive.setHex(C.yellow);
    beaconMat.emissiveIntensity = 0.35;
    g.add(beacon);
    this.beacons.push(beacon);

    g.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    this.group.add(g);
    this.colliders.push({ minX: -25.2, maxX: -21.8, minZ: 15.5, maxZ: 20.2 });
  }

  private buildSafetyDetails(): void {
    const bollardMat = this.mat(C.yellow, 0.5, 0.14);
    for (const [x, z] of [[-48.1, 2.0], [-41.0, 2.0], [-37.0, 2.0], [-31.0, 2.0], [-27.0, 2.0], [-19.9, 2.0]] as Array<[number, number]>) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.95, 10), bollardMat);
      post.position.set(x, 0.48, z);
      post.castShadow = true;
      this.group.add(post);
    }

    // Directional arrows are geometry, so they remain crisp and cheap.
    for (const z of [17.0, 20.0, 23.0]) {
      const stem = this.box(0.16, 0.02, 1.8, C.yellow, 0.9, 0);
      stem.position.set(-34, 0.17, z);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.0, 3), new THREE.MeshBasicMaterial({ color: C.yellow }));
      head.rotation.x = Math.PI / 2;
      head.position.set(-34, 0.19, z - 1.15);
      this.group.add(stem, head);
    }
  }

  private worker(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pants = this.mat(0x334149, 0.82, 0.02);
    const vest = this.mat(C.yellow, 0.58, 0.04);
    const skin = this.mat(0xd3a078, 0.78, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.84, 0.4), vest); torso.position.y = 1.45;
    const reflective = this.box(0.78, 0.07, 0.43, C.white, 0.35, 0.05); reflective.position.y = 1.52;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin); head.position.y = 2.1;
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.36, 0.2, 12), this.mat(C.yellow, 0.48, 0.05)); helmet.position.y = 2.37;
    const legA = this.box(0.26, 0.85, 0.3, 0x334149, 0.82, 0.02); legA.position.set(-0.19, 0.65, 0);
    const legB = legA.clone(); legB.position.x = 0.19;
    g.add(torso, reflective, head, helmet, legA, legB);
    g.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    this.group.add(g);
    return g;
  }

  private pallet(x: number, z: number, color: number, label: string): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = this.box(2.45, 0.2, 1.75, C.wood, 0.94, 0);
    base.position.y = 0.12;
    g.add(base);
    const boxMat = this.mat(color, 0.78, 0.01);
    for (let row = 0; row < 2; row++) for (const col of [-0.58, 0.58]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.74, 1.35), boxMat);
      box.position.set(col, 0.56 + row * 0.75, 0);
      box.castShadow = true;
      g.add(box);
    }
    // White label plate makes scanner target visually obvious without exposing the answer.
    const tag = this.box(1.0, 0.42, 0.03, C.white, 0.42, 0);
    tag.position.set(0, 1.2, 0.70);
    g.add(tag);
    this.sign(`PALLET ${label}`, new THREE.Vector3(0, 2.12, 0), color, 2.4, g);
    this.group.add(g);
    return g;
  }

  private addAction(id: string, prompt: string, object: THREE.Object3D, radius: number, addMarker = true): void {
    if (addMarker) this.marker(object, C.yellow, 2.55);
    this.actions.push({ id, prompt, object, radius });
  }

  private addScan(id: string, prompt: string, object: THREE.Object3D, radius: number): void {
    this.scannables.push({ id, prompt, object, radius });
  }

  private marker(parent: THREE.Object3D, color: number, y: number): void {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 20), new THREE.MeshBasicMaterial({ color }));
    marker.rotation.x = Math.PI / 2;
    marker.position.y = y;
    parent.add(marker);
    parent.userData.marker = marker;
  }

  private sign(text: string, position: THREE.Vector3, color: number, width: number, parent: THREE.Object3D = this.group): void {
    const sprite = this.labelSprite(text, color, width);
    sprite.position.copy(position);
    parent.add(sprite);
  }

  private labelSprite(text: string, color: number, width: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(12,22,27,.9)';
    ctx.roundRect(6, 10, 500, 108, 16);
    ctx.fill();
    ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#f6f8f9';
    ctx.font = '700 36px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 65, 470);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
    sprite.scale.set(width, width * 0.25, 1);
    return sprite;
  }

  private box(w: number, h: number, d: number, color: number, roughness: number, metalness: number): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, roughness, metalness));
  }

  private mat(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
}
