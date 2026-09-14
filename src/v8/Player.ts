import * as THREE from 'three';
import { CharacterAnimator, type CharacterAction, type CharacterRig } from './animation/CharacterAnimator';
import type { Collider, PlayerProfile } from './types';
import type { Input } from './Input';

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;

  private visual = new THREE.Group();
  private carrySocket = new THREE.Group();
  private carriedId: string | null = null;
  private carriedObject: THREE.Object3D | null = null;
  private animator!: CharacterAnimator;

  constructor(private profile: PlayerProfile) {
    this.group.name = 'V8_PLAYER';
    this.buildAvatar();
    this.carrySocket.position.set(0, 1.42, 0.78);
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
    const speed = (sprint ? 7.15 : 4.7) * (this.carriedId ? 0.76 : 1);

    if (moving) {
      movement.normalize();
      const next = this.position.clone().addScaledVector(movement, speed * dt);
      if (!this.collides(next, colliders)) this.position.copy(next);
      const targetYaw = Math.atan2(movement.x, movement.z);
      this.visual.rotation.y = this.lerpAngle(this.visual.rotation.y, targetYaw, 1 - Math.exp(-dt * 12));
    }

    if (!locked && !this.carriedId) {
      if (input.isDown('KeyF')) this.animator.play('scan');
      else if (input.isDown('KeyE')) this.animator.play('interact');
    }

    this.animator.setLocomotion(moving, sprint, Boolean(this.carriedId));
    this.animator.update(dt);
  }

  playAction(action: Exclude<CharacterAction, null>): void {
    this.animator.play(action);
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
    object.scale.multiplyScalar(0.7);
    object.userData.carried = true;
    this.playAction('pickup');
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
    this.playAction('drop');
    return { id, object };
  }

  private buildAvatar(): void {
    const accent = new THREE.Color(this.profile.accent);
    const mats = {
      navy: this.mat(0x173346, 0.68, 0.04),
      pants: this.mat(0x2e3940, 0.82, 0.02),
      skin: this.mat(0xd6a078, 0.76, 0.0),
      yellow: this.mat(0xf4c542, 0.52, 0.02),
      reflective: this.mat(0xeaf3f5, 0.38, 0.08, 0x7bb7ca, 0.14),
      dark: this.mat(0x10171b, 0.8, 0.06),
      metal: this.mat(0x576870, 0.44, 0.55),
      glass: this.mat(0x233f53, 0.18, 0.12),
      accent: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.04, emissive: accent, emissiveIntensity: 0.08 })
    };

    const torsoRig = new THREE.Group();
    torsoRig.name = 'torsoRig';
    torsoRig.position.set(0, 1.18, 0);
    this.visual.add(torsoRig);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.64, 5, 12), mats.navy);
    torso.position.y = 0.34;
    torso.scale.set(1.0, 1.0, 0.74);
    torsoRig.add(torso);

    const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.74, 0.16), mats.yellow);
    vestFront.position.set(0, 0.36, 0.33);
    vestFront.rotation.x = -0.03;
    torsoRig.add(vestFront);

    for (const y of [0.23, 0.49]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.055, 0.18), mats.reflective);
      stripe.position.set(0, y, 0.345);
      torsoRig.add(stripe);
    }

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.11, 0.52), mats.dark);
    belt.position.set(0, -0.02, 0.02);
    torsoRig.add(belt);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.08), mats.dark);
    radio.position.set(-0.34, 0.58, 0.37);
    torsoRig.add(radio);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), mats.accent);
    badge.position.set(0.23, 0.58, 0.37);
    torsoRig.add(badge);

    const headRig = new THREE.Group();
    headRig.name = 'headRig';
    headRig.position.set(0, 1.06, 0.02);
    torsoRig.add(headRig);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mats.skin);
    head.scale.set(0.9, 1.05, 0.92);
    headRig.add(head);

    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mats.skin);
    earL.position.set(-0.255, 0, 0);
    const earR = earL.clone();
    earR.position.x = 0.255;
    headRig.add(earL, earR);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), mats.yellow);
    helmet.position.y = 0.17;
    helmet.scale.z = 0.94;
    headRig.add(helmet);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.055, 0.46), mats.yellow);
    brim.position.set(0, 0.06, 0.08);
    headRig.add(brim);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.045), mats.glass);
    visor.position.set(0, -0.02, 0.255);
    headRig.add(visor);

    const shoulderL = this.buildArm(-1, mats.navy, mats.skin, mats.dark);
    const shoulderR = this.buildArm(1, mats.navy, mats.skin, mats.dark);
    torsoRig.add(shoulderL.root, shoulderR.root);

    const hipL = this.buildLeg(-1, mats.pants, mats.dark, mats.metal);
    const hipR = this.buildLeg(1, mats.pants, mats.dark, mats.metal);
    this.visual.add(hipL.root, hipR.root);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.22), mats.dark);
    backpack.position.set(0, 1.52, -0.33);
    backpack.rotation.x = 0.08;
    this.visual.add(backpack);
    const backpackBand = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.235), mats.yellow);
    backpackBand.position.set(0, 1.55, -0.35);
    this.visual.add(backpackBand);

    const scanner = new THREE.Group();
    scanner.name = 'handScanner';
    const scannerBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.11), mats.dark);
    const scannerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.12, 0.012), mats.accent);
    scannerScreen.position.set(0, 0.045, 0.061);
    scanner.add(scannerBody, scannerScreen);
    scanner.position.set(0, -0.34, 0.16);
    scanner.rotation.x = -0.4;
    shoulderR.elbow.add(scanner);
    scanner.visible = false;

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.group.add(shadow);

    this.visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    shadow.castShadow = false;
    shadow.receiveShadow = false;
    this.group.add(this.visual);

    const rig: CharacterRig = {
      root: this.group,
      visual: this.visual,
      torso: torsoRig,
      head: headRig,
      leftShoulder: shoulderL.root,
      rightShoulder: shoulderR.root,
      leftElbow: shoulderL.elbow,
      rightElbow: shoulderR.elbow,
      leftHip: hipL.root,
      rightHip: hipR.root,
      leftKnee: hipL.knee,
      rightKnee: hipR.knee,
      scanner
    };
    this.animator = new CharacterAnimator(rig);
  }

  private buildArm(side: -1 | 1, sleeve: THREE.Material, skin: THREE.Material, glove: THREE.Material): { root: THREE.Group; elbow: THREE.Group } {
    const root = new THREE.Group();
    root.position.set(side * 0.5, 0.68, 0);
    root.rotation.z = side * 0.04;

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.38, 4, 8), sleeve);
    upper.position.y = -0.25;
    root.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.52, 0);
    root.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 4, 8), skin);
    forearm.position.y = -0.22;
    elbow.add(forearm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.17, 0.18), glove);
    hand.position.set(0, -0.48, 0.02);
    elbow.add(hand);
    return { root, elbow };
  }

  private buildLeg(side: -1 | 1, pants: THREE.Material, boot: THREE.Material, sole: THREE.Material): { root: THREE.Group; knee: THREE.Group } {
    const root = new THREE.Group();
    root.position.set(side * 0.19, 1.03, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.48, 4, 8), pants);
    thigh.position.y = -0.32;
    root.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.67, 0);
    root.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.42, 4, 8), pants);
    shin.position.y = -0.28;
    knee.add(shin);
    const bootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.45), boot);
    bootMesh.position.set(0, -0.58, 0.08);
    knee.add(bootMesh);
    const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.055, 0.47), sole);
    soleMesh.position.set(0, -0.7, 0.095);
    knee.add(soleMesh);
    return { root, knee };
  }

  private mat(color: number, roughness: number, metalness: number, emissive?: number, emissiveIntensity = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: emissive ?? 0x000000, emissiveIntensity });
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
