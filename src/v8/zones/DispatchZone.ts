import * as THREE from 'three';
import type { Carryable, Collider, DropSocket } from '../types';
import { EnvironmentKit } from '../visual/EnvironmentKit';
import { IndustrialKit } from '../visual/IndustrialKit';

export class DispatchZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly carryables = new Map<string, Carryable>();
  readonly sockets = new Map<string, DropSocket>();

  private readonly kit = new IndustrialKit();
  private readonly environment = new EnvironmentKit();

  constructor() { this.group.name = 'V8_ZONE_DISPATCH'; }

  init(): void {
    const floor = this.kit.box(27, 0.15, 20, this.kit.materials.concrete, false, true);
    floor.position.set(0, 0.025, 35);
    this.group.add(floor);

    this.addWallX(0, 25, 27, 'dispatch-rear');
    this.addWallZ(-13.5, 35, 20, 'dispatch-left');
    this.addWallZ(13.5, 35, 20, 'dispatch-right');

    const sign = this.kit.sign('DESPACHO · TRAZABILIDAD DE SALIDA', 7.4, 0.72, '#173346', '#ffffff', '#b77042');
    sign.position.set(0, 4.05, 25.18);
    this.group.add(sign);

    const staging = this.kit.floorDecal('STAGING DE CARGA', 21.5, 8.0, '#3a494f', '#f3c83f');
    staging.position.set(0, 0.17, 32.2);
    this.group.add(staging);

    const boxes: Array<[string, number, number, string]> = [
      ['pkg-2401', -8, 31.0, 'AUR-2401'],
      ['pkg-2402', 0, 31.0, 'AUR-2402'],
      ['pkg-2403', 8, 31.0, 'AUR-2403']
    ];
    for (const [id, x, z, label] of boxes) {
      const box = this.packageBox(x, z, label);
      this.carryables.set(id, { id, label, object: box, radius: 1.8, home: [x, 0, z] });
    }

    for (let index = 0; index < 3; index++) {
      const x = -8 + index * 8;
      const socket = this.socketPad(x, 41.0, 0xb77042, `POS ${index + 1}`);
      this.sockets.set(`dispatch-${index + 1}`, { id: `dispatch-${index + 1}`, label: `Posición ${index + 1}`, object: socket, radius: 2.1 });
    }

    for (const x of [-10.8, 10.8]) {
      const bollard = this.environment.bollard(0.82, 0xf3c83f);
      bollard.position.set(x, 0, 38.2);
      this.group.add(bollard);
    }

    const desk = this.kit.workstation();
    desk.position.set(-9.3, 0, 43.0);
    desk.rotation.y = Math.PI;
    this.group.add(desk);
    this.colliders.push({ id: 'dispatch-desk', minX: -11.3, maxX: -7.3, minZ: 42.1, maxZ: 43.9, enabled: true, debugLabel: 'Dispatch workstation' });

    const route = this.kit.floorDecal('RUTA DE MONTACARGAS', 10.0, 0.92, '#4b565b', '#f3c83f');
    route.position.set(0, 0.18, 44.0);
    this.group.add(route);
  }

  private addWallX(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, 0xb77042);
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - length / 2, maxX: x + length / 2, minZ: z - 0.17, maxZ: z + 0.17, enabled: true });
  }

  private addWallZ(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, 0xb77042);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - 0.17, maxX: x + 0.17, minZ: z - length / 2, maxZ: z + length / 2, enabled: true });
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
}
