import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export type AssetPlacement = {
  url: string;
  position: THREE.Vector3;
  rotationY?: number;
  targetMaxSize?: number;
  scale?: number;
  tint?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  name?: string;
};

export class RemoteAssetLibrary {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<THREE.Group>>();

  async clone(url: string): Promise<THREE.Group> {
    const source = await this.load(url);
    const copy = skeletonClone(source) as THREE.Group;
    copy.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      if (Array.isArray(node.material)) node.material = node.material.map((m) => m.clone());
      else if (node.material) node.material = node.material.clone();
    });
    return copy;
  }

  async place(parent: THREE.Object3D, spec: AssetPlacement): Promise<THREE.Group | null> {
    try {
      const object = await this.clone(spec.url);
      object.position.copy(spec.position);
      object.rotation.y = spec.rotationY ?? 0;
      object.name = spec.name ?? `remote:${this.fileName(spec.url)}`;

      if (spec.targetMaxSize) this.fitToSize(object, spec.targetMaxSize);
      if (spec.scale) object.scale.multiplyScalar(spec.scale);
      this.polishMaterials(object, spec);
      parent.add(object);
      return object;
    } catch (error) {
      console.warn('[V5 asset fallback]', spec.url, error);
      return null;
    }
  }

  async placeMany(parent: THREE.Object3D, specs: AssetPlacement[]): Promise<void> {
    const concurrency = 6;
    for (let start = 0; start < specs.length; start += concurrency) {
      await Promise.all(specs.slice(start, start + concurrency).map((spec) => this.place(parent, spec)));
    }
  }

  private load(url: string): Promise<THREE.Group> {
    let promise = this.cache.get(url);
    if (!promise) {
      promise = this.loader.loadAsync(url).then((gltf) => {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        return root;
      });
      this.cache.set(url, promise);
    }
    return promise;
  }

  private fitToSize(object: THREE.Object3D, targetMax: number): void {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const max = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(max) || max <= 0.0001) return;
    object.scale.multiplyScalar(targetMax / max);
    object.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(object);
    if (Number.isFinite(scaledBox.min.y)) object.position.y -= scaledBox.min.y;
  }

  private polishMaterials(object: THREE.Object3D, spec: AssetPlacement): void {
    const tint = spec.tint ? new THREE.Color(spec.tint) : null;
    const emissive = spec.emissive ? new THREE.Color(spec.emissive) : null;

    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshPhysicalMaterial)) continue;
        if (tint) material.color.lerp(tint, 0.12);
        material.roughness = spec.roughness ?? Math.min(0.86, Math.max(0.36, material.roughness));
        material.metalness = spec.metalness ?? Math.min(0.38, material.metalness);
        if (emissive) {
          material.emissive.copy(emissive);
          material.emissiveIntensity = spec.emissiveIntensity ?? 0.5;
        }
        material.needsUpdate = true;
      }
    });
  }

  private fileName(url: string): string {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1));
  }
}
