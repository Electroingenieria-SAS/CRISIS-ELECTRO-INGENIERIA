import * as THREE from 'three';
import type { Collider, WorldObjectDefinition } from '../types';
import type { DoorState } from './GameplayComponents';
import { GameLogger } from './GameLogger';

export interface DoorComponentOptions {
  id: string;
  entry: WorldObjectDefinition;
  collider: Collider;
  pivot: THREE.Object3D;
  root: THREE.Object3D;
  closedAngle?: number;
  openAngle?: number;
  duration?: number;
  leafWidth?: number;
  leafThickness?: number;
  hingeSide?: 'left' | 'right';
}

/**
 * Reusable hinge-authoritative door.
 * The functional pivot owns state; visual meshes are decoration and the AABB is
 * recomputed from the rotated leaf so closed/open geometry cannot drift apart.
 */
export class DoorComponent {
  readonly interactionPoint = new THREE.Group();
  private stateValue: DoorState = 'CLOSED';
  private elapsed = 0;
  private fromAngle = 0;
  private toAngle = 0;
  private visualNormalized = false;
  private readonly closedAngle: number;
  private readonly openAngle: number;
  private readonly duration: number;
  private readonly leafWidth: number;
  private readonly leafThickness: number;
  private readonly hingeDirection: 1 | -1;
  private readonly corner = new THREE.Vector3();
  private readonly pivotPosition = new THREE.Vector3();

  constructor(private readonly options: DoorComponentOptions) {
    this.closedAngle = options.closedAngle ?? 0;
    this.openAngle = options.openAngle ?? -Math.PI / 2;
    this.duration = Math.max(0.20, options.duration ?? 0.58);
    this.leafWidth = options.leafWidth ?? Math.max(0.6, options.collider.maxX - options.collider.minX);
    this.leafThickness = options.leafThickness ?? Math.max(0.12, options.collider.maxZ - options.collider.minZ);
    this.hingeDirection = options.hingeSide === 'right' ? -1 : 1;

    this.interactionPoint.name = `${options.id}_INTERACTION_POINT`;
    this.interactionPoint.position.set(this.hingeDirection * this.leafWidth * 0.5, 0, -0.95);
    options.root.add(this.interactionPoint);
    options.entry.interaction = {
      ...(options.entry.interaction ?? {}),
      point: this.interactionPoint,
      maxDistance: options.entry.radius ?? 2.4,
      maxFacingAngle: Math.PI * 0.48,
      alignDistance: 1.15,
      requiresFacing: true
    };
    options.entry.state ??= {};
    options.entry.state.component = this;
    options.entry.state.doorState = this.stateValue;
    options.entry.object.userData.doorComponent = this;
    options.pivot.userData.functionalPivot = true;
    options.pivot.userData.doorPivot = true;
    options.collider.debugLabel = `${options.id} leaf (${this.stateValue})`;
    this.syncCollider();
  }

  get state(): DoorState {
    return this.stateValue;
  }

  get pivot(): THREE.Object3D {
    return this.options.pivot;
  }

  toggle(): boolean {
    if (this.stateValue === 'LOCKED' || this.stateValue === 'BROKEN' || this.stateValue === 'OPENING' || this.stateValue === 'CLOSING') return false;
    if (this.stateValue === 'CLOSED') return this.transition('OPENING', this.openAngle);
    if (this.stateValue === 'OPEN') return this.transition('CLOSING', this.closedAngle);
    return false;
  }

  lock(locked = true): void {
    if (this.stateValue === 'OPENING' || this.stateValue === 'CLOSING') return;
    this.stateValue = locked ? 'LOCKED' : Math.abs(this.options.pivot.rotation.y - this.openAngle) < 0.04 ? 'OPEN' : 'CLOSED';
    this.publishState();
  }

  update(dt: number): void {
    this.normalizeDecorativeLeafOnce();
    if (this.stateValue !== 'OPENING' && this.stateValue !== 'CLOSING') {
      this.syncCollider();
      return;
    }

    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    const t = THREE.MathUtils.clamp(this.elapsed / this.duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    this.options.pivot.rotation.y = THREE.MathUtils.lerp(this.fromAngle, this.toAngle, eased);
    this.syncCollider();

    if (t >= 1) {
      this.options.pivot.rotation.y = this.toAngle;
      this.stateValue = this.stateValue === 'OPENING' ? 'OPEN' : 'CLOSED';
      this.publishState();
      this.syncCollider();
      GameLogger.interaction('door transition complete', this.options.id, this.stateValue);
    }
  }

  debugState(): Record<string, string> {
    return {
      id: this.options.id,
      state: this.stateValue,
      collider: this.options.collider.enabled === false ? 'DISABLED' : 'DYNAMIC_AABB',
      pivot: this.options.pivot.name || 'unnamed'
    };
  }

  private transition(state: 'OPENING' | 'CLOSING', target: number): boolean {
    this.stateValue = state;
    this.elapsed = 0;
    this.fromAngle = this.options.pivot.rotation.y;
    this.toAngle = target;
    this.publishState();
    GameLogger.interaction('door transition start', this.options.id, state);
    return true;
  }

  private publishState(): void {
    this.options.entry.state ??= {};
    this.options.entry.state.doorState = this.stateValue;
    this.options.entry.state.open = this.stateValue === 'OPEN' || this.stateValue === 'OPENING';
    this.options.entry.prompt = this.stateValue === 'OPEN' ? 'Cerrar' : this.stateValue === 'CLOSED' ? 'Abrir' : 'En movimiento';
    this.options.collider.debugLabel = `${this.options.id} leaf (${this.stateValue})`;
    this.options.root.userData.objectState = this.stateValue;
  }

  private syncCollider(): void {
    this.options.pivot.updateWorldMatrix(true, false);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const x0 = this.hingeDirection > 0 ? 0 : -this.leafWidth;
    const x1 = this.hingeDirection > 0 ? this.leafWidth : 0;
    const z0 = -this.leafThickness / 2;
    const z1 = this.leafThickness / 2;
    for (const x of [x0, x1]) {
      for (const z of [z0, z1]) {
        this.corner.set(x, 0, z).applyMatrix4(this.options.pivot.matrixWorld);
        minX = Math.min(minX, this.corner.x);
        maxX = Math.max(maxX, this.corner.x);
        minZ = Math.min(minZ, this.corner.z);
        maxZ = Math.max(maxZ, this.corner.z);
      }
    }
    this.options.collider.minX = minX - 0.025;
    this.options.collider.maxX = maxX + 0.025;
    this.options.collider.minZ = minZ - 0.025;
    this.options.collider.maxZ = maxZ + 0.025;
    this.options.collider.enabled = this.stateValue !== 'BROKEN';
  }

  /**
   * V8 centered optional door GLTFs on the hinge host. Once the asset arrives,
   * move its left/right edge onto the actual hinge exactly once.
   */
  private normalizeDecorativeLeafOnce(): void {
    if (this.visualNormalized || this.stateValue !== 'CLOSED') return;
    const visual = this.options.pivot.children.find((child) => child.userData.decorativeOnly === true);
    if (!visual) return;
    visual.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(visual);
    if (box.isEmpty()) return;
    this.options.pivot.getWorldPosition(this.pivotPosition);
    const edge = this.hingeDirection > 0 ? box.min.x : box.max.x;
    const deltaWorldX = this.pivotPosition.x - edge;
    visual.position.x += deltaWorldX * this.hingeDirection;
    visual.userData.hingeNormalized = true;
    this.visualNormalized = true;
    GameLogger.rendering('normalized door GLTF to hinge', this.options.id, deltaWorldX);
  }
}
