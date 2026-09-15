import * as THREE from 'three';
import type { Carryable, Collider, WorldAction, WorldObjectDefinition } from '../types';
import { KayKitEnvironmentLibrary, type EnvironmentAssetId } from '../assets/KayKitEnvironmentLibrary';
import { EnvironmentKit } from '../visual/EnvironmentKit';
import { IndustrialKit, INDUSTRIAL_COLORS as C } from '../visual/IndustrialKit';

/**
 * Reference vertical slice for environment systems.
 * Story anchors remain stable while environmental gameplay is modularized.
 */
export class ControlZone {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly actions: WorldAction[] = [];
  readonly worldObjects: WorldObjectDefinition[] = [];
  readonly carryables = new Map<string, Carryable>();

  private readonly kit = new IndustrialKit();
  private readonly environment = new EnvironmentKit();
  private readonly assetSlots: Array<{ host: THREE.Group; id: EnvironmentAssetId; height: number; rotationY?: number }> = [];

  constructor() {
    this.group.name = 'V8_ZONE_CONTROL_VERTICAL_SLICE';
  }

  init(): void {
    this.buildArchitecture();
    this.buildStoryStations();
    this.buildInteractiveBay();
    this.buildTrainingCourt();
    this.buildEnvironmentalDepth();
    void this.loadCuratedAssets();
  }

  private buildArchitecture(): void {
    const floor = this.kit.box(19, 0.15, 17, this.kit.materials.concrete, false, true);
    floor.position.set(0, 0.025, 0);
    this.group.add(floor);

    const rear = this.environment.wall(19, 4.5, 0.28, this.kit.materials.white, C.blue);
    rear.position.set(0, 0, -8.5);
    this.group.add(rear);
    this.addCollider('control-wall-rear', -9.5, 9.5, -8.66, -8.34, false, undefined, 'Rear wall');

    const left = this.environment.wall(17, 4.5, 0.28, this.kit.materials.white, C.blue);
    left.rotation.y = Math.PI / 2;
    left.position.set(-9.5, 0, 0);
    this.group.add(left);
    this.addCollider('control-wall-left', -9.66, -9.34, -8.5, 8.5, false, undefined, 'Left wall');

    const right = left.clone();
    right.position.x = 9.5;
    this.group.add(right);
    this.addCollider('control-wall-right', 9.34, 9.66, -8.5, 8.5, false, undefined, 'Right wall');

    // Front wall is split around a real 3.2 m gameplay opening.
    const doorWidth = 3.2;
    const segment = (19 - doorWidth) / 2;
    const frontLeft = this.environment.wall(segment, 4.5, 0.28, this.kit.materials.white, C.blue);
    frontLeft.position.set(-(doorWidth / 2 + segment / 2), 0, 8.5);
    const frontRight = frontLeft.clone();
    frontRight.position.x *= -1;
    this.group.add(frontLeft, frontRight);
    this.addCollider('control-wall-front-l', -9.5, -doorWidth / 2, 8.34, 8.66, false, undefined, 'Front wall L');
    this.addCollider('control-wall-front-r', doorWidth / 2, 9.5, 8.34, 8.66, false, undefined, 'Front wall R');

    const lintel = this.kit.box(3.55, 0.42, 0.48, this.kit.materials.steelDark);
    lintel.position.set(0, 3.25, 8.5);
    this.group.add(lintel);
    for (const x of [-1.72, 1.72]) {
      const jamb = this.kit.box(0.22, 3.25, 0.48, this.kit.materials.steelDark);
      jamb.position.set(x, 1.625, 8.5);
      this.group.add(jamb);
    }

    const sign = this.kit.sign('CENTRO DE CONTROL · OPERACIÓN AURORA', 7.9, 0.7, '#173346', '#ffffff', '#f3c83f');
    sign.position.set(0, 4.05, -8.31);
    this.group.add(sign);

    // Windows provide depth without obstructing the elevated camera.
    for (const z of [-4.6, 1.8]) {
      const windowL = this.environment.windowBay(3.15, 1.75, C.blue);
      windowL.rotation.y = Math.PI / 2;
      windowL.position.set(-9.31, 1.25, z);
      const windowR = windowL.clone();
      windowR.position.x = 9.31;
      this.group.add(windowL, windowR);
    }

    for (const x of [-7.9, 7.9]) {
      const column = this.kit.box(0.34, 4.85, 0.34, this.kit.materials.steelDark);
      column.position.set(x, 2.42, -7.95);
      this.group.add(column);
    }

    for (const x of [-5.6, 0, 5.6]) {
      const light = this.kit.overheadLight(2.6);
      light.position.set(x, 4.15, -1.2);
      this.group.add(light);
    }

    this.buildDoor();
  }

  private buildDoor(): void {
    const anchor = new THREE.Group();
    anchor.name = 'CONTROL_EXIT_DOOR_ANCHOR';
    anchor.position.set(0, 0, 8.48);
    this.group.add(anchor);

    const pivot = new THREE.Group();
    pivot.name = 'CONTROL_EXIT_DOOR_PIVOT';
    pivot.position.set(-1.5, 0, 0);
    anchor.add(pivot);

    const fallback = new THREE.Group();
    fallback.name = 'CONTROL_DOOR_FALLBACK';
    const panel = this.kit.box(2.92, 3.02, 0.16, this.kit.materials.blue);
    panel.position.set(1.46, 1.51, 0);
    const inset = this.kit.box(2.38, 2.38, 0.035, this.kit.materials.navy, false, false);
    inset.position.set(1.46, 1.54, -0.098);
    const handle = this.kit.box(0.08, 0.52, 0.08, this.kit.materials.steel);
    handle.position.set(2.63, 1.48, -0.14);
    fallback.add(panel, inset, handle);
    pivot.add(fallback);

    this.assetSlots.push({ host: pivot, id: 'prototype-door', height: 3.04 });

    const colliderId = 'control-door-collider';
    this.addCollider(colliderId, -1.5, 1.5, 8.31, 8.66, false, undefined, 'Control exit door');
    this.worldObjects.push({
      id: 'control-exit-door',
      kind: 'door',
      label: 'Puerta principal',
      prompt: 'Abrir',
      object: anchor,
      radius: 2.4,
      colliderId,
      state: { pivot, closedRotationY: 0, openRotationY: -Math.PI / 2, open: false }
    });
  }

  private buildStoryStations(): void {
    const laura = new THREE.Group();
    laura.name = 'npc-laura-anchor';
    laura.position.set(-3.25, 0, -2.8);
    this.group.add(laura);
    this.actions.push({ id: 'npc-laura', prompt: 'Hablar con Laura · Calidad', object: laura, radius: 2.2 });

    const workstation = this.kit.workstation();
    workstation.position.set(-5.25, 0, -5.25);
    workstation.rotation.y = Math.PI * 0.08;
    this.group.add(workstation);
    this.addCollider('control-workstation', -7.25, -3.25, -6.1, -4.35, false, workstation, 'Quality workstation');

    const scanner = this.controlTerminal(3.75, -3.25, C.blue, 'ESCÁNER EI');
    this.actions.push({ id: 'scanner-terminal', prompt: 'Retirar Escáner EI', object: scanner, radius: 2.0 });
    this.addCollider('control-scanner-terminal', 2.75, 4.75, -3.75, -2.75, false, scanner, 'Scanner terminal');

    const cabinet = this.kit.toolCabinet(this.kit.materials.blue);
    cabinet.position.set(7.5, 0, -6.7);
    cabinet.rotation.y = -Math.PI / 2;
    this.group.add(cabinet);
    this.addCollider('control-cabinet', 7.0, 8.0, -7.45, -5.95, false, cabinet, 'Tool cabinet');
  }

  private buildInteractiveBay(): void {
    this.buildChest(-6.45, 3.25);
    this.buildPickup(6.15, 2.9);
    this.buildPushCrate(-5.1, 6.1);
    this.buildCarryCrate(5.25, 5.75);
    this.buildLever(7.0, -0.2);
  }

  private buildChest(x: number, z: number): void {
    const group = new THREE.Group();
    group.name = 'CONTROL_TOOL_CHEST';
    group.position.set(x, 0, z);
    this.group.add(group);

    const base = this.kit.box(1.45, 0.68, 0.92, this.kit.materials.navy);
    base.position.y = 0.34;
    group.add(base);
    const trim = this.kit.box(1.5, 0.10, 0.98, this.kit.materials.steelDark);
    trim.position.y = 0.68;
    group.add(trim);
    const lid = new THREE.Group();
    lid.position.set(0, 0.73, -0.42);
    const lidMesh = this.kit.box(1.48, 0.18, 0.9, this.kit.materials.blue);
    lidMesh.position.set(0, 0, 0.42);
    lid.add(lidMesh);
    group.add(lid);
    const latch = this.kit.box(0.18, 0.25, 0.06, this.kit.materials.yellow);
    latch.position.set(0, 0.64, 0.50);
    group.add(latch);

    const colliderId = 'control-chest-collider';
    this.addCollider(colliderId, x - 0.78, x + 0.78, z - 0.5, z + 0.5, false, group, 'Equipment chest');
    this.worldObjects.push({
      id: 'control-equipment-chest',
      kind: 'container',
      label: 'Cofre de equipo',
      prompt: 'Abrir',
      object: group,
      radius: 2.1,
      colliderId,
      contents: [
        { id: 'inspection-tags', label: 'Etiquetas de inspección', description: 'Juego de etiquetas para identificación visual.', quantity: 2 },
        { id: 'spare-fuse', label: 'Fusible de repuesto', description: 'Elemento de mantenimiento para futuros puzzles.', quantity: 1 }
      ],
      state: { lid, open: false, looted: false }
    });
  }

  private buildPickup(x: number, z: number): void {
    const group = new THREE.Group();
    group.name = 'CONTROL_DATA_CARTRIDGE';
    group.position.set(x, 0, z);
    const body = this.kit.box(0.32, 0.12, 0.46, this.kit.materials.blue);
    body.position.y = 0.2;
    const stripe = this.kit.box(0.22, 0.13, 0.05, this.kit.materials.yellow, false, false);
    stripe.position.set(0, 0.2, 0.25);
    group.add(body, stripe);
    this.group.add(group);
    this.worldObjects.push({
      id: 'control-data-cartridge',
      kind: 'pickup',
      label: 'Cartucho de datos EI',
      prompt: 'Recoger',
      object: group,
      radius: 1.65,
      inventoryItem: { id: 'data-cartridge', label: 'Cartucho de datos EI', description: 'Registro portátil de evidencia de proceso.' }
    });
  }

  private buildPushCrate(x: number, z: number): void {
    const group = this.kit.crate(1.15, 0.82, 1.02, this.kit.materials.cardboard);
    group.name = 'CONTROL_PUSHABLE_CRATE';
    group.position.set(x, 0, z);
    this.group.add(group);
    const colliderId = 'control-push-crate-col';
    this.addCollider(colliderId, x - 0.58, x + 0.58, z - 0.52, z + 0.52, true, group, 'Pushable crate');
    this.worldObjects.push({ id: 'control-push-crate', kind: 'movable', label: 'Caja móvil', prompt: 'Empujar', object: group, radius: 1.7, colliderId });
    this.assetSlots.push({ host: group, id: 'prototype-box', height: 0.92 });
  }

  private buildCarryCrate(x: number, z: number): void {
    const group = this.kit.crate(0.82, 0.62, 0.72, this.kit.materials.cardboard);
    group.name = 'CONTROL_CARRY_CRATE';
    group.position.set(x, 0, z);
    this.group.add(group);
    this.carryables.set('env-carry-crate', { id: 'env-carry-crate', label: 'Caja de práctica', object: group, radius: 1.75, home: [x, 0, z] });
    this.worldObjects.push({ id: 'env-carry-crate', kind: 'carryable', label: 'Caja de práctica', prompt: 'Levantar', object: group, radius: 1.75 });
  }

  private buildLever(x: number, z: number): void {
    const group = new THREE.Group();
    group.name = 'CONTROL_TRAINING_LEVER';
    group.position.set(x, 0, z);
    this.group.add(group);

    const base = this.kit.box(0.75, 0.42, 0.75, this.kit.materials.steelDark);
    base.position.y = 0.21;
    group.add(base);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.46, 0);
    pivot.rotation.x = 0.65;
    const arm = this.kit.box(0.13, 0.95, 0.13, this.kit.materials.yellow);
    arm.position.y = 0.42;
    pivot.add(arm);
    group.add(pivot);
    const indicatorMaterial = new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 0.42, roughness: 0.28 });
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), indicatorMaterial);
    indicator.position.set(0.25, 0.42, 0.32);
    group.add(indicator);
    this.worldObjects.push({
      id: 'control-training-lever',
      kind: 'puzzle',
      label: 'Palanca de prueba',
      prompt: 'Activar',
      object: group,
      radius: 1.7,
      state: { pivot, indicator, active: false }
    });
    this.assetSlots.push({ host: group, id: 'platformer-lever', height: 1.25 });
  }

  private buildTrainingCourt(): void {
    const court = this.kit.floorDecal('ZONA DE PRÁCTICA · COMBATE / INTERACCIÓN', 11.0, 9.5, '#34474f', '#f3c83f');
    court.position.set(0, 0.08, 15.0);
    this.group.add(court);

    this.worldObjects.push({
      id: 'control-training-combat-zone',
      kind: 'combat-zone',
      label: 'Zona de práctica',
      object: this.anchor(0, 0, 15.0),
      radius: 5.0,
      enabled: true
    });

    const target = new THREE.Group();
    target.name = 'CONTROL_BREAKABLE_TARGET';
    target.position.set(0, 0, 17.7);
    this.group.add(target);
    const post = this.kit.box(0.18, 1.8, 0.18, this.kit.materials.steelDark);
    post.position.y = 0.9;
    const board = this.kit.box(1.25, 1.25, 0.16, this.kit.materials.cardboard);
    board.position.y = 1.72;
    const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.03, 20), this.kit.materials.red);
    bull.rotation.x = Math.PI / 2;
    bull.position.set(0, 1.72, 0.095);
    target.add(post, board, bull);
    const colliderId = 'control-target-col';
    this.addCollider(colliderId, -0.7, 0.7, 17.5, 17.9, false, target, 'Breakable target');
    this.worldObjects.push({ id: 'control-breakable-target', kind: 'breakable', label: 'Target de entrenamiento', prompt: 'Golpear', key: 'SPACE', object: target, radius: 2.0, colliderId, health: 2, maxHealth: 2 });
    this.assetSlots.push({ host: target, id: 'prototype-target', height: 2.35 });

    // Keep the arena readable: only four corner bollards.
    for (const [x, z] of [[-5.2, 10.6], [5.2, 10.6], [-5.2, 19.4], [5.2, 19.4]] as Array<[number, number]>) {
      const bollard = this.environment.bollard(0.78, C.yellow);
      bollard.position.set(x, 0, z);
      this.group.add(bollard);
    }
  }

  private buildEnvironmentalDepth(): void {
    const bench = new THREE.Group();
    bench.position.set(-8.0, 0, 14.7);
    bench.rotation.y = Math.PI / 2;
    this.group.add(bench);
    const seat = this.kit.box(2.0, 0.15, 0.55, this.kit.materials.wood);
    seat.position.y = 0.55;
    const back = this.kit.box(2.0, 0.65, 0.12, this.kit.materials.wood);
    back.position.set(0, 0.9, -0.28);
    bench.add(seat, back);
    this.assetSlots.push({ host: bench, id: 'halloween-bench', height: 1.05, rotationY: Math.PI / 2 });
    this.addCollider('control-bench-col', -8.45, -7.55, 13.65, 15.75, false, bench, 'Campus bench');

    for (const [x, z] of [[-8.0, 10.5], [8.0, 10.5]] as Array<[number, number]>) {
      const planter = this.environment.planter(2.3, 0.72);
      planter.position.set(x, 0, z);
      this.group.add(planter);
      this.addCollider(`control-planter-${x < 0 ? 'l' : 'r'}`, x - 1.2, x + 1.2, z - 0.4, z + 0.4, false, planter, 'Planter');
    }

    for (const [x, z, s] of [[-7.6, 20.6, 0.8], [7.8, 20.5, 0.7]] as Array<[number, number, number]>) {
      const rock = this.environment.rock(s);
      rock.position.set(x, 0.35 * s, z);
      this.group.add(rock);
      this.addCollider(`control-rock-${x < 0 ? 'l' : 'r'}`, x - 0.55 * s, x + 0.55 * s, z - 0.5 * s, z + 0.5 * s, false, rock, 'Landscape rock');
    }
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

  private anchor(x: number, y: number, z: number): THREE.Group {
    const anchor = new THREE.Group();
    anchor.position.set(x, y, z);
    this.group.add(anchor);
    return anchor;
  }

  private addCollider(id: string, minX: number, maxX: number, minZ: number, maxZ: number, pushable = false, object?: THREE.Object3D, debugLabel?: string): void {
    this.colliders.push({ id, minX, maxX, minZ, maxZ, pushable, object, enabled: true, debugLabel });
  }

  private async loadCuratedAssets(): Promise<void> {
    for (const slot of this.assetSlots) {
      const model = await KayKitEnvironmentLibrary.clone(slot.id);
      if (!model || !slot.host.parent) continue;
      this.fitModel(model, slot.height);
      if (slot.rotationY) model.rotation.y += slot.rotationY;

      // Keep gameplay geometry as an invisible-safe fallback only when the asset is loaded.
      for (const child of slot.host.children) {
        if (child === model) continue;
        if (child.userData.gameplayEssential) continue;
        child.visible = false;
      }
      slot.host.add(model);
    }
  }

  private fitModel(model: THREE.Object3D, targetHeight: number): void {
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    if (height > 0.001) model.scale.multiplyScalar(targetHeight / height);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
  }
}
