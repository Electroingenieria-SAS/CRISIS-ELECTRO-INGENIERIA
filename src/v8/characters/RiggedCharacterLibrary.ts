import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { HeroBase } from '../types';
import { GameLogger } from '../gameplay/GameLogger';

export interface RiggedCharacterClips {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  run: THREE.AnimationClip;
  interact?: THREE.AnimationClip;
  pickup?: THREE.AnimationClip;
  putDown?: THREE.AnimationClip;
  useItem?: THREE.AnimationClip;
  attack?: THREE.AnimationClip;
  hit?: THREE.AnimationClip;
  push?: THREE.AnimationClip;
  pull?: THREE.AnimationClip;
  throw?: THREE.AnimationClip;
  carryIdle?: THREE.AnimationClip;
  carryWalk?: THREE.AnimationClip;
}

interface RiggedSource {
  scene: THREE.Group;
  clips: RiggedCharacterClips;
}

interface SharedAnimations {
  movement: THREE.AnimationClip[];
  general: THREE.AnimationClip[];
  combat: THREE.AnimationClip[];
  tools: THREE.AnimationClip[];
}

const CHARACTER_FILES: Record<HeroBase, string> = {
  knight: 'Knight.glb',
  rogue: 'Rogue.glb',
  mage: 'Mage.glb'
};

/** Shared KayKit rig/cache with semantic clip resolution for V9 gameplay. */
export class RiggedCharacterLibrary {
  private static sources = new Map<HeroBase, Promise<RiggedSource>>();
  private static animationPromise: Promise<SharedAnimations> | null = null;

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

  private static async animations(): Promise<SharedAnimations> {
    if (!this.animationPromise) {
      const loader = new GLTFLoader();
      const root = import.meta.env.BASE_URL || '/';
      const required = (file: string) => loader.loadAsync(`${root}assets/kaykit/animations/${file}`);
      const optional = async (file: string): Promise<THREE.AnimationClip[]> => {
        try {
          const gltf = await loader.loadAsync(`${root}assets/kaykit/animations/${file}`);
          return gltf.animations;
        } catch (error) {
          GameLogger.animation('optional animation set unavailable', file, error);
          return [];
        }
      };

      this.animationPromise = Promise.all([
        required('Rig_Medium_MovementBasic.glb'),
        required('Rig_Medium_General.glb'),
        required('Rig_Medium_CombatMelee.glb'),
        optional('Rig_Medium_Tools.glb')
      ]).then(([movement, general, combat, tools]) => ({
        movement: movement.animations,
        general: general.animations,
        combat: combat.animations,
        tools
      }));
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

    const all = [...character.animations, ...shared.movement, ...shared.general, ...shared.combat, ...shared.tools];
    const byName = (...names: string[]): THREE.AnimationClip | undefined => {
      for (const name of names) {
        const clip = THREE.AnimationClip.findByName(all, name);
        if (clip) return clip;
      }
      return undefined;
    };
    const semantic = (include: string[], exclude: string[] = []): THREE.AnimationClip | undefined => all.find((clip) => {
      const name = clip.name.toLowerCase().replace(/[\s_-]+/g, ' ');
      return include.every((token) => name.includes(token.toLowerCase())) && !exclude.some((token) => name.includes(token.toLowerCase()));
    });
    const required = (...names: string[]): THREE.AnimationClip => {
      const clip = byName(...names);
      if (clip) return clip;
      throw new Error(`Missing required rig animation: ${names.join(' / ')}`);
    };

    const attack = byName(
      'Punch', 'Punch_A', 'Punch_B', 'Unarmed_Punch', 'Unarmed_Attack',
      'Unarmed_Attack_A', 'Attack', 'Attack_A', 'Attack_1H', 'Attack (1h)'
    ) ?? semantic(['punch'])
      ?? semantic(['unarmed', 'attack'])
      ?? semantic(['attack'], ['hit', 'hurt', 'death', 'defeat', 'block']);

    const pickup = byName('PickUp', 'Pick_Up', 'Pickup', 'Interact_Pickup')
      ?? semantic(['pick', 'up'])
      ?? byName('Interact', 'Interact_A');
    const carryIdle = byName('Holding_A', 'Holding_B', 'Holding_C')
      ?? semantic(['holding']);
    const hit = byName('Hit_A', 'Hit_B', 'Hit', 'HitReaction', 'Get_Hit')
      ?? semantic(['hit'], ['attack']);

    const clips: RiggedCharacterClips = {
      idle: byName('Idle_A', 'Idle_B') ?? required('Idle_C'),
      walk: byName('Walking_A', 'Walking_B') ?? required('Walking_C'),
      run: byName('Running_A', 'Running_B') ?? required('Running_C'),
      interact: byName('Interact', 'Interact_A') ?? semantic(['interact']),
      pickup,
      putDown: byName('PutDown', 'Put_Down', 'Place') ?? pickup,
      useItem: byName('Use_Item', 'UseItem') ?? semantic(['use', 'item']),
      attack,
      hit,
      push: byName('Push', 'Pushing') ?? semantic(['push']),
      pull: byName('Pull', 'Pulling') ?? semantic(['pull']),
      throw: byName('Throw', 'Throw_A', 'Toss') ?? semantic(['throw']),
      carryIdle,
      // No authored carry-walk is guaranteed in the CC0 pack. V9 deliberately
      // falls back to controlled walk rather than abusing a static Holding clip.
      carryWalk: undefined
    };

    GameLogger.animation('resolved KayKit clips', Object.fromEntries(
      Object.entries(clips).map(([key, clip]) => [key, clip?.name ?? 'fallback'])
    ));

    return { scene: character.scene, clips };
  }
}
