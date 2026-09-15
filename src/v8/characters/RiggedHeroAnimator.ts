import * as THREE from 'three';
import type { CharacterAction } from '../animation/CharacterAnimator';
import { GameLogger } from '../gameplay/GameLogger';
import type { RiggedCharacterClips } from './RiggedCharacterLibrary';

export type HeroAnimationState =
  | 'idle' | 'walk' | 'run'
  | 'carryIdle' | 'carryWalk'
  | 'attack' | 'hit' | 'interact' | 'pickup' | 'putDown' | 'throw' | 'push' | 'pull' | 'scan';

export interface HeroActionRequest {
  marker?: number;
  onMarker?: () => void;
  onComplete?: () => void;
  reverse?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  timeScale?: number;
}

type BaseState = 'idle' | 'walk' | 'run' | 'carryIdle' | 'carryWalk';

interface ActiveOneShot {
  key: Exclude<HeroAnimationState, BaseState>;
  action: THREE.AnimationAction;
  request: HeroActionRequest;
  markerFired: boolean;
  generation: number;
}

/**
 * V9 KayKit animation state machine.
 * Locomotion is controller-driven; gameplay synchronization uses normalized
 * animation markers. Finished one-shots stay alive for the full crossfade
 * interval instead of being stopped on the next microtask.
 */
export class RiggedHeroAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<HeroAnimationState, THREE.AnimationAction>();
  private readonly scanner: THREE.Object3D | null;
  private readonly retiring = new Map<THREE.AnimationAction, number>();
  private baseState: BaseState = 'idle';
  private moving = false;
  private sprinting = false;
  private carrying = false;
  private active: ActiveOneShot | null = null;
  private generation = 0;

  constructor(private readonly root: THREE.Object3D, clips: RiggedCharacterClips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions.set('idle', this.loopAction(clips.idle));
    this.actions.set('walk', this.loopAction(clips.walk));
    this.actions.set('run', this.loopAction(clips.run));
    if (clips.carryIdle) this.actions.set('carryIdle', this.loopAction(clips.carryIdle));
    if (clips.carryWalk) this.actions.set('carryWalk', this.loopAction(clips.carryWalk));

    this.addOnce('interact', clips.interact);
    this.addOnce('pickup', clips.pickup);
    this.addOnce('putDown', clips.putDown);
    this.addOnce('attack', clips.attack);
    this.addOnce('hit', clips.hit);
    this.addOnce('push', clips.push);
    this.addOnce('pull', clips.pull);
    this.addOnce('throw', clips.throw);
    this.addOnce('scan', clips.useItem);

    this.scanner = root.getObjectByName('EI_HAND_SCANNER_RIGGED') ?? null;
    if (this.scanner) this.scanner.visible = false;

    this.actions.get('idle')?.reset().play();
    this.mixer.addEventListener('finished', this.onFinished);
  }

  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void {
    this.moving = moving;
    this.sprinting = sprinting;
    this.carrying = carrying;
    if (this.active) return;
    const desired = this.desiredBaseState();
    if (desired !== this.baseState) this.transitionBase(desired);
    else this.ensureBaseAuthority(desired);
  }

  play(action: Exclude<CharacterAction, null>): void {
    const mapped: Record<Exclude<CharacterAction, null>, HeroAnimationState> = {
      pickup: 'pickup',
      drop: 'putDown',
      scan: 'scan',
      interact: 'interact'
    };
    this.playState(mapped[action]);
  }

  playAttack(request: HeroActionRequest = {}): boolean {
    return this.playState('attack', request) || this.playState('interact', request);
  }

  playState(state: HeroAnimationState, request: HeroActionRequest = {}): boolean {
    if (state === 'idle' || state === 'walk' || state === 'run' || state === 'carryIdle' || state === 'carryWalk') return false;
    if (this.active) return false;

    const animation = this.actions.get(state) ?? this.fallbackFor(state);
    if (!animation) return false;

    this.generation += 1;
    const generation = this.generation;
    this.active = { key: state, action: animation, request, markerFired: false, generation };
    if (this.scanner) this.scanner.visible = state === 'scan';

    this.retiring.delete(animation);
    const reverse = request.reverse === true;
    const clipDuration = Math.max(0.001, animation.getClip().duration);
    animation.stop();
    animation.reset();
    animation.stopFading();
    animation.stopWarping();
    animation.enabled = true;
    animation.paused = false;
    animation.clampWhenFinished = true;
    animation.setLoop(THREE.LoopOnce, 1);
    animation.time = reverse ? clipDuration : 0;
    animation.setEffectiveWeight(1);
    animation.setEffectiveTimeScale((reverse ? -1 : 1) * Math.max(0.05, request.timeScale ?? 1));
    animation.play();

    const base = this.actions.get(this.baseState);
    if (base && base !== animation) {
      base.stopFading();
      animation.crossFadeFrom(base, request.fadeIn ?? (state === 'attack' ? 0.08 : 0.14), false);
    }

    GameLogger.animation('one-shot start', state, animation.getClip().name, { reverse, generation });
    return true;
  }

  isBusy(): boolean {
    return this.active !== null;
  }

  state(): HeroAnimationState {
    return this.active?.key ?? this.baseState;
  }

  update(dt: number): void {
    const walk = this.actions.get('walk');
    if (walk) walk.setEffectiveTimeScale(this.carrying ? 0.78 : 1);
    const carryWalk = this.actions.get('carryWalk');
    if (carryWalk) carryWalk.setEffectiveTimeScale(0.82);

    this.mixer.update(dt);
    this.fireMarkerIfNeeded();
    this.updateRetiring(dt);
  }

  dispose(): void {
    this.generation += 1;
    this.active = null;
    this.retiring.clear();
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  private addOnce(key: Exclude<HeroAnimationState, BaseState>, clip?: THREE.AnimationClip): void {
    if (!clip) return;
    const copy = clip.clone();
    copy.name = `${clip.name || key}__${key.toUpperCase()}`;
    this.actions.set(key, this.onceAction(copy));
  }

  private fallbackFor(state: Exclude<HeroAnimationState, BaseState>): THREE.AnimationAction | undefined {
    if (state === 'putDown') return this.actions.get('pickup');
    if (state === 'throw') return this.actions.get('interact');
    if (state === 'push' || state === 'pull' || state === 'hit') return this.actions.get('interact');
    return undefined;
  }

  private desiredBaseState(): BaseState {
    if (this.carrying) {
      if (this.moving) return this.actions.has('carryWalk') ? 'carryWalk' : 'walk';
      return this.actions.has('carryIdle') ? 'carryIdle' : 'idle';
    }
    if (!this.moving) return 'idle';
    return this.sprinting ? 'run' : 'walk';
  }

  private transitionBase(next: BaseState): void {
    const previous = this.actions.get(this.baseState);
    const target = this.actions.get(next);
    if (!target) return;
    this.prepareBaseAction(target);
    if (previous && previous !== target) {
      previous.stopFading();
      target.crossFadeFrom(previous, next === 'run' || this.baseState === 'run' ? 0.14 : 0.20, false);
    }
    GameLogger.animation('locomotion', this.baseState, '→', next);
    this.baseState = next;
  }

  private ensureBaseAuthority(state: BaseState): void {
    const target = this.actions.get(state);
    if (!target) return;
    target.enabled = true;
    target.paused = false;
    target.setEffectiveWeight(1);
    if (!target.isRunning()) target.play();
  }

  private prepareBaseAction(action: THREE.AnimationAction): void {
    this.retiring.delete(action);
    action.stopFading();
    action.stopWarping();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    if (!action.isRunning()) action.reset().play();
  }

  private fireMarkerIfNeeded(): void {
    const active = this.active;
    if (!active || active.markerFired || active.request.marker === undefined) return;
    const duration = Math.max(0.001, active.action.getClip().duration);
    const reverse = active.request.reverse === true;
    const raw = THREE.MathUtils.clamp(active.action.time / duration, 0, 1);
    const normalizedProgress = reverse ? 1 - raw : raw;
    if (normalizedProgress < THREE.MathUtils.clamp(active.request.marker, 0, 1)) return;
    active.markerFired = true;
    GameLogger.animation('marker', active.key, normalizedProgress.toFixed(2));
    active.request.onMarker?.();
  }

  private updateRetiring(dt: number): void {
    for (const [action, remaining] of this.retiring) {
      const next = remaining - dt;
      if (next > 0) {
        this.retiring.set(action, next);
        continue;
      }
      this.retiring.delete(action);
      if (this.active?.action === action) continue;
      action.stopFading();
      action.stopWarping();
      action.stop();
      action.enabled = false;
      action.setEffectiveWeight(0);
    }
  }

  private onFinished = (event: { action: THREE.AnimationAction }): void => {
    const active = this.active;
    if (!active || active.action !== event.action) return;
    if (!active.markerFired && active.request.onMarker) {
      active.markerFired = true;
      active.request.onMarker();
    }

    const finished = active.action;
    const completed = active.request.onComplete;
    const fadeOut = active.request.fadeOut ?? (active.key === 'attack' ? 0.09 : 0.13);
    this.active = null;
    if (this.scanner) this.scanner.visible = false;

    const desired = this.desiredBaseState();
    const target = this.actions.get(desired) ?? this.actions.get('idle');
    if (target && target !== finished) {
      this.prepareBaseAction(target);
      finished.stopFading();
      target.crossFadeFrom(finished, fadeOut, false);
      this.retiring.set(finished, Math.max(0.05, fadeOut + 0.02));
    } else {
      finished.stop();
      finished.enabled = false;
      finished.setEffectiveWeight(0);
    }
    this.baseState = target === this.actions.get(desired) ? desired : 'idle';

    GameLogger.animation('one-shot complete', active.key, { fadeOut });
    completed?.();
  };

  private loopAction(clip: THREE.AnimationClip): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    return action;
  }

  private onceAction(clip: THREE.AnimationClip): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    return action;
  }
}
