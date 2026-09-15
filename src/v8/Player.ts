import * as THREE from 'three';
import { CharacterAnimator, type CharacterAction } from './animation/CharacterAnimator';
import { EngineerHeroCharacterV2 } from './characters/EngineerHeroCharacterV2';
import type { HeroActionRequest, HeroAnimationState } from './characters/RiggedHeroAnimator';
import { HeroCharacter } from './characters/HeroCharacter';
import { emitCombatCue } from './gameplay/CombatCue';
import { CARRY_FEEL, sampleCarrySettle, samplePickupLift, samplePutDown } from './gameplay/CarryMotion';
import { DEFAULT_CARRY_CONFIG, WEIGHT_PROFILES, type CarryConfig, type CarryState } from './gameplay/GameplayComponents';
import { GameLogger } from './gameplay/GameLogger';
import type { PlayerProfile } from './types';
import type { Input } from './Input';

interface PlayerAnimator {
  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void;
  play(action: Exclude<CharacterAction, null>): void;
  playAttack?(request?: HeroActionRequest): boolean | void;
  playState?(state: HeroAnimationState, request?: HeroActionRequest): boolean;
  isBusy?(): boolean;
  update(dt: number): void;
  dispose?(): void;
}

interface CarryPhysicsBridge {
  setCarried(): void;
  release(position: THREE.Vector3): void;
  launch(velocity: THREE.Vector3): void;
}

type MovementResolver = (current: THREE.Vector3, desired: THREE.Vector3, radius: number) => THREE.Vector3;

type FallbackTimeline = {
  elapsed: number;
  duration: number;
  marker: number;
  markerFired: boolean;
  onMarker?: () => void;
  onComplete?: () => void;
};

type ObjectPoseTransition = {
  mode: 'LIFT' | 'LOWER' | 'SETTLE';
  elapsed: number;
  duration: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  toQuaternion: THREE.Quaternion;
  arcHeight?: number;
};

/**
 * V9 professional character controller.
 *
 * Position remains controller-authoritative. Authored KayKit animation supplies
 * anticipation/follow-through, while normalized markers synchronize physical
 * events. Pickup uses a short safe approach, a real contact marker, a two-stage
 * lift and a final settle so the object is visibly lifted and secured rather
 * than magnetically absorbed by the carry socket.
 */
export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;

  private visual = new THREE.Group();
  private readonly carryAnchor = new THREE.Group();
  private readonly leftGripDebug = new THREE.Group();
  private readonly rightGripDebug = new THREE.Group();
  private carriedId: string | null = null;
  private carriedObject: THREE.Object3D | null = null;
  private carryConfig: CarryConfig = { ...DEFAULT_CARRY_CONFIG };
  private carryState: CarryState = 'NONE';
  private pendingTarget: THREE.Vector3 | null = null;
  private alignElapsed = 0;
  private alignApproachDistance = 0;
  private animator!: PlayerAnimator;
  private inputRef: Input | null = null;
  private readonly velocity = new THREE.Vector3();
  private readonly desiredVelocity = new THREE.Vector3();
  private readonly poseSample = new THREE.Vector3();
  private fallbackTimeline: FallbackTimeline | null = null;
  private objectPoseTransition: ObjectPoseTransition | null = null;

  constructor(private profile: PlayerProfile) {
    this.group.name = 'V9_PLAYER';
    this.carryAnchor.name = 'V9_CARRY_ANCHOR';
    this.leftGripDebug.name = 'V9_LEFT_HAND_GRIP';
    this.rightGripDebug.name = 'V9_RIGHT_HAND_GRIP';
    this.carryAnchor.add(this.leftGripDebug, this.rightGripDebug);
    this.buildFallbackHero();
    this.visual.add(this.carryAnchor);
    this.applyCarryAnchorConfig();
    this.setCarryState('NONE');
    void this.promoteToEngineerHero();
  }

  update(dt: number, input: Input, resolveMovement: MovementResolver, screenUp: THREE.Vector3, screenRight: THREE.Vector3, locked: boolean): void {
    this.inputRef = input;
    this.updateFallbackTimeline(dt);
    this.updateAlignment(dt, resolveMovement);
    this.updateObjectPoseTransition(dt);

    const transitionLocked = this.isCarryTransition() || Boolean(this.animator.isBusy?.() && this.carryState === 'NONE');
    const movementLocked = locked || transitionLocked;
    let x = 0;
    let y = 0;
    if (!movementLocked) {
      if (input.isDown('KeyW', 'ArrowUp')) y += 1;
      if (input.isDown('KeyS', 'ArrowDown')) y -= 1;
      if (input.isDown('KeyA', 'ArrowLeft')) x -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) x += 1;
    }

    const inputVector = new THREE.Vector3();
    inputVector.addScaledVector(screenUp, y).addScaledVector(screenRight, x);
    if (inputVector.lengthSq() > 1) inputVector.normalize();

    const carrying = this.isCarryingPose();
    const profile = WEIGHT_PROFILES[this.carryConfig.weightClass];
    const sprint = !movementLocked && input.isDown('ShiftLeft', 'ShiftRight') && !carrying;
    const baseSpeed = sprint ? 7.15 : 4.7;
    const speed = baseSpeed * (carrying ? profile.moveSpeed : 1);
    const acceleration = carrying ? 9.5 * profile.acceleration : sprint ? 14.5 : 12.5;
    const deceleration = carrying ? 12.0 : 15.0;

    this.desiredVelocity.copy(inputVector).multiplyScalar(speed);
    const response = inputVector.lengthSq() > 0.001 ? acceleration : deceleration;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, this.desiredVelocity.x, response, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, this.desiredVelocity.z, response, dt);
    if (movementLocked) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 22, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 22, dt);
    }

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = planarSpeed > 0.06;
    if (moving) {
      const desired = this.position.clone().addScaledVector(this.velocity, dt);
      const carryClearance = carrying ? this.carryCollisionRadius() : 0.42;
      const resolved = resolveMovement(this.position, desired, carryClearance);
      const actualDelta = resolved.clone().sub(this.position);
      this.position.copy(resolved);
      if (actualDelta.lengthSq() < 0.000001 && planarSpeed > 0.2) this.velocity.multiplyScalar(0.58);

      if (!this.isCarryTransition()) {
        const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
        this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * (carrying ? 8.5 : 11.5)));
      }
    }

    if (carrying) this.setCarryState(moving ? 'CARRY_WALK' : 'CARRY_IDLE');
    this.animator.setLocomotion(moving, sprint, carrying);
    this.animator.update(dt);
  }

  playAction(action: Exclude<CharacterAction, null>): void {
    if (action === 'interact' && this.inputRef?.isDown('Space')) {
      this.playAttack(() => emitCombatCue('attack-impact'));
      return;
    }
    this.animator.play(action);
  }

  playAttack(onImpact?: () => void): boolean {
    if (this.carryState !== 'NONE' || this.animator.isBusy?.()) return false;
    const request: HeroActionRequest = { marker: 0.36, onMarker: onImpact, fadeIn: 0.08, fadeOut: 0.10 };
    if (this.animator.playAttack) {
      const result = this.animator.playAttack(request);
      return result !== false;
    }
    this.animator.play('interact');
    this.startFallbackTimeline(0.72, 0.36, onImpact);
    return true;
  }

  getCarriedId(): string | null {
    return this.carriedId;
  }

  getCarryState(): CarryState {
    return this.carryState;
  }

  getCarryWeight(): CarryConfig['weightClass'] | null {
    return this.carriedId ? this.carryConfig.weightClass : null;
  }

  getCarryAnchor(): THREE.Object3D {
    return this.carryAnchor;
  }

  getGripPoints(): { left: THREE.Object3D; right: THREE.Object3D } {
    return { left: this.leftGripDebug, right: this.rightGripDebug };
  }

  isActionLocked(): boolean {
    return this.isCarryTransition() || Boolean(this.animator.isBusy?.());
  }

  forward(target = new THREE.Vector3()): THREE.Vector3 {
    target.set(Math.sin(this.visual.rotation.y), 0, Math.cos(this.visual.rotation.y));
    return target.normalize();
  }

  pickup(object: THREE.Object3D, id: string): boolean {
    if (this.carriedId || this.carryState !== 'NONE' || this.animator.isBusy?.()) return false;

    this.carriedId = id;
    this.carriedObject = object;
    this.carryConfig = this.resolveCarryConfig(object);
    this.applyCarryAnchorConfig();
    object.userData.v9OriginalScale ??= object.scale.clone();
    object.userData.v9OriginalQuaternion ??= object.quaternion.clone();
    object.userData.carried = false;

    this.pendingTarget = object.getWorldPosition(new THREE.Vector3()).setY(this.position.y);
    this.setCarryState('ALIGNING');
    this.alignElapsed = 0;
    this.alignApproachDistance = 0;
    this.velocity.set(0, 0, 0);
    GameLogger.interaction('pickup requested', id, this.carryConfig.weightClass);
    return true;
  }

  /** Starts a visible put-down and returns the logical item for mission bookkeeping. */
  drop(parent: THREE.Object3D, target: THREE.Vector3): { id: string; object: THREE.Object3D } | null {
    if (!this.carriedId || !this.carriedObject || !this.isCarryingPose()) return null;
    const id = this.carriedId;
    const object = this.carriedObject;
    const config = this.carryConfig;
    this.setCarryState('PUTDOWN');
    this.velocity.set(0, 0, 0);

    const localTarget = target.clone();
    this.carryAnchor.worldToLocal(localTarget);
    this.objectPoseTransition = {
      mode: 'LOWER',
      elapsed: 0,
      duration: Math.max(0.24, (config.putDownDuration ?? 0.96) * (config.releaseNormalizedTime ?? 0.67)),
      fromPosition: object.position.clone(),
      toPosition: localTarget,
      fromQuaternion: object.quaternion.clone(),
      toQuaternion: new THREE.Quaternion()
    };

    const release = () => this.releaseCarried(parent, target, false);
    const complete = () => {
      if (this.carryState === 'PUTDOWN') this.finishCarryCycle();
    };
    const played = this.playHeroState('putDown', {
      marker: config.releaseNormalizedTime ?? 0.67,
      onMarker: release,
      onComplete: complete,
      reverse: true,
      timeScale: config.pickupTimeScale ?? 0.90,
      fadeIn: 0.16,
      fadeOut: 0.18
    }, 'drop');
    if (!played) this.startFallbackTimeline(config.putDownDuration ?? 0.96, config.releaseNormalizedTime ?? 0.67, release, complete);
    return { id, object };
  }

  throwCarried(parent: THREE.Object3D, direction: THREE.Vector3): { id: string; object: THREE.Object3D } | null {
    if (!this.carriedId || !this.carriedObject || !this.isCarryingPose()) return null;
    if (this.carryConfig.weightClass === 'HEAVY') return null;

    const id = this.carriedId;
    const object = this.carriedObject;
    const config = this.carryConfig;
    const weight = WEIGHT_PROFILES[config.weightClass];
    this.setCarryState('THROW_START');
    this.velocity.set(0, 0, 0);

    const release = () => {
      if (!this.carriedObject) return;
      this.setCarryState('THROW_RELEASE');
      const bridge = this.physicsBridge(this.carriedObject);
      parent.attach(this.carriedObject);
      const forward = direction.clone().setY(0).normalize();
      const launch = forward.multiplyScalar((config.throwSpeed ?? 6.6) * weight.throwMultiplier);
      launch.y = config.throwLift ?? 3.0;
      this.carriedObject.userData.carried = false;
      bridge?.launch(launch);
      GameLogger.physics('throw release', id, launch.toArray());
    };
    const complete = () => {
      this.setCarryState('THROW_RECOVERY');
      this.finishCarryCycle();
    };
    const played = this.playHeroState('throw', { marker: 0.48, onMarker: release, onComplete: complete, fadeIn: 0.10, fadeOut: 0.14 }, 'drop');
    if (!played) this.startFallbackTimeline(0.76, 0.48, release, complete);
    return { id, object };
  }

  dispose(): void {
    this.animator.dispose?.();
    this.fallbackTimeline = null;
    this.objectPoseTransition = null;
  }

  private startPickupAnimation(): void {
    if (!this.carriedId || !this.carriedObject) return this.finishCarryCycle();
    this.setCarryState('PICKUP_START');
    const config = this.carryConfig;
    const feel = CARRY_FEEL[config.weightClass];
    const duration = config.pickupDuration ?? 1.08;
    const timeScale = config.pickupTimeScale ?? feel.pickupTimeScale;
    const marker = config.attachNormalizedTime ?? feel.attachMarker;

    const attach = () => {
      if (!this.carriedObject) return;
      const object = this.carriedObject;
      this.physicsBridge(object)?.setCarried();

      // Preserve the exact world pose at hand contact. From this point the box
      // rises first and only then moves inward toward the torso.
      this.carryAnchor.attach(object);
      const originalScale = object.userData.v9OriginalScale as THREE.Vector3 | undefined;
      if (originalScale) object.scale.copy(originalScale);
      object.userData.carried = true;

      this.objectPoseTransition = {
        mode: 'LIFT',
        elapsed: 0,
        duration: Math.max(0.30, (duration / Math.max(0.20, timeScale)) * (1 - marker)),
        fromPosition: object.position.clone(),
        toPosition: new THREE.Vector3(0, 0, 0),
        fromQuaternion: object.quaternion.clone(),
        toQuaternion: new THREE.Quaternion(),
        arcHeight: feel.liftArc
      };
      this.setCarryState('PICKUP_LIFT');
      GameLogger.interaction('carry contact marker', this.carriedId, object.position.toArray());
    };

    const complete = () => {
      if (!this.carriedObject || !this.carriedId) return;

      // Never snap to the socket at clip completion. Any residual centimetres
      // are resolved through a short settle transition while carry locomotion
      // blends in underneath.
      const currentPosition = this.carriedObject.position.clone();
      const currentQuaternion = this.carriedObject.quaternion.clone();
      const remaining = currentPosition.length();
      if (remaining > 0.002 || currentQuaternion.angleTo(new THREE.Quaternion()) > 0.015) {
        this.objectPoseTransition = {
          mode: 'SETTLE',
          elapsed: 0,
          duration: config.settleDuration ?? feel.settleDuration,
          fromPosition: currentPosition,
          toPosition: new THREE.Vector3(),
          fromQuaternion: currentQuaternion,
          toQuaternion: new THREE.Quaternion()
        };
      } else {
        this.objectPoseTransition = null;
      }
      this.setCarryState('CARRY_IDLE');
      GameLogger.interaction('carry lift secured', this.carriedId, { remaining });
    };

    const played = this.playHeroState('pickup', {
      marker,
      onMarker: attach,
      onComplete: complete,
      timeScale,
      fadeIn: 0.18,
      fadeOut: 0.20
    }, 'pickup');
    if (!played) this.startFallbackTimeline(duration / Math.max(0.20, timeScale), marker, attach, complete);
  }

  private releaseCarried(parent: THREE.Object3D, target: THREE.Vector3, launched: boolean): void {
    if (!this.carriedObject || !this.carriedId) return;
    const object = this.carriedObject;
    parent.attach(object);

    const localTarget = target.clone();
    parent.worldToLocal(localTarget);
    object.position.copy(localTarget);
    object.userData.carried = false;
    this.objectPoseTransition = null;
    if (!launched) this.physicsBridge(object)?.release(target.clone());
    GameLogger.interaction('carry release marker', this.carriedId, target.toArray());
  }

  private finishCarryCycle(): void {
    this.carriedId = null;
    this.carriedObject = null;
    this.objectPoseTransition = null;
    this.pendingTarget = null;
    this.alignApproachDistance = 0;
    this.carryConfig = { ...DEFAULT_CARRY_CONFIG };
    this.applyCarryAnchorConfig();
    this.setCarryState('NONE');
  }

  private updateAlignment(dt: number, resolveMovement: MovementResolver): void {
    if (this.carryState !== 'ALIGNING' || !this.pendingTarget) return;
    this.alignElapsed += dt;
    const feel = CARRY_FEEL[this.carryConfig.weightClass];
    const dx = this.pendingTarget.x - this.position.x;
    const dz = this.pendingTarget.z - this.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance > 0.0001) {
      const targetYaw = Math.atan2(dx, dz);
      this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * 18));

      // Tiny controller-authoritative approach closes the visual gap without
      // taking control away from the player or tunnelling through scenery.
      const desiredStandoff = 0.82;
      const remainingBudget = Math.max(0, feel.maxApproachDistance - this.alignApproachDistance);
      if (distance > desiredStandoff && remainingBudget > 0.001) {
        const step = Math.min(distance - desiredStandoff, feel.approachSpeed * dt, remainingBudget);
        if (step > 0.0001) {
          const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
          const desired = this.position.clone().addScaledVector(direction, step);
          const resolved = resolveMovement(this.position, desired, 0.42);
          const actual = resolved.distanceTo(this.position);
          this.position.copy(resolved);
          this.alignApproachDistance += actual;
        }
      }
    }

    if (this.alignElapsed >= feel.alignDuration) this.startPickupAnimation();
  }

  private updateObjectPoseTransition(dt: number): void {
    const transition = this.objectPoseTransition;
    const object = this.carriedObject;
    if (!transition || !object || object.parent !== this.carryAnchor) return;

    transition.elapsed += dt;
    const raw = THREE.MathUtils.clamp(transition.elapsed / Math.max(0.001, transition.duration), 0, 1);
    if (transition.mode === 'LIFT') {
      samplePickupLift(transition.fromPosition, transition.toPosition, raw, transition.arcHeight ?? 0, this.poseSample);
    } else if (transition.mode === 'LOWER') {
      samplePutDown(transition.fromPosition, transition.toPosition, raw, this.poseSample);
    } else {
      sampleCarrySettle(transition.fromPosition, transition.toPosition, raw, this.poseSample);
    }
    object.position.copy(this.poseSample);

    const rotationT = raw * raw * (3 - 2 * raw);
    object.quaternion.copy(transition.fromQuaternion).slerp(transition.toQuaternion, rotationT);
    if (raw >= 1) {
      object.position.copy(transition.toPosition);
      object.quaternion.copy(transition.toQuaternion);
      this.objectPoseTransition = null;
    }
  }

  private updateFallbackTimeline(dt: number): void {
    const timeline = this.fallbackTimeline;
    if (!timeline) return;
    timeline.elapsed += dt;
    const t = THREE.MathUtils.clamp(timeline.elapsed / Math.max(0.001, timeline.duration), 0, 1);
    if (!timeline.markerFired && t >= timeline.marker) {
      timeline.markerFired = true;
      timeline.onMarker?.();
    }
    if (t >= 1) {
      if (!timeline.markerFired) timeline.onMarker?.();
      this.fallbackTimeline = null;
      timeline.onComplete?.();
    }
  }

  private startFallbackTimeline(duration: number, marker: number, onMarker?: () => void, onComplete?: () => void): void {
    this.fallbackTimeline = { elapsed: 0, duration, marker, markerFired: false, onMarker, onComplete };
  }

  private playHeroState(state: HeroAnimationState, request: HeroActionRequest, legacy: Exclude<CharacterAction, null>): boolean {
    if (this.animator.playState) return this.animator.playState(state, request);
    this.animator.play(legacy);
    return false;
  }

  private setCarryState(state: CarryState): void {
    this.carryState = state;
    this.carryAnchor.userData.state = state;
    this.carryAnchor.userData.weightClass = this.carriedId ? this.carryConfig.weightClass : null;
    if (this.carriedObject) this.carriedObject.userData.carryState = state;
  }

  private isCarryTransition(): boolean {
    return ['ALIGNING', 'PICKUP_START', 'PICKUP_LIFT', 'PUTDOWN', 'THROW_START', 'THROW_RELEASE', 'THROW_RECOVERY'].includes(this.carryState);
  }

  private isCarryingPose(): boolean {
    return this.carryState === 'CARRY_IDLE' || this.carryState === 'CARRY_WALK';
  }

  private carryCollisionRadius(): number {
    if (!this.carriedObject) return 0.55;
    const box = new THREE.Box3().setFromObject(this.carriedObject);
    const size = box.getSize(new THREE.Vector3());
    return THREE.MathUtils.clamp(0.42 + Math.max(size.x, size.z) * 0.22, 0.54, 0.90);
  }

  private resolveCarryConfig(object: THREE.Object3D): CarryConfig {
    const partial = (object.userData.v9CarryConfig ?? {}) as Partial<CarryConfig>;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const halfX = THREE.MathUtils.clamp(size.x * 0.5, 0.15, 0.65);
    const halfZ = THREE.MathUtils.clamp(size.z * 0.5, 0.15, 0.58);
    const inferredPosition: THREE.Vector3Tuple = [
      0,
      THREE.MathUtils.clamp(0.98 + size.y * 0.12, 1.02, 1.16),
      THREE.MathUtils.clamp(0.42 + halfZ * 0.22, 0.47, 0.56)
    ];

    return {
      ...DEFAULT_CARRY_CONFIG,
      ...partial,
      positionOffset: partial.positionOffset ?? inferredPosition,
      leftHandGrip: partial.leftHandGrip ?? { position: [-halfX * 0.84, -0.06, -0.05] },
      rightHandGrip: partial.rightHandGrip ?? { position: [halfX * 0.84, -0.06, -0.05] }
    };
  }

  private applyCarryAnchorConfig(): void {
    const [x, y, z] = this.carryConfig.positionOffset;
    const [rx, ry, rz] = this.carryConfig.rotationOffset ?? [0, 0, 0];
    this.carryAnchor.position.set(x, y, z);
    this.carryAnchor.rotation.set(rx, ry, rz);

    const left = this.carryConfig.leftHandGrip?.position ?? [-0.30, -0.08, -0.06];
    const right = this.carryConfig.rightHandGrip?.position ?? [0.30, -0.08, -0.06];
    this.leftGripDebug.position.set(left[0], left[1], left[2]);
    this.rightGripDebug.position.set(right[0], right[1], right[2]);
    this.carryAnchor.userData.restPosition = [x, y, z];
    this.carryAnchor.userData.weightClass = this.carryConfig.weightClass;
  }

  private physicsBridge(object: THREE.Object3D): CarryPhysicsBridge | null {
    return (object.userData.v9PhysicsBridge as CarryPhysicsBridge | undefined) ?? null;
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
    this.visual.name = 'V9_HERO_FALLBACK';
    this.visual.visible = false;
    this.group.add(this.visual);
    this.animator = new CharacterAnimator({ ...model.rig, root: this.group, visual: this.visual });

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
    );
    shadow.name = 'V9_PLAYER_CONTACT_SHADOW';
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

      fallback.remove(this.carryAnchor);
      this.group.remove(fallback);
      this.animator.dispose?.();
      this.visual = hero.root;
      this.visual.name = 'V9_HERO_KAYKIT_ENGINEER';
      this.group.add(this.visual);
      this.visual.add(this.carryAnchor);
      this.animator = hero.animator;
      this.applyCarryAnchorConfig();
      this.setCarryState('NONE');
      this.group.userData.heroAppearance = this.profile.appearance;
      this.group.userData.heroCanonical = 'kaykit-engineer-v9-carry-polish';
      GameLogger.lifecycle('KayKit engineer promoted with polished carry rig');
    } catch (error) {
      GameLogger.lifecycle('KayKit engineer unavailable; fallback enabled', error);
      fallback.visible = true;
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
