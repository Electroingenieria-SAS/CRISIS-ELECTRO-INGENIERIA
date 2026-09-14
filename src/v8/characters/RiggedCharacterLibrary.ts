import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

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

/**
 * Shared local rig cache for V8. The GLBs are parsed once, then every actor
 * receives a SkeletonUtils clone so skinning state stays independent.
 */
export class RiggedCharacterLibrary {
  private static sourcePromise: Promise<RiggedSource> | null = null;

  static async clone(): Promise<{ scene: THREE.Group; clips: RiggedCharacterClips }> {
    const source = await this.source();
    const scene = cloneSkeleton(source.scene) as THREE.Group;
    return { scene, clips: source.clips };
  }

  private static source(): Promise<RiggedSource> {
    if (!this.sourcePromise) this.sourcePromise = this.loadSource();
    return this.sourcePromise;
  }

  private static async loadSource(): Promise<RiggedSource> {
    const loader = new GLTFLoader();
    const base = import.meta.env.BASE_URL || '/';
    const [character, movement, general] = await Promise.all([
      loader.loadAsync(`${base}assets/kaykit/characters/Knight.glb`),
      loader.loadAsync(`${base}assets/kaykit/animations/Rig_Medium_MovementBasic.glb`),
      loader.loadAsync(`${base}assets/kaykit/animations/Rig_Medium_General.glb`)
    ]);

    const required = (clips: THREE.AnimationClip[], name: string): THREE.AnimationClip => {
      const clip = THREE.AnimationClip.findByName(clips, name);
      if (!clip) throw new Error(`Missing required rig animation: ${name}`);
      return clip;
    };
    const optional = (clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined =>
      THREE.AnimationClip.findByName(clips, name) ?? undefined;

    return {
      scene: character.scene,
      clips: {
        idle: optional(general.animations, 'Idle_A') ?? required(general.animations, 'Idle_B'),
        walk: optional(movement.animations, 'Walking_A') ?? required(movement.animations, 'Walking_B'),
        run: optional(movement.animations, 'Running_A') ?? required(movement.animations, 'Running_B'),
        interact: optional(general.animations, 'Interact'),
        pickup: optional(general.animations, 'PickUp'),
        useItem: optional(general.animations, 'Use_Item')
      }
    };
  }
}
