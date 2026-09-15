import * as THREE from 'three';
import type { Collider } from '../types';
import { WorldObjectRegistry } from './WorldObjectRegistry';

export class DebugWorldOverlay {
  readonly group = new THREE.Group();
  private enabled = false;
  private readonly colliderMaterial = new THREE.MeshBasicMaterial({ color: 0xff3344, wireframe: true, transparent: true, opacity: 0.75, depthTest: false });
  private readonly interactionMaterial = new THREE.MeshBasicMaterial({ color: 0x33ccff, wireframe: true, transparent: true, opacity: 0.65, depthTest: false });
  private readonly combatMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc33, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });

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
    if (enabled) this.rebuild();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(): void {
    if (!this.enabled) return;
    this.rebuild();
  }

  private rebuild(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }

    for (const collider of this.colliders) {
      if (collider.enabled === false) continue;
      const width = Math.max(0.02, collider.maxX - collider.minX);
      const depth = Math.max(0.02, collider.maxZ - collider.minZ);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1.5, depth), this.colliderMaterial);
      mesh.position.set((collider.minX + collider.maxX) / 2, 0.75, (collider.minZ + collider.maxZ) / 2);
      mesh.name = `COLLIDER:${collider.id ?? collider.debugLabel ?? 'anonymous'}`;
      this.group.add(mesh);
    }

    for (const entry of this.registry.all()) {
      if (entry.enabled === false || !entry.object.visible) continue;
      const radius = entry.radius ?? 2;
      const mat = entry.kind === 'combat-zone' ? this.combatMaterial : this.interactionMaterial;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.035, 28, 1, true), mat);
      entry.object.getWorldPosition(ring.position);
      ring.position.y = 0.04;
      ring.name = `${entry.kind}:${entry.id}`;
      this.group.add(ring);
    }
  }
}
