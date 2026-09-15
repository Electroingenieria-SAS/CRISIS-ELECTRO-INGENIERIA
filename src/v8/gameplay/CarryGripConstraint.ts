import * as THREE from 'three';
import { CARRY_FEEL } from './CarryMotion';
import type { WeightClass } from './GameplayComponents';
import { GameLogger } from './GameLogger';

/**
 * Conservative hand-contact correction for carried objects.
 *
 * KayKit Holding_* owns the arm pose. This solver deliberately behaves like a
 * low-frequency stabilizer, not full IK: it keeps the load centred, filters
 * frame-to-frame hand noise and only allows a few centimetres of vertical/depth
 * correction. During pickup/put-down it yields to the authored object path.
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
  private warnedMissingBones = false;
  private readonly handL = new THREE.Vector3();
  private readonly handR = new THREE.Vector3();
  private readonly gripL = new THREE.Vector3();
  private readonly gripR = new THREE.Vector3();
  private readonly handMid = new THREE.Vector3();
  private readonly gripMid = new THREE.Vector3();
  private readonly targetWorld = new THREE.Vector3();
  private readonly targetLocal = new THREE.Vector3();
  private readonly filteredTarget = new THREE.Vector3();
  private previousState = 'NONE';
  private stateElapsed = 0;

  update(sceneRoot: THREE.Object3D, dt: number): void {
    if (!this.resolve(sceneRoot)) return;
    const anchor = this.anchor!;
    const parent = this.anchorParent!;
    const state = String(anchor.userData.state ?? 'NONE');
    const weight = this.weight(anchor);

    if (state !== this.previousState) {
      this.previousState = state;
      this.stateElapsed = 0;
      this.filteredTarget.copy(anchor.position);
      GameLogger.animation('carry constraint state', state, weight);
    } else {
      this.stateElapsed += dt;
    }

    const stableCarry = state === 'CARRY_IDLE' || state === 'CARRY_WALK';
    if (!stableCarry) {
      // Pickup/put-down/throw own the visible object path. The anchor itself
      // returns softly to the authored ergonomic rest without competing with it.
      const response = state === 'PICKUP_LIFT' ? 8.0 : state === 'PUTDOWN' ? 7.0 : 11.0;
      this.dampTo(anchor.position, this.rest, response, dt);
      return;
    }

    if (!this.leftHand || !this.rightHand) {
      if (!this.warnedMissingBones) {
        this.warnedMissingBones = true;
        GameLogger.animation('carry grip correction disabled: KayKit hand bones not resolved');
      }
      this.dampTo(anchor.position, this.rest, 8.0, dt);
      return;
    }

    this.player!.updateWorldMatrix(true, true);
    this.leftHand.getWorldPosition(this.handL);
    this.rightHand.getWorldPosition(this.handR);
    this.leftGrip!.getWorldPosition(this.gripL);
    this.rightGrip!.getWorldPosition(this.gripR);

    this.handMid.copy(this.handL).add(this.handR).multiplyScalar(0.5);
    this.gripMid.copy(this.gripL).add(this.gripR).multiplyScalar(0.5);
    anchor.getWorldPosition(this.targetWorld).add(this.handMid.sub(this.gripMid));
    this.targetLocal.copy(this.targetWorld);
    parent.worldToLocal(this.targetLocal);

    // Centre-line ownership is strict. Arms may refine height/depth only.
    this.targetLocal.x = this.rest.x;

    const isWalking = state === 'CARRY_WALK';
    const verticalLimit = isWalking ? 0.052 : 0.040;
    const depthLimit = isWalking ? 0.044 : 0.034;
    this.targetLocal.y = this.rest.y + THREE.MathUtils.clamp(this.targetLocal.y - this.rest.y, -verticalLimit, verticalLimit);
    this.targetLocal.z = this.rest.z + THREE.MathUtils.clamp(this.targetLocal.z - this.rest.z, -depthLimit, depthLimit);

    // Dead-zone prevents sub-centimetre bone noise from becoming visible jitter.
    if (Math.abs(this.targetLocal.y - this.rest.y) < 0.012) this.targetLocal.y = this.rest.y;
    if (Math.abs(this.targetLocal.z - this.rest.z) < 0.012) this.targetLocal.z = this.rest.z;

    // Low-pass filter the hand-derived target before damping the anchor itself.
    const filter = 1 - Math.exp(-dt * (isWalking ? 6.2 : 5.0));
    this.filteredTarget.lerp(this.targetLocal, filter);
    this.filteredTarget.x = this.rest.x;

    // Heavier loads should look more planted and respond less to arm noise.
    const response = weight === 'HEAVY' ? 5.0 : weight === 'MEDIUM' ? 6.5 : 8.0;
    this.dampTo(anchor.position, this.filteredTarget, response, dt);
  }

  reset(): void {
    this.player = null;
    this.anchor = null;
    this.leftGrip = null;
    this.rightGrip = null;
    this.leftHand = null;
    this.rightHand = null;
    this.anchorParent = null;
    this.warnedMissingBones = false;
    this.previousState = 'NONE';
    this.stateElapsed = 0;
  }

  private resolve(sceneRoot: THREE.Object3D): boolean {
    const player = sceneRoot.getObjectByName('V9_PLAYER');
    if (!player) return false;
    const anchor = player.getObjectByName('V9_CARRY_ANCHOR');
    const leftGrip = player.getObjectByName('V9_LEFT_HAND_GRIP');
    const rightGrip = player.getObjectByName('V9_RIGHT_HAND_GRIP');
    if (!anchor || !leftGrip || !rightGrip || !anchor.parent) return false;

    if (player !== this.player || anchor !== this.anchor || anchor.parent !== this.anchorParent) {
      this.player = player;
      this.anchor = anchor;
      this.leftGrip = leftGrip;
      this.rightGrip = rightGrip;
      this.anchorParent = anchor.parent;
      this.leftHand = this.findHand(anchor.parent, 'left');
      this.rightHand = this.findHand(anchor.parent, 'right');
      this.rest.copy(anchor.position);
      this.filteredTarget.copy(anchor.position);
      this.warnedMissingBones = false;
      GameLogger.animation('carry grip constraint resolved', {
        rest: this.rest.toArray(),
        leftHand: this.leftHand?.name ?? 'missing',
        rightHand: this.rightHand?.name ?? 'missing'
      });
    } else {
      const configured = anchor.userData.restPosition as [number, number, number] | undefined;
      if (configured) this.rest.set(configured[0], configured[1], configured[2]);
    }
    return true;
  }

  private weight(anchor: THREE.Object3D): WeightClass {
    const value = String(anchor.userData.weightClass ?? 'MEDIUM') as WeightClass;
    return value in CARRY_FEEL ? value : 'MEDIUM';
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
