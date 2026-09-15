import * as THREE from 'three';
import type { CharacterRig } from '../animation/CharacterAnimator';
import type { HeroAppearance } from '../types';
import type { CharacterModel, CharacterRole } from '../visual/CharacterFactory';

export interface HeroStyle {
  name: string;
  role: CharacterRole;
  accent: number;
  appearance: HeroAppearance;
}

type Mats = {
  skin: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshStandardMaterial;
  uniform: THREE.MeshPhysicalMaterial;
  pants: THREE.MeshPhysicalMaterial;
  boots: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  reflective: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  helmet: THREE.MeshPhysicalMaterial;
  eye: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
};

/**
 * Canonical playable hero for V8.
 *
 * This is a self-contained chibi rig. The visible body, PPE and animation
 * hierarchy are authored together so the creator preview and the in-game
 * character are literally the same model. No external humanoid mesh is
 * promoted over it after creation.
 */
export class HeroCharacter {
  create(style: HeroStyle): CharacterModel {
    const appearance = style.appearance;
    const root = new THREE.Group();
    root.name = 'V8_PREMIUM_CHIBI_HERO';

    const visual = new THREE.Group();
    visual.name = 'V8_PREMIUM_CHIBI_VISUAL';
    root.add(visual);

    const mats = this.materials(appearance);
    const width = appearance.build === 'slim' ? 0.91 : appearance.build === 'athletic' ? 1.08 : 1;

    // ----- lower body / hips -----
    const pelvis = new THREE.Group();
    pelvis.name = 'hero-pelvis';
    pelvis.position.set(0, 1.02, 0);
    visual.add(pelvis);

    const hipShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.31 * width, 0.14, 7, 18), mats.pants);
    hipShell.name = 'hero-hip-shell';
    hipShell.scale.z = 0.78;
    hipShell.position.y = 0.07;
    pelvis.add(hipShell);

    // ----- torso rig -----
    const torsoRig = new THREE.Group();
    torsoRig.name = 'hero-torso-rig';
    torsoRig.position.set(0, 1.12, 0);
    visual.add(torsoRig);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36 * width, 0.46, 9, 22), mats.uniform);
    torso.name = 'hero-jumpsuit-torso';
    torso.position.y = 0.32;
    torso.scale.z = 0.79;
    torsoRig.add(torso);

    this.addTorsoTailoring(torsoRig, appearance, mats, width);
    this.addPpe(torsoRig, appearance, mats, width);
    this.addUtilityBelt(torsoRig, appearance, mats, width);

    // ----- head / face -----
    const headRig = new THREE.Group();
    headRig.name = 'hero-head-rig';
    headRig.position.set(0, 1.02, 0.015);
    torsoRig.add(headRig);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.37, 36, 26), mats.skin);
    skull.name = 'hero-face';
    skull.scale.set(1.03, 0.95, 0.97);
    headRig.add(skull);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 10), mats.skin);
      ear.name = side < 0 ? 'hero-ear-l' : 'hero-ear-r';
      ear.position.set(side * 0.36, -0.005, -0.008);
      ear.scale.set(0.68, 1, 0.72);
      headRig.add(ear);
    }

    const blinkMeshes: THREE.Mesh[] = [];
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.07, 5, 14), mats.eye);
      eye.name = side < 0 ? 'hero-eye-l' : 'hero-eye-r';
      eye.position.set(side * 0.125, 0.015, 0.355);
      eye.scale.set(0.9, 1, 0.34);
      headRig.add(eye);

      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.012, 0.014), mats.skin);
      lid.name = side < 0 ? 'hero-lid-l' : 'hero-lid-r';
      lid.position.set(side * 0.125, 0.015, 0.379);
      lid.visible = false;
      headRig.add(lid);
      blinkMeshes.push(lid);
    }

    this.addHair(headRig, appearance, mats);
    this.addHardhat(headRig, appearance, mats);
    if (appearance.glasses) this.addSafetyGoggles(headRig, mats);

    // ----- arms -----
    const leftArm = this.buildArm(-1, torsoRig, appearance, mats, width);
    const rightArm = this.buildArm(1, torsoRig, appearance, mats, width);

    // ----- legs -----
    const leftLeg = this.buildLeg(-1, visual, appearance, mats, width);
    const rightLeg = this.buildLeg(1, visual, appearance, mats, width);

    // ----- scanner attached to right forearm rig -----
    const scanner = this.addScanner(rightArm.elbow, appearance, mats);
    scanner.visible = false;

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
      leftShoulder: leftArm.shoulder,
      rightShoulder: rightArm.shoulder,
      leftElbow: leftArm.elbow,
      rightElbow: rightArm.elbow,
      leftHip: leftLeg.hip,
      rightHip: rightLeg.hip,
      leftKnee: leftLeg.knee,
      rightKnee: rightLeg.knee,
      scanner
    };

    root.userData.heroQuality = true;
    root.userData.heroStyle = 'premium-chibi-industrial';
    root.userData.characterName = style.name;
    root.userData.characterRole = style.role;
    root.userData.faceHead = headRig;
    root.userData.blinkLeft = blinkMeshes[0];
    root.userData.blinkRight = blinkMeshes[1];
    root.userData.appearance = { ...appearance };

    return {
      root,
      visual,
      rig,
      blinkLeft: blinkMeshes[0]!,
      blinkRight: blinkMeshes[1]!
    };
  }

  private materials(appearance: HeroAppearance): Mats {
    const uniformColor = appearance.uniform === 'graphite' ? 0x34434c : appearance.uniform === 'teal' ? 0x17656b : 0x155a70;
    const pantsColor = appearance.pantsStyle === 'cargo' ? 0x285058 : appearance.pantsStyle === 'graphite' ? 0x252d33 : 0x24535a;
    const bootsColor = appearance.bootStyle === 'yellow' ? 0xb78625 : appearance.bootStyle === 'steel' ? 0x465963 : 0x12191e;
    const accentColor = new THREE.Color(appearance.vest).getHex();

    return {
      skin: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.skin), roughness: 0.58, clearcoat: 0.05, clearcoatRoughness: 0.72 }),
      hair: new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.82 }),
      uniform: new THREE.MeshPhysicalMaterial({ color: uniformColor, roughness: 0.56, metalness: 0.018, clearcoat: 0.11, clearcoatRoughness: 0.56 }),
      pants: new THREE.MeshPhysicalMaterial({ color: pantsColor, roughness: 0.68, metalness: 0.025, clearcoat: 0.05 }),
      boots: new THREE.MeshPhysicalMaterial({ color: bootsColor, roughness: 0.52, metalness: 0.09, clearcoat: 0.09 }),
      accent: new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.4, metalness: 0.035, clearcoat: 0.25, clearcoatRoughness: 0.36 }),
      reflective: new THREE.MeshPhysicalMaterial({ color: 0xf0f5f6, roughness: 0.2, metalness: 0.1, clearcoat: 0.38, emissive: 0x6f929c, emissiveIntensity: 0.04 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x11191e, roughness: 0.67, metalness: 0.1 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xc5e4ef, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.46, transmission: 0.3, thickness: 0.018, clearcoat: 0.72 }),
      helmet: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.helmet), roughness: 0.29, metalness: 0.02, clearcoat: 0.62, clearcoatRoughness: 0.19 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x29323a, roughness: 0.46, metalness: 0.03 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x5a6870, roughness: 0.42, metalness: 0.56 })
    };
  }

  private addTorsoTailoring(torso: THREE.Group, appearance: HeroAppearance, mat: Mats, width: number): void {
    const seams = new THREE.Group();
    seams.name = `hero-top-${appearance.topStyle}`;

    if (appearance.topStyle === 'workshirt') {
      for (const side of [-1, 1] as const) {
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.075, 0.035), mat.dark);
        collar.position.set(side * 0.105, 0.62, 0.285);
        collar.rotation.z = side * 0.36;
        seams.add(collar);
      }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.025), mat.uniform);
      pocket.position.set(0.18 * width, 0.4, 0.315);
      seams.add(pocket);
    } else if (appearance.topStyle === 'polo') {
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 7, 22), mat.dark);
      neck.rotation.x = Math.PI / 2;
      neck.position.set(0, 0.61, 0.04);
      seams.add(neck);
      for (const y of [0.52, 0.46]) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), mat.reflective);
        button.position.set(0, y, 0.316);
        seams.add(button);
      }
    } else {
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.56, 0.024), mat.reflective);
      zip.position.set(0, 0.3, 0.32);
      seams.add(zip);
      for (const side of [-1, 1] as const) {
        const shoulderPatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.04), mat.accent);
        shoulderPatch.position.set(side * 0.23 * width, 0.58, 0.18);
        seams.add(shoulderPatch);
      }
    }

    torso.add(seams);
  }

  private addPpe(torso: THREE.Group, appearance: HeroAppearance, mat: Mats, width: number): void {
    const ppe = new THREE.Group();
    ppe.name = `hero-ppe-${appearance.ppeStyle}`;

    if (appearance.ppeStyle === 'harness') {
      for (const side of [-1, 1] as const) {
        const strap = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.43, 5, 12), mat.accent);
        strap.position.set(side * 0.17 * width, 0.33, 0.322);
        strap.scale.z = 0.38;
        ppe.add(strap);
      }
      const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(0.54 * width, 0.035, 0.035), mat.reflective);
      lowerBand.position.set(0, 0.13, 0.338);
      ppe.add(lowerBand);
    } else if (appearance.ppeStyle === 'vest') {
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.36, 6, 14), mat.accent);
        panel.position.set(side * 0.16 * width, 0.34, 0.325);
        panel.scale.set(0.88, 1, 0.35);
        ppe.add(panel);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.03, 0.02), mat.reflective);
        stripe.position.set(side * 0.16 * width, 0.18, 0.355);
        ppe.add(stripe);
      }
    }

    // Reference-approved badge on the right front strap/torso.
    const badge = new THREE.Group();
    badge.name = 'hero-id-badge';
    const badgeBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.025), mat.reflective);
    const badgeMark = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.028, 0.01), mat.accent);
    badgeMark.position.set(0, 0.038, 0.019);
    badge.add(badgeBody, badgeMark);
    badge.position.set(0.24 * width, 0.43, 0.36);
    ppe.add(badge);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), mat.dark);
    radio.name = 'hero-radio';
    radio.position.set(-0.26 * width, 0.5, 0.34);
    ppe.add(radio);

    torso.add(ppe);
  }

  private addUtilityBelt(torso: THREE.Group, appearance: HeroAppearance, mat: Mats, width: number): void {
    const belt = new THREE.Group();
    belt.name = 'hero-utility-belt';

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.72 * width, 0.075, 0.5), mat.dark);
    band.position.set(0, -0.02, 0);
    belt.add(band);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.105, 0.04), mat.steel);
    buckle.position.set(0, -0.02, 0.28);
    belt.add(buckle);

    for (const side of [-1, 1] as const) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), mat.dark);
      pouch.position.set(side * 0.3 * width, -0.03, 0.18);
      belt.add(pouch);
    }

    torso.add(belt);
  }

  private addHair(head: THREE.Group, appearance: HeroAppearance, mat: Mats): void {
    const group = new THREE.Group();
    group.name = `hero-hair-${appearance.hairStyle}`;

    const back = new THREE.Mesh(new THREE.SphereGeometry(0.345, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), mat.hair);
    back.position.set(0, 0.12, -0.035);
    back.scale.set(0.98, appearance.hairStyle === 'buzz' ? 0.34 : 0.58, 0.95);
    group.add(back);

    if (appearance.hairStyle !== 'buzz') {
      for (const side of [-1, 1] as const) {
        const temple = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, appearance.hairStyle === 'wave' ? 0.13 : 0.09, 4, 9), mat.hair);
        temple.position.set(side * 0.295, 0.03, 0.02);
        temple.rotation.z = side * 0.12;
        group.add(temple);
      }
    }

    if (appearance.hairStyle === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.15, 4, 10), mat.hair);
      sweep.position.set(-0.115, 0.17, 0.18);
      sweep.rotation.z = -0.78;
      group.add(sweep);
    } else if (appearance.hairStyle === 'short') {
      for (const x of [-0.12, -0.04, 0.04, 0.12]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.08, 7), mat.hair);
        tuft.position.set(x, 0.21, 0.08);
        tuft.rotation.z = -x * 0.8;
        group.add(tuft);
      }
    } else if (appearance.hairStyle === 'wave') {
      for (const x of [-0.2, -0.11, 0.11, 0.2]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), mat.hair);
        curl.position.set(x, 0.12 + Math.abs(x) * 0.14, 0.08);
        group.add(curl);
      }
    }

    head.add(group);
  }

  private addHardhat(head: THREE.Group, appearance: HeroAppearance, mat: Mats): void {
    const helmet = new THREE.Group();
    helmet.name = 'EI_HARDHAT_MANDATORY';
    helmet.userData.requiredPPE = true;

    // Brim sits just above the brow line. The shell is intentionally smaller
    // than the skull: it reads as PPE placed on a head, never as the head itself.
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.385, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.48), mat.helmet);
    shell.position.set(0, 0.245, -0.005);
    shell.scale.set(1.01, 0.78, 0.98);
    helmet.add(shell);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.405, 0.045, 36), mat.helmet);
    brim.position.set(0, 0.125, 0.012);
    helmet.add(brim);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.49), mat.helmet);
    ridge.position.set(0, 0.34, -0.005);
    helmet.add(ridge);

    for (const side of [-1, 1] as const) {
      const boss = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.08), mat.helmet);
      boss.position.set(side * 0.28, 0.21, 0.13);
      helmet.add(boss);
    }

    head.add(helmet);
  }

  private addSafetyGoggles(head: THREE.Group, mat: Mats): void {
    const goggles = new THREE.Group();
    goggles.name = 'hero-safety-goggles';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.13, 5, 15), mat.glass);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(side * 0.125, 0.015, 0.378);
      lens.scale.set(1.05, 1, 0.23);
      goggles.add(lens);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.022), mat.dark);
      temple.position.set(side * 0.245, 0.02, 0.305);
      temple.rotation.y = side * 0.32;
      goggles.add(temple);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.024, 0.02), mat.dark);
    bridge.position.set(0, 0.015, 0.39);
    goggles.add(bridge);

    head.add(goggles);
  }

  private buildArm(side: -1 | 1, torso: THREE.Group, appearance: HeroAppearance, mat: Mats, width: number) {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'hero-shoulder-l' : 'hero-shoulder-r';
    shoulder.position.set(side * 0.39 * width, 0.55, 0);
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.105 * width, 0.22, 7, 16), mat.uniform);
    upper.name = side < 0 ? 'hero-upper-arm-l' : 'hero-upper-arm-r';
    upper.position.y = -0.17;
    upper.scale.z = 0.9;
    shoulder.add(upper);

    const sleeveStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * width, 0.11 * width, 0.035, 16), mat.reflective);
    sleeveStripe.position.y = -0.2;
    shoulder.add(sleeveStripe);

    const elbow = new THREE.Group();
    elbow.name = side < 0 ? 'hero-elbow-l' : 'hero-elbow-r';
    elbow.position.y = -0.36;
    shoulder.add(elbow);

    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.094 * width, 0.19, 7, 16), mat.uniform);
    lower.position.y = -0.145;
    lower.scale.z = 0.9;
    elbow.add(lower);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.115 * width, 18, 13), appearance.gloves ? mat.dark : mat.skin);
    hand.position.y = -0.31;
    hand.scale.set(0.9, 1.05, 0.86);
    elbow.add(hand);

    if (appearance.gloves) {
      for (const x of [-0.045, 0, 0.045]) {
        const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.018, 0.025), mat.steel);
        knuckle.position.set(x, -0.3, 0.09);
        elbow.add(knuckle);
      }
    }

    return { shoulder, elbow };
  }

  private buildLeg(side: -1 | 1, visual: THREE.Group, appearance: HeroAppearance, mat: Mats, width: number) {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'hero-hip-l' : 'hero-hip-r';
    hip.position.set(side * 0.2 * width, 1.02, 0);
    visual.add(hip);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.125 * width, 0.2, 7, 16), mat.pants);
    thigh.position.y = -0.17;
    thigh.scale.z = 0.94;
    hip.add(thigh);

    if (appearance.pantsStyle === 'cargo') {
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.055), mat.pants);
      pocket.position.set(side * 0.08, -0.15, 0.11);
      hip.add(pocket);
    }

    const knee = new THREE.Group();
    knee.name = side < 0 ? 'hero-knee-l' : 'hero-knee-r';
    knee.position.y = -0.35;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.108 * width, 0.18, 7, 16), mat.pants);
    shin.position.y = -0.145;
    shin.scale.z = 0.92;
    knee.add(shin);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.19 * width, 0.105, 0.055), mat.dark);
    kneePad.position.set(0, -0.01, 0.105);
    kneePad.rotation.x = -0.08;
    knee.add(kneePad);

    const reflective = new THREE.Mesh(new THREE.CylinderGeometry(0.113 * width, 0.113 * width, 0.035, 16), mat.reflective);
    reflective.position.y = -0.19;
    knee.add(reflective);

    const boot = new THREE.Group();
    boot.name = side < 0 ? 'hero-boot-l' : 'hero-boot-r';
    boot.position.set(0, -0.36, 0.045);
    knee.add(boot);

    const bootBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * width, 0.14, 7, 16), mat.boots);
    bootBody.rotation.x = Math.PI / 2;
    bootBody.position.set(0, 0.035, 0.075);
    bootBody.scale.set(1, 1, 0.95);
    boot.add(bootBody);

    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.135 * width, 18, 12), mat.boots);
    toe.position.set(0, 0.025, 0.18);
    toe.scale.set(1, 0.62, 1.2);
    boot.add(toe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.27 * width, 0.055, 0.34), mat.dark);
    sole.position.set(0, -0.065, 0.09);
    boot.add(sole);

    return { hip, knee };
  }

  private addScanner(elbow: THREE.Group, appearance: HeroAppearance, mat: Mats): THREE.Group {
    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.075), mat.dark);
    const screenMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.vest),
      emissive: new THREE.Color(appearance.vest),
      emissiveIntensity: 0.3,
      roughness: 0.24
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.01), screenMat);
    screen.position.set(0, 0.025, 0.043);
    scanner.add(body, screen);
    scanner.position.set(0, -0.28, 0.15);
    scanner.rotation.x = -0.34;
    elbow.add(scanner);
    return scanner;
  }
}
