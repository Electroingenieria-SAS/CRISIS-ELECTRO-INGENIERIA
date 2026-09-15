import * as THREE from 'three';
import type { CharacterAction } from '../animation/CharacterAnimator';

export interface RiggedHeroClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  interact?: THREE.AnimationClip;
  pickup?: THREE.AnimationClip;
  useItem?: THREE.AnimationClip;
  attack?: THREE.AnimationClip;
}

type BaseState = 'idle' | 'walk' | 'run';

/** Cross-faded KayKit skeletal locomotion/action controller for the V8 hero. */
export class RiggedHeroAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly scanner: THREE.Object3D | null;
  private baseState: BaseState = 'idle';
  private moving = false;
  private sprinting = false;
  private carrying = false;
  private actionPlaying = false;
  private activeAction: string | null = null;
  private actionGeneration = 0;

  constructor(private readonly root: THREE.Object3D, clips: RiggedHeroClips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions.set('idle', this.loopAction(clips.idle));
    this.actions.set('walk', this.loopAction(clips.walk));
    this.actions.set('run', this.loopAction(clips.run));

    if (clips.interact) this.actions.set('interact', this.onceAction(clips.interact));
    if (clips.pickup) this.actions.set('pickup', this.onceAction(clips.pickup));
    if (clips.attack) {
      const attackClip = clips.attack.clone();
      attackClip.name = `${clips.attack.name || 'Attack'}__COMBAT`;
      this.actions.set('attack', this.onceAction(attackClip));
    }

    if (clips.useItem) {
      const scanClip = clips.useItem.clone();
      scanClip.name = `${clips.useItem.name || 'UseItem'}__SCAN`;
      const dropClip = clips.useItem.clone();
      dropClip.name = `${clips.useItem.name || 'UseItem'}__DROP`;
      this.actions.set('scan', this.onceAction(scanClip));
      this.actions.set('drop', this.onceAction(dropClip));
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

    const desired = this.desiredBaseState();
    if (desired !== this.baseState) this.transitionBase(desired);
    else this.ensureBaseAuthority(desired);
  }

  play(action: Exclude<CharacterAction, null>): void {
    this.startOneShot(action);
  }

  /** Play the real KayKit melee/punch clip selected by RiggedCharacterLibrary. */
  playAttack(): void {
    if (!this.startOneShot('attack')) this.startOneShot('interact');
  }

  update(dt: number): void {
    const walk = this.actions.get('walk');
    if (walk) walk.setEffectiveTimeScale(this.carrying ? 0.78 : 1);
    const run = this.actions.get('run');
    if (run) run.setEffectiveTimeScale(1);
    this.mixer.update(dt);
  }

  dispose(): void {
    this.actionGeneration += 1;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  private startOneShot(key: string): boolean {
    const animation = this.actions.get(key);
    if (!animation || this.actionPlaying) return false;

    this.actionPlaying = true;
    this.activeAction = key;
    this.actionGeneration += 1;
    if (this.scanner) this.scanner.visible = key === 'scan';

    const base = this.actions.get(this.baseState);
    animation.stop();
    animation.reset();
    animation.stopFading();
    animation.stopWarping();
    animation.enabled = true;
    animation.paused = false;
    animation.setEffectiveWeight(1);
    animation.setEffectiveTimeScale(1);
    animation.play();

    if (base && base !== animation) {
      base.stopFading();
      animation.crossFadeFrom(base, key === 'attack' ? 0.09 : 0.16, false);
    }
    return true;
  }

  private desiredBaseState(): BaseState {
    return !this.moving ? 'idle' : this.sprinting && !this.carrying ? 'run' : 'walk';
  }

  private transitionBase(next: BaseState): void {
    const previous = this.actions.get(this.baseState);
    const target = this.actions.get(next);
    if (!target) return;

    this.prepareBaseAction(target);
    if (previous && previous !== target) {
      previous.stopFading();
      target.crossFadeFrom(previous, next === 'run' || this.baseState === 'run' ? 0.16 : 0.22, false);
    }
    this.baseState = next;
  }

  private ensureBaseAuthority(state: BaseState): void {
    const target = this.actions.get(state);
    if (!target) return;
    target.stopFading();
    target.enabled = true;
    target.paused = false;
    target.setEffectiveWeight(1);
    if (!target.isRunning()) target.play();
  }

  private prepareBaseAction(action: THREE.AnimationAction): void {
    action.stopFading();
    action.stopWarping();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    if (!action.isRunning()) action.play();
  }

  private onFinished = (): void => {
    if (!this.actionPlaying || !this.activeAction) return;

    const finishedKey = this.activeAction;
    const finishedAction = this.actions.get(finishedKey);
    const generation = this.actionGeneration;

    this.actionPlaying = false;
    this.activeAction = null;
    if (this.scanner) this.scanner.visible = false;

    const desired = this.desiredBaseState();
    const target = this.actions.get(desired);
    if (!target) {
      finishedAction?.stop();
      return;
    }

    this.prepareBaseAction(target);
    if (finishedAction && finishedAction !== target) {
      finishedAction.stopFading();
      finishedAction.enabled = true;
      finishedAction.setEffectiveWeight(1);
      target.crossFadeFrom(finishedAction, finishedKey === 'attack' ? 0.10 : 0.14, false);

      window.setTimeout(() => {
        if (generation !== this.actionGeneration || this.activeAction === finishedKey) return;
        finishedAction.stopFading();
        finishedAction.stopWarping();
        finishedAction.stop();
        finishedAction.enabled = false;
        finishedAction.setEffectiveWeight(0);
      }, finishedKey === 'attack' ? 150 : 190);
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
