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
}

const ZERO: Pose = {
  torsoX: 0,
  torsoY: 0,
  torsoZ: 0,
  headX: 0,
  headY: 0,
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
  bob: 0
};

export class CharacterAnimator {
  private phase = 0;
  private action: CharacterAction = null;
  private actionTime = 0;
  private actionDuration = 0;
  private carrying = false;
  private moving = false;
  private sprinting = false;

  constructor(private rig: CharacterRig) {}

  setLocomotion(moving: boolean, sprinting: boolean, carrying: boolean): void {
    this.moving = moving;
    this.sprinting = sprinting;
    this.carrying = carrying;
  }

  play(action: Exclude<CharacterAction, null>): void {
    this.action = action;
    this.actionTime = 0;
    this.actionDuration = action === 'scan' ? 0.82 : action === 'interact' ? 0.62 : 0.72;
  }

  update(dt: number): void {
    const locomotionRate = this.moving ? (this.sprinting ? 10.8 : this.carrying ? 5.4 : 7.4) : 1.9;
    this.phase += dt * locomotionRate;

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
    const idleBreath = Math.sin(this.phase * 0.85);

    if (!this.moving) {
      pose.torsoX = 0.018 + idleBreath * 0.012;
      pose.headY = Math.sin(this.phase * 0.55) * 0.035;
      pose.leftShoulderZ = -0.045;
      pose.rightShoulderZ = 0.045;
      pose.leftElbowX = this.carrying ? -0.9 : -0.06;
      pose.rightElbowX = this.carrying ? -0.9 : -0.06;
      if (this.carrying) {
        pose.leftShoulderX = -0.72;
        pose.rightShoulderX = -0.72;
        pose.leftShoulderZ = -0.18;
        pose.rightShoulderZ = 0.18;
      }
      pose.bob = idleBreath * 0.006;
      return pose;
    }

    const stride = Math.sin(this.phase);
    const counter = Math.sin(this.phase + Math.PI);
    const strideAmp = this.sprinting ? 0.82 : this.carrying ? 0.33 : 0.56;
    pose.leftHipX = stride * strideAmp;
    pose.rightHipX = counter * strideAmp;
    pose.leftKneeX = Math.max(0, -stride) * (this.sprinting ? 0.92 : 0.58);
    pose.rightKneeX = Math.max(0, -counter) * (this.sprinting ? 0.92 : 0.58);
    pose.torsoX = this.sprinting ? -0.11 : this.carrying ? -0.04 : -0.025;
    pose.torsoZ = Math.sin(this.phase * 0.5) * (this.sprinting ? 0.055 : 0.03);
    pose.headY = -pose.torsoZ * 0.5;
    pose.bob = Math.abs(Math.sin(this.phase)) * (this.sprinting ? 0.055 : 0.028);

    if (this.carrying) {
      pose.leftShoulderX = -0.72;
      pose.rightShoulderX = -0.72;
      pose.leftShoulderZ = -0.18;
      pose.rightShoulderZ = 0.18;
      pose.leftElbowX = -0.9;
      pose.rightElbowX = -0.9;
    } else {
      pose.leftShoulderX = counter * strideAmp * 0.72;
      pose.rightShoulderX = stride * strideAmp * 0.72;
      pose.leftElbowX = -Math.max(0, stride) * 0.35;
      pose.rightElbowX = -Math.max(0, counter) * 0.35;
    }
    return pose;
  }

  private actionPose(action: Exclude<CharacterAction, null>, t: number): Pose {
    const pose = this.locomotionPose();
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const returnEase = Math.sin(Math.PI * Math.min(1, t));

    if (action === 'pickup') {
      pose.torsoX = THREE.MathUtils.lerp(pose.torsoX, 0.55, returnEase);
      pose.headX = THREE.MathUtils.lerp(pose.headX, -0.16, returnEase);
      pose.leftShoulderX = THREE.MathUtils.lerp(pose.leftShoulderX, -0.95, returnEase);
      pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -0.95, returnEase);
      pose.leftElbowX = THREE.MathUtils.lerp(pose.leftElbowX, -0.65, returnEase);
      pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -0.65, returnEase);
      pose.leftHipX *= 0.2;
      pose.rightHipX *= 0.2;
      return pose;
    }

    if (action === 'drop') {
      pose.torsoX = THREE.MathUtils.lerp(pose.torsoX, 0.28, returnEase);
      pose.leftShoulderX = THREE.MathUtils.lerp(-0.72, -1.25, ease);
      pose.rightShoulderX = THREE.MathUtils.lerp(-0.72, -1.25, ease);
      pose.leftElbowX = THREE.MathUtils.lerp(-0.9, -0.28, ease);
      pose.rightElbowX = THREE.MathUtils.lerp(-0.9, -0.28, ease);
      return pose;
    }

    if (action === 'scan') {
      pose.torsoY = THREE.MathUtils.lerp(0, -0.16, returnEase);
      pose.headY = THREE.MathUtils.lerp(pose.headY, -0.18, returnEase);
      pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.35, returnEase);
      pose.rightShoulderZ = THREE.MathUtils.lerp(pose.rightShoulderZ, 0.18, returnEase);
      pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -1.05, returnEase);
      pose.leftShoulderX = THREE.MathUtils.lerp(pose.leftShoulderX, -0.35, returnEase);
      this.rig.scanner.visible = true;
      return pose;
    }

    pose.torsoY = THREE.MathUtils.lerp(0, 0.12, returnEase);
    pose.headY = THREE.MathUtils.lerp(pose.headY, 0.12, returnEase);
    pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.0, returnEase);
    pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -0.42, returnEase);
    return pose;
  }

  private applyPose(pose: Pose, dt: number): void {
    const alpha = 1 - Math.exp(-dt * 13);
    const rot = (group: THREE.Object3D, x: number, y = 0, z = 0) => {
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, x, alpha);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, y, alpha);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, z, alpha);
    };

    rot(this.rig.torso, pose.torsoX, pose.torsoY, pose.torsoZ);
    rot(this.rig.head, pose.headX, pose.headY, 0);
    rot(this.rig.leftShoulder, pose.leftShoulderX, 0, pose.leftShoulderZ);
    rot(this.rig.rightShoulder, pose.rightShoulderX, 0, pose.rightShoulderZ);
    rot(this.rig.leftElbow, pose.leftElbowX);
    rot(this.rig.rightElbow, pose.rightElbowX);
    rot(this.rig.leftHip, pose.leftHipX);
    rot(this.rig.rightHip, pose.rightHipX);
    rot(this.rig.leftKnee, pose.leftKneeX);
    rot(this.rig.rightKnee, pose.rightKneeX);

    this.rig.visual.position.y = THREE.MathUtils.lerp(this.rig.visual.position.y, pose.bob, alpha);
    if (this.action !== 'scan') this.rig.scanner.visible = false;
  }
}
