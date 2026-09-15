import * as THREE from 'three';
import type { CombatHitResult, WorldInteractionResult, WorldObjectDefinition } from '../types';
import { InventorySystem } from '../inventory/InventorySystem';
import { CollisionSystem } from './CollisionSystem';
import { WorldObjectRegistry } from './WorldObjectRegistry';

type AnimatedEntry = {
  object: THREE.Object3D;
  property: 'rotation-y' | 'rotation-x';
  target: number;
  speed: number;
};

export class WorldInteractionSystem {
  private readonly animated = new Map<string, AnimatedEntry>();
  private readonly temp = new THREE.Vector3();

  constructor(
    private readonly registry: WorldObjectRegistry,
    private readonly collisions: CollisionSystem,
    private readonly inventory: InventorySystem,
    private readonly effectsRoot: THREE.Object3D
  ) {}

  update(dt: number): void {
    for (const [id, entry] of this.animated) {
      const current = entry.property === 'rotation-y' ? entry.object.rotation.y : entry.object.rotation.x;
      const next = THREE.MathUtils.damp(current, entry.target, entry.speed, dt);
      if (entry.property === 'rotation-y') entry.object.rotation.y = next;
      else entry.object.rotation.x = next;
      if (Math.abs(next - entry.target) < 0.004) {
        if (entry.property === 'rotation-y') entry.object.rotation.y = entry.target;
        else entry.object.rotation.x = entry.target;
        this.animated.delete(id);
      }
    }
  }

  interact(id: string): WorldInteractionResult {
    const entry = this.registry.get(id);
    if (!entry || entry.enabled === false) return { handled: false };

    switch (entry.kind) {
      case 'pickup':
        return this.pickup(entry);
      case 'door':
        return this.toggleDoor(entry);
      case 'container':
        return this.openContainer(entry);
      case 'puzzle':
        return this.togglePuzzle(entry);
      case 'interactable':
        return { handled: true, title: entry.label, message: String(entry.state?.description ?? 'Elemento examinado.') };
      case 'movable':
        return { handled: true, title: entry.label, message: 'Empújalo caminando contra él.' };
      case 'breakable':
        return { handled: true, title: entry.label, message: 'Utiliza ESPACIO para golpear este objeto.' };
      default:
        return { handled: false };
    }
  }

  attack(origin: THREE.Vector3, forward: THREE.Vector3, range = 2.15): CombatHitResult {
    const damagedIds: string[] = [];
    const destroyedIds: string[] = [];
    const normalized = forward.clone().setY(0).normalize();

    for (const entry of this.registry.byKind('breakable')) {
      if (entry.enabled === false || !entry.object.visible) continue;
      const target = entry.object.getWorldPosition(this.temp).clone().sub(origin).setY(0);
      const distance = target.length();
      if (distance > range || distance <= 0.001) continue;
      target.normalize();
      if (target.dot(normalized) < 0.2) continue;

      entry.health = Math.max(0, (entry.health ?? 1) - 1);
      damagedIds.push(entry.id);
      this.flash(entry.object);
      if (entry.health <= 0) {
        destroyedIds.push(entry.id);
        this.destroyBreakable(entry);
      }
    }

    return { hit: damagedIds.length > 0, damagedIds, destroyedIds };
  }

  private pickup(entry: WorldObjectDefinition): WorldInteractionResult {
    const item = entry.inventoryItem;
    if (!item) return { handled: false };
    const obtained = this.inventory.add(item);
    entry.enabled = false;
    entry.object.visible = false;
    if (entry.colliderId) this.collisions.setEnabled(entry.colliderId, false);
    return {
      handled: true,
      title: 'OBJETO RECOGIDO',
      message: `${obtained.label}${obtained.quantity && obtained.quantity > 1 ? ` ×${obtained.quantity}` : ''}`,
      tone: 'success',
      items: [obtained]
    };
  }

  private toggleDoor(entry: WorldObjectDefinition): WorldInteractionResult {
    const state = entry.state ?? (entry.state = {});
    const pivot = state.pivot as THREE.Object3D | undefined;
    if (!pivot) return { handled: false };
    const open = !Boolean(state.open);
    state.open = open;
    const closed = Number(state.closedRotationY ?? 0);
    const opened = Number(state.openRotationY ?? -Math.PI / 2);
    this.animated.set(entry.id, { object: pivot, property: 'rotation-y', target: open ? opened : closed, speed: 8 });
    if (entry.colliderId) this.collisions.setEnabled(entry.colliderId, !open);
    entry.prompt = open ? 'Cerrar' : 'Abrir';
    return { handled: true, title: open ? 'PUERTA ABIERTA' : 'PUERTA CERRADA', message: entry.label, tone: 'normal' };
  }

  private openContainer(entry: WorldObjectDefinition): WorldInteractionResult {
    const state = entry.state ?? (entry.state = {});
    const lid = state.lid as THREE.Object3D | undefined;
    if (!lid) return { handled: false };

    if (!state.open) {
      state.open = true;
      this.animated.set(entry.id, { object: lid, property: 'rotation-x', target: -1.08, speed: 7 });
    }

    if (state.looted) return { handled: true, title: entry.label, message: 'El contenedor está vacío.' };
    state.looted = true;
    const items = (entry.contents ?? []).map((item) => this.inventory.add(item));
    entry.prompt = 'Examinar';
    return {
      handled: true,
      title: 'CONTENEDOR ABIERTO',
      message: items.length ? `Obtienes: ${items.map((item) => item.label).join(', ')}.` : 'No contiene objetos útiles.',
      tone: items.length ? 'success' : 'normal',
      items
    };
  }

  private togglePuzzle(entry: WorldObjectDefinition): WorldInteractionResult {
    const state = entry.state ?? (entry.state = {});
    state.active = !Boolean(state.active);
    const pivot = state.pivot as THREE.Object3D | undefined;
    if (pivot) {
      this.animated.set(entry.id, {
        object: pivot,
        property: 'rotation-x',
        target: state.active ? -0.65 : 0.65,
        speed: 9
      });
    }
    const indicator = state.indicator as THREE.Mesh | undefined;
    if (indicator?.material instanceof THREE.MeshStandardMaterial) {
      const color = state.active ? 0x4f9a69 : 0xc64c4c;
      indicator.material.color.setHex(color);
      indicator.material.emissive.setHex(color);
      indicator.material.emissiveIntensity = 0.45;
    }
    return { handled: true, title: state.active ? 'MECANISMO ACTIVO' : 'MECANISMO INACTIVO', message: entry.label, tone: state.active ? 'success' : 'normal' };
  }

  private destroyBreakable(entry: WorldObjectDefinition): void {
    const world = entry.object.getWorldPosition(new THREE.Vector3());
    entry.enabled = false;
    entry.object.visible = false;
    if (entry.colliderId) this.collisions.setEnabled(entry.colliderId, false);

    const material = new THREE.MeshStandardMaterial({ color: 0xb98048, roughness: 0.82 });
    for (let i = 0; i < 6; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), material);
      shard.position.copy(world).add(new THREE.Vector3((i % 3 - 1) * 0.18, 0.18 + Math.floor(i / 3) * 0.16, (i % 2 ? 1 : -1) * 0.15));
      shard.rotation.set(i * 0.5, i * 0.9, i * 0.35);
      shard.userData.expireAt = performance.now() + 1200;
      this.effectsRoot.add(shard);
      window.setTimeout(() => {
        shard.removeFromParent();
        shard.geometry.dispose();
      }, 1250);
    }
  }

  private flash(object: THREE.Object3D): void {
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
      const material = node.material;
      const previous = material.emissive.getHex();
      material.emissive.setHex(0xffffff);
      material.emissiveIntensity = 0.9;
      window.setTimeout(() => {
        material.emissive.setHex(previous);
        material.emissiveIntensity = 0;
      }, 90);
    });
  }
}
