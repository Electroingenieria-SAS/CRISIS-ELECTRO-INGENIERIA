import * as THREE from 'three';
import type { CharacterRig } from '../animation/CharacterAnimator';

export type HairStyle = 'short' | 'side' | 'bun' | 'ponytail' | 'buzz';
export type CharacterRole = 'quality' | 'warehouse' | 'production' | 'metrology' | 'maintenance' | 'dispatch' | 'lead';

export interface CharacterStyle {
  name: string;
  role: CharacterRole;
  accent: number;
  skin: number;
  hair: number;
  eye: number;
  hairStyle: HairStyle;
  feminine?: boolean;
  glasses?: boolean;
  helmet?: boolean;
  beard?: boolean;
  labCoat?: boolean;
  vest?: boolean;
  radio?: boolean;
  tablet?: boolean;
}

export interface CharacterModel {
  root: THREE.Group;
  visual: THREE.Group;
  rig: CharacterRig;
  blinkLeft: THREE.Object3D;
  blinkRight: THREE.Object3D;
}

const MAT = (color: number, roughness = 0.68, metalness = 0.02) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export class CharacterFactory {
  create(style: CharacterStyle): CharacterModel {
    const root = new THREE.Group();
    root.name = `character-${style.name.toLowerCase().replace(/\s+/g, '-')}`;
    const visual = new THREE.Group();
    visual.name = 'character-visual';
    root.add(visual);

    const bodyScale = style.feminine ? 0.94 : 1;
    const skin = MAT(style.skin, 0.72, 0);
    const hair = MAT(style.hair, 0.76, 0);
    const eyeWhite = MAT(0xf7f7f2, 0.48, 0);
    const iris = MAT(style.eye, 0.42, 0.02);
    const pupil = MAT(0x111317, 0.52, 0);
    const mouth = MAT(0x7b403c, 0.7, 0);
    const eyebrow = MAT(Math.max(0x111111, style.hair - 0x111111), 0.78, 0);
    const navy = MAT(0x173346, 0.64, 0.05);
    const shirt = MAT(style.role === 'quality' || style.role === 'metrology' ? 0xe7edf0 : 0x25465b, 0.65, 0.02);
    const pants = MAT(0x2e3940, 0.82, 0.02);
    const accent = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.48, metalness: 0.06, emissive: style.accent, emissiveIntensity: 0.04 });
    const reflective = new THREE.MeshStandardMaterial({ color: 0xe9f4f6, roughness: 0.3, metalness: 0.09, emissive: 0xaad9e8, emissiveIntensity: 0.11 });
    const dark = MAT(0x11191e, 0.76, 0.08);
    const steel = MAT(0x59666d, 0.42, 0.58);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x98bfd3, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.46, transmission: 0.18, thickness: 0.03 });

    const torsoRig = new THREE.Group();
    torsoRig.name = 'torsoRig';
    torsoRig.position.set(0, 1.17, 0);
    visual.add(torsoRig);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39 * bodyScale, 0.64, 6, 14), shirt);
    torso.position.y = 0.34;
    torso.scale.set(1, 1, 0.76);
    torsoRig.add(torso);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.31 * bodyScale, 0.34 * bodyScale, 0.28, 14), pants);
    waist.position.y = -0.05;
    torsoRig.add(waist);

    if (style.labCoat) {
      const coatBack = new THREE.Mesh(new THREE.BoxGeometry(0.78 * bodyScale, 0.94, 0.16), MAT(0xf1f4f5, 0.78, 0));
      coatBack.position.set(0, 0.22, -0.29);
      torsoRig.add(coatBack);
      for (const side of [-1, 1] as const) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.08), MAT(0xf5f6f6, 0.72, 0));
        lapel.position.set(side * 0.19, 0.36, 0.31);
        lapel.rotation.z = side * 0.07;
        torsoRig.add(lapel);
      }
    } else if (style.vest !== false) {
      const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.78 * bodyScale, 0.76, 0.15), accent);
      vestFront.position.set(0, 0.35, 0.31);
      torsoRig.add(vestFront);
      for (const y of [0.21, 0.49]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.79 * bodyScale, 0.052, 0.17), reflective);
        stripe.position.set(0, y, 0.335);
        torsoRig.add(stripe);
      }
    }

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.8 * bodyScale, 0.1, 0.49), dark);
    belt.position.set(0, -0.03, 0.02);
    torsoRig.add(belt);

    if (style.radio !== false) {
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.075), dark);
      radio.position.set(-0.34 * bodyScale, 0.57, 0.35);
      torsoRig.add(radio);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), dark);
      antenna.position.set(-0.34 * bodyScale, 0.77, 0.35);
      torsoRig.add(antenna);
    }

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.21, 0.025), accent);
    badge.position.set(0.23 * bodyScale, 0.58, 0.365);
    torsoRig.add(badge);

    const headRig = new THREE.Group();
    headRig.name = 'headRig';
    headRig.position.set(0, 1.06, 0.02);
    torsoRig.add(headRig);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 22, 16), skin);
    head.name = 'face-head';
    head.scale.set(style.feminine ? 0.88 : 0.93, 1.07, 0.94);
    headRig.add(head);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), skin);
      ear.position.set(side * 0.258, -0.005, -0.005);
      ear.scale.x = 0.7;
      headRig.add(ear);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.12, 10), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.015, 0.282);
    headRig.add(nose);

    const eyeY = 0.065;
    const blinkMeshes: THREE.Mesh[] = [];
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.067, 14, 10), eyeWhite);
      eye.position.set(side * 0.105, eyeY, 0.247);
      eye.scale.set(1, 0.74, 0.38);
      headRig.add(eye);

      const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), iris);
      irisMesh.position.set(side * 0.105, eyeY, 0.278);
      irisMesh.scale.z = 0.34;
      headRig.add(irisMesh);

      const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 7), pupil);
      pupilMesh.position.set(side * 0.105, eyeY, 0.291);
      pupilMesh.scale.z = 0.3;
      headRig.add(pupilMesh);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.024), eyebrow);
      brow.position.set(side * 0.105, 0.145, 0.272);
      brow.rotation.z = side * -0.05;
      headRig.add(brow);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.01, 0.025), skin);
      lid.position.set(side * 0.105, eyeY + 0.004, 0.301);
      lid.visible = false;
      headRig.add(lid);
      blinkMeshes.push(lid);
    }

    const mouthMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.11, 3, 8), mouth);
    mouthMesh.rotation.z = Math.PI / 2;
    mouthMesh.scale.set(1, 0.35, 0.35);
    mouthMesh.position.set(0, -0.135, 0.281);
    headRig.add(mouthMesh);

    if (style.beard) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), hair);
      beard.scale.set(0.9, 0.52, 0.84);
      beard.position.set(0, -0.15, 0.055);
      headRig.add(beard);
    }

    this.addHair(headRig, style.hairStyle, hair, style.feminine ?? false);

    if (style.helmet !== false) {
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.327, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.57), accent);
      helmet.position.y = 0.18;
      helmet.scale.z = 0.94;
      headRig.add(helmet);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.052, 0.47), accent);
      brim.position.set(0, 0.07, 0.085);
      headRig.add(brim);
      const crownBand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.04), reflective);
      crownBand.position.set(0, 0.27, 0.24);
      headRig.add(crownBand);
    }

    if (style.glasses) {
      for (const side of [-1, 1] as const) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.025), glass);
        lens.position.set(side * 0.1, 0.067, 0.31);
        headRig.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.018, 0.02), dark);
      bridge.position.set(0, 0.067, 0.319);
      headRig.add(bridge);
    }

    const leftArm = this.buildArm(-1, shirt, skin, dark, bodyScale);
    const rightArm = this.buildArm(1, shirt, skin, dark, bodyScale);
    torsoRig.add(leftArm.root, rightArm.root);

    const leftLeg = this.buildLeg(-1, pants, dark, steel, bodyScale);
    const rightLeg = this.buildLeg(1, pants, dark, steel, bodyScale);
    visual.add(leftLeg.root, rightLeg.root);

    const scanner = new THREE.Group();
    scanner.name = 'handScanner';
    const scannerBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.11), dark);
    const scannerScreenMat = new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.accent, emissiveIntensity: 0.45, roughness: 0.24 });
    const scannerScreen = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.12, 0.012), scannerScreenMat);
    scannerScreen.position.set(0, 0.045, 0.061);
    scanner.add(scannerBody, scannerScreen);
    scanner.position.set(0, -0.34, 0.16);
    scanner.rotation.x = -0.4;
    rightArm.elbow.add(scanner);
    scanner.visible = false;

    if (style.tablet) {
      const tablet = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.045), dark);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.31, 0.012), accent);
      screen.position.z = 0.029;
      tablet.add(frame, screen);
      tablet.position.set(0, -0.42, 0.12);
      leftArm.elbow.add(tablet);
    }

    visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    const rig: CharacterRig = {
      root,
      visual,
      torso: torsoRig,
      head: headRig,
      leftShoulder: leftArm.root,
      rightShoulder: rightArm.root,
      leftElbow: leftArm.elbow,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.root,
      rightHip: rightLeg.root,
      leftKnee: leftLeg.knee,
      rightKnee: rightLeg.knee,
      scanner
    };

    root.userData.characterName = style.name;
    root.userData.characterRole = style.role;
    root.userData.faceHead = headRig;
    root.userData.blinkLeft = blinkMeshes[0];
    root.userData.blinkRight = blinkMeshes[1];

    return { root, visual, rig, blinkLeft: blinkMeshes[0]!, blinkRight: blinkMeshes[1]! };
  }

  animateIdle(model: CharacterModel, time: number, phase = 0): void {
    const t = time + phase;
    model.visual.position.y = Math.sin(t * 1.4) * 0.008;
    model.rig.torso.rotation.x = 0.012 + Math.sin(t * 1.1) * 0.012;
    model.rig.head.rotation.y = Math.sin(t * 0.62) * 0.09;
    model.rig.head.rotation.x = Math.sin(t * 0.41) * 0.018;
    model.rig.leftShoulder.rotation.z = -0.035 + Math.sin(t * 0.8) * 0.012;
    model.rig.rightShoulder.rotation.z = 0.035 - Math.sin(t * 0.8) * 0.012;
    const blink = Math.sin(t * 0.73 + phase * 2.3) > 0.986;
    model.blinkLeft.visible = blink;
    model.blinkRight.visible = blink;
  }

  private addHair(head: THREE.Group, style: HairStyle, material: THREE.Material, feminine: boolean): void {
    if (style === 'buzz') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.287, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.47), material);
      cap.position.y = 0.1;
      head.add(cap);
      return;
    }

    const top = new THREE.Mesh(new THREE.SphereGeometry(0.302, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), material);
    top.position.y = 0.13;
    top.scale.set(1, 0.78, 0.98);
    head.add(top);

    if (style === 'side') {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.18), material);
      side.position.set(-0.21, 0.055, -0.02);
      side.rotation.z = 0.16;
      head.add(side);
    }

    if (style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), material);
      bun.position.set(0, 0.15, -0.27);
      head.add(bun);
    }

    if (style === 'ponytail') {
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), material);
      tie.position.set(0, 0.12, -0.275);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, feminine ? 0.34 : 0.26, 4, 8), material);
      tail.position.set(0, -0.05, -0.33);
      tail.rotation.x = -0.12;
      head.add(tie, tail);
    }
  }

  private buildArm(side: -1 | 1, sleeve: THREE.Material, skin: THREE.Material, glove: THREE.Material, scale: number) {
    const root = new THREE.Group();
    root.position.set(side * 0.49 * scale, 0.68, 0);
    root.rotation.z = side * 0.04;
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.38, 5, 10), sleeve);
    upper.position.y = -0.25;
    root.add(upper);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.52, 0);
    root.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.34, 5, 10), skin);
    forearm.position.y = -0.22;
    elbow.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), glove);
    hand.position.set(0, -0.47, 0.025);
    hand.scale.set(0.82, 1.02, 0.94);
    elbow.add(hand);
    return { root, elbow };
  }

  private buildLeg(side: -1 | 1, pants: THREE.Material, boot: THREE.Material, sole: THREE.Material, scale: number) {
    const root = new THREE.Group();
    root.position.set(side * 0.19 * scale, 1.03, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.48, 5, 10), pants);
    thigh.position.y = -0.32;
    root.add(thigh);
    const knee = new THREE.Group();
    knee.position.set(0, -0.67, 0);
    root.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.42, 5, 10), pants);
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
}
