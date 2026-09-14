import * as THREE from 'three';
import { CharacterFactory, type CharacterModel, type CharacterRole } from '../visual/CharacterFactory';

export interface HeroStyle {
  name: string;
  role: CharacterRole;
  accent: number;
}

/**
 * High-detail stylized hero used by the V8 player controller.
 * It deliberately stays lightweight enough for WebGL while giving the main
 * character a substantially richer silhouette than ambient NPCs.
 */
export class HeroCharacter {
  private readonly factory = new CharacterFactory();

  create(style: HeroStyle): CharacterModel {
    const model = this.factory.create({
      name: style.name,
      role: style.role,
      accent: style.accent,
      skin: 0xd8a27e,
      hair: 0x352722,
      eye: 0x4b7184,
      hairStyle: 'side',
      helmet: true,
      glasses: true,
      vest: true,
      radio: true,
      tablet: true
    });

    this.addHeadDetail(model, style.accent);
    this.addPPE(model, style.accent);
    this.addUtilityGear(model, style.accent);
    this.addLegProtection(model);
    this.finish(model);
    return model;
  }

  private addHeadDetail(model: CharacterModel, accentColor: number): void {
    const skin = this.mat(0xd8a27e, 0.58, 0.0);
    const dark = this.mat(0x131a1e, 0.62, 0.12);
    const accent = this.physical(accentColor, 0.28, 0.08, 0.42);
    const reflective = new THREE.MeshStandardMaterial({
      color: 0xf0fafc,
      roughness: 0.24,
      metalness: 0.08,
      emissive: 0xbce9f3,
      emissiveIntensity: 0.12
    });

    // Jaw + chin create a less spherical, more authored facial silhouette.
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.225, 24, 16), skin);
    jaw.scale.set(0.93, 0.58, 0.88);
    jaw.position.set(0, -0.145, 0.025);
    model.rig.head.add(jaw);

    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), skin);
    chin.scale.set(1.12, 0.7, 0.92);
    chin.position.set(0, -0.235, 0.155);
    model.rig.head.add(chin);

    // Hard-hat reinforcement, side clips and rear adjustment dial.
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.278, 0.022, 8, 32, Math.PI), accent);
    crown.rotation.x = Math.PI / 2;
    crown.rotation.z = Math.PI;
    crown.position.set(0, 0.205, 0.015);
    model.rig.head.add(crown);

    for (const side of [-1, 1] as const) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.13, 0.105), dark);
      clip.position.set(side * 0.285, 0.11, -0.015);
      model.rig.head.add(clip);

      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.28, 0.025), dark);
      strap.position.set(side * 0.225, -0.09, 0.055);
      strap.rotation.z = side * 0.22;
      model.rig.head.add(strap);
    }

    const rearDial = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.035, 16), dark);
    rearDial.rotation.x = Math.PI / 2;
    rearDial.position.set(0, 0.08, -0.315);
    model.rig.head.add(rearDial);

    const frontMark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.018), reflective);
    frontMark.position.set(0, 0.265, 0.27);
    model.rig.head.add(frontMark);
  }

  private addPPE(model: CharacterModel, accentColor: number): void {
    const accent = this.physical(accentColor, 0.42, 0.06, 0.28);
    const reflective = new THREE.MeshStandardMaterial({
      color: 0xeaf7f8,
      roughness: 0.28,
      metalness: 0.1,
      emissive: 0x9bc9d3,
      emissiveIntensity: 0.09
    });
    const dark = this.mat(0x141c20, 0.68, 0.12);

    // Shoulder caps give the torso a stronger industrial hero silhouette.
    for (const [side, shoulder] of [[-1, model.rig.leftShoulder], [1, model.rig.rightShoulder]] as const) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10), accent);
      cap.scale.set(1.25, 0.58, 1.08);
      cap.position.set(0, 0.01, 0);
      shoulder.add(cap);

      const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.13), reflective);
      reflector.position.set(side * 0.01, 0.05, 0.085);
      shoulder.add(reflector);
    }

    // Harness straps and chest buckle.
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.78, 0.035), reflective);
      strap.position.set(side * 0.23, 0.36, 0.395);
      strap.rotation.z = side * -0.11;
      model.rig.torso.add(strap);
    }

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.055), dark);
    buckle.position.set(0, 0.29, 0.42);
    model.rig.torso.add(buckle);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.035, 8, 24, Math.PI), dark);
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = Math.PI;
    collar.position.set(0, 0.77, 0.02);
    model.rig.torso.add(collar);
  }

  private addUtilityGear(model: CharacterModel, accentColor: number): void {
    const dark = this.mat(0x11191e, 0.72, 0.12);
    const steel = this.mat(0x59676e, 0.38, 0.62);
    const accent = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.12,
      emissive: accentColor,
      emissiveIntensity: 0.05
    });

    // Compact technical backpack with rigid shell and safety stripe.
    const backpack = new THREE.Group();
    backpack.name = 'hero-technical-pack';
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.78, 0.25), dark);
    shell.position.set(0, 1.5, -0.34);
    shell.rotation.x = 0.05;
    backpack.add(shell);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.5, 0.035), accent);
    panel.position.set(0, 1.51, -0.48);
    backpack.add(panel);
    const topHandle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 18, Math.PI), steel);
    topHandle.rotation.x = Math.PI / 2;
    topHandle.position.set(0, 1.92, -0.33);
    backpack.add(topHandle);
    model.visual.add(backpack);

    // Tool belt: two pouches, carabiner and compact measuring tool.
    for (const side of [-1, 1] as const) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.27, 0.16), dark);
      pouch.position.set(side * 0.37, 1.05, 0.02);
      pouch.rotation.z = side * 0.04;
      model.visual.add(pouch);
    }

    const carabiner = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI * 1.55), steel);
    carabiner.position.set(0.31, 1.0, 0.13);
    carabiner.rotation.z = -0.25;
    model.visual.add(carabiner);

    const tool = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.07), steel);
    tool.position.set(-0.31, 0.96, 0.15);
    tool.rotation.z = 0.12;
    model.visual.add(tool);

    const wristDisplay = new THREE.Group();
    const watchBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.055), dark);
    const watchScreen = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.065, 0.012), accent);
    watchScreen.position.z = 0.034;
    wristDisplay.add(watchBody, watchScreen);
    wristDisplay.position.set(0, -0.34, 0.105);
    model.rig.leftElbow.add(wristDisplay);
  }

  private addLegProtection(model: CharacterModel): void {
    const pad = this.physical(0x27343b, 0.48, 0.28, 0.16);
    const steel = this.mat(0x66747b, 0.34, 0.68);

    for (const knee of [model.rig.leftKnee, model.rig.rightKnee]) {
      const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), pad);
      kneePad.scale.set(0.9, 0.72, 0.48);
      kneePad.position.set(0, 0.02, 0.13);
      knee.add(kneePad);

      const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.23), steel);
      toeCap.position.set(0, -0.57, 0.25);
      toeCap.rotation.x = -0.08;
      knee.add(toeCap);
    }
  }

  private finish(model: CharacterModel): void {
    model.visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    model.root.userData.heroQuality = true;
  }

  private mat(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  private physical(color: number, roughness: number, metalness: number, clearcoat: number): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: 0.28
    });
  }
}
