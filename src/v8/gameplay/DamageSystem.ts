import * as THREE from 'three';
import type { Collider, CombatHitResult, WorldObjectDefinition } from '../types';
import { emitAudioCue } from './AudioCue';
import type { SurfaceMaterial, WorldObjectCategory } from './GameplayComponents';
import { GameLogger } from './GameLogger';
import { WorldObjectRegistry } from '../world/WorldObjectRegistry';

interface BodyHitBridge {
  hit?(impulse: THREE.Vector3): void;
}

interface BreakSequence {
  entry: WorldObjectDefinition;
  elapsed: number;
  duration: number;
  baseRotation: THREE.Euler;
  fragmented: boolean;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  elapsed: number;
  lifetime: number;
}

/** Category-aware combat response. Ordinary world objects never despawn on hit. */
export class DamageSystem {
  private readonly breaks = new Map<string, BreakSequence>();
  private readonly particles: ImpactParticle[] = [];
  private readonly temp = new THREE.Vector3();
  private readonly particleGeometry = new THREE.BoxGeometry(0.075, 0.075, 0.075);
  private readonly materials: Record<SurfaceMaterial, THREE.MeshStandardMaterial> = {
    WOOD: new THREE.MeshStandardMaterial({ color: 0x9b6d42, roughness: 0.92 }),
    METAL: new THREE.MeshStandardMaterial({ color: 0x9fb2bb, roughness: 0.34, metalness: 0.62 }),
    STONE: new THREE.MeshStandardMaterial({ color: 0x899197, roughness: 0.96 }),
    VEGETATION: new THREE.MeshStandardMaterial({ color: 0x5e8c58, roughness: 0.98 }),
    CARDBOARD: new THREE.MeshStandardMaterial({ color: 0xb98754, roughness: 0.94 }),
    GENERIC: new THREE.MeshStandardMaterial({ color: 0xa7b2b8, roughness: 0.76 })
  };

  constructor(
    private readonly registry: WorldObjectRegistry,
    private readonly colliders: Collider[],
    private readonly effectsRoot: THREE.Object3D
  ) {}

  update(dt: number): void {
    this.updateBreaks(dt);
    this.updateParticles(dt);
  }

  attack(origin: THREE.Vector3, forward: THREE.Vector3, range = 2.15): CombatHitResult {
    const damagedIds: string[] = [];
    const destroyedIds: string[] = [];
    const reactedIds: string[] = [];
    const normalized = forward.clone().setY(0).normalize();

    for (const entry of this.registry.byKind('breakable', 'movable', 'carryable', 'door', 'container', 'puzzle', 'interactable')) {
      if (entry.enabled === false || !entry.object.visible || this.breaks.has(entry.id)) continue;
      const targetWorld = entry.object.getWorldPosition(this.temp);
      const toTarget = targetWorld.clone().sub(origin).setY(0);
      const distance = toTarget.length();
      if (distance > range || distance <= 0.001) continue;
      toTarget.normalize();
      if (toTarget.dot(normalized) < 0.35) continue;

      const category = this.category(entry);
      const material = this.material(entry);
      reactedIds.push(entry.id);
      this.spawnImpact(targetWorld, material, normalized);
      if (reactedIds.length === 1) this.emitImpactAudio(material);

      if (category === 'MOVABLE') {
        const bridge = entry.object.userData.v9PhysicsBridge as BodyHitBridge | undefined;
        bridge?.hit?.(normalized.clone().multiplyScalar(2.25).add(new THREE.Vector3(0, 0.45, 0)));
        this.nudge(entry.object, normalized, 0.045);
        continue;
      }

      if (category === 'BREAKABLE' || category === 'DAMAGEABLE' || category === 'ENEMY') {
        entry.health = Math.max(0, (entry.health ?? entry.damage?.health ?? 1) - 1);
        damagedIds.push(entry.id);
        this.nudge(entry.object, normalized, entry.damage?.hitReactionScale ?? 0.035);
        if (entry.health <= 0 && category === 'BREAKABLE') {
          destroyedIds.push(entry.id);
          this.beginBreak(entry);
        }
      }
      // STATIC/DECORATION: impact feedback only. Never hide/remove.
    }

    return { hit: reactedIds.length > 0, damagedIds, destroyedIds, reactedIds };
  }

  dispose(): void {
    for (const particle of this.particles) particle.mesh.removeFromParent();
    this.particles.length = 0;
    this.particleGeometry.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }

  private category(entry: WorldObjectDefinition): WorldObjectCategory {
    if (entry.category) return entry.category;
    if (entry.kind === 'breakable') return 'BREAKABLE';
    if (entry.kind === 'movable' || entry.kind === 'carryable') return 'MOVABLE';
    if (entry.kind === 'door' || entry.kind === 'container' || entry.kind === 'puzzle') return 'STATIC';
    return entry.damage?.category ?? 'STATIC';
  }

  private material(entry: WorldObjectDefinition): SurfaceMaterial {
    if (entry.damage?.material) return entry.damage.material;
    const name = `${entry.id} ${entry.label}`.toLowerCase();
    if (name.includes('metal') || name.includes('door') || name.includes('lever')) return 'METAL';
    if (name.includes('crate') || name.includes('caja') || name.includes('target')) return 'WOOD';
    if (name.includes('rock') || name.includes('stone')) return 'STONE';
    if (name.includes('plant') || name.includes('tree')) return 'VEGETATION';
    return 'GENERIC';
  }

  private beginBreak(entry: WorldObjectDefinition): void {
    entry.state ??= {};
    entry.state.breaking = true;
    entry.state.damageState = 'BREAKING';
    this.breaks.set(entry.id, {
      entry,
      elapsed: 0,
      duration: Math.max(0.32, entry.damage?.breakDelay ?? 0.52),
      baseRotation: entry.object.rotation.clone(),
      fragmented: false
    });
    emitAudioCue('break');
    GameLogger.interaction('break sequence', entry.id);
  }

  private updateBreaks(dt: number): void {
    for (const [id, sequence] of this.breaks) {
      sequence.elapsed += dt;
      const t = THREE.MathUtils.clamp(sequence.elapsed / sequence.duration, 0, 1);
      const anticipation = Math.sin(Math.min(1, t * 2.4) * Math.PI);
      sequence.entry.object.rotation.z = sequence.baseRotation.z + Math.sin(sequence.elapsed * 54) * 0.055 * anticipation;
      sequence.entry.object.rotation.x = sequence.baseRotation.x + t * 0.16;

      if (!sequence.fragmented && t >= 0.42) {
        sequence.fragmented = true;
        this.spawnFragments(sequence.entry);
        sequence.entry.state ??= {};
        sequence.entry.state.damageState = 'FRAGMENTING';
      }

      if (t < 1) continue;
      sequence.entry.enabled = false;
      sequence.entry.object.visible = false;
      sequence.entry.state ??= {};
      sequence.entry.state.breaking = false;
      sequence.entry.state.damageState = 'BROKEN';
      if (sequence.entry.colliderId) {
        const collider = this.colliders.find((item) => item.id === sequence.entry.colliderId);
        if (collider) collider.enabled = false;
      }
      this.breaks.delete(id);
    }
  }

  private emitImpactAudio(material: SurfaceMaterial): void {
    if (material === 'WOOD' || material === 'CARDBOARD') emitAudioCue('hit-wood');
    else if (material === 'METAL') emitAudioCue('hit-metal');
    else if (material === 'STONE') emitAudioCue('hit-stone');
    else emitAudioCue('hit-generic');
  }

  private spawnImpact(position: THREE.Vector3, material: SurfaceMaterial, normal: THREE.Vector3): void {
    const count = material === 'METAL' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, this.materials[material]);
      mesh.position.copy(position).add(new THREE.Vector3((i - 1) * 0.06, 0.55 + i * 0.035, 0));
      mesh.scale.setScalar(material === 'METAL' ? 0.55 : 0.85);
      this.effectsRoot.add(mesh);
      const sideways = new THREE.Vector3(-normal.z, 0, normal.x).multiplyScalar((i - (count - 1) / 2) * 0.65);
      this.particles.push({
        mesh,
        velocity: normal.clone().multiplyScalar(0.7).add(sideways).add(new THREE.Vector3(0, 1.2 + i * 0.16, 0)),
        elapsed: 0,
        lifetime: material === 'METAL' ? 0.22 : 0.40
      });
    }
  }

  private spawnFragments(entry: WorldObjectDefinition): void {
    const world = entry.object.getWorldPosition(new THREE.Vector3());
    const material = this.material(entry);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, this.materials[material]);
      mesh.scale.setScalar(1.3 + (i % 3) * 0.35);
      mesh.position.copy(world).add(new THREE.Vector3((i % 4 - 1.5) * 0.12, 0.55 + Math.floor(i / 4) * 0.14, (i % 2 ? 1 : -1) * 0.08));
      this.effectsRoot.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((i % 4 - 1.5) * 0.72, 1.8 + (i % 3) * 0.28, (i % 2 ? 1 : -1) * (0.75 + i * 0.035)),
        elapsed: 0,
        lifetime: 0.85 + (i % 3) * 0.10
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.elapsed += dt;
      particle.velocity.y -= 7.8 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 5.4;
      particle.mesh.rotation.z += dt * 4.1;
      if (particle.mesh.position.y < 0.05) {
        particle.mesh.position.y = 0.05;
        particle.velocity.y *= -0.18;
        particle.velocity.x *= 0.72;
        particle.velocity.z *= 0.72;
      }
      if (particle.elapsed < particle.lifetime) continue;
      particle.mesh.removeFromParent();
      this.particles.splice(i, 1);
    }
  }

  private nudge(object: THREE.Object3D, direction: THREE.Vector3, amount: number): void {
    object.position.addScaledVector(direction, amount);
  }
}
