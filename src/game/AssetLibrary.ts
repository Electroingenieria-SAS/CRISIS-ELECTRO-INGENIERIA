import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLibrary {
  private loader = new GLTFLoader();
  private gltfCache = new Map<string, Promise<GLTF>>();

  load(path: string): Promise<GLTF> {
    let cached = this.gltfCache.get(path);
    if (!cached) {
      cached = this.loader.loadAsync(path);
      this.gltfCache.set(path, cached);
    }
    return cached;
  }

  async cloneStatic(path: string): Promise<THREE.Object3D> {
    const gltf = await this.load(path);
    const object = gltf.scene.clone(true);
    this.prepareShadows(object);
    return object;
  }

  async cloneSkinned(path: string): Promise<THREE.Object3D> {
    const gltf = await this.load(path);
    const object = cloneSkeleton(gltf.scene);
    this.prepareShadows(object);
    return object;
  }

  async animations(path: string): Promise<THREE.AnimationClip[]> {
    const gltf = await this.load(path);
    return gltf.animations;
  }

  private prepareShadows(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((m) => {
            if ('color' in m) m.needsUpdate = true;
          });
        } else if (material) {
          material.needsUpdate = true;
        }
      }
    });
  }
}
