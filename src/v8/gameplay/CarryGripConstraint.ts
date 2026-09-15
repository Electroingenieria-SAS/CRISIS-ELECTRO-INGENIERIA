import * as THREE from 'three';
import { GameLogger } from './GameLogger';

/**
 * Lightweight carry contact solver.
 *
 * It deliberately does not solve a full skeletal IK chain. KayKit Holding_* owns
 * the arm pose; this constraint only shifts the carry anchor by the averaged
 * hand/grip error, bounded to a few centimetres. That keeps authored animation
 * stable while making differently-sized objects sit between the real hand bones.
 */
export class CarryGripConstraint {
  private player: THREE.Object3D | null = null;
  private anchor: THREE.Object3D | null = null;
  private leftGrip: THREE.Object3D | null = null;
  private rightGrip: THREE.Object3D | null = null;
  private leftHand: THREE.Object3D | null = null;
  private rightHand: THREE.Object3D | null = null;
  private anchorParent: THREE.Object3D | null = null;
  private readonly rest = new THREE.Vector3();
  private restCaptured = false;
  private warnedMissingBones = false;
  private readonly handL = new THREE.Vector3();
  private readonly handR = new THREE.Vector3();
  private readonly gripL = new THREE.Vector3();
  private readonly gripR = new THREE.Vector3();
  private readonly targetWorld = new THREE.Vector3();
  private readonly targetLocal = new THREE.Vector3();
  private readonly correction = new THREE.Vector3();

  update(sceneRoot: THREE.Object3D, dt: number): void {
    if (!this.resolve(sceneRoot)) return;
    const anchor = this.anchor!;
    const parent = this.anchorParent!;
    if (!this.restCaptured) {
      this.rest.copy(anchor.position);
      this.restCaptured = true;
    }

    const carried = anchor.children.some((child) => child.userData.carried === true);
    if (!carried) {
      this.dampTo(anchor.position, this.rest, 11, dt);
      return;
    }
    if (!this.leftHand || !this.rightHand) {
      if (!this.warnedMissingBones) {
        this.warnedMissingBones = true;
        GameLogger.animation('carry grip constraint unavailable: KayKit hand bones not resolved');
      }
      return;
    }

    this.player!.updateWorldMatrix(true, true);
    this.leftHand.getWorldPosition(this.handL);
    this.rightHand.getWorldPosition(this.handR);
    this.leftGrip!.getWorldPosition(this.gripL);
    this.rightGrip!.getWorldPosition(this.gripR);

    // Average both grip errors. This avoids over-constraining the skinned arms
    // while still keeping the object's centre physically between the hands.
    this.correction
      .copy(this.handL).sub(this.gripL)
      .add(this.handR.clone().sub(this.gripR))
      .multiplyScalar(0.5);

    anchor.getWorldPosition(this.targetWorld).add(this.correction);
    this.targetLocal.copy(this.targetWorld);
    parent.worldToLocal(this.targetLocal);

    this.targetLocal.x = this.rest.x + THREE.MathUtils.clamp(this.targetLocal.x - this.rest.x, -0.16, 0.16);
    this.targetLocal.y = this.rest.y + THREE.MathUtils.clamp(this.targetLocal.y - this.rest.y, -0.18, 0.18);
    this.targetLocal.z = this.rest.z + THREE.MathUtils.clamp(this.targetLocal.z - this.rest.z, -0.22, 0.22);
    this.dampTo(anchor.position, this.targetLocal, 16, dt);
  }

  reset(): void {
    this.player = null;
    this.anchor = null;
    this.leftGrip = null;
    this.rightGrip = null;
    this.leftHand = null;
    this.rightHand = null;
    this.anchorParent = null;
    this.restCaptured = false;
    this.warnedMissingBones = false;
  }

  private resolve(sceneRoot: THREE.Object3D): boolean {
    const player = sceneRoot.getObjectByName('V9_PLAYER');
    if (!player) return false;
    const anchor = player.getObjectByName('V9_CARRY_ANCHOR');
    const leftGrip = player.getObjectByName('V9_LEFT_HAND_GRIP');
    const rightGrip = player.getObjectByName('V9_RIGHT_HAND_GRIP');
    if (!anchor || !leftGrip || !rightGrip || !anchor.parent) return false;

    if (player !== this.player || anchor !== this.anchor) {
      this.player = player;
      this.anchor = anchor;
      this.leftGrip = leftGrip;
      this.rightGrip = rightGrip;
      this.anchorParent = anchor.parent;
      this.leftHand = this.findHand(anchor.parent, 'left');
      this.rightHand = this.findHand(anchor.parent, 'right');
      this.rest.copy(anchor.position);
      this.restCaptured = true;
      this.warnedMissingBones = false;
      GameLogger.animation('carry grip constraint resolved', {
        leftHand: this.leftHand?.name ?? 'missing',
        rightHand: this.rightHand?.name ?? 'missing'
      });
    }
    return true;
  }

  private findHand(root: THREE.Object3D, side: 'left' | 'right'): THREE.Object3D | null {
    const exact = side === 'left'
      ? ['hand.l', 'hand_l', 'handleft', 'left_hand', 'lefthand']
      : ['hand.r', 'hand_r', 'handright', 'right_hand', 'righthand'];
    for (const name of exact) {
      const found = root.getObjectByName(name);
      if (found) return found;
    }

    let best: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (best) return;
      const name = node.name.toLowerCase();
      if (!name.includes('hand') || name.includes('slot')) return;
      const matches = side === 'left'
        ? name.includes('left') || name.includes('.l') || name.endsWith('_l')
        : name.includes('right') || name.includes('.r') || name.endsWith('_r');
      if (matches) best = node;
    });
    return best;
  }

  private dampTo(current: THREE.Vector3, target: THREE.Vector3, lambda: number, dt: number): void {
    current.x = THREE.MathUtils.damp(current.x, target.x, lambda, dt);
    current.y = THREE.MathUtils.damp(current.y, target.y, lambda, dt);
    current.z = THREE.MathUtils.damp(current.z, target.z, lambda, dt);
  }
}
