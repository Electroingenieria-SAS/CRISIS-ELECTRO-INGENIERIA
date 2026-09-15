import * as THREE from 'three';
import { World as EnvironmentWorld } from './WorldEnvironmentCore';
import { DoorComponent } from './gameplay/DoorComponent';
import { DEFAULT_CARRY_CONFIG, type CarryConfig } from './gameplay/GameplayComponents';
import { KinematicPhysicsWorld } from './gameplay/KinematicPhysicsWorld';
import { GameLogger } from './gameplay/GameLogger';
import { installVerticalSliceFurnitureColliders } from './world/ZoneCollisionProfiles';

/**
 * Public V9 world entry point layered over the stable V8 compositor.
 * Existing level geometry stays intact; V9 adds professional reusable systems
 * while the V8 branch remains recoverable at its deployed commit.
 */
export class World extends EnvironmentWorld {
  private readonly physics = new KinematicPhysicsWorld(this.colliders);
  private readonly doors: DoorComponent[] = [];

  override init(): void {
    super.init();
    installVerticalSliceFurnitureColliders(this.colliders);
    this.registerCarryableBodies();
    this.adoptLegacyDoor();
    this.protectFunctionalLever();
    this.group.name = 'V9_WORLD';
  }

  override update(dt: number, playerPosition?: THREE.Vector3): void {
    for (const door of this.doors) door.update(dt);
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

  doorComponents(): readonly DoorComponent[] {
    return this.doors;
  }

  private adoptLegacyDoor(): void {
    const entry = this.registry.get('control-exit-door');
    if (!entry?.state) return;
    const pivot = entry.state.pivot as THREE.Object3D | undefined;
    const collider = entry.colliderId ? this.colliders.find((item) => item.id === entry.colliderId) : undefined;
    if (!pivot || !collider) return;

    const door = new DoorComponent({
      id: entry.id,
      entry,
      collider,
      pivot,
      root: entry.object,
      closedAngle: Number(entry.state.closedRotationY ?? 0),
      openAngle: Number(entry.state.openRotationY ?? -Math.PI / 2),
      duration: 0.62,
      leafWidth: 3.0,
      leafThickness: 0.22,
      hingeSide: 'left'
    });
    this.doors.push(door);
  }

  /**
   * V8's optional lever loader hid the procedural pivot because every fallback
   * child was considered replaceable. Mark functional children before the async
   * GLTF returns, so visual decoration can never erase the actual mechanism.
   */
  private protectFunctionalLever(): void {
    const entry = this.registry.get('control-training-lever');
    if (!entry?.state) return;
    const pivot = entry.state.pivot as THREE.Object3D | undefined;
    const indicator = entry.state.indicator as THREE.Object3D | undefined;
    if (pivot) {
      pivot.userData.gameplayEssential = true;
      pivot.userData.functionalPivot = true;
      pivot.traverse((node) => { node.userData.gameplayEssential = true; });
    }
    if (indicator) indicator.userData.gameplayEssential = true;
    for (const child of entry.object.children) {
      if (child === pivot || child === indicator || child.userData.decorativeOnly === true) continue;
      child.userData.gameplayEssential = true;
    }
    entry.object.userData.objectState = 'INACTIVE';
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
        },
        hit: (impulse: THREE.Vector3) => {
          if (this.physics.get(carryable.id)?.bodyType !== 'DYNAMIC') this.physics.setBodyType(carryable.id, 'DYNAMIC');
          this.physics.applyImpulse(carryable.id, impulse);
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
