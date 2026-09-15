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
  positionOffset: THREE.Vector3Tuple;
  rotationOffset?: THREE.Vector3Tuple;
  leftHandGrip?: GripPointConfig;
  rightHandGrip?: GripPointConfig;
  carryHeight: number;
  weightClass: WeightClass;
  pickupDuration?: number;
  attachNormalizedTime?: number;
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
  LIGHT: { moveSpeed: 0.90, acceleration: 0.92, throwMultiplier: 1.15, carryBob: 0.020 },
  MEDIUM: { moveSpeed: 0.76, acceleration: 0.78, throwMultiplier: 0.82, carryBob: 0.012 },
  HEAVY: { moveSpeed: 0.58, acceleration: 0.60, throwMultiplier: 0.0, carryBob: 0.006 }
};

export const DEFAULT_CARRY_CONFIG: CarryConfig = {
  positionOffset: [0, 1.32, 0.64],
  rotationOffset: [0, 0, 0],
  leftHandGrip: { position: [-0.30, 0.12, 0.04] },
  rightHandGrip: { position: [0.30, 0.12, 0.04] },
  carryHeight: 1.32,
  weightClass: 'MEDIUM',
  pickupDuration: 0.90,
  attachNormalizedTime: 0.48,
  putDownDuration: 0.78,
  releaseNormalizedTime: 0.62,
  throwSpeed: 6.8,
  throwLift: 3.2
};
