import * as THREE from 'three';
import type { Collider } from '../types';
import { WorldObjectRegistry } from './WorldObjectRegistry';

/**
 * Allocation-free debug overlay for V8.
 *
 * Geometry and meshes are pooled by collider/registry key. The overlay only
 * updates transforms/visibility while enabled; it never destroys and recreates
 * BoxGeometry/CylinderGeometry every frame.
 */
export class DebugWorldOverlay {
  readonly group = new THREE.Group();
  private enabled = false;

  private readonly colliderMaterial = new THREE.MeshBasicMaterial({ color: 0xff3344, wireframe: true, transparent: true, opacity: 0.75, depthTest: false });
  private readonly interactionMaterial = new THREE.MeshBasicMaterial({ color: 0x33ccff, wireframe: true, transparent: true, opacity: 0.65, depthTest: false });
  private readonly combatMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc33, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly unitRing = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
  private readonly colliderMeshes = new Map<string, THREE.Mesh>();
  private readonly registryMeshes = new Map<string, THREE.Mesh>();
  private readonly worldPosition = new THREE.Vector3();

  constructor(private readonly colliders: Collider[], private readonly registry: WorldObjectRegistry) {
    this.group.name = 'V8_WORLD_DEBUG';
    this.group.visible = false;
    this.group.renderOrder = 999;
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
    if (enabled) this.sync();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(): void {
    if (!this.enabled) return;
    this.sync();
  }

  dispose(): void {
    this.colliderMeshes.clear();
    this.registryMeshes.clear();
    this.group.clear();
    this.unitBox.dispose();
    this.unitRing.dispose();
    this.colliderMaterial.dispose();
    this.interactionMaterial.dispose();
    this.combatMaterial.dispose();
  }

  private sync(): void {
    const activeColliderKeys = new Set<string>();
    this.colliders.forEach((collider, index) => {
      const key = this.colliderKey(collider, index);
      activeColliderKeys.add(key);
      const mesh = this.colliderMesh(key);
      const visible = collider.enabled !== false;
      mesh.visible = visible;
      if (!visible) return;

      const width = Math.max(0.02, collider.maxX - collider.minX);
      const depth = Math.max(0.02, collider.maxZ - collider.minZ);
      mesh.position.set((collider.minX + collider.maxX) / 2, 0.75, (collider.minZ + collider.maxZ) / 2);
      mesh.scale.set(width, 1.5, depth);
      mesh.name = `COLLIDER:${collider.id ?? collider.debugLabel ?? index}`;
    });

    for (const [key, mesh] of this.colliderMeshes) {
      if (!activeColliderKeys.has(key)) mesh.visible = false;
    }

    const activeRegistryKeys = new Set<string>();
    for (const entry of this.registry.all()) {
      const key = `${entry.kind}:${entry.id}`;
      activeRegistryKeys.add(key);
      const mesh = this.registryMesh(key, entry.kind === 'combat-zone');
      const visible = entry.enabled !== false && entry.object.visible;
      mesh.visible = visible;
      if (!visible) continue;

      const radius = Math.max(0.05, entry.radius ?? 2);
      entry.object.getWorldPosition(this.worldPosition);
      mesh.position.set(this.worldPosition.x, 0.04, this.worldPosition.z);
      mesh.scale.set(radius, 0.035, radius);
      mesh.name = key;
    }

    for (const [key, mesh] of this.registryMeshes) {
      if (!activeRegistryKeys.has(key)) mesh.visible = false;
    }
  }

  private colliderKey(collider: Collider, index: number): string {
    return collider.id ?? collider.debugLabel ?? `anonymous-${index}`;
  }

  private colliderMesh(key: string): THREE.Mesh {
    let mesh = this.colliderMeshes.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(this.unitBox, this.colliderMaterial);
      mesh.renderOrder = 999;
      mesh.frustumCulled = false;
      this.colliderMeshes.set(key, mesh);
      this.group.add(mesh);
    }
    return mesh;
  }

  private registryMesh(key: string, combat: boolean): THREE.Mesh {
    let mesh = this.registryMeshes.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(this.unitRing, combat ? this.combatMaterial : this.interactionMaterial);
      mesh.renderOrder = 999;
      mesh.frustumCulled = false;
      this.registryMeshes.set(key, mesh);
      this.group.add(mesh);
    } else {
      mesh.material = combat ? this.combatMaterial : this.interactionMaterial;
    }
    return mesh;
  }
}
