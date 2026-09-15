import * as THREE from 'three';
import type { Collider } from '../types';
import type { DynamicBodyConfig, PhysicsBodyType } from './GameplayComponents';
import { GameLogger } from './GameLogger';

export interface RuntimeBody extends DynamicBodyConfig {
  velocity: THREE.Vector3;
  grounded: boolean;
  enabled: boolean;
  collider: Collider;
}

/**
 * Deterministic 2.5D physics layer for the current planar world.
 * Static world collision remains the existing AABB authority; movable bodies
 * gain velocity, gravity, sub-stepping and swept axis resolution without
 * introducing a second WASM physics world.
 */
export class KinematicPhysicsWorld {
  private readonly bodies = new Map<string, RuntimeBody>();
  private accumulator = 0;
  private readonly fixedStep = 1 / 120;
  private readonly gravity = 12.8;

  constructor(private readonly colliders: Collider[]) {}

  register(config: DynamicBodyConfig): RuntimeBody {
    const existing = this.bodies.get(config.id);
    if (existing) return existing;

    const [hx, , hz] = config.halfExtents;
    const collider: Collider = {
      id: `body:${config.id}`,
      minX: config.object.position.x - hx,
      maxX: config.object.position.x + hx,
      minZ: config.object.position.z - hz,
      maxZ: config.object.position.z + hz,
      enabled: config.bodyType !== 'TRIGGER',
      pushable: config.bodyType === 'DYNAMIC',
      object: config.object,
      debugLabel: `${config.bodyType} ${config.id}`
    };
    this.colliders.push(collider);

    const body: RuntimeBody = {
      ...config,
      mass: Math.max(0.01, config.mass ?? 1),
      restitution: THREE.MathUtils.clamp(config.restitution ?? 0.12, 0, 0.8),
      friction: THREE.MathUtils.clamp(config.friction ?? 0.84, 0, 1),
      gravityScale: config.gravityScale ?? 1,
      velocity: new THREE.Vector3(),
      grounded: config.object.position.y <= 0.001,
      enabled: true,
      collider
    };
    this.bodies.set(config.id, body);
    this.syncCollider(body);
    config.object.userData.physicsBodyId = config.id;
    config.object.userData.physicsBodyType = config.bodyType;
    return body;
  }

  unregister(id: string): void {
    const body = this.bodies.get(id);
    if (!body) return;
    const index = this.colliders.indexOf(body.collider);
    if (index >= 0) this.colliders.splice(index, 1);
    this.bodies.delete(id);
  }

  get(id: string): RuntimeBody | null {
    return this.bodies.get(id) ?? null;
  }

  all(): RuntimeBody[] {
    return [...this.bodies.values()];
  }

  setBodyType(id: string, bodyType: PhysicsBodyType): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.bodyType = bodyType;
    body.object.userData.physicsBodyType = bodyType;
    body.collider.enabled = body.enabled && bodyType !== 'TRIGGER';
    if (bodyType !== 'DYNAMIC') body.velocity.set(0, 0, 0);
    this.syncCollider(body);
    GameLogger.physics('body type', id, bodyType);
  }

  setEnabled(id: string, enabled: boolean): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.enabled = enabled;
    body.collider.enabled = enabled && body.bodyType !== 'TRIGGER';
  }

  teleport(id: string, position: THREE.Vector3): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.object.position.copy(position);
    body.velocity.set(0, 0, 0);
    body.grounded = body.object.position.y <= 0.001;
    this.syncCollider(body);
  }

  launch(id: string, velocity: THREE.Vector3): boolean {
    const body = this.bodies.get(id);
    if (!body || !body.enabled) return false;
    this.setBodyType(id, 'DYNAMIC');
    body.velocity.copy(velocity);
    body.grounded = false;
    GameLogger.physics('launch', id, velocity.toArray());
    return true;
  }

  applyImpulse(id: string, impulse: THREE.Vector3): boolean {
    const body = this.bodies.get(id);
    if (!body || !body.enabled || body.bodyType !== 'DYNAMIC') return false;
    body.velocity.addScaledVector(impulse, 1 / Math.max(0.01, body.mass ?? 1));
    return true;
  }

  step(dt: number): void {
    this.accumulator = Math.min(this.accumulator + Math.min(dt, 0.05), 0.12);
    while (this.accumulator >= this.fixedStep) {
      this.substep(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }
    for (const body of this.bodies.values()) this.syncCollider(body);
  }

  private substep(dt: number): void {
    for (const body of this.bodies.values()) {
      if (!body.enabled || body.bodyType !== 'DYNAMIC') continue;
      const gravityScale = body.gravityScale ?? 1;
      body.velocity.y -= this.gravity * gravityScale * dt;

      this.integrateAxis(body, 'x', body.velocity.x * dt);
      this.integrateAxis(body, 'z', body.velocity.z * dt);
      body.object.position.y += body.velocity.y * dt;

      const floorY = 0;
      if (body.object.position.y <= floorY) {
        body.object.position.y = floorY;
        if (body.velocity.y < -0.8) body.velocity.y = -body.velocity.y * (body.restitution ?? 0.12);
        else body.velocity.y = 0;
        body.grounded = true;

        const damping = Math.pow(body.friction ?? 0.84, dt * 60);
        body.velocity.x *= damping;
        body.velocity.z *= damping;
        if (Math.abs(body.velocity.x) < 0.025) body.velocity.x = 0;
        if (Math.abs(body.velocity.z) < 0.025) body.velocity.z = 0;
      } else {
        body.grounded = false;
      }

      if (body.velocity.lengthSq() > 0.005) {
        body.object.rotation.x += body.velocity.z * dt * 0.48;
        body.object.rotation.z -= body.velocity.x * dt * 0.48;
      }
      this.syncCollider(body);
    }
  }

  private integrateAxis(body: RuntimeBody, axis: 'x' | 'z', delta: number): void {
    if (Math.abs(delta) < 1e-6) return;
    body.object.position[axis] += delta;
    this.syncCollider(body);

    for (const obstacle of this.colliders) {
      if (obstacle === body.collider || obstacle.enabled === false) continue;
      if (!this.overlaps(body.collider, obstacle)) continue;

      const [hx, , hz] = body.halfExtents;
      if (axis === 'x') {
        body.object.position.x = delta > 0 ? obstacle.minX - hx - 0.002 : obstacle.maxX + hx + 0.002;
        body.velocity.x *= -(body.restitution ?? 0.12);
      } else {
        body.object.position.z = delta > 0 ? obstacle.minZ - hz - 0.002 : obstacle.maxZ + hz + 0.002;
        body.velocity.z *= -(body.restitution ?? 0.12);
      }
      this.syncCollider(body);
    }
  }

  private syncCollider(body: RuntimeBody): void {
    const [hx, , hz] = body.halfExtents;
    const position = body.object.getWorldPosition(new THREE.Vector3());
    body.collider.minX = position.x - hx;
    body.collider.maxX = position.x + hx;
    body.collider.minZ = position.z - hz;
    body.collider.maxZ = position.z + hz;
    body.collider.enabled = body.enabled && body.bodyType !== 'TRIGGER' && body.bodyType !== 'KINEMATIC';
  }

  private overlaps(a: Collider, b: Collider): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  }
}
