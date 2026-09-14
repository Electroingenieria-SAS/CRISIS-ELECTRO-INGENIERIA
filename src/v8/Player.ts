import * as THREE from 'three';
import type { Collider, PlayerProfile } from './types';
import type { Input } from './Input';

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  private visual = new THREE.Group();
  private carrySocket = new THREE.Group();
  private carriedId: string | null = null;
  private carriedObject: THREE.Object3D | null = null;
  private phase = 0;
  private lastMoving = false;

  constructor(private profile: PlayerProfile) {
    this.group.name = 'V8_PLAYER';
    this.buildAvatar();
    this.carrySocket.position.set(0, 1.25, 0.78);
    this.group.add(this.carrySocket);
  }

  update(dt: number, input: Input, colliders: Collider[], screenUp: THREE.Vector3, screenRight: THREE.Vector3, locked: boolean): void {
    let x = 0;
    let y = 0;
    if (!locked) {
      if (input.isDown('KeyW', 'ArrowUp')) y += 1;
      if (input.isDown('KeyS', 'ArrowDown')) y -= 1;
      if (input.isDown('KeyA', 'ArrowLeft')) x -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) x += 1;
    }

    const movement = new THREE.Vector3();
    movement.addScaledVector(screenUp, y).addScaledVector(screenRight, x);
    const moving = movement.lengthSq() > 0.001;
    const sprint = input.isDown('ShiftLeft', 'ShiftRight') && !this.carriedId;
    const speed = (sprint ? 7.0 : 4.65) * (this.carriedId ? 0.78 : 1);

    if (moving) {
      movement.normalize();
      const next = this.position.clone().addScaledVector(movement, speed * dt);
      if (!this.collides(next, colliders)) this.position.copy(next);
      const targetYaw = Math.atan2(movement.x, movement.z);
      this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * 12));
    }

    this.animate(dt, moving, sprint);
    this.lastMoving = moving;
  }

  getCarriedId(): string | null {
    return this.carriedId;
  }

  pickup(object: THREE.Object3D, id: string): boolean {
    if (this.carriedId) return false;
    this.carriedId = id;
    this.carriedObject = object;
    object.userData.v8OriginalScale = object.scale.clone();
    this.carrySocket.attach(object);
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.multiplyScalar(0.72);
    object.userData.carried = true;
    return true;
  }

  drop(parent: THREE.Object3D, target: THREE.Vector3): { id: string; object: THREE.Object3D } | null {
    if (!this.carriedId || !this.carriedObject) return null;
    const id = this.carriedId;
    const object = this.carriedObject;
    parent.attach(object);
    object.position.copy(target);
    object.rotation.set(0, 0, 0);
    const original = object.userData.v8OriginalScale as THREE.Vector3 | undefined;
    if (original) object.scale.copy(original);
    object.userData.carried = false;
    this.carriedId = null;
    this.carriedObject = null;
    return { id, object };
  }

  private buildAvatar(): void {
    const accent = new THREE.Color(this.profile.accent);
    const navy = new THREE.MeshStandardMaterial({ color: 0x173346, roughness: 0.68 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2f3b43, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd6a078, roughness: 0.78 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf4c542, roughness: 0.52 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeaf3f5, roughness: 0.44, emissive: 0x7bb7ca, emissiveIntensity: 0.12 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111a20, roughness: 0.78 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, emissive: accent, emissiveIntensity: 0.08 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.65, 4, 10), navy);
    torso.position.y = 1.45;
    torso.scale.z = 0.68;
    this.visual.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.7, 0.44), yellow);
    vest.position.set(0, 1.45, 0);
    this.visual.add(vest);

    for (const y of [1.35, 1.58]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.055, 0.46), white);
      stripe.position.set(0, y, 0.01);
      this.visual.add(stripe);
    }

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), skin);
    head.position.y = 2.15;
    this.visual.add(head);

    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.37, 0.22, 14), yellow);
    helmet.position.y = 2.44;
    this.visual.add(helmet);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.055, 14), yellow);
    brim.position.y = 2.34;
    this.visual.add(brim);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.04), new THREE.MeshStandardMaterial({ color: 0x203a4b, roughness: 0.2 }));
    visor.position.set(0, 2.18, 0.25);
    this.visual.add(visor);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.025), accentMat);
    badge.position.set(0.23, 1.58, 0.235);
    this.visual.add(badge);

    const makeArm = (x: number) => {
      const arm = new THREE.Group();
      arm.position.set(x, 1.65, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.22), navy);
      upper.position.y = -0.25;
      arm.add(upper);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.26, 0.2), skin);
      hand.position.y = -0.67;
      arm.add(hand);
      this.visual.add(arm);
      return arm;
    };
    const leftArm = makeArm(-0.5);
    const rightArm = makeArm(0.5);
    leftArm.name = 'leftArm';
    rightArm.name = 'rightArm';

    const makeLeg = (x: number) => {
      const leg = new THREE.Group();
      leg.position.set(x, 1.0, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.76, 0.31), pants);
      upper.position.y = -0.35;
      leg.add(upper);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.43), dark);
      boot.position.set(0, -0.82, 0.05);
      leg.add(boot);
      this.visual.add(leg);
      return leg;
    };
    const leftLeg = makeLeg(-0.2);
    const rightLeg = makeLeg(0.2);
    leftLeg.name = 'leftLeg';
    rightLeg.name = 'rightLeg';

    this.visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.group.add(this.visual);
  }

  private animate(dt: number, moving: boolean, sprinting: boolean): void {
    this.phase += dt * (moving ? (sprinting ? 10.2 : 7.2) : 2.0);
    const leftLeg = this.visual.getObjectByName('leftLeg');
    const rightLeg = this.visual.getObjectByName('rightLeg');
    const leftArm = this.visual.getObjectByName('leftArm');
    const rightArm = this.visual.getObjectByName('rightArm');
    const target = moving ? Math.sin(this.phase) * (sprinting ? 0.65 : 0.42) : 0;
    if (leftLeg) leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, target, 0.22);
    if (rightLeg) rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, -target, 0.22);
    if (leftArm) leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -target * 0.7, 0.2);
    if (rightArm) rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, target * 0.7, 0.2);
    this.visual.position.y = moving ? Math.abs(Math.sin(this.phase * 2)) * 0.025 : Math.sin(this.phase) * 0.006;
  }

  private collides(position: THREE.Vector3, colliders: Collider[]): boolean {
    const radius = 0.42;
    return colliders.some((c) => position.x + radius > c.minX && position.x - radius < c.maxX && position.z + radius > c.minZ && position.z - radius < c.maxZ);
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }
}
