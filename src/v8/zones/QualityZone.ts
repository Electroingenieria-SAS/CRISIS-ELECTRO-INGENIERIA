import * as THREE from 'three';
import type { Carryable, Collider, DropSocket, WorldAction } from '../types';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from '../visual/IndustrialKit';

export class QualityZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();

  private readonly kit = new IndustrialKit();
  private markers: THREE.Mesh[] = [];
  private workers: THREE.Group[] = [];
  private clock = 0;

  constructor() {
    this.group.name = 'V8_ZONE_QUALITY';
  }

  init(): void {
    this.buildShell();
    this.buildMetrologyControl();
    this.buildMasterStandard();
    this.buildMeasurementBanks();
    this.buildIsolationArea();
    this.buildWayfinding();
  }

  update(dt: number): void {
    this.clock += dt;
    for (const marker of this.markers) {
      marker.position.y = Number(marker.userData.baseY ?? 2.2) + Math.sin(this.clock * 2.4 + Number(marker.userData.phase ?? 0)) * 0.07;
      marker.rotation.y += dt * 0.75;
    }
    for (let i = 0; i < this.workers.length; i++) {
      const worker = this.workers[i]!;
      worker.position.y = Math.sin(this.clock * 1.25 + i) * 0.007;
      const head = worker.getObjectByName('worker-head');
      if (head) head.rotation.y = Math.sin(this.clock * 0.55 + i) * 0.08;
    }
  }

  private buildShell(): void {
    const floor = this.kit.box(29.2, 0.16, 24.4, this.kit.materials.concrete, false, true);
    floor.position.set(24, 0.03, -28);
    this.group.add(floor);

    const rear = this.kit.box(28.8, 4.9, 0.26, this.kit.materials.white);
    rear.position.set(24, 2.45, -39.9);
    const left = this.kit.box(0.26, 4.9, 23.8, this.kit.materials.white);
    left.position.set(9.65, 2.45, -28);
    const right = left.clone();
    right.position.x = 38.35;
    this.group.add(rear, left, right);

    for (const x of [14.2, 20.8, 27.4, 34.0]) {
      const glass = this.kit.box(5.7, 2.45, 0.06, this.kit.materials.glass, false, false);
      glass.position.set(x, 2.25, -39.72);
      this.group.add(glass);
    }

    for (const x of [12.0, 18.0, 24.0, 30.0, 36.0]) {
      const column = this.kit.box(0.18, 5.1, 0.2, this.kit.materials.steelDark);
      column.position.set(x, 2.55, -39.65);
      this.group.add(column);
    }

    for (const x of [15.5, 24, 32.5]) {
      const lampA = this.kit.overheadLight(2.7);
      lampA.position.set(x, 4.45, -32.8);
      const lampB = this.kit.overheadLight(2.7);
      lampB.position.set(x, 4.45, -23.5);
      this.group.add(lampA, lampB);
    }

    this.colliders.push(
      { minX: 9.1, maxX: 10.2, minZ: -40.5, maxZ: -15.6 },
      { minX: 37.8, maxX: 38.9, minZ: -40.5, maxZ: -15.6 },
      { minX: 9.5, maxX: 38.5, minZ: -40.5, maxZ: -39.3 }
    );
  }

  private buildMetrologyControl(): void {
    this.worker(13.0, -35.2, 0x5287b7);

    const station = this.kit.workstation();
    station.position.set(16.0, 0, -35.6);
    this.group.add(station);
    const cabinet = this.kit.toolCabinet(this.kit.materials.blue);
    cabinet.position.set(11.1, 0, -32.8);
    this.group.add(cabinet);

    const sign = this.kit.sign('CONTROL METROLÓGICO', 4.6, 0.62, '#173346', '#ffffff', '#7eb7ff');
    sign.position.set(16.0, 3.35, -39.66);
    this.group.add(sign);
  }

  private buildMasterStandard(): void {
    const station = new THREE.Group();
    station.position.set(14.3, 0, -27.7);
    this.group.add(station);

    const pedestal = this.kit.box(1.6, 0.95, 1.6, this.kit.materials.steelDark);
    pedestal.position.y = 0.48;
    station.add(pedestal);
    const foam = this.kit.box(1.32, 0.12, 1.32, this.kit.materials.black);
    foam.position.y = 1.02;
    station.add(foam);

    const standardObject = new THREE.Group();
    standardObject.position.set(0, 1.22, 0);
    station.add(standardObject);
    const caseBottom = this.kit.box(1.02, 0.18, 0.82, this.kit.materials.blue);
    caseBottom.position.y = 0.1;
    standardObject.add(caseBottom);
    const standard = this.kit.box(0.72, 0.42, 0.42, this.kit.materials.steel);
    standard.position.y = 0.38;
    standardObject.add(standard);
    const microLabel = this.kit.sign('50,00', 0.72, 0.22, '#f7f7f2', '#17232a', '#7eb7ff');
    microLabel.position.set(0, 0.38, 0.23);
    standardObject.add(microLabel);

    const sign = this.kit.sign('PATRÓN MAESTRO 50,00 mm', 3.15, 0.46, '#173346', '#ffffff', '#7eb7ff');
    sign.position.set(0, 2.35, 0);
    station.add(sign);
    this.addMarker(standardObject, 0x7eb7ff, 1.25);

    this.carryables.set('master-block', {
      id: 'master-block',
      label: 'Patrón maestro 50,00 mm',
      object: standardObject,
      radius: 2.2,
      home: [14.3, 1.22, -27.7]
    });
  }

  private buildMeasurementBanks(): void {
    const banks: Array<[number, number, number, string]> = [
      [18.6, -22.0, 1, 'COMPARADOR DIGITAL'],
      [25.3, -22.0, 2, 'MICRÓMETRO'],
      [32.0, -22.0, 3, 'BANCO ÓPTICO']
    ];

    for (const [x, z, number, type] of banks) {
      const bank = this.measurementBank(number, type);
      bank.position.set(x, 0, z);
      this.group.add(bank);
      this.sockets.set(`gauge-${number}`, { id: `gauge-${number}`, label: `Banco M-0${number}`, object: bank, radius: 2.45 });

      const tagTerminal = this.tagStation(number);
      tagTerminal.position.set(x, 0, -34.0);
      this.group.add(tagTerminal);
      this.actions.push({ id: `tag-gauge-${number}`, prompt: `Retirar de servicio M-0${number}`, object: tagTerminal, radius: 1.95 });
      this.addMarker(tagTerminal, C.yellow, 2.25);
    }
  }

  private measurementBank(number: number, type: string): THREE.Group {
    const group = new THREE.Group();
    const bench = this.kit.box(4.2, 0.16, 2.2, this.kit.materials.steel);
    bench.position.y = 0.95;
    group.add(bench);
    for (const x of [-1.65, 1.65]) {
      for (const z of [-0.78, 0.78]) {
        const leg = this.kit.box(0.14, 0.94, 0.14, this.kit.materials.steelDark);
        leg.position.set(x, 0.47, z);
        group.add(leg);
      }
    }

    const base = this.kit.box(1.65, 0.18, 1.25, this.kit.materials.navy);
    base.position.set(0, 1.14, 0);
    group.add(base);
    const column = this.kit.box(0.28, 1.45, 0.32, this.kit.materials.steelDark);
    column.position.set(-0.52, 1.86, 0);
    group.add(column);
    const arm = this.kit.box(1.15, 0.22, 0.3, this.kit.materials.steel);
    arm.position.set(0, 2.45, 0);
    group.add(arm);
    const probe = this.kit.box(0.18, 0.95, 0.18, this.kit.materials.yellow);
    probe.position.set(0.46, 2.0, 0);
    group.add(probe);

    const displayMaterial = new THREE.MeshStandardMaterial({ color: 0x326f8f, emissive: 0x326f8f, emissiveIntensity: 0.25, roughness: 0.22 });
    const displayBody = this.kit.box(1.2, 0.78, 0.25, this.kit.materials.navy);
    displayBody.position.set(1.15, 1.85, -0.62);
    group.add(displayBody);
    const screen = this.kit.box(0.9, 0.48, 0.02, displayMaterial, false, false);
    screen.position.set(1.15, 1.88, -0.485);
    group.add(screen);

    const sign = this.kit.sign(`M-0${number} · ${type}`, 3.35, 0.4, '#173346', '#ffffff', '#7eb7ff');
    sign.position.set(0, 3.05, 0);
    group.add(sign);
    return group;
  }

  private tagStation(number: number): THREE.Group {
    const group = new THREE.Group();
    const stand = this.kit.box(0.32, 1.35, 0.32, this.kit.materials.steelDark);
    stand.position.y = 0.68;
    group.add(stand);
    const panel = this.kit.box(1.55, 1.0, 0.22, this.kit.materials.navy);
    panel.position.y = 1.55;
    group.add(panel);
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.11, 14),
      new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 0.35, roughness: 0.3 })
    );
    button.rotation.x = Math.PI / 2;
    button.position.set(0, 1.52, 0.17);
    group.add(button);
    const sign = this.kit.sign(`BLOQUEAR M-0${number}`, 1.42, 0.3, '#8b2f36', '#ffffff', '#f3c83f');
    sign.position.set(0, 2.18, 0.08);
    group.add(sign);
    return group;
  }

  private buildIsolationArea(): void {
    const floor = this.kit.floorDecal('EQUIPO FUERA DE SERVICIO', 7.2, 2.6, '#6a3438', '#ffffff');
    floor.position.set(33.0, 0.18, -29.7);
    this.group.add(floor);
    const cabinet = this.kit.toolCabinet(this.kit.materials.red);
    cabinet.position.set(35.4, 0, -29.6);
    this.group.add(cabinet);
    const barrier = this.kit.barrier(3.4);
    barrier.position.set(30.0, 0, -29.7);
    barrier.rotation.y = Math.PI / 2;
    this.group.add(barrier);
  }

  private buildWayfinding(): void {
    const zone = this.kit.sign('LABORATORIO DE CALIDAD · METROLOGÍA', 8.1, 0.8, '#173346', '#ffffff', '#7eb7ff');
    zone.position.set(24, 4.12, -39.68);
    this.group.add(zone);

    const route = this.kit.floorDecal('RUTA DE MUESTRAS', 9.0, 0.88, '#43545a', '#7eb7ff');
    route.position.set(24, 0.19, -17.0);
    this.group.add(route);
  }

  private worker(x: number, z: number, accent: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const pants = new THREE.MeshStandardMaterial({ color: 0x2e3940, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xe9eef0, roughness: 0.65 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd6a078, roughness: 0.75 });
    const vest = new THREE.MeshStandardMaterial({ color: 0x7eb7ff, roughness: 0.5 });
    const legL = this.kit.box(0.24, 0.82, 0.26, pants);
    legL.position.set(-0.15, 0.46, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.58, 4, 10), shirt);
    torso.position.y = 1.43;
    torso.scale.z = 0.7;
    const coat = this.kit.box(0.72, 0.7, 0.18, vest);
    coat.position.set(0, 1.44, 0.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), skin);
    head.name = 'worker-head';
    head.position.y = 2.15;
    const glasses = this.kit.box(0.42, 0.06, 0.035, this.kit.materials.glass, false, false);
    glasses.position.set(0, 2.16, 0.24);
    const badgeMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.08, roughness: 0.5 });
    const badge = this.kit.box(0.14, 0.19, 0.025, badgeMaterial);
    badge.position.set(0.2, 1.58, 0.4);
    group.add(legL, legR, torso, coat, head, glasses, badge);
    group.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    this.group.add(group);
    this.workers.push(group);
    return group;
  }

  private addMarker(parent: THREE.Object3D, color: number, y: number): void {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 0.28 });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), material);
    marker.position.y = y;
    marker.userData.baseY = y;
    marker.userData.phase = parent.position.x * 0.13 + parent.position.z * 0.09;
    parent.add(marker);
    parent.userData.marker = marker;
    this.markers.push(marker);
  }
}
