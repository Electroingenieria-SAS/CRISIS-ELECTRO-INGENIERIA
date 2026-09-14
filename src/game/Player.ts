import * as THREE from 'three';
import type { Collider } from './types';
import type { AssetLibrary } from './AssetLibrary';
import type { Input } from './Input';

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction = '';
  private radius = 0.48;
  private tmp = new THREE.Vector3();
  private facing = new THREE.Vector3(0, 0, -1);
  private actionLock = 0;

  constructor(private assets: AssetLibrary) {}

  async init(): Promise<void> {
    const model = await this.assets.cloneSkinned('/assets/kaykit/characters/Knight.glb');
    model.rotation.y = Math.PI;
    this.group.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const [movement, general] = await Promise.all([
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_MovementBasic.glb'),
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_General.glb')
    ]);

    for (const clip of [...movement, ...general]) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.play('Idle_A', 0);
  }

  update(dt: number, input: Input, colliders: Collider[], movementLocked: boolean): void {
    this.mixer?.update(dt);
    this.actionLock = Math.max(0, this.actionLock - dt);
    if (this.actionLock > 0) return;
    if (movementLocked) {
      this.play('Idle_A');
      return;
    }

    let x = 0;
    let z = 0;
    if (input.isDown('KeyW', 'ArrowUp')) z -= 1;
    if (input.isDown('KeyS', 'ArrowDown')) z += 1;
    if (input.isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) x += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len; z /= len;
      const sprint = input.isDown('ShiftLeft', 'ShiftRight');
      const speed = sprint ? 6.1 : 4.15;
      const dx = x * speed * dt;
      const dz = z * speed * dt;

      if (!this.collides(this.position.x + dx, this.position.z, colliders)) this.position.x += dx;
      if (!this.collides(this.position.x, this.position.z + dz, colliders)) this.position.z += dz;

      this.facing.set(x, 0, z).normalize();
      const targetYaw = Math.atan2(x, z);
      this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-dt * 18));
      this.play(sprint ? 'Running_A' : 'Walking_A');
    } else {
      this.play('Idle_A');
    }
  }

  getFacing(): THREE.Vector3 {
    return this.facing;
  }

  playInteract(): void {
    const action = this.actions.get('Interact');
    if (action) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    this.actionLock = 0.52;
    this.play('Interact', 0.08);
  }

  private collides(x: number, z: number, colliders: Collider[]): boolean {
    for (const c of colliders) {
      if (c.enabled && !c.enabled()) continue;
      const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < this.radius * this.radius) return true;
    }
    return false;
  }

  private play(name: string, fade = 0.16): void {
    if (name === this.currentAction) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.currentAction);
    next.reset().fadeIn(fade).play();
    prev?.fadeOut(fade);
    this.currentAction = name;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let delta = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
  }
}
