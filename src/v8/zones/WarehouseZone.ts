import * as THREE from 'three';
import type { Carryable, Collider, DropSocket, WorldAction } from '../types';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from '../visual/IndustrialKit';

/**
 * V8 vertical slice: Recepción / Almacén.
 * This sector owns its geometry, interactions and collision layout.
 */
export class WarehouseZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly scannables: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();

  private readonly kit = new IndustrialKit();
  private beacons: THREE.Mesh[] = [];
  private fanRotors: THREE.Object3D[] = [];
  private clock = 0;

  constructor() {
    this.group.name = 'V8_ZONE_WAREHOUSE';
  }

  init(): void {
    this.buildArchitecture();
    this.buildReceivingControl();
    this.buildDockLine();
    this.buildStorage();
    this.buildInspectionLane();
    this.buildQuarantine();
    this.buildServiceArea();
    this.buildWayfinding();
  }

  update(dt: number): void {
    this.clock += dt;
    const pulse = 0.28 + (Math.sin(this.clock * 4.4) * 0.5 + 0.5) * 0.72;
    for (const beacon of this.beacons) {
      const material = beacon.material;
      if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = pulse;
      beacon.rotation.y += dt * 1.65;
    }
    for (const rotor of this.fanRotors) rotor.rotation.z += dt * 1.8;
  }

  private buildArchitecture(): void {
    const floor = this.kit.box(31, 0.16, 25.8, this.kit.materials.floor, false, true);
    floor.position.set(-34, 0.03, 10.1);
    this.group.add(floor);

    const apron = this.kit.box(31.6, 0.1, 5.2, this.kit.materials.concrete, false, true);
    apron.position.set(-34, 0.02, 24.4);
    this.group.add(apron);

    const back = this.kit.box(30.6, 4.8, 0.3, this.kit.materials.white);
    back.position.set(-34, 2.4, -2.55);
    this.group.add(back);
    const left = this.kit.box(0.3, 4.8, 25.4, this.kit.materials.white);
    left.position.set(-49.3, 2.4, 10.1);
    this.group.add(left);
    const right = left.clone();
    right.position.x = -18.7;
    this.group.add(right);

    for (const x of [-47.2, -40.6, -34, -27.4, -20.8]) {
      const columnA = this.kit.box(0.24, 5.25, 0.28, this.kit.materials.steelDark);
      columnA.position.set(x, 2.62, -1.9);
      const columnB = columnA.clone();
      columnB.position.z = 21.1;
      const beam = this.kit.box(0.24, 0.22, 23.2, this.kit.materials.steelDark);
      beam.position.set(x, 4.86, 9.6);
      this.group.add(columnA, columnB, beam);
    }

    for (const z of [2.2, 9.6, 17.1]) {
      const brace = this.kit.box(29.2, 0.14, 0.18, this.kit.materials.steel);
      brace.position.set(-34, 4.82, z);
      this.group.add(brace);
    }

    for (const x of [-44, -34, -24]) {
      const lamp = this.kit.overheadLight(3.0);
      lamp.position.set(x, 4.52, 8.2);
      this.group.add(lamp);
      const lamp2 = this.kit.overheadLight(3.0);
      lamp2.position.set(x, 4.52, 16.1);
      this.group.add(lamp2);
    }

    const officeGlass = this.kit.box(8.2, 2.4, 0.08, this.kit.materials.glass, false, false);
    officeGlass.position.set(-44.4, 2.0, 6.35);
    this.group.add(officeGlass);

    this.colliders.push(
      { minX: -49.8, maxX: -48.7, minZ: -3.0, maxZ: 22.8 },
      { minX: -19.3, maxX: -18.2, minZ: -3.0, maxZ: 22.8 },
      { minX: -49.7, maxX: -18.3, minZ: -3.0, maxZ: -1.9 }
    );
  }

  private buildReceivingControl(): void {
    const station = this.kit.workstation();
    station.position.set(-44.2, 0, 4.2);
    station.rotation.y = Math.PI;
    this.group.add(station);

    const cabinet = this.kit.toolCabinet(this.kit.materials.blue);
    cabinet.position.set(-47.5, 0, 5.1);
    cabinet.rotation.y = Math.PI / 2;
    this.group.add(cabinet);

    const mateo = this.worker(-46.4, 3.2, C.blue);
    this.addAction('npc-mateo', 'Hablar con Mateo · Recepción', mateo, 2.15);

    const docsAnchor = new THREE.Group();
    docsAnchor.position.set(-42.65, 0, 4.9);
    this.group.add(docsAnchor);
    this.marker(docsAnchor, C.blue, 2.25);
    this.addAction('warehouse-docs', 'Revisar Pedido / Remisión / COA', docsAnchor, 2.2, false);

    const docTray = this.kit.box(1.15, 0.08, 0.82, this.kit.materials.black);
    docTray.position.set(-42.65, 1.12, 4.2);
    this.group.add(docTray);
    for (let i = 0; i < 3; i++) {
      const page = this.kit.box(0.86, 0.015, 0.58, this.kit.materials.white, false, false);
      page.position.set(-42.65 + i * 0.035, 1.18 + i * 0.018, 4.18 - i * 0.025);
      page.rotation.y = -0.08 + i * 0.04;
      this.group.add(page);
    }

    const sign = this.kit.sign('CONTROL DOCUMENTAL', 4.15, 0.64, '#173346', '#ffffff', '#f3c83f');
    sign.position.set(-44.15, 3.35, 6.28);
    this.group.add(sign);
  }

  private buildDockLine(): void {
    const xs = [-44, -34, -24];
    xs.forEach((x, index) => {
      const door = this.kit.dockDoor(`MUELLE 0${index + 1}`, 6.05);
      door.position.set(x, 0, -2.28);
      this.group.add(door);

      const dockPlate = this.kit.box(4.9, 0.12, 1.55, this.kit.materials.steelDark);
      dockPlate.position.set(x, 0.15, -0.8);
      dockPlate.rotation.x = -0.045;
      this.group.add(dockPlate);

      const beaconBase = this.kit.box(0.16, 0.24, 0.16, this.kit.materials.steelDark);
      beaconBase.position.set(x + 2.75, 3.45, -1.98);
      this.group.add(beaconBase);
      const beaconMaterial = new THREE.MeshStandardMaterial({ color: 0xf15d4a, emissive: 0xf15d4a, emissiveIntensity: 0.5, roughness: 0.32 });
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.18, 12), beaconMaterial);
      beacon.position.set(x + 2.75, 3.68, -1.98);
      this.group.add(beacon);
      this.beacons.push(beacon);
    });
  }

  private buildStorage(): void {
    const rackPositions: Array<[number, number, number]> = [
      [-45.6, 10.2, Math.PI / 2],
      [-45.6, 15.3, Math.PI / 2],
      [-22.65, 7.0, Math.PI / 2],
      [-22.65, 12.0, Math.PI / 2]
    ];

    for (const [x, z, rot] of rackPositions) {
      const rack = this.kit.rack(4.5, 3.7, 1.5, 3);
      rack.position.set(x, 0, z);
      rack.rotation.y = rot;
      this.group.add(rack);
      for (let level = 0; level < 2; level++) {
        for (let col = -1; col <= 1; col++) {
          const crate = this.kit.crate(0.64, 0.48, 0.5);
          crate.position.set(x + 0.15 * level, 1.28 + level * 1.02, z + col * 0.68);
          crate.rotation.y = rot;
          this.group.add(crate);
        }
      }
    }

    this.colliders.push(
      { minX: -47.1, maxX: -44.1, minZ: 7.7, maxZ: 12.7 },
      { minX: -47.1, maxX: -44.1, minZ: 12.8, maxZ: 17.8 },
      { minX: -24.2, maxX: -21.2, minZ: 4.5, maxZ: 9.5 },
      { minX: -24.2, maxX: -21.2, minZ: 9.5, maxZ: 14.5 }
    );
  }

  private buildInspectionLane(): void {
    const lane = this.kit.box(18.6, 0.035, 7.45, this.kit.materials.steelDark, false, true);
    lane.position.set(-34.1, 0.13, 9.35);
    this.group.add(lane);

    const header = this.kit.sign('INSPECCIÓN DE RECIBO · VERIFICAR ANTES DE LIBERAR', 8.4, 0.62, '#253a45', '#ffffff', '#f3c83f');
    header.position.set(-34.1, 3.65, 14.95);
    this.group.add(header);

    const positions: Array<[string, number, THREE.Material]> = [
      ['A', -42.3, this.kit.materials.blue],
      ['B', -34.1, this.kit.materials.cardboard],
      ['C', -25.9, this.kit.materials.steel]
    ];

    for (const [code, x, material] of positions) {
      const outline = this.kit.floorDecal(`PALLET ${code}`, 5.6, 5.15, '#47565d', '#f3c83f');
      outline.position.set(x, 0.175, 9.35);
      this.group.add(outline);
      const pallet = this.kit.pallet(code, material);
      pallet.position.set(x, 0, 9.35);
      this.group.add(pallet);
      const id = `pallet-${code.toLowerCase()}`;
      this.addScan(id, `Escanear Pallet ${code}`, pallet, 4.15);
      const label = code === 'A' ? 'Pallet A · L-0908-A' : code === 'B' ? 'Pallet B · L-0908-B' : 'Pallet C · L-0906-C';
      this.carryables.set(id, { id, label, object: pallet, radius: 2.25, home: [x, 0, 9.35] });
    }

    for (const x of [-46.8, -21.4]) {
      const barrier = this.kit.barrier(2.0);
      barrier.position.set(x, 0, 5.8);
      barrier.rotation.y = Math.PI / 2;
      this.group.add(barrier);
    }
  }

  private buildQuarantine(): void {
    const x = -43.6;
    const z = 19.0;
    const floor = this.kit.floorDecal('CUARENTENA', 7.2, 4.0, '#6a3438', '#ffffff');
    floor.position.set(x, 0.17, z);
    this.group.add(floor);

    const cageRail = (px: number, pz: number, w: number, d: number) => {
      const rail = this.kit.box(w, 1.65, d, this.kit.materials.steelDark);
      rail.position.set(px, 0.86, pz);
      this.group.add(rail);
    };
    cageRail(x - 3.55, z, 0.1, 4.1);
    cageRail(x + 3.55, z, 0.1, 4.1);
    cageRail(x, z + 2.0, 7.15, 0.1);

    const sign = this.kit.sign('MATERIAL BLOQUEADO', 4.2, 0.62, '#8b2f36', '#ffffff', '#f3c83f');
    sign.position.set(x, 2.05, z + 2.03);
    this.group.add(sign);

    for (const dx of [-2.5, 2.5]) {
      const cone = this.kit.cone();
      cone.position.set(x + dx, 0, z - 1.45);
      this.group.add(cone);
    }

    const socket = new THREE.Group();
    socket.position.set(x, 0, z);
    this.group.add(socket);
    this.marker(socket, C.red, 2.4);
    this.sockets.set('quarantine', { id: 'quarantine', label: 'CUARENTENA', object: socket, radius: 3.0 });
  }

  private buildServiceArea(): void {
    const forklift = this.kit.forklift();
    forklift.position.set(-27.0, 0, 18.25);
    forklift.rotation.y = -Math.PI / 2;
    this.group.add(forklift);
    this.colliders.push({ minX: -28.6, maxX: -25.4, minZ: 16.6, maxZ: 20.1 });

    const cabinetA = this.kit.toolCabinet(this.kit.materials.blue);
    cabinetA.position.set(-20.6, 0, 17.4);
    cabinetA.rotation.y = -Math.PI / 2;
    this.group.add(cabinetA);
    const cabinetB = this.kit.toolCabinet(this.kit.materials.yellowDark);
    cabinetB.position.set(-20.6, 0, 19.0);
    cabinetB.rotation.y = -Math.PI / 2;
    this.group.add(cabinetB);

    const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 24), this.kit.materials.steelDark);
    fanHousing.rotation.x = Math.PI / 2;
    fanHousing.position.set(-20.0, 3.4, 2.6);
    this.group.add(fanHousing);
    const rotor = new THREE.Group();
    rotor.position.set(-19.9, 3.4, 2.6);
    rotor.rotation.y = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const blade = this.kit.box(0.48, 0.07, 0.18, this.kit.materials.steel, false, false);
      blade.position.x = 0.24;
      const arm = new THREE.Group();
      arm.rotation.z = i * Math.PI / 2;
      arm.add(blade);
      rotor.add(arm);
    }
    this.group.add(rotor);
    this.fanRotors.push(rotor);
  }

  private buildWayfinding(): void {
    const zone = this.kit.sign('RECEPCIÓN / ALMACÉN', 7.2, 0.8, '#173346', '#ffffff', '#f3c83f');
    zone.position.set(-34, 4.12, -2.32);
    this.group.add(zone);

    const pedestrian = this.kit.floorDecal('RUTA PEATONAL', 8.8, 1.0, '#405158', '#f3c83f');
    pedestrian.position.set(-34, 0.18, 23.5);
    this.group.add(pedestrian);

    for (let x = -46; x <= -22; x += 3.2) {
      const stripe = this.kit.box(1.45, 0.018, 0.12, this.kit.materials.yellow, false, false);
      stripe.position.set(x, 0.19, 22.1);
      this.group.add(stripe);
    }
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
    head.position.y = 2.15;
    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 14), vest);
    helmet.position.y = 2.42;
    const badge = this.kit.box(0.14, 0.19, 0.025, accentMat);
    badge.position.set(0.2, 1.58, 0.395);
    group.add(legL, legR, torso, vestMesh, head, helmet, badge);
    group.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    return group;
  }

  private marker(parent: THREE.Object3D, color: number, y: number): void {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.3 });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), material);
    marker.position.y = y;
    parent.add(marker);
    parent.userData.marker = marker;
    this.beacons.push(marker);
  }

  private addAction(id: string, prompt: string, object: THREE.Object3D, radius: number, addMarker = true): void {
    if (addMarker && !object.userData.marker) this.marker(object, C.yellow, 2.55);
    this.actions.push({ id, prompt, object, radius });
  }

  private addScan(id: string, prompt: string, object: THREE.Object3D, radius: number): void {
    const anchor = new THREE.Group();
    anchor.position.set(0, 0.6, 0);
    object.add(anchor);
    this.marker(anchor, C.blue, 1.55);
    this.scannables.push({ id, prompt, object: anchor, radius });
  }
}
