import * as THREE from 'three';
import type { HeroAppearance, HeroBuild, HeroPpeStyle } from '../types';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface EngineerHeroAssetV2 {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

type HeroMaterialsV2 = {
  accent: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  reflective: THREE.MeshPhysicalMaterial;
  helmet: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshStandardMaterial;
  boots: THREE.MeshPhysicalMaterial;
};

/**
 * KayKit Adventurer → EI Engineer conversion.
 *
 * Design rule: each selected Adventurer remains the authored visible body.
 * We preserve its face/eyes and rig, remove fantasy accessories, then add a
 * compact industrial PPE kit that follows the same skeleton.
 */
export class EngineerHeroCharacterV2 {
  async load(appearance: HeroAppearance): Promise<EngineerHeroAssetV2> {
    const { scene, clips } = await RiggedCharacterLibrary.clone(appearance.base);
    const root = new THREE.Group();
    root.name = `V8_ENGINEER_${appearance.base.toUpperCase()}`;

    scene.name = `V8_ENGINEER_${appearance.base.toUpperCase()}_RIG`;
    scene.rotation.set(0, 0, 0);
    scene.scale.copy(this.buildScale(appearance.build));
    root.add(scene);

    const mat = this.materials(appearance);
    this.convertKayKitSurface(scene, appearance);
    this.addHairAccent(scene, appearance, mat);
    this.addIndustrialHelmet(scene, mat);
    if (appearance.glasses) this.addBlackSafetyGlasses(scene, mat);
    this.addIndustrialPpe(scene, appearance, mat);
    this.addWorkDetails(scene, appearance, mat);
    this.addScanner(scene, mat);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = `KayKit ${appearance.base} → EI Engineer`;
    root.userData.heroStyle = 'kaykit-engineer-v3';
    root.userData.usesKayKitFace = true;
    root.userData.extraEyes = false;
    root.userData.appearance = { ...appearance };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    // Keep authored proportions nearly intact; these are intentionally subtle.
    if (build === 'slim') return new THREE.Vector3(0.975, 1, 0.975);
    if (build === 'athletic') return new THREE.Vector3(1.025, 1, 1.015);
    return new THREE.Vector3(1, 1, 1);
  }

  private materials(appearance: HeroAppearance): HeroMaterialsV2 {
    const bootColor = appearance.bootStyle === 'yellow' ? 0x9e7324 : appearance.bootStyle === 'steel' ? 0x44545e : 0x11181d;
    return {
      accent: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.vest),
        roughness: 0.54,
        metalness: 0.01,
        clearcoat: 0.08,
        clearcoatRoughness: 0.62
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.66, metalness: 0.04 }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f4,
        roughness: 0.26,
        metalness: 0.05,
        clearcoat: 0.16,
        emissive: 0x6c8e99,
        emissiveIntensity: 0.02
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.30,
        metalness: 0.01,
        clearcoat: 0.34,
        clearcoatRoughness: 0.25
      }),
      hair: new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.84 }),
      boots: new THREE.MeshPhysicalMaterial({
        color: bootColor,
        roughness: 0.54,
        metalness: 0.05,
        clearcoat: 0.07,
        clearcoatRoughness: 0.58
      })
    };
  }

  private convertKayKitSurface(root: THREE.Object3D, appearance: HeroAppearance): void {
    const uniformColor = appearance.uniform === 'graphite' ? 0x465159 : appearance.uniform === 'teal' ? 0x2b7175 : 0x176383;
    const pantsColor = appearance.pantsStyle === 'graphite' ? 0x333b40 : appearance.pantsStyle === 'technical' ? 0x38545d : 0x40545a;
    const skinTint = new THREE.Color(appearance.skin).lerp(new THREE.Color(0xffffff), 0.30);

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();

      // Remove fantasy identity while keeping the authored body and face.
      if (
        name.includes('cape') ||
        name.includes('helmet') ||
        name.includes('visor') ||
        name.includes('quiver') ||
        name.includes('hood') ||
        name.includes('hat')
      ) {
        node.visible = false;
        return;
      }

      if (name.endsWith('_head') || name.includes('_head')) this.tintMappedMesh(node, skinTint, 0.68);
      else if (name.includes('leg')) this.tintMappedMesh(node, pantsColor, 0.76);
      else if (name.includes('arm') || name.includes('body')) this.tintMappedMesh(node, uniformColor, 0.68);
    });
  }

  private tintMappedMesh(mesh: THREE.Mesh, color: THREE.ColorRepresentation, roughness: number): void {
    const tint = new THREE.Color(color);
    const cloneMaterial = (source: THREE.Material): THREE.Material => {
      if (source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhysicalMaterial) {
        const next = source.clone();
        next.color.copy(tint);
        next.roughness = roughness;
        next.metalness = Math.min(next.metalness, 0.04);
        next.needsUpdate = true;
        return next;
      }
      return source.clone();
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
  }

  private addHairAccent(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    if (appearance.hairStyle === 'buzz') return;
    const head = root.getObjectByName('head');
    if (!head) return;

    const hair = new THREE.Group();
    hair.name = `EI_HAIR_${appearance.base.toUpperCase()}`;

    // Hair is deliberately subtle because the hardhat remains mandatory.
    for (const side of [-1, 1] as const) {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, appearance.hairStyle === 'wave' ? 0.105 : 0.065, 4, 8), mat.hair);
      lock.position.set(side * 0.43, 0.56, -0.005);
      lock.rotation.z = side * 0.10;
      hair.add(lock);
    }

    if (appearance.hairStyle === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.13, 4, 8), mat.hair);
      sweep.position.set(-0.14, 0.70, 0.27);
      sweep.rotation.z = -0.72;
      hair.add(sweep);
    } else if (appearance.hairStyle === 'wave') {
      for (const x of [-0.18, 0, 0.18]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 7), mat.hair);
        curl.position.set(x, 0.69 + Math.abs(x) * 0.05, 0.14);
        hair.add(curl);
      }
    }
    head.add(hair);
  }

  private addIndustrialHelmet(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const hardhat = new THREE.Group();
    hardhat.name = 'EI_ENGINEER_HARDHAT_V3';
    hardhat.userData.requiredPPE = true;

    // Lower, enveloping fit: the brim intentionally sits near the brow line.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.49, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.54),
      mat.helmet
    );
    shell.position.set(0, 0.70, -0.015);
    shell.scale.set(1.01, 0.76, 0.93);
    hardhat.add(shell);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.525, 0.035, 36), mat.helmet);
    brim.position.set(0, 0.625, 0.005);
    hardhat.add(brim);

    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.026, 0.115), mat.helmet);
    frontLip.position.set(0, 0.615, 0.435);
    hardhat.add(frontLip);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.035, 0.30), mat.helmet);
    ridge.position.set(0, 0.965, 0);
    hardhat.add(ridge);

    head.add(hardhat);
  }

  private addBlackSafetyGlasses(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const glasses = new THREE.Group();
    glasses.name = 'EI_BLACK_SAFETY_GLASSES';

    // No opaque lenses: only a black frame around the original KayKit eyes.
    for (const side of [-1, 1] as const) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 7, 28), mat.dark);
      rim.scale.set(1.20, 0.78, 1);
      rim.position.set(side * 0.145, 0.505, 0.555);
      glasses.add(rim);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.014), mat.dark);
      temple.position.set(side * 0.30, 0.515, 0.445);
      temple.rotation.y = side * 0.45;
      glasses.add(temple);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.014, 0.014), mat.dark);
    bridge.position.set(0, 0.515, 0.558);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addIndustrialPpe(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    const chest = root.getObjectByName('chest');
    const hips = root.getObjectByName('hips');
    if (!chest || !hips) return;

    const ppe = new THREE.Group();
    ppe.name = `EI_ENGINEER_PPE_V3_${appearance.ppeStyle.toUpperCase()}`;

    if (appearance.ppeStyle === 'vest') this.buildProfessionalVest(ppe, mat);
    else if (appearance.ppeStyle === 'harness') this.buildHarness(ppe, mat);

    this.addIdAndRadio(ppe, mat);
    chest.add(ppe);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.052, 0.42), mat.dark);
    belt.name = 'EI_ENGINEER_BELT_V3';
    belt.position.set(0, 0.085, 0.00);
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.060, 0.036), mat.reflective);
    buckle.position.set(0, 0.085, 0.228);
    hips.add(buckle);
  }

  private buildProfessionalVest(parent: THREE.Group, mat: HeroMaterialsV2): void {
    // A readable, squared safety vest: flat front panels, center opening and back panel.
    for (const side of [-1, 1] as const) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.43, 0.028), mat.accent);
      panel.position.set(side * 0.145, 0.005, 0.395);
      parent.add(panel);

      const upperBand = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.030, 0.012), mat.reflective);
      upperBand.position.set(side * 0.145, 0.045, 0.418);
      parent.add(upperBand);

      const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.030, 0.012), mat.reflective);
      lowerBand.position.set(side * 0.145, -0.125, 0.418);
      parent.add(lowerBand);

      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.060, 0.030), mat.accent);
      shoulder.position.set(side * 0.20, 0.245, 0.355);
      shoulder.rotation.z = side * 0.42;
      parent.add(shoulder);
    }

    const centerOpening = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.39, 0.035), mat.dark);
    centerOpening.position.set(0, 0.015, 0.416);
    parent.add(centerOpening);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.42, 0.028), mat.accent);
    back.position.set(0, 0.005, -0.385);
    parent.add(back);

    const backBand = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.032, 0.014), mat.reflective);
    backBand.position.set(0, -0.075, -0.405);
    parent.add(backBand);
  }

  private buildHarness(parent: THREE.Group, mat: HeroMaterialsV2): void {
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.44, 0.022), mat.accent);
      strap.position.set(side * 0.15, 0.020, 0.397);
      strap.rotation.z = side * 0.10;
      parent.add(strap);
    }
    const chestBand = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.036, 0.022), mat.reflective);
    chestBand.position.set(0, 0.035, 0.415);
    parent.add(chestBand);
    const waistBand = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.048, 0.024), mat.accent);
    waistBand.position.set(0, -0.180, 0.405);
    parent.add(waistBand);
  }

  private addIdAndRadio(parent: THREE.Group, mat: HeroMaterialsV2): void {
    const id = new THREE.Group();
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.110, 0.016), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.006), mat.accent);
    idMark.position.set(0, 0.028, 0.012);
    id.add(idBody, idMark);
    id.position.set(0.235, 0.105, 0.424);
    parent.add(id);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.115, 0.044), mat.dark);
    radio.position.set(-0.255, 0.105, 0.410);
    parent.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.072, 7), mat.dark);
    antenna.position.set(-0.255, 0.195, 0.410);
    parent.add(antenna);
  }

  private addWorkDetails(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    for (const side of ['l', 'r'] as const) {
      const hand = root.getObjectByName(`hand.${side}`);
      const foot = root.getObjectByName(`foot.${side}`);
      if (hand && appearance.gloves) {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.087, 14, 10), mat.dark);
        glove.scale.set(0.82, 0.92, 0.80);
        glove.position.set(0, 0.026, 0);
        hand.add(glove);
      }
      if (foot) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 9), mat.boots);
        toe.scale.set(1.0, 0.58, 1.18);
        toe.position.set(0, 0.076, 0.098);
        foot.add(toe);
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.027, 0.292), mat.dark);
        sole.position.set(0, 0.017, 0.075);
        foot.add(sole);
      }
    }
  }

  private addScanner(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const hand = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!hand) return;
    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.175, 0.068), mat.dark);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.070, 0.010), mat.accent);
    screen.position.set(0, 0.026, 0.039);
    scanner.add(body, screen);
    scanner.position.set(0, -0.112, 0.090);
    scanner.rotation.set(-0.35, 0.08, 0);
    scanner.visible = false;
    hand.add(scanner);
  }
}
