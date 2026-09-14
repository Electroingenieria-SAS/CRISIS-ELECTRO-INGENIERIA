import * as THREE from 'three';
import type { Collider, PlayerProfile } from '../v3/types';
import type { Controls } from '../v3/Controls';
import { EngineerAvatar } from '../v3/EngineerAvatar';

export class V4Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly carrySocket = new THREE.Group();

  private avatar: EngineerAvatar;
  private radius = 0.55;
  private facing = new THREE.Vector3(0, 0, 1);
  private velocity = new THREE.Vector3();
  private interactionLock = 0;
  private footstepTimer = 0;
  private carried: THREE.Object3D | null = null;
  private carriedId: string | null = null;
  private carryPhase = 0;

  onFootstep: (() => void) | null = null;

  constructor(private profile: PlayerProfile) {
    this.avatar = new EngineerAvatar({
      accent: profile.color,
      helmet: '#F4C542',
      shirt: '#15364F',
      pants: '#2C3740',
      vest: '#F0C434',
      callsign: profile.callsign
    });
    this.group.add(this.avatar.group);
    this.carrySocket.position.set(0, 1.38, 0.86);
    this.group.add(this.carrySocket);
  }

  async init(): Promise<void> {
    this.avatar.setAccent(this.profile.color);
  }

  update(
    dt: number,
    controls: Controls,
    colliders: Collider[],
    screenUp: THREE.Vector3,
    screenRight: THREE.Vector3,
    locked: boolean
  ): void {
    this.interactionLock = Math.max(0, this.interactionLock - dt);
    this.carryPhase += dt;

    const controlLocked = locked || this.interactionLock > 0;
    if (controlLocked) {
      this.velocity.multiplyScalar(Math.exp(-dt * 16));
      this.avatar.update(dt, 0, false, true);
      this.animateCarry();
      return;
    }

    let verticalAxis = 0;
    let horizontalAxis = 0;
    if (controls.isDown('KeyW', 'ArrowUp')) verticalAxis += 1;
    if (controls.isDown('KeyS', 'ArrowDown')) verticalAxis -= 1;
    if (controls.isDown('KeyD', 'ArrowRight')) horizontalAxis += 1;
    if (controls.isDown('KeyA', 'ArrowLeft')) horizontalAxis -= 1;

    const up = screenUp.clone().setY(0).normalize();
    const right = screenRight.clone().setY(0).normalize();
    const move = new THREE.Vector3().addScaledVector(up, verticalAxis).addScaledVector(right, horizontalAxis);
    const moving = move.lengthSq() > 0.0001;
    const sprinting = moving && controls.isDown('ShiftLeft', 'ShiftRight') && !this.carried;
    const targetSpeed = this.carried ? 3.65 : sprinting ? 7.2 : 4.65;

    if (moving) {
      move.normalize();
      this.velocity.lerp(move.multiplyScalar(targetSpeed), 1 - Math.exp(-dt * 17));
      const horizontalVelocity = this.velocity.clone().setY(0);
      if (horizontalVelocity.lengthSq() > 0.01) {
        this.facing.copy(horizontalVelocity).normalize();
        const targetYaw = Math.atan2(this.facing.x, this.facing.z);
        this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-dt * 16));
      }
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = sprinting ? 0.28 : this.carried ? 0.5 : 0.42;
        this.onFootstep?.();
      }
    } else {
      this.velocity.multiplyScalar(Math.exp(-dt * 15));
      if (this.velocity.lengthSq() < 0.005) this.velocity.set(0, 0, 0);
      this.footstepTimer = 0;
    }

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    if (!this.collides(this.position.x + dx, this.position.z, colliders)) this.position.x += dx;
    else this.velocity.x = 0;
    if (!this.collides(this.position.x, this.position.z + dz, colliders)) this.position.z += dz;
    else this.velocity.z = 0;

    const speed01 = Math.min(1, this.velocity.length() / Math.max(0.1, targetSpeed));
    this.avatar.update(dt, speed01, sprinting, this.carried !== null);
    this.animateCarry();
  }

  playInteract(): void {
    this.interactionLock = 0.42;
  }

  pickupObject(object: THREE.Object3D, id: string, scale = 0.72): boolean {
    if (this.carried) return false;
    this.carried = object;
    this.carriedId = id;
    object.removeFromParent();
    this.carrySocket.add(object);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.multiplyScalar(scale);
    this.interactionLock = 0.32;
    return true;
  }

  releaseObject(parent: THREE.Object3D, worldPosition: THREE.Vector3, scaleFactor = 1): { object: THREE.Object3D; id: string } | null {
    if (!this.carried || !this.carriedId) return null;
    const object = this.carried;
    const id = this.carriedId;
    object.removeFromParent();
    parent.add(object);
    object.position.copy(worldPosition);
    if (scaleFactor !== 1) object.scale.multiplyScalar(scaleFactor);
    this.carried = null;
    this.carriedId = null;
    this.interactionLock = 0.24;
    return { object, id };
  }

  getCarriedId(): string | null {
    return this.carriedId;
  }

  hasCarriedObject(): boolean {
    return this.carried !== null;
  }

  getFacing(): THREE.Vector3 {
    return this.facing.clone();
  }

  private animateCarry(): void {
    if (!this.carried) return;
    this.carrySocket.position.y = 1.4 + Math.sin(this.carryPhase * 5.2) * 0.025;
    this.carried.rotation.y = Math.sin(this.carryPhase * 1.4) * 0.035;
  }

  private collides(x: number, z: number, colliders: Collider[]): boolean {
    for (const collider of colliders) {
      if (collider.enabled && !collider.enabled()) continue;
      const nearestX = Math.max(collider.minX, Math.min(x, collider.maxX));
      const nearestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < this.radius * this.radius) return true;
    }
    return false;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
