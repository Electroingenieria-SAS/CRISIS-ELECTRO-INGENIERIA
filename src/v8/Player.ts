import * as THREE from 'three';
import { CharacterAnimator, type CharacterAction } from './animation/CharacterAnimator';
import { EngineerHeroCharacterV2 } from './characters/EngineerHeroCharacterV2';
import { HeroCharacter } from './characters/HeroCharacter';
import type { PlayerProfile } from './types';
import type { Input } from './Input';

interface PlayerAnimator {
  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void;
  play(action: Exclude<CharacterAction, null>): void;
  update(dt: number): void;
}

type MovementResolver = (current: THREE.Vector3, desired: THREE.Vector3, radius: number) => THREE.Vector3;

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;

  private visual = new THREE.Group();
  private carrySocket = new THREE.Group();
  private carriedId: string | null = null;
  private carriedObject: THREE.Object3D | null = null;
  private animator!: PlayerAnimator;

  constructor(private profile: PlayerProfile) {
    this.group.name = 'V8_PLAYER';
    this.buildFallbackHero();
    this.carrySocket.position.set(0, 1.42, 0.78);
    this.group.add(this.carrySocket);
    void this.promoteToEngineerHero();
  }

  update(dt: number, input: Input, resolveMovement: MovementResolver, screenUp: THREE.Vector3, screenRight: THREE.Vector3, locked: boolean): void {
    let x = 0;
    let y = 0;
    if (!locked) {
      if (input.isDown('KeyW', 'ArrowUp')) y += 1;
      if (input.isDown('KeyS', 'ArrowDown')) y -= 1;
      if (input.isDown('KeyA', 'ArrowLeft')) x -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) x += 1;
    }

    const movement = new THREE.Vector3();
    movement.addScaledVector(screenUp, y).addScaledVector(screenRight, x);
    const moving = movement.lengthSq() > 0.001;
    const sprint = !locked && input.isDown('ShiftLeft', 'ShiftRight') && !this.carriedId;
    const speed = (sprint ? 7.15 : 4.7) * (this.carriedId ? 0.76 : 1);

    if (moving) {
      movement.normalize();
      const desired = this.position.clone().addScaledVector(movement, speed * dt);
      this.position.copy(resolveMovement(this.position, desired, 0.42));
      const targetYaw = Math.atan2(movement.x, movement.z);
      this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * 12));
    }

    // E/F actions are intentionally NOT triggered from held-key state here.
    this.animator.setLocomotion(moving, sprint, Boolean(this.carriedId));
    this.animator.update(dt);
  }

  playAction(action: Exclude<CharacterAction, null>): void {
    this.animator.play(action);
  }

  getCarriedId(): string | null {
    return this.carriedId;
  }

  forward(target = new THREE.Vector3()): THREE.Vector3 {
    target.set(Math.sin(this.visual.rotation.y), 0, Math.cos(this.visual.rotation.y));
    return target.normalize();
  }

  pickup(object: THREE.Object3D, id: string): boolean {
    if (this.carriedId) return false;
    this.carriedId = id;
    this.carriedObject = object;
    object.userData.v8OriginalScale = object.scale.clone();
    this.carrySocket.attach(object);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.multiplyScalar(0.7);
    object.userData.carried = true;
    this.playAction('pickup');
    return true;
  }

  drop(parent: THREE.Object3D, target: THREE.Vector3): { id: string; object: THREE.Object3D } | null {
    const released = this.releaseCarried(parent);
    if (!released) return null;
    released.object.position.copy(target);
    released.object.rotation.set(0, 0, 0);
    this.playAction('drop');
    return released;
  }

  throwCarried(parent: THREE.Object3D, direction: THREE.Vector3): { id: string; object: THREE.Object3D } | null {
    const released = this.releaseCarried(parent);
    if (!released) return null;

    const object = released.object;
    const start = object.position.clone();
    const forward = direction.clone().setY(0).normalize();
    const end = start.clone().addScaledVector(forward, 3.0);
    const started = performance.now();
    const duration = 380;
    object.userData.throwing = true;

    const animate = (now: number) => {
      const t = THREE.MathUtils.clamp((now - started) / duration, 0, 1);
      object.position.lerpVectors(start, end, t);
      object.position.y = THREE.MathUtils.lerp(start.y, 0.15, t) + Math.sin(Math.PI * t) * 1.05;
      object.rotation.x += 0.16;
      object.rotation.z += 0.10;
      if (t < 1) requestAnimationFrame(animate);
      else {
        object.position.y = 0.15;
        object.userData.throwing = false;
      }
    };
    requestAnimationFrame(animate);
    this.playAction('drop');
    return released;
  }

  private releaseCarried(parent: THREE.Object3D): { id: string; object: THREE.Object3D } | null {
    if (!this.carriedId || !this.carriedObject) return null;
    const id = this.carriedId;
    const object = this.carriedObject;
    parent.attach(object);
    const original = object.userData.v8OriginalScale as THREE.Vector3 | undefined;
    if (original) object.scale.copy(original);
    object.userData.carried = false;
    this.carriedId = null;
    this.carriedObject = null;
    return { id, object };
  }

  private buildFallbackHero(): void {
    const role = this.profile.role === 'quality' ? 'quality' : this.profile.role === 'process' ? 'production' : 'maintenance';
    const hero = new HeroCharacter();
    const model = hero.create({
      name: this.profile.name || 'Investigador',
      role,
      accent: new THREE.Color(this.profile.appearance.vest).getHex(),
      appearance: this.profile.appearance
    });

    this.visual = model.visual;
    this.visual.name = 'V8_HERO_FALLBACK';
    this.visual.visible = false;
    this.group.add(this.visual);
    this.animator = new CharacterAnimator({ ...model.rig, root: this.group, visual: this.visual });

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.19, depthWrite: false })
    );
    shadow.name = 'V8_PLAYER_CONTACT_SHADOW';
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.group.add(shadow);
  }

  private async promoteToEngineerHero(): Promise<void> {
    const fallback = this.visual;
    try {
      const hero = await new EngineerHeroCharacterV2().load(this.profile.appearance);
      if (this.carriedId) {
        fallback.visible = true;
        return;
      }

      this.group.remove(fallback);
      this.visual = hero.root;
      this.visual.name = 'V8_HERO_KAYKIT_ENGINEER_V2';
      this.group.add(this.visual);
      this.animator = hero.animator;
      this.group.userData.heroAppearance = this.profile.appearance;
      this.group.userData.heroCanonical = 'kaykit-engineer-v6';
    } catch (error) {
      console.warn('[V8] KayKit engineer V2 unavailable; enabling fallback.', error);
      fallback.visible = true;
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
