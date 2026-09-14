import * as THREE from 'three';

export type CharacterAction = 'pickup' | 'drop' | 'scan' | 'interact' | null;

export interface CharacterRig {
  root: THREE.Group;
  visual: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  scanner: THREE.Object3D;
}

interface Pose {
  torsoX: number;
  torsoY: number;
  torsoZ: number;
  headX: number;
  headY: number;
  headZ: number;
  leftShoulderX: number;
  rightShoulderX: number;
  leftShoulderZ: number;
  rightShoulderZ: number;
  leftElbowX: number;
  rightElbowX: number;
  leftHipX: number;
  rightHipX: number;
  leftKneeX: number;
  rightKneeX: number;
  bob: number;
  swayX: number;
  surgeZ: number;
}

const ZERO: Pose = {
  torsoX: 0,
  torsoY: 0,
  torsoZ: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  leftShoulderX: 0,
  rightShoulderX: 0,
  leftShoulderZ: 0,
  rightShoulderZ: 0,
  leftElbowX: 0,
  rightElbowX: 0,
  leftHipX: 0,
  rightHipX: 0,
  leftKneeX: 0,
  rightKneeX: 0,
  bob: 0,
  swayX: 0,
  surgeZ: 0
};

export class CharacterAnimator {
  private phase = 0;
  private action: CharacterAction = null;
  private actionTime = 0;
  private actionDuration = 0;
  private carrying = false;
  private moving = false;
  private sprinting = false;
  private moveBlend = 0;
  private sprintBlend = 0;
  private carryBlend = 0;

  constructor(private rig: CharacterRig) {}

  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void {
    this.moving = moving;
    this.sprinting = sprinting;
    this.carrying = carrying;
  }

  play(action: Exclude<CharacterAction, null>): void {
    if (this.action === action) return;
    this.action = action;
    this.actionTime = 0;
    this.actionDuration = action === 'scan' ? 0.95 : action === 'interact' ? 0.78 : action === 'pickup' ? 0.92 : 0.82;
  }

  update(dt: number): void {
    this.moveBlend = THREE.MathUtils.damp(this.moveBlend, this.moving ? 1 : 0, this.moving ? 10 : 7, dt);
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, this.sprinting ? 1 : 0, 8, dt);
    this.carryBlend = THREE.MathUtils.damp(this.carryBlend, this.carrying ? 1 : 0, 9, dt);

    const gaitRate = THREE.MathUtils.lerp(7.1, 11.4, this.sprintBlend);
    const carryRate = THREE.MathUtils.lerp(gaitRate, 5.6, this.carryBlend);
    const idleRate = 1.35;
    this.phase += dt * THREE.MathUtils.lerp(idleRate, carryRate, this.moveBlend);

    if (this.action) {
      this.actionTime += dt;
      if (this.actionTime >= this.actionDuration) {
        this.action = null;
        this.actionTime = 0;
      }
    }

    const pose = this.action ? this.actionPose(this.action, this.actionTime / this.actionDuration) : this.locomotionPose();
    this.applyPose(pose, dt);
  }

  private locomotionPose(): Pose {
    const pose = { ...ZERO };
    const breath = Math.sin(this.phase * 0.72);
    const idleLook = Math.sin(this.phase * 0.39);

    // Idle remains alive even when moveBlend has not fully returned to zero.
    pose.torsoX = 0.012 + breath * 0.009 * (1 - this.moveBlend);
    pose.headY = idleLook * 0.026 * (1 - this.moveBlend);
    pose.headX = -breath * 0.006 * (1 - this.moveBlend);
    pose.leftShoulderZ = -0.04;
    pose.rightShoulderZ = 0.04;
    pose.bob = breath * 0.0045 * (1 - this.moveBlend);

    const stride = Math.sin(this.phase);
    const opposite = -stride;
    const footLiftL = Math.max(0, -stride);
    const footLiftR = Math.max(0, stride);
    const contact = Math.cos(this.phase * 2);

    const walkAmp = 0.54;
    const runAmp = 0.88;
    const locomotionAmp = THREE.MathUtils.lerp(walkAmp, runAmp, this.sprintBlend) * this.moveBlend;
    const legAmp = THREE.MathUtils.lerp(locomotionAmp, 0.33 * this.moveBlend, this.carryBlend);

    pose.leftHipX = stride * legAmp;
    pose.rightHipX = opposite * legAmp;

    const kneeWalk = THREE.MathUtils.lerp(0.62, 1.02, this.sprintBlend);
    pose.leftKneeX = footLiftL * kneeWalk * this.moveBlend;
    pose.rightKneeX = footLiftR * kneeWalk * this.moveBlend;

    // Forward lean and vertical compression create a stronger sense of mass.
    const baseLean = THREE.MathUtils.lerp(-0.035, -0.135, this.sprintBlend);
    pose.torsoX += THREE.MathUtils.lerp(baseLean, -0.055, this.carryBlend) * this.moveBlend;
    pose.torsoZ = stride * THREE.MathUtils.lerp(0.025, 0.055, this.sprintBlend) * this.moveBlend;
    pose.torsoY = -stride * 0.018 * this.moveBlend;
    pose.headY += -pose.torsoZ * 0.58;
    pose.headZ = -pose.torsoZ * 0.25;
    pose.headX += THREE.MathUtils.lerp(0.01, 0.035, this.sprintBlend) * this.moveBlend;

    const stepHeight = THREE.MathUtils.lerp(0.026, 0.062, this.sprintBlend);
    pose.bob += (0.5 - 0.5 * contact) * stepHeight * this.moveBlend;
    pose.swayX = Math.sin(this.phase * 0.5) * THREE.MathUtils.lerp(0.008, 0.018, this.sprintBlend) * this.moveBlend;
    pose.surgeZ = -Math.max(0, contact) * THREE.MathUtils.lerp(0.006, 0.015, this.sprintBlend) * this.moveBlend;

    if (this.carryBlend > 0.02) {
      const hold = this.carryBlend;
      pose.leftShoulderX = THREE.MathUtils.lerp(opposite * locomotionAmp * 0.48, -0.78, hold);
      pose.rightShoulderX = THREE.MathUtils.lerp(stride * locomotionAmp * 0.48, -0.78, hold);
      pose.leftShoulderZ = THREE.MathUtils.lerp(-0.04, -0.2, hold);
      pose.rightShoulderZ = THREE.MathUtils.lerp(0.04, 0.2, hold);
      pose.leftElbowX = THREE.MathUtils.lerp(-Math.max(0, stride) * 0.28, -0.92, hold);
      pose.rightElbowX = THREE.MathUtils.lerp(-Math.max(0, opposite) * 0.28, -0.92, hold);
      pose.headX += 0.018 * hold;
    } else {
      const shoulderAmp = locomotionAmp * THREE.MathUtils.lerp(0.7, 0.82, this.sprintBlend);
      pose.leftShoulderX = opposite * shoulderAmp;
      pose.rightShoulderX = stride * shoulderAmp;
      pose.leftElbowX = -Math.max(0, stride) * THREE.MathUtils.lerp(0.28, 0.52, this.sprintBlend) * this.moveBlend;
      pose.rightElbowX = -Math.max(0, opposite) * THREE.MathUtils.lerp(0.28, 0.52, this.sprintBlend) * this.moveBlend;
      pose.leftShoulderZ = -0.04 - Math.abs(stride) * 0.025 * this.moveBlend;
      pose.rightShoulderZ = 0.04 + Math.abs(opposite) * 0.025 * this.moveBlend;
    }

    return pose;
  }

  private actionPose(action: Exclude<CharacterAction, null>, t: number): Pose {
    const pose = this.locomotionPose();
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    const envelope = Math.sin(Math.PI * clamped);
    const anticipation = this.smoothstep(0, 0.23, clamped);
    const settle = 1 - this.smoothstep(0.76, 1, clamped);

    if (action === 'pickup') {
      const reach = Math.sin(Math.PI * this.smoothstep(0.05, 0.78, clamped));
      pose.torsoX = THREE.MathUtils.lerp(pose.torsoX, 0.62, reach);
      pose.headX = THREE.MathUtils.lerp(pose.headX, -0.18, reach);
      pose.leftShoulderX = THREE.MathUtils.lerp(pose.leftShoulderX, -1.08, reach);
      pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.08, reach);
      pose.leftElbowX = THREE.MathUtils.lerp(pose.leftElbowX, -0.62, reach);
      pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -0.62, reach);
      pose.leftHipX *= 0.1;
      pose.rightHipX *= 0.1;
      pose.leftKneeX += 0.22 * reach;
      pose.rightKneeX += 0.22 * reach;
      pose.bob -= 0.055 * reach;
      return pose;
    }

    if (action === 'drop') {
      const lower = Math.sin(Math.PI * this.smoothstep(0, 0.88, clamped));
      pose.torsoX = THREE.MathUtils.lerp(pose.torsoX, 0.34, lower);
      pose.leftShoulderX = THREE.MathUtils.lerp(-0.78, -1.28, lower);
      pose.rightShoulderX = THREE.MathUtils.lerp(-0.78, -1.28, lower);
      pose.leftElbowX = THREE.MathUtils.lerp(-0.92, -0.24, lower);
      pose.rightElbowX = THREE.MathUtils.lerp(-0.92, -0.24, lower);
      pose.bob -= 0.028 * lower;
      return pose;
    }

    if (action === 'scan') {
      const present = envelope * THREE.MathUtils.lerp(0.82, 1, anticipation);
      pose.torsoY = THREE.MathUtils.lerp(pose.torsoY, -0.13, present);
      pose.torsoX += -0.025 * present;
      pose.headY = THREE.MathUtils.lerp(pose.headY, -0.2, present);
      pose.headX = THREE.MathUtils.lerp(pose.headX, 0.045, present);
      pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.42, present);
      pose.rightShoulderZ = THREE.MathUtils.lerp(pose.rightShoulderZ, 0.19, present);
      pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -1.08, present);
      pose.leftShoulderX = THREE.MathUtils.lerp(pose.leftShoulderX, -0.38, present);
      pose.leftElbowX = THREE.MathUtils.lerp(pose.leftElbowX, -0.22, present);
      pose.surgeZ += 0.012 * settle;
      this.rig.scanner.visible = true;
      return pose;
    }

    // Contextual interaction: reach, confirm, recover.
    const reach = envelope;
    pose.torsoY = THREE.MathUtils.lerp(pose.torsoY, 0.1, reach);
    pose.torsoX += -0.018 * reach;
    pose.headY = THREE.MathUtils.lerp(pose.headY, 0.13, reach);
    pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.08, reach);
    pose.rightShoulderZ += 0.08 * reach;
    pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -0.46, reach);
    pose.leftShoulderX += -0.14 * reach;
    return pose;
  }

  private applyPose(pose: Pose, dt: number): void {
    const alpha = 1 - Math.exp(-dt * 14);
    const rot = (group: THREE.Object3D, x: number, y = 0, z = 0) => {
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, x, alpha);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, y, alpha);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, z, alpha);
    };

    rot(this.rig.torso, pose.torsoX, pose.torsoY, pose.torsoZ);
    rot(this.rig.head, pose.headX, pose.headY, pose.headZ);
    rot(this.rig.leftShoulder, pose.leftShoulderX, 0, pose.leftShoulderZ);
    rot(this.rig.rightShoulder, pose.rightShoulderX, 0, pose.rightShoulderZ);
    rot(this.rig.leftElbow, pose.leftElbowX);
    rot(this.rig.rightElbow, pose.rightElbowX);
    rot(this.rig.leftHip, pose.leftHipX);
    rot(this.rig.rightHip, pose.rightHipX);
    rot(this.rig.leftKnee, pose.leftKneeX);
    rot(this.rig.rightKnee, pose.rightKneeX);

    this.rig.visual.position.y = THREE.MathUtils.lerp(this.rig.visual.position.y, pose.bob, alpha);
    this.rig.visual.position.x = THREE.MathUtils.lerp(this.rig.visual.position.x, pose.swayX, alpha);
    this.rig.visual.position.z = THREE.MathUtils.lerp(this.rig.visual.position.z, pose.surgeZ, alpha);
    if (this.action !== 'scan') this.rig.scanner.visible = false;
  }

  private smoothstep(edge0: number, edge1: number, value: number): number {
    const x = THREE.MathUtils.clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
  }
}
