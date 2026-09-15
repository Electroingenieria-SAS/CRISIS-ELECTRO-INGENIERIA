import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { HeroBase } from '../types';

export interface RiggedCharacterClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  interact?: THREE.AnimationClip;
  pickup?: THREE.AnimationClip;
  useItem?: THREE.AnimationClip;
}

interface RiggedSource {
  scene: THREE.Group;
  clips: RiggedCharacterClips;
}

const CHARACTER_FILES: Record<HeroBase, string> = {
  knight: 'Knight.glb',
  rogue: 'Rogue.glb',
  mage: 'Mage.glb'
};

/**
 * Shared KayKit rig cache. Each selectable body is parsed only once, then
 * SkeletonUtils creates independent skinned clones for preview/gameplay.
 */
export class RiggedCharacterLibrary {
  private static sources = new Map<HeroBase, Promise<RiggedSource>>();
  private static animationPromise: Promise<{ movement: THREE.AnimationClip[]; general: THREE.AnimationClip[] }> | null = null;

  static async clone(base: HeroBase = 'knight'): Promise<{ scene: THREE.Group; clips: RiggedCharacterClips }> {
    const source = await this.source(base);
    return { scene: cloneSkeleton(source.scene) as THREE.Group, clips: source.clips };
  }

  private static source(base: HeroBase): Promise<RiggedSource> {
    let source = this.sources.get(base);
    if (!source) {
      source = this.loadSource(base);
      this.sources.set(base, source);
    }
    return source;
  }

  private static async animations(): Promise<{ movement: THREE.AnimationClip[]; general: THREE.AnimationClip[] }> {
    if (!this.animationPromise) {
      const loader = new GLTFLoader();
      const root = import.meta.env.BASE_URL || '/';
      this.animationPromise = Promise.all([
        loader.loadAsync(`${root}assets/kaykit/animations/Rig_Medium_MovementBasic.glb`),
        loader.loadAsync(`${root}assets/kaykit/animations/Rig_Medium_General.glb`)
      ]).then(([movement, general]) => ({ movement: movement.animations, general: general.animations }));
    }
    return this.animationPromise;
  }

  private static async loadSource(base: HeroBase): Promise<RiggedSource> {
    const loader = new GLTFLoader();
    const root = import.meta.env.BASE_URL || '/';
    const [character, shared] = await Promise.all([
      loader.loadAsync(`${root}assets/kaykit/characters/${CHARACTER_FILES[base]}`),
      this.animations()
    ]);

    const all = [...character.animations, ...shared.movement, ...shared.general];
    const required = (...names: string[]): THREE.AnimationClip => {
      for (const name of names) {
        const clip = THREE.AnimationClip.findByName(all, name);
        if (clip) return clip;
      }
      throw new Error(`Missing required rig animation: ${names.join(' / ')}`);
    };
    const optional = (...names: string[]): THREE.AnimationClip | undefined => {
      for (const name of names) {
        const clip = THREE.AnimationClip.findByName(all, name);
        if (clip) return clip;
      }
      return undefined;
    };

    return {
      scene: character.scene,
      clips: {
        idle: optional('Idle_A', 'Idle_B') ?? required('Idle_C'),
        walk: optional('Walking_A', 'Walking_B') ?? required('Walking_C'),
        run: optional('Running_A', 'Running_B') ?? required('Running_C'),
        interact: optional('Interact', 'Interact_A'),
        pickup: optional('PickUp', 'Pick_Up'),
        useItem: optional('Use_Item', 'UseItem')
      }
    };
  }
}
