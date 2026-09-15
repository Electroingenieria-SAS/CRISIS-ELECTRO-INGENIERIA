import * as THREE from 'three';
import { World as EnvironmentWorld } from './WorldEnvironmentCore';
import { DEFAULT_CARRY_CONFIG, type CarryConfig } from './gameplay/GameplayComponents';
import { KinematicPhysicsWorld } from './gameplay/KinematicPhysicsWorld';
import { GameLogger } from './gameplay/GameLogger';
import { installVerticalSliceFurnitureColliders } from './world/ZoneCollisionProfiles';

/**
 * Public V9 world entry point layered over the stable V8 compositor.
 * Existing level geometry stays untouched; V9 adds explicit body ownership for
 * carryables and dynamic hit reactions on top of the same collider authority.
 */
export class World extends EnvironmentWorld {
  private readonly physics = new KinematicPhysicsWorld(this.colliders);

  override init(): void {
    super.init();
    installVerticalSliceFurnitureColliders(this.colliders);
    this.registerCarryableBodies();
    this.group.name = 'V9_WORLD';
  }

  override update(dt: number, playerPosition?: THREE.Vector3): void {
    this.physics.step(dt);
    super.update(dt, playerPosition);
  }

  bodyState(id: string): string | null {
    return this.physics.get(id)?.bodyType ?? null;
  }

  applyBodyImpulse(id: string, impulse: THREE.Vector3): boolean {
    const body = this.physics.get(id);
    if (!body) return false;
    if (body.bodyType !== 'DYNAMIC') this.physics.setBodyType(id, 'DYNAMIC');
    return this.physics.applyImpulse(id, impulse);
  }

  private registerCarryableBodies(): void {
    const size = new THREE.Vector3();
    for (const carryable of this.carryables.values()) {
      carryable.object.updateMatrixWorld(true);
      new THREE.Box3().setFromObject(carryable.object).getSize(size);
      const halfX = THREE.MathUtils.clamp(size.x * 0.48, 0.18, 1.65);
      const halfY = THREE.MathUtils.clamp(size.y * 0.48, 0.15, 1.20);
      const halfZ = THREE.MathUtils.clamp(size.z * 0.48, 0.18, 1.65);
      const carryConfig: CarryConfig = {
        ...DEFAULT_CARRY_CONFIG,
        ...carryable.carryConfig,
        weightClass: carryable.carryConfig?.weightClass ?? this.inferWeight(carryable.id, Math.max(size.x, size.y, size.z))
      };
      carryable.object.userData.v9CarryConfig = carryConfig;

      this.physics.register({
        id: carryable.id,
        object: carryable.object,
        bodyType: carryable.bodyType ?? 'STATIC',
        halfExtents: [halfX, halfY, halfZ],
        mass: carryConfig.weightClass === 'HEAVY' ? 5.2 : carryConfig.weightClass === 'MEDIUM' ? 2.4 : 1.0,
        restitution: carryable.id.startsWith('env-') ? 0.16 : 0.08,
        friction: carryConfig.weightClass === 'HEAVY' ? 0.90 : 0.84
      });

      carryable.object.userData.v9PhysicsBridge = {
        setCarried: () => {
          this.physics.setBodyType(carryable.id, 'KINEMATIC');
          this.physics.setEnabled(carryable.id, true);
        },
        release: (position: THREE.Vector3) => {
          this.physics.teleport(carryable.id, position);
          this.physics.setBodyType(carryable.id, carryable.id.startsWith('env-') ? 'DYNAMIC' : 'STATIC');
        },
        launch: (velocity: THREE.Vector3) => {
          this.physics.launch(carryable.id, velocity);
        }
      };

      carryable.object.userData.worldObjectId = carryable.id;
      carryable.object.userData.physicsBodyType = carryable.bodyType ?? 'STATIC';
      carryable.object.userData.weightClass = carryConfig.weightClass;
    }
    GameLogger.physics('registered carryable bodies', this.carryables.size);
  }

  private inferWeight(id: string, largestDimension: number): CarryConfig['weightClass'] {
    if (id.startsWith('pallet-') || largestDimension > 1.8) return 'HEAVY';
    if (id === 'master-block' || id.startsWith('pkg-')) return 'MEDIUM';
    return largestDimension < 0.85 ? 'LIGHT' : 'MEDIUM';
  }
}
