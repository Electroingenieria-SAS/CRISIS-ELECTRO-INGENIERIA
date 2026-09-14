import * as THREE from 'three';
import type { Collider, PlayerProfile } from './types';
import type { AssetLibrary } from './AssetLibrary';
import type { Input } from './Input';

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction = '';
  private radius = 0.48;
  private facing = new THREE.Vector3(0, 0, -1);
  private actionLock = 0;
  private attackRing: THREE.Mesh | null = null;
  private attackPulse = 0;
  private moving = false;

  constructor(private assets: AssetLibrary) {}

  async init(profile: PlayerProfile): Promise<void> {
    const model = await this.assets.cloneSkinned('/assets/kaykit/characters/Knight.glb');
    model.rotation.y = Math.PI;
    this.group.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const [movement, general] = await Promise.all([
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_MovementBasic.glb'),
      this.assets.animations('/assets/kaykit/animations/Rig_Medium_General.glb')
    ]);

    for (const clip of [...movement, ...general]) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.createCharacterMarker(profile);
    this.play('Idle_A', 0);
  }

  update(
    dt: number,
    input: Input,
    colliders: Collider[],
    movementLocked: boolean,
    cameraForward: THREE.Vector3,
    cameraRight: THREE.Vector3
  ): boolean {
    this.mixer?.update(dt);
    this.actionLock = Math.max(0, this.actionLock - dt);
    this.attackPulse = Math.max(0, this.attackPulse - dt);
    if (this.attackRing) {
      const t = 1 - Math.min(1, this.attackPulse / 0.24);
      this.attackRing.scale.setScalar(1 + t * 2.6);
      const material = this.attackRing.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, this.attackPulse / 0.24) * 0.72;
      this.attackRing.visible = this.attackPulse > 0;
    }

    if (this.actionLock > 0 || movementLocked) {
      this.moving = false;
      if (this.actionLock <= 0) this.play('Idle_A');
      return false;
    }

    let vertical = 0;
    let horizontal = 0;
    if (input.isDown('KeyW', 'ArrowUp')) vertical += 1;
    if (input.isDown('KeyS', 'ArrowDown')) vertical -= 1;
    if (input.isDown('KeyA', 'ArrowLeft')) horizontal -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) horizontal += 1;

    const direction = new THREE.Vector3();
    direction.addScaledVector(cameraForward, vertical);
    direction.addScaledVector(cameraRight, horizontal);
    direction.y = 0;

    if (direction.lengthSq() > 0.001) {
      direction.normalize();
      const sprint = input.isDown('ShiftLeft', 'ShiftRight');
      const speed = sprint ? 6.25 : 4.25;
      const dx = direction.x * speed * dt;
      const dz = direction.z * speed * dt;

      if (!this.collides(this.position.x + dx, this.position.z, colliders)) this.position.x += dx;
      if (!this.collides(this.position.x, this.position.z + dz, colliders)) this.position.z += dz;

      this.facing.copy(direction);
      const targetYaw = Math.atan2(direction.x, direction.z);
      this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-dt * 18));
      this.play(sprint ? 'Running_A' : 'Walking_A');
      this.moving = true;
      return true;
    }

    this.moving = false;
    this.play('Idle_A');
    return false;
  }

  getFacing(): THREE.Vector3 { return this.facing; }
  isMoving(): boolean { return this.moving; }

  playInteract(): void {
    this.actionLock = 0.46;
    this.playOneShot(['Interact', 'PickUp', 'Use_Item'], 0.08);
  }

  attack(): void {
    this.actionLock = 0.28;
    this.attackPulse = 0.24;
    this.playOneShot(['1H_Melee_Attack_Chop', 'Melee_1H_Attack_Chop', 'Punch_A', 'Interact'], 0.05);
  }

  private createCharacterMarker(profile: PlayerProfile): void {
    const accent = new THREE.Color(profile.accent);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.54, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.group.add(ring);

    const beacon = new THREE.PointLight(accent, 1.25, 4.5, 2);
    beacon.position.set(0, 1.45, 0);
    this.group.add(beacon);

    this.attackRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.84, 40),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.attackRing.rotation.x = -Math.PI / 2;
    this.attackRing.position.y = 0.045;
    this.attackRing.visible = false;
    this.group.add(this.attackRing);
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

  private play(name: string, fade = 0.16): void {
    if (name === this.currentAction) return;
    const next = this.actions.get(name);
    if (!next) return;
    const previous = this.actions.get(this.currentAction);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    previous?.fadeOut(fade);
    this.currentAction = name;
  }

  private playOneShot(names: string[], fade = 0.08): void {
    const name = names.find((candidate) => this.actions.has(candidate));
    if (!name) return;
    const action = this.actions.get(name)!;
    const previous = this.actions.get(this.currentAction);
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.fadeIn(fade).play();
    previous?.fadeOut(fade);
    this.currentAction = name;
    window.setTimeout(() => {
      if (this.currentAction === name) this.currentAction = '';
    }, 320);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let delta = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
  }
}
