import * as THREE from 'three';
import type { Collider, WorldAction } from '../types';
import { EnvironmentKit } from '../visual/EnvironmentKit';
import { IndustrialKit } from '../visual/IndustrialKit';

export class CapaZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];

  private readonly kit = new IndustrialKit();
  private readonly environment = new EnvironmentKit();

  constructor() { this.group.name = 'V8_ZONE_CAPA'; }

  init(): void {
    const floor = this.kit.box(23, 0.15, 20, this.kit.materials.concrete, false, true);
    floor.position.set(38, 0.025, 35);
    this.group.add(floor);

    this.addWallX(38, 25, 23, 'capa-rear');
    this.addWallZ(26.5, 35, 20, 'capa-left');
    this.addWallZ(49.5, 35, 20, 'capa-right');

    const header = this.kit.sign('CENTRO CAPA · DECISIONES SISTÉMICAS', 7.3, 0.72, '#173346', '#ffffff', '#9c7ad8');
    header.position.set(38, 4.05, 25.18);
    this.group.add(header);

    const floorMark = this.kit.floorDecal('ANÁLISIS → CAUSA → CONTROL → VERIFICACIÓN', 17.2, 1.05, '#4b4757', '#ffffff');
    floorMark.position.set(38, 0.17, 43.0);
    this.group.add(floorMark);

    const options: Array<[string, string, number, string]> = [
      ['capa-a', 'RECORDAR', 30.5, 'Recordatorio'],
      ['capa-b', 'CONTROLAR', 38.0, 'Control de versión'],
      ['capa-c', 'INSPECCIONAR', 45.5, 'Más inspección']
    ];
    for (const [id, label, x, subtitle] of options) {
      const terminal = this.strategyTerminal(x, 34.4, label, subtitle);
      this.actions.push({ id, prompt: `Evaluar estrategia · ${label}`, object: terminal, radius: 2.0 });
      this.colliders.push({ id: `${id}-col`, minX: x - 1.0, maxX: x + 1.0, minZ: 33.9, maxZ: 34.9, enabled: true, object: terminal, debugLabel: `CAPA ${label}` });
    }

    const table = this.meetingTable();
    table.position.set(38, 0, 39.5);
    this.group.add(table);
    this.colliders.push({ id: 'capa-meeting-table', minX: 34.8, maxX: 41.2, minZ: 37.8, maxZ: 41.2, enabled: true, object: table, debugLabel: 'CAPA meeting table' });

    const beaconMat = new THREE.MeshStandardMaterial({ color: 0x9c7ad8, emissive: 0x9c7ad8, emissiveIntensity: 0.16, roughness: 0.42 });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 3.1, 14), beaconMat);
    beacon.position.set(47.0, 1.55, 42.0);
    beacon.castShadow = true;
    this.group.add(beacon);
  }

  private addWallX(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, 0x9c7ad8);
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - length / 2, maxX: x + length / 2, minZ: z - 0.17, maxZ: z + 0.17, enabled: true });
  }

  private addWallZ(x: number, z: number, length: number, id: string): void {
    const wall = this.environment.wall(length, 4.5, 0.28, this.kit.materials.white, 0x9c7ad8);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(x, 0, z);
    this.group.add(wall);
    this.colliders.push({ id, minX: x - 0.17, maxX: x + 0.17, minZ: z - length / 2, maxZ: z + length / 2, enabled: true });
  }

  private strategyTerminal(x: number, z: number, label: string, subtitle: string): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = this.kit.box(1.8, 0.2, 1.3, this.kit.materials.steelDark);
    base.position.y = 0.1;
    const stand = this.kit.box(0.32, 1.45, 0.32, this.kit.materials.steelDark);
    stand.position.y = 0.82;
    const panel = this.kit.box(1.9, 1.22, 0.26, this.kit.materials.navy);
    panel.position.y = 1.78;
    const title = this.kit.sign(label, 1.62, 0.35, '#9c7ad8', '#ffffff', '#f3c83f');
    title.position.set(0, 2.2, 0.16);
    const sub = this.kit.sign(subtitle, 1.58, 0.25, '#253a45', '#ffffff', '#9c7ad8');
    sub.position.set(0, 1.55, 0.16);
    group.add(base, stand, panel, title, sub);
    this.group.add(group);
    return group;
  }

  private meetingTable(): THREE.Group {
    const group = new THREE.Group();
    const top = this.kit.box(5.8, 0.16, 2.6, this.kit.materials.wood);
    top.position.y = 1.0;
    group.add(top);
    for (const x of [-2.4, 2.4]) {
      for (const z of [-0.9, 0.9]) {
        const leg = this.kit.box(0.18, 1.0, 0.18, this.kit.materials.steelDark);
        leg.position.set(x, 0.5, z);
        group.add(leg);
      }
    }
    for (let x = -2.0; x <= 2.0; x += 1.0) {
      const card = this.kit.box(0.72, 0.025, 0.5, this.kit.materials.white, false, false);
      card.position.set(x, 1.1, 0);
      card.rotation.y = x * 0.05;
      group.add(card);
    }
    return group;
  }
}
