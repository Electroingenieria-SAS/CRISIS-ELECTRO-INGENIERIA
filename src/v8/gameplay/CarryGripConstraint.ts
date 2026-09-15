import * as THREE from 'three';
import { GameLogger } from './GameLogger';

/**
 * Conservative hand-contact correction for carried objects.
 *
 * The authored KayKit Holding_* clip owns the arms. This solver only makes a
 * small vertical/forward correction while deliberately locking the carry anchor
 * to the actor centre line. That prevents a hand mismatch from pushing the box
 * beside or behind the character.
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

  update(sceneRoot: THREE.Object3D, dt: number): void {
    if (!this.resolve(sceneRoot)) return;
    const anchor = this.anchor!;
    const parent = this.anchorParent!;
    const state = String(anchor.userData.state ?? 'NONE');
    const stableCarry = state === 'CARRY_IDLE' || state === 'CARRY_WALK';

    // Pickup/put-down own the object's visible travel. Never fight those
    // transitions by moving the carry anchor at the same time.
    if (!stableCarry) {
      this.dampTo(anchor.position, this.rest, 18, dt);
      return;
    }

    if (!this.leftHand || !this.rightHand) {
      if (!this.warnedMissingBones) {
        this.warnedMissingBones = true;
        GameLogger.animation('carry grip correction disabled: KayKit hand bones not resolved');
      }
      this.dampTo(anchor.position, this.rest, 18, dt);
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

    // Lateral position is non-negotiable: a carried box belongs on the centre
    // line. Hands may refine height/depth only within a narrow safe envelope.
    this.targetLocal.x = this.rest.x;
    this.targetLocal.y = this.rest.y + THREE.MathUtils.clamp(this.targetLocal.y - this.rest.y, -0.10, 0.11);
    this.targetLocal.z = this.rest.z + THREE.MathUtils.clamp(this.targetLocal.z - this.rest.z, -0.08, 0.08);

    // Never permit the object to drift behind the authored carry plane.
    this.targetLocal.z = Math.max(this.targetLocal.z, this.rest.z - 0.08);
    this.dampTo(anchor.position, this.targetLocal, 14, dt);
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
