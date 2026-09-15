import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type EnvironmentAssetId =
  | 'prototype-door'
  | 'prototype-box'
  | 'prototype-barrel'
  | 'prototype-pillar'
  | 'prototype-table'
  | 'prototype-target'
  | 'platformer-button'
  | 'platformer-lever'
  | 'platformer-sign'
  | 'halloween-bench'
  | 'halloween-tree'
  | 'halloween-path';

export interface DecorationPlacement {
  position?: THREE.Vector3Tuple;
  rotation?: THREE.Vector3Tuple;
  scale?: number | THREE.Vector3Tuple;
}

const FILES: Record<EnvironmentAssetId, string> = {
  'prototype-door': 'prototype/Door_A_Decorated.gltf',
  'prototype-box': 'prototype/Box_A.gltf',
  'prototype-barrel': 'prototype/Barrel_A.gltf',
  'prototype-pillar': 'prototype/Pillar_A.gltf',
  'prototype-table': 'prototype/table_medium_Decorated.gltf',
  'prototype-target': 'prototype/target_stand_A_Decorated.gltf',
  'platformer-button': 'platformer/button_base_blue.gltf',
  'platformer-lever': 'platformer/lever_floor_base_blue.gltf',
  'platformer-sign': 'platformer/signage_arrow_stand_blue.gltf',
  'halloween-bench': 'halloween/bench.gltf',
  'halloween-tree': 'halloween/tree_pine_yellow_medium.gltf',
  'halloween-path': 'halloween/path_A.gltf'
};

/**
 * Optional KayKit environment asset cache.
 *
 * IMPORTANT: cloned GLTFs are presentation-only. They must never replace a
 * gameplay pivot used by a door, lever, button or other interactive mechanism.
 * Use attachDecoration() when dressing a functional pivot.
 */
export class KayKitEnvironmentLibrary {
  private static readonly sources = new Map<EnvironmentAssetId, Promise<THREE.Group | null>>();

  static async clone(id: EnvironmentAssetId): Promise<THREE.Group | null> {
    const source = await this.source(id);
    if (!source) return null;
    const copy = cloneSkeleton(source) as THREE.Group;
    copy.name = `KAYKIT_${id.toUpperCase().replaceAll('-', '_')}`;
    copy.userData.decorativeOnly = true;
    copy.userData.environmentAssetId = id;
    copy.traverse((node) => {
      node.userData.decorativeOnly = true;
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return copy;
  }

  /**
   * Mount a visual GLTF under a dedicated child slot while preserving the
   * original gameplay pivot, its userData, transforms, interaction registry
   * reference and collider relationship.
   */
  static async attachDecoration(
    functionalPivot: THREE.Object3D,
    id: EnvironmentAssetId,
    placement: DecorationPlacement = {}
  ): Promise<THREE.Group | null> {
    functionalPivot.userData.functionalPivot = true;

    const slotName = `V8_DECORATION_SLOT_${id.toUpperCase().replaceAll('-', '_')}`;
    const previous = functionalPivot.getObjectByName(slotName);
    if (previous?.parent === functionalPivot) functionalPivot.remove(previous);

    const asset = await this.clone(id);
    if (!asset) return null;

    const slot = new THREE.Group();
    slot.name = slotName;
    slot.userData.decorativeOnly = true;
    slot.userData.functionalPivotOwner = functionalPivot.uuid;

    const [px, py, pz] = placement.position ?? [0, 0, 0];
    const [rx, ry, rz] = placement.rotation ?? [0, 0, 0];
    slot.position.set(px, py, pz);
    slot.rotation.set(rx, ry, rz);

    if (typeof placement.scale === 'number') {
      slot.scale.setScalar(placement.scale);
    } else if (placement.scale) {
      slot.scale.set(...placement.scale);
    }

    slot.add(asset);
    functionalPivot.add(slot);
    return asset;
  }

  private static source(id: EnvironmentAssetId): Promise<THREE.Group | null> {
    let promise = this.sources.get(id);
    if (!promise) {
      promise = this.load(id);
      this.sources.set(id, promise);
    }
    return promise;
  }

  private static async load(id: EnvironmentAssetId): Promise<THREE.Group | null> {
    const root = import.meta.env.BASE_URL || '/';
    const url = `${root}assets/kaykit/environment/${FILES[id]}`;
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      return gltf.scene;
    } catch (error) {
      console.warn(`[V8] Optional KayKit environment asset unavailable: ${id}`, error);
      return null;
    }
  }
}
