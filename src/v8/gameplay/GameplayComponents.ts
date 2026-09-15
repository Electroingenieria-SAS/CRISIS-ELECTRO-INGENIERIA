import * as THREE from 'three';

export type PhysicsBodyType = 'STATIC' | 'KINEMATIC' | 'DYNAMIC' | 'CHARACTER' | 'TRIGGER';
export type WorldObjectCategory = 'STATIC' | 'DAMAGEABLE' | 'BREAKABLE' | 'MOVABLE' | 'ENEMY' | 'DECORATION';
export type WeightClass = 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type SurfaceMaterial = 'WOOD' | 'METAL' | 'STONE' | 'VEGETATION' | 'CARDBOARD' | 'GENERIC';
export type CarryState =
  | 'NONE'
  | 'ALIGNING'
  | 'PICKUP_START'
  | 'PICKUP_LIFT'
  | 'CARRY_IDLE'
  | 'CARRY_WALK'
  | 'PUTDOWN'
  | 'THROW_START'
  | 'THROW_RELEASE'
  | 'THROW_RECOVERY';
export type DoorState = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'LOCKED' | 'BROKEN';

export interface GripPointConfig {
  position: THREE.Vector3Tuple;
  rotation?: THREE.Vector3Tuple;
}

export interface CarryConfig {
  /** Final object-centre position in actor-local space. X=0 keeps the load centred. */
  positionOffset: THREE.Vector3Tuple;
  /** Rotation of the carry frame. The carried object's local rotation remains identity. */
  rotationOffset?: THREE.Vector3Tuple;
  leftHandGrip?: GripPointConfig;
  rightHandGrip?: GripPointConfig;
  carryHeight: number;
  weightClass: WeightClass;
  pickupDuration?: number;
  pickupTimeScale?: number;
  attachNormalizedTime?: number;
  settleDuration?: number;
  putDownDuration?: number;
  releaseNormalizedTime?: number;
  throwSpeed?: number;
  throwLift?: number;
}

export interface InteractionConfig {
  point?: THREE.Object3D;
  maxDistance?: number;
  maxFacingAngle?: number;
  alignDistance?: number;
  requiresFacing?: boolean;
}

export interface DamageConfig {
  category: WorldObjectCategory;
  material: SurfaceMaterial;
  health?: number;
  maxHealth?: number;
  hitReactionScale?: number;
  breakDelay?: number;
}

export interface DoorConfig {
  id: string;
  root: THREE.Object3D;
  pivot: THREE.Object3D;
  visual: THREE.Object3D;
  interactionPoint: THREE.Object3D;
  colliderId: string;
  closedAngle: number;
  openAngle: number;
  duration: number;
  direction: 1 | -1;
  state?: DoorState;
}

export interface DynamicBodyConfig {
  id: string;
  object: THREE.Object3D;
  bodyType: PhysicsBodyType;
  halfExtents: THREE.Vector3Tuple;
  mass?: number;
  restitution?: number;
  friction?: number;
  gravityScale?: number;
}

export const WEIGHT_PROFILES: Record<WeightClass, {
  moveSpeed: number;
  acceleration: number;
  throwMultiplier: number;
  carryBob: number;
}> = {
  LIGHT: { moveSpeed: 0.90, acceleration: 0.92, throwMultiplier: 1.15, carryBob: 0.016 },
  MEDIUM: { moveSpeed: 0.74, acceleration: 0.74, throwMultiplier: 0.82, carryBob: 0.008 },
  HEAVY: { moveSpeed: 0.56, acceleration: 0.56, throwMultiplier: 0.0, carryBob: 0.004 }
};

/**
 * Neutral ergonomic pose for a medium box. The load is kept close to the abdomen
 * and below the sternum, which gives the KayKit elbows room to bend and prevents
 * the box from reading as if it were magnetically attached to the chest.
 */
export const DEFAULT_CARRY_CONFIG: CarryConfig = {
  positionOffset: [0, 1.04, 0.49],
  rotationOffset: [0, 0, 0],
  leftHandGrip: { position: [-0.30, -0.08, -0.06] },
  rightHandGrip: { position: [0.30, -0.08, -0.06] },
  carryHeight: 1.04,
  weightClass: 'MEDIUM',
  pickupDuration: 1.08,
  pickupTimeScale: 0.88,
  attachNormalizedTime: 0.50,
  settleDuration: 0.15,
  putDownDuration: 0.96,
  releaseNormalizedTime: 0.67,
  throwSpeed: 6.6,
  throwLift: 3.0
};
