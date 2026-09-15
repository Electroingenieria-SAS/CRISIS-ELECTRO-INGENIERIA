import * as THREE from 'three';
import type { Collider, PlayerProfile } from './types';
import type { Controls } from './Controls';
import { EngineerAvatar } from './EngineerAvatar';

/**
 * Player controller for Adventure V3.
 *
 * Important design rule: movement is SCREEN RELATIVE, not world relative.
 * W / ArrowUp always moves toward the TOP of the current screen.
 * S / ArrowDown always moves toward the BOTTOM.
 * A and D always move left/right on screen.
 *
 * Game.ts supplies two horizontal unit vectors derived directly from the
 * camera yaw: screenUp and screenRight. This avoids the old inversion that
 * came from projecting camera.getWorldDirection() onto the floor.
 */
export class AdventurePlayer {
  readonly group = new THREE.Group();
  readonly position = this.group.position;

  private avatar: EngineerAvatar;
  private radius = 0.52;
  private facing = new THREE.Vector3(0, 0, 1);
  private velocity = new THREE.Vector3();
  private interactionLock = 0;
  private footstepTimer = 0;
  private currentSpeed01 = 0;

  onFootstep: (() => void) | null = null;

  constructor(private profile: PlayerProfile) {
    this.avatar = new EngineerAvatar({
      accent: profile.color,
      helmet: '#F4C542',
      shirt: '#12324A',
      pants: '#2C3740',
      vest: '#E8B82D',
      callsign: profile.callsign
    });
    this.group.add(this.avatar.group);
  }

  async init(): Promise<void> {
    // The engineer avatar is built procedurally and is immediately available.
    // Keep async init so Game.ts can treat player/world loading uniformly.
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

    const controlLocked = locked || this.interactionLock > 0;
    if (controlLocked) {
      this.velocity.multiplyScalar(Math.exp(-dt * 16));
      if (this.velocity.lengthSq() < 0.001) this.velocity.set(0, 0, 0);
      this.currentSpeed01 = THREE.MathUtils.damp(this.currentSpeed01, 0, 14, dt);
      this.avatar.update(dt, this.currentSpeed01, false, this.interactionLock > 0);
      return;
    }

    // Raw keyboard axes in literal screen directions.
    let verticalAxis = 0;
    let horizontalAxis = 0;
    if (controls.isDown('KeyW', 'ArrowUp')) verticalAxis += 1;
    if (controls.isDown('KeyS', 'ArrowDown')) verticalAxis -= 1;
    if (controls.isDown('KeyD', 'ArrowRight')) horizontalAxis += 1;
    if (controls.isDown('KeyA', 'ArrowLeft')) horizontalAxis -= 1;

    const up = screenUp.clone().setY(0).normalize();
    const right = screenRight.clone().setY(0).normalize();
    const move = new THREE.Vector3()
      .addScaledVector(up, verticalAxis)
      .addScaledVector(right, horizontalAxis);

    const moving = move.lengthSq() > 0.0001;
    const sprinting = moving && controls.isDown('ShiftLeft', 'ShiftRight');
    const targetSpeed = sprinting ? 7.1 : 4.55;

    if (moving) {
      move.normalize();
      const desiredVelocity = move.multiplyScalar(targetSpeed);
      const acceleration = sprinting ? 15 : 18;
      this.velocity.lerp(desiredVelocity, 1 - Math.exp(-dt * acceleration));

      const horizontalVelocity = this.velocity.clone().setY(0);
      if (horizontalVelocity.lengthSq() > 0.01) {
        this.facing.copy(horizontalVelocity).normalize();
        const targetYaw = Math.atan2(this.facing.x, this.facing.z);
        this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-dt * 16));
      }

      this.currentSpeed01 = THREE.MathUtils.damp(this.currentSpeed01, 1, 12, dt);
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = sprinting ? 0.28 : 0.42;
        this.onFootstep?.();
      }
    } else {
      this.velocity.multiplyScalar(Math.exp(-dt * 15));
      if (this.velocity.lengthSq() < 0.006) this.velocity.set(0, 0, 0);
      this.currentSpeed01 = THREE.MathUtils.damp(this.currentSpeed01, 0, 12, dt);
      this.footstepTimer = 0;
    }

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;

    // Axis-separated collision allows the player to slide naturally along walls.
    if (!this.collides(this.position.x + dx, this.position.z, colliders)) {
      this.position.x += dx;
    } else {
      this.velocity.x = 0;
    }

    if (!this.collides(this.position.x, this.position.z + dz, colliders)) {
      this.position.z += dz;
    } else {
      this.velocity.z = 0;
    }

    const actualSpeed = Math.min(1, this.velocity.length() / targetSpeed);
    this.avatar.update(dt, actualSpeed * this.currentSpeed01, sprinting, false);
  }

  playInteract(): void {
    this.interactionLock = 0.48;
  }

  getFacing(): THREE.Vector3 {
    return this.facing.clone();
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
