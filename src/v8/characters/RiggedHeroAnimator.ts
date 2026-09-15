import * as THREE from 'three';
import type { CharacterAction } from '../animation/CharacterAnimator';

export interface RiggedHeroClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  interact?: THREE.AnimationClip;
  pickup?: THREE.AnimationClip;
  useItem?: THREE.AnimationClip;
}

type BaseState = 'idle' | 'walk' | 'run';

/** Cross-faded skeletal locomotion/action controller for the V8 hero. */
export class RiggedHeroAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly scanner: THREE.Object3D | null;
  private baseState: BaseState = 'idle';
  private moving = false;
  private sprinting = false;
  private carrying = false;
  private actionPlaying = false;
  private activeAction: Exclude<CharacterAction, null> | null = null;

  constructor(private readonly root: THREE.Object3D, clips: RiggedHeroClips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions.set('idle', this.loopAction(clips.idle));
    this.actions.set('walk', this.loopAction(clips.walk));
    this.actions.set('run', this.loopAction(clips.run));
    if (clips.interact) this.actions.set('interact', this.onceAction(clips.interact));
    if (clips.pickup) this.actions.set('pickup', this.onceAction(clips.pickup));
    if (clips.useItem) {
      const useItem = this.onceAction(clips.useItem);
      this.actions.set('scan', useItem);
      this.actions.set('drop', useItem);
    }

    this.scanner = root.getObjectByName('EI_HAND_SCANNER_RIGGED') ?? null;
    if (this.scanner) this.scanner.visible = false;

    const idle = this.actions.get('idle');
    idle?.reset().play();
    this.mixer.addEventListener('finished', this.onFinished);
  }

  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void {
    this.moving = moving;
    this.sprinting = sprinting;
    this.carrying = carrying;
    if (this.actionPlaying) return;

    const desired: BaseState = !moving ? 'idle' : sprinting && !carrying ? 'run' : 'walk';
    if (desired !== this.baseState) this.transitionBase(desired);
  }

  play(action: Exclude<CharacterAction, null>): void {
    const animation = this.actions.get(action);
    if (!animation) return;

    // Do not restart a one-shot every frame or interrupt another one-shot.
    // GameCore dispatches actions once per consumed key press.
    if (this.actionPlaying) return;

    this.actionPlaying = true;
    this.activeAction = action;
    if (this.scanner) this.scanner.visible = action === 'scan';

    const base = this.actions.get(this.baseState);
    animation.stop();
    animation.reset();
    animation.enabled = true;
    animation.setEffectiveWeight(1);
    animation.setEffectiveTimeScale(1);
    animation.play();
    if (base && base !== animation) animation.crossFadeFrom(base, 0.18, true);
  }

  update(dt: number): void {
    const walk = this.actions.get('walk');
    if (walk) walk.setEffectiveTimeScale(this.carrying ? 0.78 : 1);
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  private transitionBase(next: BaseState): void {
    const previous = this.actions.get(this.baseState);
    const target = this.actions.get(next);
    if (!target) return;

    target.enabled = true;
    target.setEffectiveWeight(1);
    if (!target.isRunning()) target.play();
    if (previous && previous !== target) {
      target.crossFadeFrom(previous, next === 'run' || this.baseState === 'run' ? 0.18 : 0.24, true);
    }
    this.baseState = next;
  }

  private onFinished = (): void => {
    if (!this.actionPlaying) return;

    this.actionPlaying = false;
    this.activeAction = null;
    if (this.scanner) this.scanner.visible = false;

    const desired: BaseState = !this.moving ? 'idle' : this.sprinting && !this.carrying ? 'run' : 'walk';
    const target = this.actions.get(desired);
    if (!target) return;

    target.enabled = true;
    target.setEffectiveWeight(1);
    if (!target.isRunning()) target.reset().play();

    const seen = new Set<THREE.AnimationAction>();
    for (const key of ['interact', 'pickup', 'scan', 'drop']) {
      const action = this.actions.get(key);
      if (!action || seen.has(action)) continue;
      seen.add(action);
      if (action.isRunning()) target.crossFadeFrom(action, 0.20, true);
    }
    this.baseState = desired;
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
