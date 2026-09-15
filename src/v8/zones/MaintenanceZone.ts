import * as THREE from 'three';
import type { Collider, WorldAction } from '../types';
import { EnvironmentKit } from '../visual/EnvironmentKit';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from '../visual/IndustrialKit';

export class MaintenanceZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly rotators: THREE.Object3D[] = [];

  private readonly kit = new IndustrialKit();
  private readonly environment = new EnvironmentKit();

  constructor() { this.group.name = 'V8_ZONE_MAINTENANCE'; }

  init(): void {
    const floor = this.kit.box(23, 0.15, 22, this.kit.materials.concrete, false, true);
    floor.position.set(39, 0.025, 5);
    this.group.add(floor);

    this.addWallX(39, -6, 23, 'maintenance-rear');
    this.addWallZ(27.5, 5, 22, 'maintenance-left');
    this.addWallZ(50.5, 5, 22, 'maintenance-right');

    const header = this.kit.sign('MANTENIMIENTO / SST · ZONA LOTO', 7.5, 0.74, '#173346', '#ffffff', '#d9a928');
    header.position.set(39, 4.08, -5.82);
    this.group.add(header);

    const machine = this.machine(39, 5);
    this.group.add(machine);
    this.colliders.push({ id: 'maintenance-machine', minX: 35.4, maxX: 42.6, minZ: 2.0, maxZ: 8.0, enabled: true, debugLabel: 'Maintenance machine' });

    const steps: Array<[string, string, number, number]> = [
      ['loto-stop', '1 · DETENER', 31.5, -1.2],
      ['loto-isolate', '2 · AISLAR', 46.5, -1.2],
      ['loto-lock', '3 · BLOQUEAR', 31.5, 12.0],
      ['loto-zero', '4 · ENERGÍA CERO', 46.5, 12.0]
    ];
    for (const [id, label, x, z] of steps) {
      const terminal = this.terminal(x, z, label);
      this.actions.push({ id, prompt: `LOTO · ${label}`, object: terminal, radius: 2.0 });
      this.colliders.push({ id: `${id}-col`, minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.45, maxZ: z + 0.45, enabled: true, object: terminal, debugLabel: label });
    }

    for (const [x, z] of [[29.5, 8.7], [48.5, 8.7]] as Array<[number, number]>) {
      const cabinet = this.kit.toolCabinet(x < 39 ? this.kit.materials.yellowDark : this.kit.materials.blue);
      cabinet.position.set(x, 0, z);
      cabinet.rotation.y = x < 39 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(cabinet);
      this.colliders.push({ id: `maintenance-cabinet-${x}`, minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.72, maxZ: z + 0.72, enabled: true, debugLabel: 'Tool cabinet' });
    }

    const safe = this.kit.floorDecal('ÁREA DE INTERVENCIÓN · 9 m LIBRES', 10.0, 8.5, '#38494f', '#d9a928');
    safe.position.set(39, 0.17, 5);
    this.group.add(safe);

    const route = this.kit.floorDecal('RUTA PEATONAL', 8.5, 0.9, '#46575e', '#f3c83f');
    route.position.set(39, 0.18, 15.0);
    this.group.add(route);
  }

  private addWallX(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, C.yellowDark);
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - length / 2, maxX: x + length / 2, minZ: z - 0.17, maxZ: z + 0.17, enabled: true });
  }

  private addWallZ(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, C.yellowDark);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - 0.17, maxX: x + 0.17, minZ: z - length / 2, maxZ: z + length / 2, enabled: true });
  }

  private machine(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = this.kit.box(7.0, 0.58, 5.4, this.kit.materials.steelDark);
    base.position.y = 0.29;
    const body = this.kit.box(5.4, 2.75, 4.0, this.kit.materials.navy);
    body.position.y = 1.95;
    const access = this.kit.box(3.4, 1.6, 0.12, this.kit.materials.steel);
    access.position.set(0, 1.9, 2.04);
    const glass = this.kit.box(2.4, 0.9, 0.04, this.kit.materials.glass, false, false);
    glass.position.set(0, 2.15, 2.115);
    group.add(base, body, access, glass);

    const rotor = new THREE.Group();
    rotor.position.set(0, 2.1, 2.14);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = i * Math.PI / 2;
      const blade = this.kit.box(1.25, 0.10, 0.24, this.kit.materials.steel, false, false);
      blade.position.x = 0.62;
      arm.add(blade);
      rotor.add(arm);
    }
    group.add(rotor);
    this.rotators.push(rotor);
    return group;
  }

  private terminal(x: number, z: number, label: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const stand = this.kit.box(0.32, 1.25, 0.32, this.kit.materials.steelDark);
    stand.position.y = 0.63;
    const panel = this.kit.box(1.55, 1.0, 0.25, this.kit.materials.navy);
    panel.position.y = 1.52;
    const sign = this.kit.sign(label, 1.38, 0.31, '#f3c83f', '#17232a', '#173346');
    sign.position.set(0, 2.18, 0.08);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.10, 14), this.kit.materials.red);
    button.rotation.x = Math.PI / 2;
    button.position.set(0, 1.48, 0.18);
    group.add(stand, panel, sign, button);
    this.group.add(group);
    return group;
  }
}
