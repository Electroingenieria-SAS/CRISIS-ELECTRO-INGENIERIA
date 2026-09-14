import * as THREE from 'three';
import { CharacterAnimator, type CharacterAction } from './animation/CharacterAnimator';
import { HeroCharacter } from './characters/HeroCharacter';
import { RiggedHeroCharacter } from './characters/RiggedHeroCharacter';
import type { Collider, PlayerProfile } from './types';
import type { Input } from './Input';

interface PlayerAnimator {
  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void;
  play(action: Exclude<CharacterAction, null>): void;
  update(dt: number): void;
}

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;

  private visual = new THREE.Group();
  private carrySocket = new THREE.Group();
  private carriedId: string | null = null;
  private carriedObject: THREE.Object3D | null = null;
  private animator!: PlayerAnimator;
  private rigged = false;

  constructor(private profile: PlayerProfile) {
    this.group.name = 'V8_PLAYER';
    const accent = new THREE.Color(this.profile.accent).getHex();
    this.buildFallbackAvatar(accent);
    this.carrySocket.position.set(0, 1.42, 0.78);
    this.group.add(this.carrySocket);
    void this.promoteToRiggedHero(accent);
  }

  update(dt: number, input: Input, colliders: Collider[], screenUp: THREE.Vector3, screenRight: THREE.Vector3, locked: boolean): void {
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
    const sprint = input.isDown('ShiftLeft', 'ShiftRight') && !this.carriedId;
    const speed = (sprint ? 7.15 : 4.7) * (this.carriedId ? 0.76 : 1);

    if (moving) {
      movement.normalize();
      const next = this.position.clone().addScaledVector(movement, speed * dt);
      if (!this.collides(next, colliders)) this.position.copy(next);
      const targetYaw = Math.atan2(movement.x, movement.z);
      this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * 12));
    }

    if (!locked && !this.carriedId) {
      if (input.isDown('KeyF')) this.animator.play('scan');
      else if (input.isDown('KeyE')) this.animator.play('interact');
    }

    this.animator.setLocomotion(moving, sprint, Boolean(this.carriedId));
    this.animator.update(dt);
  }

  playAction(action: Exclude<CharacterAction, null>): void {
    this.animator.play(action);
  }

  getCarriedId(): string | null {
    return this.carriedId;
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
    if (!this.carriedId || !this.carriedObject) return null;
    const id = this.carriedId;
    const object = this.carriedObject;
    parent.attach(object);
    object.position.copy(target);
    object.rotation.set(0, 0, 0);
    const original = object.userData.v8OriginalScale as THREE.Vector3 | undefined;
    if (original) object.scale.copy(original);
    object.userData.carried = false;
    this.carriedId = null;
    this.carriedObject = null;
    this.playAction('drop');
    return { id, object };
  }

  private buildFallbackAvatar(accent: number): void {
    const role = this.profile.role === 'quality' ? 'quality' : this.profile.role === 'process' ? 'production' : 'maintenance';
    const hero = new HeroCharacter();
    const model = hero.create({
      name: this.profile.name || 'Investigador',
      role,
      accent
    });

    this.visual = model.visual;
    this.visual.name = 'V8_HERO_FALLBACK';
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

  private async promoteToRiggedHero(accent: number): Promise<void> {
    try {
      const rigged = await new RiggedHeroCharacter().load(accent);
      // Avoid replacing the avatar in the middle of a carry operation. The
      // loader is normally complete before the first playable interaction.
      if (this.carriedId) return;

      const oldVisual = this.visual;
      this.group.remove(oldVisual);
      this.visual = rigged.root;
      this.group.add(this.visual);
      this.animator = rigged.animator;
      this.rigged = true;
      this.group.userData.riggedHero = true;
    } catch (error) {
      console.warn('[V8] Rigged hero unavailable; retaining premium procedural fallback.', error);
      this.rigged = false;
    }
  }

  private collides(position: THREE.Vector3, colliders: Collider[]): boolean {
    const radius = 0.42;
    return colliders.some((c) => position.x + radius > c.minX && position.x - radius < c.maxX && position.z + radius > c.minZ && position.z - radius < c.maxZ);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
