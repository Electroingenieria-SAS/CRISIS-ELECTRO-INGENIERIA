import * as THREE from 'three';
import type { Collider, WorldAction } from '../types';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from '../visual/IndustrialKit';

/**
 * Production vertical slice.
 * Replaces the old row of abstract buttons with one coherent production cell.
 */
export class ProductionZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];

  private readonly kit = new IndustrialKit();
  private indicators: THREE.Mesh[] = [];
  private mechanismMarkers: THREE.Mesh[] = [];
  private conveyorRollers: THREE.Mesh[] = [];
  private workers: THREE.Group[] = [];
  private beacon!: THREE.Mesh;
  private clock = 0;

  constructor() {
    this.group.name = 'V8_ZONE_PRODUCTION';
  }

  init(): void {
    this.buildShell();
    this.buildBriefingStation();
    this.buildCell();
    this.buildInterlocks();
    this.buildStatusBoard();
    this.buildFirstPieceStation();
    this.buildWayfinding();
    this.setInterlocks([false, false, false, false]);
  }

  update(dt: number): void {
    this.clock += dt;
    for (const roller of this.conveyorRollers) roller.rotation.x += dt * 0.9;
    for (const marker of this.mechanismMarkers) {
      marker.position.y = Number(marker.userData.baseY ?? 2.18) + Math.sin(this.clock * 2.6 + Number(marker.userData.phase ?? 0)) * 0.07;
      marker.rotation.y += dt * 0.9;
    }
    for (let index = 0; index < this.workers.length; index++) {
      const worker = this.workers[index]!;
      worker.position.y = Math.sin(this.clock * 1.45 + index) * 0.008;
      const head = worker.getObjectByName('worker-head');
      if (head) head.rotation.y = Math.sin(this.clock * 0.62 + index * 0.8) * 0.08;
    }
    if (this.beacon) {
      const material = this.beacon.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = 0.28 + (Math.sin(this.clock * 4.2) * 0.5 + 0.5) * 0.55;
      }
      this.beacon.rotation.y += dt * 1.4;
    }
  }

  setInterlocks(state: boolean[]): void {
    this.indicators.forEach((indicator, index) => {
      const ok = Boolean(state[index]);
      const material = indicator.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.setHex(ok ? C.green : C.red);
        material.emissive.setHex(ok ? C.green : C.red);
        material.emissiveIntensity = ok ? 0.72 : 0.44;
      }
    });
    if (this.beacon) {
      const allOk = state.length >= 4 && state.every(Boolean);
      const material = this.beacon.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.setHex(allOk ? C.green : 0xf0a23d);
        material.emissive.setHex(allOk ? C.green : 0xf0a23d);
      }
    }
  }

  private buildShell(): void {
    const floor = this.kit.box(31.8, 0.16, 24.4, this.kit.materials.floor, false, true);
    floor.position.set(-24, 0.03, -27);
    this.group.add(floor);

    const backWall = this.kit.box(31.2, 5.0, 0.28, this.kit.materials.white);
    backWall.position.set(-24, 2.5, -38.9);
    this.group.add(backWall);
    const leftWall = this.kit.box(0.28, 5.0, 23.8, this.kit.materials.white);
    leftWall.position.set(-39.55, 2.5, -27);
    this.group.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.position.x = -8.45;
    this.group.add(rightWall);

    for (const x of [-37.2, -30.6, -24, -17.4, -10.8]) {
      const column = this.kit.box(0.25, 5.35, 0.28, this.kit.materials.steelDark);
      column.position.set(x, 2.67, -38.35);
      const frontColumn = column.clone();
      frontColumn.position.z = -15.9;
      const beam = this.kit.box(0.24, 0.22, 22.6, this.kit.materials.steelDark);
      beam.position.set(x, 4.93, -27.1);
      this.group.add(column, frontColumn, beam);
    }

    for (const z of [-34.8, -27.0, -19.2]) {
      const cross = this.kit.box(29.5, 0.15, 0.2, this.kit.materials.steel);
      cross.position.set(-24, 4.88, z);
      this.group.add(cross);
    }

    for (const x of [-34.2, -24, -13.8]) {
      const lampA = this.kit.overheadLight(3.1);
      lampA.position.set(x, 4.58, -31.3);
      const lampB = this.kit.overheadLight(3.1);
      lampB.position.set(x, 4.58, -22.5);
      this.group.add(lampA, lampB);
    }

    this.colliders.push(
      { minX: -40.1, maxX: -39.0, minZ: -39.5, maxZ: -15.2 },
      { minX: -9.0, maxX: -7.9, minZ: -39.5, maxZ: -15.2 },
      { minX: -40.0, maxX: -8.0, minZ: -39.5, maxZ: -38.2 }
    );
  }

  private buildBriefingStation(): void {
    const andres = this.worker(-35.1, -34.0, C.green);
    this.addAction('npc-andres', 'Hablar con Andrés · Producción', andres, 2.15);

    const station = this.kit.workstation();
    station.position.set(-33.0, 0, -35.1);
    this.group.add(station);

    const docs = new THREE.Group();
    docs.position.set(-31.9, 0, -34.2);
    this.group.add(docs);
    this.addMarker(docs, C.blue, 2.15);
    this.actions.push({ id: 'production-docs', prompt: 'Revisar OT / set-up / primera pieza', object: docs, radius: 2.2 });

    const tray = this.kit.box(1.08, 0.06, 0.72, this.kit.materials.black);
    tray.position.set(-31.9, 1.12, -35.0);
    this.group.add(tray);
    for (let i = 0; i < 3; i++) {
      const page = this.kit.box(0.82, 0.012, 0.52, this.kit.materials.white, false, false);
      page.position.set(-31.9 + i * 0.03, 1.17 + i * 0.015, -35.0 - i * 0.02);
      this.group.add(page);
    }

    const sign = this.kit.sign('PUESTO DE LIBERACIÓN', 4.25, 0.6, '#173346', '#ffffff', '#55b985');
    sign.position.set(-33.0, 3.45, -38.68);
    this.group.add(sign);
  }

  private buildCell(): void {
    const cellFloor = this.kit.floorDecal('CELDA CT-48', 17.8, 10.2, '#33474d', '#55b985');
    cellFloor.position.set(-22.4, 0.18, -27.2);
    this.group.add(cellFloor);

    const machineBase = this.kit.box(7.4, 0.65, 4.7, this.kit.materials.steelDark);
    machineBase.position.set(-22.2, 0.36, -28.0);
    this.group.add(machineBase);

    const body = this.kit.box(5.7, 2.9, 3.4, this.kit.materials.navy);
    body.position.set(-22.2, 2.05, -28.0);
    this.group.add(body);
    const front = this.kit.box(4.6, 1.8, 0.16, this.kit.materials.steel);
    front.position.set(-22.2, 2.0, -26.23);
    this.group.add(front);

    const viewingWindow = this.kit.box(2.55, 1.08, 0.045, this.kit.materials.glass, false, false);
    viewingWindow.position.set(-22.2, 2.3, -26.12);
    this.group.add(viewingWindow);

    for (const x of [-24.45, -19.95]) {
      const safetyPost = this.kit.box(0.18, 2.8, 0.18, this.kit.materials.yellow);
      safetyPost.position.set(x, 1.45, -25.95);
      this.group.add(safetyPost);
    }

    const conveyorFrame = this.kit.box(11.3, 0.18, 2.0, this.kit.materials.steelDark);
    conveyorFrame.position.set(-22.2, 0.86, -20.9);
    this.group.add(conveyorFrame);
    for (let x = -27.2; x <= -17.2; x += 0.62) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.72, 12), this.kit.materials.steel);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(x, 1.02, -20.9);
      roller.castShadow = true;
      this.conveyorRollers.push(roller);
      this.group.add(roller);
    }

    for (const x of [-27.0, -17.4]) {
      const barrier = this.kit.barrier(2.2);
      barrier.position.set(x, 0, -24.0);
      barrier.rotation.y = Math.PI / 2;
      this.group.add(barrier);
    }

    const beaconMaterial = new THREE.MeshStandardMaterial({ color: 0xf0a23d, emissive: 0xf0a23d, emissiveIntensity: 0.5, roughness: 0.25 });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.25, 14), beaconMaterial);
    this.beacon.position.set(-18.1, 4.0, -27.1);
    this.group.add(this.beacon);

    this.colliders.push({ minX: -26.2, maxX: -18.1, minZ: -30.7, maxZ: -25.7 });
  }

  private buildInterlocks(): void {
    const mechanisms: Array<{ id: string; label: string; prompt: string; x: number; z: number; kind: 'disconnect' | 'guard' | 'clamp' | 'hmi' }> = [
      { id: 'prod-sw-0', label: 'ENERGÍA', prompt: 'Conmutar seccionador principal', x: -35.4, z: -24.0, kind: 'disconnect' },
      { id: 'prod-sw-1', label: 'GUARDA', prompt: 'Accionar enclavamiento del resguardo', x: -29.7, z: -18.0, kind: 'guard' },
      { id: 'prod-sw-2', label: 'FIJACIÓN', prompt: 'Accionar fijación de la pieza', x: -15.5, z: -21.0, kind: 'clamp' },
      { id: 'prod-sw-3', label: 'PROGRAMA', prompt: 'Conmutar receta del HMI', x: -11.6, z: -31.6, kind: 'hmi' }
    ];

    for (const item of mechanisms) {
      let object: THREE.Group;
      if (item.kind === 'disconnect') object = this.disconnectStation(item.label);
      else if (item.kind === 'guard') object = this.guardStation(item.label);
      else if (item.kind === 'clamp') object = this.clampStation(item.label);
      else object = this.hmiStation(item.label);
      object.position.set(item.x, 0, item.z);
      this.group.add(object);
      this.addAction(item.id, item.prompt, object, 2.15);
    }
  }

  private buildStatusBoard(): void {
    const group = new THREE.Group();
    group.position.set(-12.8, 0, -35.2);
    this.group.add(group);

    const cabinet = this.kit.box(6.15, 2.6, 0.36, this.kit.materials.navy);
    cabinet.position.y = 1.9;
    group.add(cabinet);
    const header = this.kit.sign('ESTADO DE LIBERACIÓN', 5.5, 0.48, '#173346', '#ffffff', '#55b985');
    header.position.set(0, 3.0, 0.22);
    group.add(header);

    const labels = ['ENERGÍA', 'GUARDA', 'FIJACIÓN', 'PROGRAMA'];
    labels.forEach((label, index) => {
      const x = -2.18 + index * 1.46;
      const lampMaterial = new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 0.42, roughness: 0.28 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10), lampMaterial);
      lamp.position.set(x, 2.0, 0.25);
      group.add(lamp);
      this.indicators.push(lamp);
      const sign = this.kit.sign(label, 1.18, 0.34, '#273d47', '#ffffff', '#55b985');
      sign.position.set(x, 1.35, 0.22);
      group.add(sign);
    });
  }

  private buildFirstPieceStation(): void {
    const station = this.kit.workstation();
    station.position.set(-12.2, 0, -18.4);
    station.rotation.y = Math.PI;
    this.group.add(station);

    const tray = this.kit.box(1.4, 0.08, 0.95, this.kit.materials.steel);
    tray.position.set(-12.0, 1.12, -17.8);
    this.group.add(tray);
    const sample = this.kit.box(0.82, 0.32, 0.48, this.kit.materials.blue);
    sample.position.set(-12.0, 1.32, -17.8);
    this.group.add(sample);
    const sign = this.kit.sign('PRIMERA PIEZA', 3.0, 0.52, '#173346', '#ffffff', '#55b985');
    sign.position.set(-12.2, 3.0, -16.4);
    this.group.add(sign);
  }

  private buildWayfinding(): void {
    const zone = this.kit.sign('PRODUCCIÓN · CELDA CT-48', 7.0, 0.8, '#173346', '#ffffff', '#55b985');
    zone.position.set(-24, 4.18, -38.7);
    this.group.add(zone);

    const pedestrian = this.kit.floorDecal('RUTA SEGURA', 8.5, 0.88, '#3c4d53', '#f3c83f');
    pedestrian.position.set(-24.0, 0.19, -16.6);
    this.group.add(pedestrian);

    for (let x = -36.5; x <= -11.5; x += 3.4) {
      const stripe = this.kit.box(1.5, 0.016, 0.1, this.kit.materials.yellow, false, false);
      stripe.position.set(x, 0.19, -17.6);
      this.group.add(stripe);
    }
  }

  private disconnectStation(label: string): THREE.Group {
    const group = new THREE.Group();
    const cabinet = this.kit.box(1.45, 2.25, 0.62, this.kit.materials.steelDark);
    cabinet.position.y = 1.15;
    group.add(cabinet);
    const plate = this.kit.sign(label, 1.1, 0.34, '#f3c83f', '#17232a', '#173346');
    plate.position.set(0, 1.9, 0.33);
    group.add(plate);
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.15, 0.38);
    const lever = this.kit.box(0.14, 0.9, 0.16, this.kit.materials.red);
    lever.position.y = -0.32;
    pivot.rotation.z = -0.45;
    pivot.add(lever);
    group.add(pivot);
    return group;
  }

  private guardStation(label: string): THREE.Group {
    const group = new THREE.Group();
    const frameTop = this.kit.box(3.1, 0.15, 0.15, this.kit.materials.yellow);
    frameTop.position.y = 2.6;
    group.add(frameTop);
    for (const x of [-1.45, 1.45]) {
      const post = this.kit.box(0.15, 2.6, 0.15, this.kit.materials.yellow);
      post.position.set(x, 1.3, 0);
      group.add(post);
    }
    const meshMat = new THREE.MeshStandardMaterial({ color: 0x6a7478, roughness: 0.6, metalness: 0.5, transparent: true, opacity: 0.55 });
    const gate = this.kit.box(2.75, 2.1, 0.06, meshMat, false, false);
    gate.position.y = 1.2;
    group.add(gate);
    const sign = this.kit.sign(label, 1.65, 0.34, '#f3c83f', '#17232a', '#173346');
    sign.position.set(0, 2.2, 0.12);
    group.add(sign);
    return group;
  }

  private clampStation(label: string): THREE.Group {
    const group = new THREE.Group();
    const bench = this.kit.box(2.4, 0.18, 1.6, this.kit.materials.steel);
    bench.position.y = 1.0;
    group.add(bench);
    for (const x of [-0.86, 0.86]) {
      const leg = this.kit.box(0.15, 1.0, 0.15, this.kit.materials.steelDark);
      leg.position.set(x, 0.5, 0);
      group.add(leg);
    }
    const fixture = this.kit.box(1.1, 0.36, 0.78, this.kit.materials.blue);
    fixture.position.y = 1.26;
    group.add(fixture);
    for (const x of [-0.42, 0.42]) {
      const clamp = this.kit.box(0.15, 0.7, 0.15, this.kit.materials.yellow);
      clamp.position.set(x, 1.55, 0);
      clamp.rotation.z = x < 0 ? -0.4 : 0.4;
      group.add(clamp);
    }
    const sign = this.kit.sign(label, 1.7, 0.34, '#173346', '#ffffff', '#55b985');
    sign.position.set(0, 2.25, 0);
    group.add(sign);
    return group;
  }

  private hmiStation(label: string): THREE.Group {
    const group = new THREE.Group();
    const stand = this.kit.box(0.35, 1.55, 0.35, this.kit.materials.steelDark);
    stand.position.y = 0.78;
    group.add(stand);
    const panel = this.kit.box(1.7, 1.2, 0.24, this.kit.materials.navy);
    panel.position.y = 1.72;
    group.add(panel);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x326f8f, emissive: 0x326f8f, emissiveIntensity: 0.32, roughness: 0.25 });
    const screen = this.kit.box(1.36, 0.74, 0.025, screenMat, false, false);
    screen.position.set(0, 1.8, 0.135);
    group.add(screen);
    const sign = this.kit.sign(label, 1.35, 0.3, '#f3c83f', '#17232a', '#173346');
    sign.position.set(0, 2.45, 0.08);
    group.add(sign);
    return group;
  }

  private worker(x: number, z: number, accent: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const pants = new THREE.MeshStandardMaterial({ color: 0x2e3940, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x173346, roughness: 0.65 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd6a078, roughness: 0.75 });
    const vest = new THREE.MeshStandardMaterial({ color: 0xf3c83f, roughness: 0.5 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, emissive: accent, emissiveIntensity: 0.08 });

    const legL = this.kit.box(0.24, 0.82, 0.26, pants);
    legL.position.set(-0.15, 0.46, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.58, 4, 10), shirt);
    torso.position.y = 1.43;
    torso.scale.z = 0.7;
    const vestMesh = this.kit.box(0.72, 0.62, 0.17, vest);
    vestMesh.position.set(0, 1.44, 0.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), skin);
    head.name = 'worker-head';
    head.position.y = 2.15;
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 14), vest);
    helmet.position.y = 2.42;
    const badge = this.kit.box(0.14, 0.19, 0.025, accentMat);
    badge.position.set(0.2, 1.58, 0.395);
    group.add(legL, legR, torso, vestMesh, head, helmet, badge);
    group.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    this.group.add(group);
    this.workers.push(group);
    return group;
  }

  private addAction(id: string, prompt: string, object: THREE.Object3D, radius: number): void {
    this.addMarker(object, C.yellow, 2.18);
    this.actions.push({ id, prompt, object, radius });
  }

  private addMarker(parent: THREE.Object3D, color: number, y: number): void {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.44, roughness: 0.28 });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), material);
    marker.position.y = y;
    marker.userData.baseY = y;
    marker.userData.phase = parent.position.x * 0.17 + parent.position.z * 0.11;
    parent.add(marker);
    parent.userData.marker = marker;
    this.mechanismMarkers.push(marker);
  }
}
