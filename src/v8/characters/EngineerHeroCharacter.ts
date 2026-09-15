import * as THREE from 'three';
import type { HeroAppearance, HeroBuild, HeroHairStyle, HeroPpeStyle, HeroTopStyle } from '../types';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface EngineerHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

type HeroMaterials = {
  skin: THREE.MeshPhysicalMaterial;
  uniform: THREE.MeshPhysicalMaterial;
  pants: THREE.MeshPhysicalMaterial;
  boots: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  reflective: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  helmet: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
};

/**
 * Canonical V8 player character.
 *
 * The KayKit Adventurers Knight remains the visible body and therefore keeps
 * the package's proportions, skinning and animation quality. Only explicitly
 * medieval pieces are removed. Industrial PPE, helmet, glasses and work tools
 * are mounted on the same Rig_Medium skeleton.
 */
export class EngineerHeroCharacter {
  async load(appearance: HeroAppearance): Promise<EngineerHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();
    const root = new THREE.Group();
    root.name = 'V8_ENGINEER_HERO';

    scene.name = 'V8_ENGINEER_HERO_RIG';
    scene.rotation.set(0, 0, 0);
    scene.scale.copy(this.buildScale(appearance.build));
    root.add(scene);

    const mat = this.materials(appearance);
    this.convertAdventurer(scene, appearance, mat);
    this.addFaceAndHair(scene, appearance, mat);
    this.addIndustrialHelmet(scene, mat);
    if (appearance.glasses) this.addSafetyGlasses(scene, mat);
    this.addIndustrialPpe(scene, appearance, mat);
    this.addHandsAndBoots(scene, appearance, mat);
    this.addScanner(scene, mat);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = 'KayKit Adventurer → EI Engineer';
    root.userData.heroStyle = 'kaykit-engineer';
    root.userData.appearance = { ...appearance };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.94, 0.98, 0.94);
    if (build === 'athletic') return new THREE.Vector3(1.07, 1.015, 1.04);
    return new THREE.Vector3(1, 1, 1);
  }

  private materials(appearance: HeroAppearance): HeroMaterials {
    const uniformColor = appearance.uniform === 'graphite' ? 0x35424a : appearance.uniform === 'teal' ? 0x1b6a70 : 0x155b78;
    const pantsColor = appearance.pantsStyle === 'graphite' ? 0x222a30 : appearance.pantsStyle === 'technical' ? 0x2a4650 : 0x30464d;
    const bootColor = appearance.bootStyle === 'yellow' ? 0xa87a21 : appearance.bootStyle === 'steel' ? 0x46545c : 0x11171b;

    return {
      skin: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.skin),
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.035,
        clearcoatRoughness: 0.82
      }),
      uniform: new THREE.MeshPhysicalMaterial({
        color: uniformColor,
        roughness: appearance.topStyle === 'coverall' ? 0.61 : 0.55,
        metalness: 0.01,
        clearcoat: 0.06,
        clearcoatRoughness: 0.66
      }),
      pants: new THREE.MeshPhysicalMaterial({ color: pantsColor, roughness: 0.7, metalness: 0.015, clearcoat: 0.025 }),
      boots: new THREE.MeshPhysicalMaterial({ color: bootColor, roughness: 0.49, metalness: 0.08, clearcoat: 0.16, clearcoatRoughness: 0.48 }),
      accent: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.vest),
        roughness: 0.38,
        metalness: 0.015,
        clearcoat: 0.24,
        clearcoatRoughness: 0.34
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.68, metalness: 0.08 }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xeaf3f5,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.26,
        emissive: 0x789cab,
        emissiveIntensity: 0.035
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xc7e9f3,
        transparent: true,
        opacity: 0.32,
        transmission: 0.18,
        thickness: 0.02,
        roughness: 0.055,
        clearcoat: 0.55
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.28,
        metalness: 0.015,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2
      }),
      hair: new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.78 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x18222a, roughness: 0.52, metalness: 0.01 })
    };
  }

  private convertAdventurer(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();

      if (name.includes('cape') || name.includes('helmetvisor') || name === 'knight_helmet') {
        node.visible = false;
        return;
      }

      // Keep the actual Adventurers geometry. Only its surface language changes.
      if (name === 'knight_head') node.material = mat.skin;
      else if (name.includes('leg')) node.material = mat.pants;
      else if (name.includes('arm') || name.includes('body')) node.material = mat.uniform;
    });

    const chest = root.getObjectByName('chest');
    if (!chest) return;

    if (appearance.topStyle === 'workshirt') {
      for (const side of [-1, 1] as const) {
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.035), mat.dark);
        collar.position.set(side * 0.115, 0.20, 0.355);
        collar.rotation.z = side * 0.38;
        chest.add(collar);
      }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.024), mat.accent);
      pocket.position.set(0.20, 0.02, 0.39);
      chest.add(pocket);
    } else if (appearance.topStyle === 'polo') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 22), mat.dark);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.19, 0.08);
      chest.add(collar);
    } else {
      const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.49, 0.024), mat.reflective);
      zipper.position.set(0, -0.035, 0.395);
      chest.add(zipper);
    }
  }

  private addFaceAndHair(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const head = root.getObjectByName('head');
    if (!head) throw new Error('Engineer hero rig is missing head bone.');

    // Rig_Medium head bone is at the base of the head. These values are derived
    // from the original Knight mesh bounds, so face equipment follows animation.
    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.075, 5, 12), mat.eye);
      eye.name = side < 0 ? 'EI_ENGINEER_EYE_L' : 'EI_ENGINEER_EYE_R';
      eye.position.set(side * 0.155, 0.50, 0.505);
      eye.scale.z = 0.34;
      head.add(eye);
    }

    const hair = new THREE.Group();
    hair.name = `EI_ENGINEER_HAIR_${appearance.hairStyle.toUpperCase()}`;

    if (appearance.hairStyle !== 'buzz') {
      for (const side of [-1, 1] as const) {
        const temple = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, appearance.hairStyle === 'wave' ? 0.17 : 0.11, 4, 10), mat.hair);
        temple.position.set(side * 0.43, 0.57, 0.02);
        temple.rotation.z = side * 0.12;
        hair.add(temple);
      }
    }

    if (appearance.hairStyle === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 10), mat.hair);
      sweep.position.set(-0.16, 0.73, 0.31);
      sweep.rotation.z = -0.78;
      hair.add(sweep);
    } else if (appearance.hairStyle === 'short') {
      for (const x of [-0.17, -0.06, 0.06, 0.17]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.105, 7), mat.hair);
        tuft.position.set(x, 0.79, 0.16);
        tuft.rotation.z = -x * 0.65;
        hair.add(tuft);
      }
    } else if (appearance.hairStyle === 'wave') {
      for (const x of [-0.28, -0.12, 0.12, 0.28]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.075, 11, 8), mat.hair);
        curl.position.set(x, 0.72 + Math.abs(x) * 0.08, 0.10);
        hair.add(curl);
      }
    }

    head.add(hair);
  }

  private addIndustrialHelmet(root: THREE.Object3D, mat: HeroMaterials): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const hardhat = new THREE.Group();
    hardhat.name = 'EI_ENGINEER_HARDHAT';
    hardhat.userData.requiredPPE = true;

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.59, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.51),
      mat.helmet
    );
    shell.position.set(0, 0.77, 0.005);
    shell.scale.z = 0.94;
    hardhat.add(shell);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.615, 0.64, 0.052, 36), mat.helmet);
    brim.position.set(0, 0.605, 0.025);
    hardhat.add(brim);

    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.16), mat.helmet);
    frontLip.position.set(0, 0.60, 0.50);
    hardhat.add(frontLip);

    for (const x of [-0.20, 0, 0.20]) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 0.62), mat.helmet);
      ridge.position.set(x, 1.02 - Math.abs(x) * 0.16, 0.00);
      ridge.rotation.z = x * -0.22;
      hardhat.add(ridge);
    }

    for (const side of [-1, 1] as const) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.07), mat.helmet);
      clip.position.set(side * 0.49, 0.77, 0.12);
      hardhat.add(clip);
    }

    head.add(hardhat);
  }

  private addSafetyGlasses(root: THREE.Object3D, mat: HeroMaterials): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const glasses = new THREE.Group();
    glasses.name = 'EI_ENGINEER_SAFETY_GLASSES';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.145, 22, 14), mat.glass);
      lens.scale.set(1.08, 0.68, 0.16);
      lens.position.set(side * 0.17, 0.505, 0.525);
      glasses.add(lens);

      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.016, 8, 28), mat.dark);
      frame.scale.y = 0.72;
      frame.position.set(side * 0.17, 0.505, 0.55);
      glasses.add(frame);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.018, 0.018), mat.dark);
      arm.position.set(side * 0.31, 0.51, 0.40);
      arm.rotation.y = side * 0.43;
      glasses.add(arm);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.02), mat.dark);
    bridge.position.set(0, 0.505, 0.555);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addIndustrialPpe(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const chest = root.getObjectByName('chest');
    const hips = root.getObjectByName('hips');
    if (!chest || !hips) return;

    const ppe = new THREE.Group();
    ppe.name = `EI_ENGINEER_PPE_${appearance.ppeStyle.toUpperCase()}`;

    if (appearance.ppeStyle !== 'id-only') {
      const panelRadius = appearance.ppeStyle === 'vest' ? 0.082 : 0.068;
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(panelRadius, 0.35, 6, 14), mat.accent);
        panel.position.set(side * 0.18, 0.015, 0.405);
        panel.scale.z = 0.42;
        ppe.add(panel);

        const band = new THREE.Mesh(new THREE.BoxGeometry(panelRadius * 2.1, 0.038, 0.042), mat.reflective);
        band.position.set(side * 0.18, -0.11, 0.432);
        ppe.add(band);
      }

      const waistBand = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.045), mat.reflective);
      waistBand.position.set(0, -0.18, 0.425);
      ppe.add(waistBand);
    }

    for (const side of [-1, 1] as const) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.055, 0.035), mat.dark);
      shoulder.position.set(side * 0.20, 0.235, 0.36);
      shoulder.rotation.z = side * 0.42;
      ppe.add(shoulder);
    }

    const id = new THREE.Group();
    id.name = 'EI_ENGINEER_ID';
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.025), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.008), mat.accent);
    idMark.position.set(0, 0.045, 0.018);
    id.add(idBody, idMark);
    id.position.set(0.27, 0.11, 0.415);
    ppe.add(id);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.20, 0.07), mat.dark);
    radio.position.set(-0.29, 0.12, 0.39);
    ppe.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), mat.dark);
    antenna.position.set(-0.29, 0.27, 0.39);
    ppe.add(antenna);

    chest.add(ppe);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.085, 0.50), mat.dark);
    belt.name = 'EI_ENGINEER_BELT';
    belt.position.set(0, 0.08, 0.01);
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.055), mat.reflective);
    buckle.position.set(0, 0.08, 0.275);
    hips.add(buckle);
  }

  private addHandsAndBoots(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    for (const side of ['l', 'r'] as const) {
      const hand = root.getObjectByName(`hand.${side}`);
      const foot = root.getObjectByName(`foot.${side}`);
      const lowerArm = root.getObjectByName(`lowerarm.${side}`);
      if (hand && appearance.gloves) {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat.dark);
        glove.scale.set(0.9, 1.0, 0.88);
        glove.position.set(0, 0.03, 0);
        hand.add(glove);
      }

      if (lowerArm) {
        const armBand = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 18), mat.reflective);
        armBand.position.y = 0.14;
        lowerArm.add(armBand);
      }

      if (foot) {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.15, 0.36), mat.boots);
        boot.position.set(0, 0.07, 0.09);
        boot.rotation.x = -0.08;
        foot.add(boot);

        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.045, 0.39), mat.dark);
        sole.position.set(0, 0.015, 0.09);
        foot.add(sole);
      }
    }
  }

  private addScanner(root: THREE.Object3D, mat: HeroMaterials): void {
    const hand = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!hand) return;

    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.085), mat.dark);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.012), mat.accent);
    screen.position.set(0, 0.035, 0.049);
    scanner.add(body, screen);
    scanner.position.set(0, -0.13, 0.10);
    scanner.rotation.set(-0.35, 0.08, 0);
    scanner.visible = false;
    hand.add(scanner);
  }
}
