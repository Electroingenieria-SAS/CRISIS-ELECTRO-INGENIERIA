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

export class KayKitEnvironmentLibrary {
  private static readonly sources = new Map<EnvironmentAssetId, Promise<THREE.Group | null>>();

  static async clone(id: EnvironmentAssetId): Promise<THREE.Group | null> {
    const source = await this.source(id);
    if (!source) return null;
    const copy = cloneSkeleton(source) as THREE.Group;
    copy.name = `KAYKIT_${id.toUpperCase().replaceAll('-', '_')}`;
    copy.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    return copy;
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
