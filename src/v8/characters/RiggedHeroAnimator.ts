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
      this.actions.set('scan', this.onceAction(clips.useItem));
      this.actions.set('drop', this.onceAction(clips.useItem));
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

    this.actionPlaying = true;
    this.activeAction = action;
    if (this.scanner) this.scanner.visible = action === 'scan';

    const base = this.actions.get(this.baseState);
    animation.reset();
    animation.enabled = true;
    animation.setEffectiveWeight(1);
    animation.setEffectiveTimeScale(1);
    if (base && base !== animation) animation.crossFadeFrom(base, 0.16, true);
    animation.play();
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
    target.reset().enabled = true;
    target.setEffectiveWeight(1);
    target.play();
    if (previous && previous !== target) target.crossFadeFrom(previous, next === 'run' || this.baseState === 'run' ? 0.2 : 0.26, true);
    this.baseState = next;
  }

  private onFinished = (): void => {
    this.actionPlaying = false;
    this.activeAction = null;
    if (this.scanner) this.scanner.visible = false;

    const desired: BaseState = !this.moving ? 'idle' : this.sprinting && !this.carrying ? 'run' : 'walk';
    const target = this.actions.get(desired);
    if (!target) return;
    const candidates = ['interact', 'pickup', 'scan', 'drop']
      .map((key) => this.actions.get(key))
      .filter((item): item is THREE.AnimationAction => Boolean(item));
    target.reset().play();
    for (const action of candidates) {
      if (action.isRunning()) target.crossFadeFrom(action, 0.2, true);
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
