import * as THREE from 'three';
import type { WeightClass } from './GameplayComponents';

export interface CarryFeelProfile {
  alignDuration: number;
  approachSpeed: number;
  maxApproachDistance: number;
  pickupTimeScale: number;
  attachMarker: number;
  settleDuration: number;
  liftArc: number;
}

export const CARRY_FEEL: Record<WeightClass, CarryFeelProfile> = {
  LIGHT: {
    alignDuration: 0.11,
    approachSpeed: 1.55,
    maxApproachDistance: 0.12,
    pickupTimeScale: 1.05,
    attachMarker: 0.43,
    settleDuration: 0.10,
    liftArc: 0.026
  },
  MEDIUM: {
    alignDuration: 0.15,
    approachSpeed: 1.25,
    maxApproachDistance: 0.16,
    pickupTimeScale: 0.88,
    attachMarker: 0.50,
    settleDuration: 0.15,
    liftArc: 0.018
  },
  HEAVY: {
    alignDuration: 0.20,
    approachSpeed: 0.92,
    maxApproachDistance: 0.12,
    pickupTimeScale: 0.72,
    attachMarker: 0.55,
    settleDuration: 0.22,
    liftArc: 0.010
  }
};

const clamp01 = (value: number): number => THREE.MathUtils.clamp(value, 0, 1);
const smoother = (value: number): number => {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const easeOutCubic = (value: number): number => 1 - Math.pow(1 - clamp01(value), 3);

/**
 * Samples a two-stage lift. Height is gained slightly before the load is pulled
 * fully into the torso, which reads as "lift, then secure" instead of magnetic
 * attraction toward the carry socket. The tiny arc supplies follow-through and
 * resolves back to the exact authored carry position at t=1.
 */
export function samplePickupLift(
  from: THREE.Vector3,
  to: THREE.Vector3,
  progress: number,
  arcHeight: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const raw = clamp01(progress);
  const vertical = easeOutCubic(raw);
  const planar = smoother(Math.max(0, (raw - 0.08) / 0.92));
  out.x = THREE.MathUtils.lerp(from.x, to.x, planar);
  out.z = THREE.MathUtils.lerp(from.z, to.z, planar);
  out.y = THREE.MathUtils.lerp(from.y, to.y, vertical) + Math.sin(Math.PI * raw) * arcHeight;
  return out;
}

/** Put-down is intentionally calmer and almost linear near the floor. */
export function samplePutDown(
  from: THREE.Vector3,
  to: THREE.Vector3,
  progress: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const t = smoother(progress);
  out.lerpVectors(from, to, t);
  return out;
}

/** Small critically-damped style settle after the authored one-shot finishes. */
export function sampleCarrySettle(
  from: THREE.Vector3,
  to: THREE.Vector3,
  progress: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const t = easeOutCubic(progress);
  out.lerpVectors(from, to, t);
  return out;
}
