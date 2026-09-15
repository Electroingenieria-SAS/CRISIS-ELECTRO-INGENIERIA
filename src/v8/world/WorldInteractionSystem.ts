import * as THREE from 'three';
import type { CombatHitResult, InventoryItem, WorldInteractionResult, WorldObjectDefinition } from '../types';
import { DamageSystem } from '../gameplay/DamageSystem';
import { GameLogger } from '../gameplay/GameLogger';
import { InventorySystem } from '../inventory/InventorySystem';
import { CollisionSystem } from './CollisionSystem';
import { WorldObjectRegistry } from './WorldObjectRegistry';

type AnimatedEntry = {
  object: THREE.Object3D;
  property: 'rotation-y' | 'rotation-x';
  from: number;
  target: number;
  elapsed: number;
  duration: number;
  marker: number;
  markerFired: boolean;
  onMarker?: () => void;
  onComplete?: () => void;
};

type DoorLike = { toggle(): boolean; readonly state: string };

export class WorldInteractionSystem {
  private readonly animated = new Map<string, AnimatedEntry>();
  private readonly damage: DamageSystem;

  constructor(
    private readonly registry: WorldObjectRegistry,
    private readonly collisions: CollisionSystem,
    private readonly inventory: InventorySystem,
    private readonly effectsRoot: THREE.Object3D
  ) {
    // Damage receives the same collider references that CollisionSystem owns.
    this.damage = new DamageSystem(registry, collisions.all(), effectsRoot);
  }

  update(dt: number): void {
    for (const [id, entry] of this.animated) {
      entry.elapsed = Math.min(entry.duration, entry.elapsed + dt);
      const t = THREE.MathUtils.clamp(entry.elapsed / entry.duration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      const next = THREE.MathUtils.lerp(entry.from, entry.target, eased);
      if (entry.property === 'rotation-y') entry.object.rotation.y = next;
      else entry.object.rotation.x = next;

      if (!entry.markerFired && t >= entry.marker) {
        entry.markerFired = true;
        entry.onMarker?.();
      }
      if (t < 1) continue;
      if (!entry.markerFired) entry.onMarker?.();
      if (entry.property === 'rotation-y') entry.object.rotation.y = entry.target;
      else entry.object.rotation.x = entry.target;
      this.animated.delete(id);
      entry.onComplete?.();
    }
    this.damage.update(dt);
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
      case 'carryable':
        return { handled: true, title: entry.label, message: 'El objeto responde a empuje, transporte e impactos.' };
      case 'breakable':
        return { handled: true, title: entry.label, message: 'Utiliza ESPACIO para golpear este objeto.' };
      default:
        return { handled: false };
    }
  }

  attack(origin: THREE.Vector3, forward: THREE.Vector3, range = 2.15): CombatHitResult {
    return this.damage.attack(origin, forward, range);
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
    const component = entry.state?.component as DoorLike | undefined;
    if (component) {
      const accepted = component.toggle();
      if (!accepted) {
        return { handled: true, title: 'PUERTA', message: component.state === 'LOCKED' ? 'La puerta está bloqueada.' : 'Espera a que termine el movimiento.' };
      }
      const opening = component.state === 'OPENING';
      return { handled: true, title: opening ? 'ABRIENDO PUERTA' : 'CERRANDO PUERTA', message: entry.label, tone: 'normal' };
    }

    // Legacy-safe fallback for doors not yet migrated to DoorComponent.
    const state = entry.state ?? (entry.state = {});
    const pivot = state.pivot as THREE.Object3D | undefined;
    if (!pivot || state.transitioning) return { handled: Boolean(pivot), title: 'PUERTA', message: 'Mecanismo ocupado.' };
    const open = !Boolean(state.open);
    state.transitioning = true;
    const closed = Number(state.closedRotationY ?? 0);
    const opened = Number(state.openRotationY ?? -Math.PI / 2);
    this.animate(entry.id, pivot, 'rotation-y', open ? opened : closed, 0.58, 0.55, undefined, () => {
      state.open = open;
      state.transitioning = false;
      if (entry.colliderId) this.collisions.setEnabled(entry.colliderId, !open);
      entry.prompt = open ? 'Cerrar' : 'Abrir';
    });
    return { handled: true, title: open ? 'ABRIENDO PUERTA' : 'CERRANDO PUERTA', message: entry.label };
  }

  private openContainer(entry: WorldObjectDefinition): WorldInteractionResult {
    const state = entry.state ?? (entry.state = {});
    const lid = state.lid as THREE.Object3D | undefined;
    if (!lid) return { handled: false };
    if (state.opening) return { handled: true, title: entry.label, message: 'El mecanismo todavía está abriendo.' };
    if (state.open) {
      return { handled: true, title: entry.label, message: state.looted ? 'El contenedor está vacío.' : 'Contenido disponible.' };
    }

    state.opening = true;
    entry.prompt = 'Abriendo…';
    let revealed: InventoryItem[] = [];
    this.animate(entry.id, lid, 'rotation-x', -1.08, 0.62, 0.60, () => {
      if (!state.looted) {
        revealed = (entry.contents ?? []).map((item) => this.inventory.add(item));
        state.looted = true;
        state.revealedItems = revealed.map((item) => item.id);
        entry.object.userData.lastLoot = revealed.map((item) => item.label);
      }
    }, () => {
      state.open = true;
      state.opening = false;
      entry.prompt = 'Examinar';
      entry.object.userData.objectState = 'OPEN';
      GameLogger.interaction('container opened', entry.id, revealed.map((item) => item.id));
    });

    return { handled: true, title: 'ABRIENDO CONTENEDOR', message: 'La tapa y el contenido se revelan en secuencia.', tone: 'normal' };
  }

  private togglePuzzle(entry: WorldObjectDefinition): WorldInteractionResult {
    const state = entry.state ?? (entry.state = {});
    const pivot = state.pivot as THREE.Object3D | undefined;
    if (!pivot) return { handled: false };
    if (state.transitioning) return { handled: true, title: entry.label, message: 'Espera a que termine el recorrido de la palanca.' };

    const nextActive = !Boolean(state.active);
    state.transitioning = true;
    entry.prompt = 'En movimiento…';
    this.animate(entry.id, pivot, 'rotation-x', nextActive ? -0.65 : 0.65, 0.42, 0.55, () => {
      state.active = nextActive;
      this.updateIndicator(state.indicator as THREE.Mesh | undefined, nextActive);
    }, () => {
      state.transitioning = false;
      entry.prompt = nextActive ? 'Desactivar' : 'Activar';
      entry.object.userData.objectState = nextActive ? 'ACTIVE' : 'INACTIVE';
      GameLogger.interaction('lever state', entry.id, nextActive);
    });

    return { handled: true, title: nextActive ? 'ACTIVANDO MECANISMO' : 'DESACTIVANDO MECANISMO', message: entry.label, tone: 'normal' };
  }

  private animate(
    id: string,
    object: THREE.Object3D,
    property: 'rotation-y' | 'rotation-x',
    target: number,
    duration: number,
    marker: number,
    onMarker?: () => void,
    onComplete?: () => void
  ): void {
    const from = property === 'rotation-y' ? object.rotation.y : object.rotation.x;
    this.animated.set(id, {
      object,
      property,
      from,
      target,
      elapsed: 0,
      duration: Math.max(0.12, duration),
      marker: THREE.MathUtils.clamp(marker, 0, 1),
      markerFired: false,
      onMarker,
      onComplete
    });
  }

  private updateIndicator(indicator: THREE.Mesh | undefined, active: boolean): void {
    if (!(indicator?.material instanceof THREE.MeshStandardMaterial)) return;
    const color = active ? 0x4f9a69 : 0xc64c4c;
    indicator.material.color.setHex(color);
    indicator.material.emissive.setHex(color);
    indicator.material.emissiveIntensity = 0.45;
  }
}
