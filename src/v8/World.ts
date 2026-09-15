import * as THREE from 'three';
import { World as EnvironmentWorld } from './WorldEnvironmentCore';
import { CarryGripConstraint } from './gameplay/CarryGripConstraint';
import { DoorComponent } from './gameplay/DoorComponent';
import { DEFAULT_CARRY_CONFIG, type CarryConfig } from './gameplay/GameplayComponents';
import { KinematicPhysicsWorld } from './gameplay/KinematicPhysicsWorld';
import { GameLogger } from './gameplay/GameLogger';
import { V9DebugOverlay } from './gameplay/V9DebugOverlay';
import type { WorldContextTarget } from './types';
import { installVerticalSliceFurnitureColliders } from './world/ZoneCollisionProfiles';

/** Public V9 world entry point layered over the stable V8 compositor. */
export class World extends EnvironmentWorld {
  private readonly physics = new KinematicPhysicsWorld(this.colliders);
  private readonly doors: DoorComponent[] = [];
  private readonly lastPlayerForward = new THREE.Vector3(0, 0, 1);
  private readonly v9Debug = new V9DebugOverlay();
  private readonly carryGripConstraint = new CarryGripConstraint();
  private debugEnabled = false;

  override init(): void {
    GameLogger.configureFromLocation();
    super.init();
    installVerticalSliceFurnitureColliders(this.colliders);
    this.registerCarryableBodies();
    this.adoptLegacyDoor();
    this.protectFunctionalLever();
    this.group.name = 'V9_WORLD';
    this.group.add(this.v9Debug.group);
    this.auditAndTuneRendering();
  }

  override update(dt: number, playerPosition?: THREE.Vector3): void {
    for (const door of this.doors) door.update(dt);
    this.physics.step(dt);
    super.update(dt, playerPosition);
    const sceneRoot = this.group.parent ?? this.group;
    this.carryGripConstraint.update(sceneRoot, dt);
    this.v9Debug.update(sceneRoot, this.registry.all(), this.doors);
  }

  override resolvePlayerMovement(current: THREE.Vector3, desired: THREE.Vector3, radius = 0.42): THREE.Vector3 {
    const dx = desired.x - current.x;
    const dz = desired.z - current.z;
    if (dx * dx + dz * dz > 0.0001) this.lastPlayerForward.set(dx, 0, dz).normalize();
    return super.resolvePlayerMovement(current, desired, radius);
  }

  override nearestContext(position: THREE.Vector3): WorldContextTarget | null {
    return this.registry.nearest(
      position,
      ['pickup', 'door', 'container', 'puzzle', 'movable', 'carryable', 'breakable', 'interactable'],
      3.0,
      this.lastPlayerForward
    );
  }

  override toggleDebug(): boolean {
    this.debugEnabled = super.toggleDebug();
    this.v9Debug.setEnabled(this.debugEnabled);
    return this.debugEnabled;
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
    entry.interaction = {
      point: entry.object,
      maxDistance: entry.radius ?? 1.7,
      maxFacingAngle: Math.PI * 0.50,
      alignDistance: 1.0,
      requiresFacing: true
    };
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
          carryable.object.userData.physicsBodyType = 'KINEMATIC';
        },
        release: (position: THREE.Vector3) => {
          this.physics.teleport(carryable.id, position);
          const type = carryable.id.startsWith('env-') ? 'DYNAMIC' : 'STATIC';
          this.physics.setBodyType(carryable.id, type);
          carryable.object.userData.physicsBodyType = type;
        },
        launch: (velocity: THREE.Vector3) => {
          this.physics.launch(carryable.id, velocity);
          carryable.object.userData.physicsBodyType = 'DYNAMIC';
        },
        hit: (impulse: THREE.Vector3) => {
          if (this.physics.get(carryable.id)?.bodyType !== 'DYNAMIC') this.physics.setBodyType(carryable.id, 'DYNAMIC');
          this.physics.applyImpulse(carryable.id, impulse);
          carryable.object.userData.physicsBodyType = 'DYNAMIC';
        }
      };

      carryable.object.userData.worldObjectId = carryable.id;
      carryable.object.userData.physicsBodyType = carryable.bodyType ?? 'STATIC';
      carryable.object.userData.weightClass = carryConfig.weightClass;
    }
    GameLogger.physics('registered carryable bodies', this.carryables.size);
  }

  private auditAndTuneRendering(): void {
    const scene = this.group.parent;
    if (!scene) return;
    const signatures = new Map<string, string>();
    const duplicates: Array<[string, string]> = [];
    scene.updateMatrixWorld(true);

    scene.traverse((node) => {
      if (node instanceof THREE.DirectionalLight && node.castShadow) {
        node.shadow.bias = -0.00018;
        node.shadow.normalBias = 0.035;
        node.shadow.radius = 1.5;
      }
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if ((material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial || material instanceof THREE.MeshBasicMaterial)
          && material.transparent && 'opacity' in material && material.opacity < 0.95) {
          material.depthWrite = false;
        }
      }

      node.getWorldPosition(this.lastAuditPosition);
      const key = `${node.geometry.uuid}|${this.lastAuditPosition.x.toFixed(4)}|${this.lastAuditPosition.y.toFixed(4)}|${this.lastAuditPosition.z.toFixed(4)}|${node.getWorldQuaternion(this.lastAuditQuaternion).toArray().map((v) => v.toFixed(3)).join(',')}`;
      const previous = signatures.get(key);
      if (previous) duplicates.push([previous, node.name || node.uuid]);
      else signatures.set(key, node.name || node.uuid);
    });
    if (duplicates.length) GameLogger.rendering('exact overlapping mesh candidates', duplicates);
  }

  private readonly lastAuditPosition = new THREE.Vector3();
  private readonly lastAuditQuaternion = new THREE.Quaternion();

  private inferWeight(id: string, largestDimension: number): CarryConfig['weightClass'] {
    if (id.startsWith('pallet-') || largestDimension > 1.8) return 'HEAVY';
    if (id === 'master-block' || id.startsWith('pkg-')) return 'MEDIUM';
    return largestDimension < 0.85 ? 'LIGHT' : 'MEDIUM';
  }
}
