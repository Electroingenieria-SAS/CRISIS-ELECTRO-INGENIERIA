import * as THREE from 'three';
import type { AssetLibrary } from '../game/AssetLibrary';
import type { Collider, PlayerProfile } from './types';
import type { Controls } from './Controls';

export class AdventurePlayer {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction = '';
  private radius = 0.55;
  private facing = new THREE.Vector3(0, 0, 1);
  private velocity = new THREE.Vector3();
  private interactionLock = 0;
  private footstepTimer = 0;
  onFootstep: (() => void) | null = null;

  constructor(private assets: AssetLibrary, private profile: PlayerProfile) {}

  async init(): Promise<void> {
    const model = await this.assets.cloneSkinned('/assets/kaykit/characters/Knight.glb');
    this.tintModel(model, this.profile.color);
    model.rotation.y = Math.PI;
    this.group.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const [movement, general] = await Promise.all([
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_MovementBasic.glb'),
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_General.glb')
    ]);

    for (const clip of [...movement, ...general]) {
      if (!this.actions.has(clip.name)) this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.play('Idle_A', 0);
  }

  update(
    dt: number,
    controls: Controls,
    colliders: Collider[],
    cameraForward: THREE.Vector3,
    locked: boolean
  ): void {
    this.mixer?.update(dt);
    this.interactionLock = Math.max(0, this.interactionLock - dt);
    if (locked || this.interactionLock > 0) {
      this.velocity.multiplyScalar(Math.exp(-dt * 12));
      this.play('Idle_A');
      return;
    }

    const forward = cameraForward.clone();
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    let forwardAxis = 0;
    let sideAxis = 0;
    if (controls.isDown('KeyW', 'ArrowUp')) forwardAxis += 1;
    if (controls.isDown('KeyS', 'ArrowDown')) forwardAxis -= 1;
    if (controls.isDown('KeyD', 'ArrowRight')) sideAxis += 1;
    if (controls.isDown('KeyA', 'ArrowLeft')) sideAxis -= 1;

    const move = forward.multiplyScalar(forwardAxis).add(right.multiplyScalar(sideAxis));
    const moving = move.lengthSq() > 0.001;
    const sprint = controls.isDown('ShiftLeft', 'ShiftRight');
    const targetSpeed = sprint ? 7.2 : 4.7;

    if (moving) {
      move.normalize();
      this.velocity.lerp(move.multiplyScalar(targetSpeed), 1 - Math.exp(-dt * 14));
      this.facing.copy(this.velocity).setY(0).normalize();

      const targetYaw = Math.atan2(this.facing.x, this.facing.z);
      this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-dt * 15));
      this.play(sprint ? 'Running_A' : 'Walking_A');

      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = sprint ? 0.28 : 0.42;
        this.onFootstep?.();
      }
    } else {
      this.velocity.multiplyScalar(Math.exp(-dt * 12));
      if (this.velocity.lengthSq() < 0.02) this.velocity.set(0, 0, 0);
      this.play('Idle_A');
      this.footstepTimer = 0;
    }

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    if (!this.collides(this.position.x + dx, this.position.z, colliders)) this.position.x += dx;
    else this.velocity.x = 0;
    if (!this.collides(this.position.x, this.position.z + dz, colliders)) this.position.z += dz;
    else this.velocity.z = 0;
  }

  playInteract(): void {
    const action = this.actions.get('Interact');
    if (action) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset();
    }
    this.interactionLock = 0.52;
    this.play('Interact', 0.08, true);
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

  private play(name: string, fade = 0.16, force = false): void {
    if (!force && name === this.currentAction) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.currentAction);
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.currentAction = name;
  }

  private tintModel(object: THREE.Object3D, colorHex: string): void {
    const tint = new THREE.Color(colorHex);
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => {
          const clone = material.clone();
          if ('color' in clone && clone.color instanceof THREE.Color) clone.color.lerp(tint, 0.34);
          clone.needsUpdate = true;
          return clone;
        });
      } else if (child.material) {
        const clone = child.material.clone();
        if ('color' in clone && clone.color instanceof THREE.Color) clone.color.lerp(tint, 0.34);
        clone.needsUpdate = true;
        child.material = clone;
      }
    });
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
