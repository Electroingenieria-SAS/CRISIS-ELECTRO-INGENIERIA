import * as THREE from 'three';
import type { Collider } from '../types';

export class CollisionSystem {
  private readonly bodies: Collider[];

  constructor(bodies: Collider[]) {
    this.bodies = bodies;
  }

  all(): Collider[] {
    return this.bodies;
  }

  add(body: Collider): Collider {
    body.enabled ??= true;
    this.bodies.push(body);
    return body;
  }

  setEnabled(id: string, enabled: boolean): void {
    const body = this.bodies.find((candidate) => candidate.id === id);
    if (body) body.enabled = enabled;
  }

  get(id: string): Collider | null {
    return this.bodies.find((candidate) => candidate.id === id) ?? null;
  }

  remove(id: string): void {
    const index = this.bodies.findIndex((candidate) => candidate.id === id);
    if (index >= 0) this.bodies.splice(index, 1);
  }

  resolve(current: THREE.Vector3, desired: THREE.Vector3, radius: number): THREE.Vector3 {
    const result = current.clone();
    const dx = desired.x - current.x;
    const dz = desired.z - current.z;

    if (Math.abs(dx) > 0.00001) {
      const candidate = result.clone();
      candidate.x += dx;
      if (!this.blocked(candidate, radius, dx, 0)) result.x = candidate.x;
    }

    if (Math.abs(dz) > 0.00001) {
      const candidate = result.clone();
      candidate.z += dz;
      if (!this.blocked(candidate, radius, 0, dz)) result.z = candidate.z;
    }

    return result;
  }

  private blocked(position: THREE.Vector3, radius: number, pushX: number, pushZ: number): boolean {
    for (const body of this.bodies) {
      if (body.enabled === false) continue;
      if (!this.circleIntersectsAabb(position.x, position.z, radius, body)) continue;
      if (body.pushable && body.object && this.tryPush(body, pushX, pushZ)) continue;
      return true;
    }
    return false;
  }

  private tryPush(body: Collider, dx: number, dz: number): boolean {
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.00001 || distance > 0.42) return false;

    const moved: Collider = {
      ...body,
      minX: body.minX + dx,
      maxX: body.maxX + dx,
      minZ: body.minZ + dz,
      maxZ: body.maxZ + dz
    };

    for (const other of this.bodies) {
      if (other === body || other.enabled === false) continue;
      if (this.aabbIntersects(moved, other)) return false;
    }

    body.minX = moved.minX;
    body.maxX = moved.maxX;
    body.minZ = moved.minZ;
    body.maxZ = moved.maxZ;
    body.object!.position.x += dx;
    body.object!.position.z += dz;
    body.object!.userData.wasPushed = true;
    return true;
  }

  private circleIntersectsAabb(x: number, z: number, radius: number, body: Collider): boolean {
    const closestX = THREE.MathUtils.clamp(x, body.minX, body.maxX);
    const closestZ = THREE.MathUtils.clamp(z, body.minZ, body.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }

  private aabbIntersects(a: Collider, b: Collider): boolean {
    const padding = 0.03;
    return a.maxX > b.minX + padding && a.minX < b.maxX - padding && a.maxZ > b.minZ + padding && a.minZ < b.maxZ - padding;
  }
}
