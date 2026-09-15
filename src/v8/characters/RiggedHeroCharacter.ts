import * as THREE from 'three';
import type {
  HeroAppearance,
  HeroBootStyle,
  HeroBuild,
  HeroHairStyle,
  HeroPantsStyle,
  HeroPpeStyle,
  HeroTopStyle,
  HeroUniform
} from '../types';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface RiggedHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

type HeroPalette = {
  uniform: number;
  pants: number;
  boots: number;
};

type HeroMaterials = {
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
  eye: THREE.MeshPhysicalMaterial;
};

/**
 * Market-ready V8 hero direction.
 *
 * The KayKit asset is used only as a proven animation skeleton. Every original
 * visible medieval mesh is hidden and the playable character is rebuilt on top
 * of the bones as one coherent chibi industrial avatar. This prevents the old
 * "mixed asset" look and makes the character creator genuinely modular.
 */
export class RiggedHeroCharacter {
  async load(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();

    const root = new THREE.Group();
    root.name = 'V8_PREMIUM_CHIBI_HERO';

    scene.name = 'V8_PREMIUM_CHIBI_SKELETON';
    scene.rotation.set(0, 0, 0);
    scene.scale.setScalar(0.94);
    root.add(scene);

    this.hideAllSourceMeshes(scene);
    const materials = this.materials(appearance);
    this.buildBody(scene, appearance, materials);
    this.buildHead(scene, appearance, materials);
    this.buildWardrobe(scene, appearance, materials);
    this.buildEquipment(scene, appearance, materials);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = 'EI Premium Chibi Industrial Hero';
    root.userData.heroStyle = 'premium-chibi-industrial';
    root.userData.appearance = { ...appearance };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private hideAllSourceMeshes(root: THREE.Object3D): void {
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.visible = false;
    });
  }

  private find(root: THREE.Object3D, ...names: string[]): THREE.Object3D | null {
    const wanted = new Set(names.map((name) => name.toLowerCase()));
    let found: THREE.Object3D | null = null;
    root.traverse((node) => {
      if (!found && wanted.has(node.name.toLowerCase())) found = node;
    });
    return found;
  }

  private palette(uniform: HeroUniform, pantsStyle: HeroPantsStyle, bootStyle: HeroBootStyle): HeroPalette {
    // Navy intentionally leans teal-blue: this is the EI hero's canonical look.
    const uniformColor = uniform === 'graphite' ? 0x34434c : uniform === 'teal' ? 0x17656b : 0x155a70;
    const pants = pantsStyle === 'cargo' ? 0x2a5057 : pantsStyle === 'graphite' ? 0x252d33 : 0x24535a;
    const boots = bootStyle === 'yellow' ? 0xb78625 : bootStyle === 'steel' ? 0x465963 : 0x11171b;
    return { uniform: uniformColor, pants, boots };
  }

  private materials(appearance: HeroAppearance): HeroMaterials {
    const palette = this.palette(appearance.uniform, appearance.pantsStyle, appearance.bootStyle);
    const accentColor = new THREE.Color(appearance.vest).getHex();

    return {
      skin: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.skin),
        roughness: 0.58,
        metalness: 0,
        clearcoat: 0.06,
        clearcoatRoughness: 0.72
      }),
      hair: new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.8 }),
      uniform: new THREE.MeshPhysicalMaterial({
        color: palette.uniform,
        roughness: 0.56,
        metalness: 0.018,
        clearcoat: 0.11,
        clearcoatRoughness: 0.52
      }),
      pants: new THREE.MeshPhysicalMaterial({
        color: palette.pants,
        roughness: 0.66,
        metalness: 0.025,
        clearcoat: 0.06
      }),
      boots: new THREE.MeshPhysicalMaterial({
        color: palette.boots,
        roughness: 0.48,
        metalness: 0.1,
        clearcoat: 0.14,
        clearcoatRoughness: 0.5
      }),
      accent: new THREE.MeshPhysicalMaterial({
        color: accentColor,
        roughness: 0.36,
        metalness: 0.025,
        clearcoat: 0.28,
        clearcoatRoughness: 0.34
      }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xe7eef0,
        roughness: 0.23,
        metalness: 0.12,
        clearcoat: 0.4,
        emissive: 0x6d8992,
        emissiveIntensity: 0.035
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x10171b, roughness: 0.62, metalness: 0.09 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xb8dce8,
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        opacity: 0.32,
        transmission: 0.36,
        thickness: 0.025,
        clearcoat: 0.65,
        clearcoatRoughness: 0.12,
        depthWrite: false
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.25,
        metalness: 0.015,
        clearcoat: 0.62,
        clearcoatRoughness: 0.18
      }),
      eye: new THREE.MeshPhysicalMaterial({
        color: 0x26323a,
        roughness: 0.25,
        metalness: 0,
        clearcoat: 0.38,
        clearcoatRoughness: 0.16
      })
    };
  }

  private width(build: HeroBuild): number {
    if (build === 'slim') return 0.9;
    if (build === 'athletic') return 1.1;
    return 1;
  }

  private capsuleOnBone(
    bone: THREE.Object3D,
    name: string,
    span: number,
    radius: number,
    material: THREE.Material,
    scaleZ = 1
  ): THREE.Mesh {
    const length = Math.max(0.018, span - radius * 2);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 7, 14), material);
    mesh.name = name;
    mesh.position.y = span * 0.5;
    mesh.scale.z = scaleZ;
    bone.add(mesh);
    return mesh;
  }

  private buildBody(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const width = this.width(appearance.build);
    const spine = this.find(root, 'spine');
    const hips = this.find(root, 'hips');
    const chest = this.find(root, 'chest');
    if (!spine || !hips || !chest) throw new Error('Hero rig is missing torso bones.');

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.275 * width, 0.22, 8, 18), mat.uniform);
    torso.name = 'EI_HERO_TORSO';
    torso.position.set(0, 0.17, 0);
    torso.scale.z = 0.78;
    spine.add(torso);

    const waist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * width, 0.285 * width, 0.19, 18),
      mat.pants
    );
    waist.name = 'EI_HERO_WAIST';
    waist.position.y = 0.105;
    hips.add(waist);

    const upperArmL = this.find(root, 'upperarm.l');
    const upperArmR = this.find(root, 'upperarm.r');
    const lowerArmL = this.find(root, 'lowerarm.l');
    const lowerArmR = this.find(root, 'lowerarm.r');
    const handL = this.find(root, 'hand.l');
    const handR = this.find(root, 'hand.r');

    for (const [side, upper, lower, hand] of [
      ['l', upperArmL, lowerArmL, handL],
      ['r', upperArmR, lowerArmR, handR]
    ] as const) {
      if (!upper || !lower || !hand) continue;
      this.capsuleOnBone(upper, `EI_UPPER_ARM_${side}`, 0.238, 0.105 * width, mat.uniform, 0.92);
      this.capsuleOnBone(lower, `EI_LOWER_ARM_${side}`, 0.255, 0.094 * width, mat.uniform, 0.9);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.108 * width, 0.108 * width, 0.038, 16),
        mat.reflective
      );
      band.name = `EI_ARM_REFLECTIVE_${side}`;
      band.position.y = 0.15;
      lower.add(band);

      const handMaterial = appearance.gloves ? mat.dark : mat.skin;
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.115 * width, 16, 12), handMaterial);
      glove.name = `EI_HAND_${side}`;
      glove.position.y = 0.035;
      glove.scale.set(0.9, 1.05, 0.86);
      hand.add(glove);
    }

    const upperLegL = this.find(root, 'upperleg.l');
    const upperLegR = this.find(root, 'upperleg.r');
    const lowerLegL = this.find(root, 'lowerleg.l');
    const lowerLegR = this.find(root, 'lowerleg.r');
    const footL = this.find(root, 'foot.l');
    const footR = this.find(root, 'foot.r');

    for (const [side, upper, lower, foot] of [
      ['l', upperLegL, lowerLegL, footL],
      ['r', upperLegR, lowerLegR, footR]
    ] as const) {
      if (!upper || !lower || !foot) continue;
      this.capsuleOnBone(upper, `EI_THIGH_${side}`, 0.225, 0.122 * width, mat.pants, 0.94);
      this.capsuleOnBone(lower, `EI_SHIN_${side}`, 0.148, 0.105 * width, mat.pants, 0.92);

      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.19 * width, 0.1, 0.055), mat.dark);
      knee.name = `EI_KNEE_PAD_${side}`;
      knee.position.set(0, 0.022, 0.095);
      knee.rotation.x = -0.08;
      lower.add(knee);

      const legBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.111 * width, 0.111 * width, 0.034, 16),
        mat.reflective
      );
      legBand.name = `EI_LEG_REFLECTIVE_${side}`;
      legBand.position.y = 0.095;
      lower.add(legBand);

      this.capsuleOnBone(foot, `EI_BOOT_${side}`, 0.19, 0.118 * width, mat.boots, 1.08);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.25 * width, 0.06, 0.25), mat.dark);
      sole.name = `EI_BOOT_SOLE_${side}`;
      sole.position.set(0, 0.085, -0.018);
      foot.add(sole);
    }
  }

  private buildHead(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const head = this.find(root, 'head');
    if (!head) throw new Error('Hero rig is missing head bone.');

    const headGroup = new THREE.Group();
    headGroup.name = 'EI_HERO_HEAD';
    head.add(headGroup);

    // The KayKit head bone starts at the neck. The visual skull must be raised.
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.33, 32, 22), mat.skin);
    skull.name = 'EI_HERO_SKULL';
    skull.position.set(0, 0.31, 0.005);
    skull.scale.set(0.98, 0.94, 0.94);
    headGroup.add(skull);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), mat.skin);
      ear.name = side < 0 ? 'EI_EAR_L' : 'EI_EAR_R';
      ear.position.set(side * 0.314, 0.31, 0.002);
      ear.scale.set(0.68, 1, 0.72);
      headGroup.add(ear);

      const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.055, 5, 12), mat.eye);
      eye.name = side < 0 ? 'EI_EYE_L' : 'EI_EYE_R';
      eye.position.set(side * 0.115, 0.33, 0.302);
      eye.scale.z = 0.42;
      headGroup.add(eye);
    }

    this.addHair(headGroup, appearance.hairStyle, mat.hair);
    this.addHelmet(headGroup, mat.helmet, mat.accent, mat.reflective);
    if (appearance.glasses) this.addSafetyGlasses(headGroup, mat.glass, mat.dark);
  }

  private addHair(head: THREE.Object3D, style: HeroHairStyle, material: THREE.Material): void {
    const group = new THREE.Group();
    group.name = `EI_HAIR_${style.toUpperCase()}`;

    // Hair is intentionally concentrated at the temples/back: the hardhat must
    // read as protective equipment sitting over hair, not as the character's head.
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.305, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), material);
    back.position.set(0, 0.42, -0.04);
    back.scale.set(1, style === 'buzz' ? 0.44 : 0.68, 0.98);
    group.add(back);

    if (style !== 'buzz') {
      for (const side of [-1, 1] as const) {
        const temple = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, style === 'wave' ? 0.13 : 0.09, 4, 9), material);
        temple.position.set(side * 0.255, 0.37, -0.005);
        temple.rotation.z = side * 0.12;
        group.add(temple);
      }
    }

    if (style === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 4, 10), material);
      sweep.position.set(-0.11, 0.48, 0.17);
      sweep.rotation.z = -0.78;
      group.add(sweep);
    } else if (style === 'short') {
      for (const x of [-0.12, -0.04, 0.04, 0.12]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.085, 7), material);
        tuft.position.set(x, 0.54, 0.08);
        tuft.rotation.z = -x * 0.8;
        group.add(tuft);
      }
    } else if (style === 'wave') {
      for (const x of [-0.18, -0.07, 0.07, 0.18]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), material);
        curl.position.set(x, 0.48, 0.09);
        group.add(curl);
      }
    }

    head.add(group);
  }

  private addHelmet(
    head: THREE.Object3D,
    helmetMaterial: THREE.Material,
    accent: THREE.Material,
    reflective: THREE.Material
  ): void {
    const hardhat = new THREE.Group();
    hardhat.name = 'EI_HARDHAT_MANDATORY';
    hardhat.userData.requiredPPE = true;

    // Brim sits above the eyes. This is the key proportion correction.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.355, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      helmetMaterial
    );
    shell.name = 'EI_HARDHAT_SHELL';
    shell.position.set(0, 0.53, 0);
    shell.scale.set(1.02, 0.96, 0.99);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.375, 0.036, 32), helmetMaterial);
    brim.name = 'EI_HARDHAT_BRIM';
    brim.position.set(0, 0.515, 0.015);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.43), helmetMaterial);
    ridge.name = 'EI_HARDHAT_RIDGE';
    ridge.position.set(0, 0.79, 0.005);
    ridge.rotation.x = -0.03;

    for (const side of [-1, 1] as const) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.08), helmetMaterial);
      lug.name = side < 0 ? 'EI_HARDHAT_LUG_L' : 'EI_HARDHAT_LUG_R';
      lug.position.set(side * 0.302, 0.57, 0.015);
      hardhat.add(lug);
    }

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.042, 0.015), accent);
    badge.position.set(0, 0.63, 0.306);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.01), reflective);
    stripe.position.set(0, 0.596, 0.313);

    hardhat.add(shell, brim, ridge, badge, stripe);
    head.add(hardhat);
  }

  private addSafetyGlasses(head: THREE.Object3D, glass: THREE.Material, dark: THREE.Material): void {
    const glasses = new THREE.Group();
    glasses.name = 'EI_SAFETY_GLASSES';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 12), glass);
      lens.name = side < 0 ? 'EI_LENS_L' : 'EI_LENS_R';
      lens.scale.set(1.05, 0.62, 0.15);
      lens.position.set(side * 0.118, 0.34, 0.309);
      glasses.add(lens);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 24), dark);
      rim.name = side < 0 ? 'EI_GLASSES_RIM_L' : 'EI_GLASSES_RIM_R';
      rim.scale.set(1.12, 0.72, 1);
      rim.position.set(side * 0.118, 0.34, 0.324);
      glasses.add(rim);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.018), dark);
      arm.position.set(side * 0.235, 0.35, 0.18);
      arm.rotation.y = side * 0.38;
      glasses.add(arm);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.018), dark);
    bridge.position.set(0, 0.34, 0.329);
    glasses.add(bridge);
    head.add(glasses);
  }

  private buildWardrobe(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const chest = this.find(root, 'chest');
    const hips = this.find(root, 'hips');
    const upperLegL = this.find(root, 'upperleg.l');
    const upperLegR = this.find(root, 'upperleg.r');
    if (!chest || !hips) return;

    this.addTopDetails(chest, appearance.topStyle, mat);
    this.addPpe(chest, appearance.ppeStyle, mat);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * this.width(appearance.build), 0.3 * this.width(appearance.build), 0.065, 18), mat.dark);
    belt.name = 'EI_UTILITY_BELT';
    belt.position.y = 0.17;
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.035), mat.dark);
    buckle.name = 'EI_BELT_BUCKLE';
    buckle.position.set(0, 0.17, 0.285);
    hips.add(buckle);

    for (const [side, upper] of [
      [-1, upperLegL],
      [1, upperLegR]
    ] as const) {
      if (!upper) continue;
      if (appearance.pantsStyle === 'cargo') {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.045), mat.pants);
        pocket.name = side < 0 ? 'EI_CARGO_POCKET_L' : 'EI_CARGO_POCKET_R';
        pocket.position.set(side * 0.07, 0.105, 0.11);
        upper.add(pocket);
      }
    }
  }

  private addTopDetails(chest: THREE.Object3D, style: HeroTopStyle, mat: HeroMaterials): void {
    const group = new THREE.Group();
    group.name = `EI_TOP_${style.toUpperCase()}`;

    if (style === 'coverall') {
      const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.42, 0.018), mat.dark);
      zipper.position.set(0, -0.12, 0.27);
      group.add(zipper);
      for (const side of [-1, 1] as const) {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.105, 0.025), mat.uniform);
        pocket.position.set(side * 0.16, -0.02, 0.276);
        group.add(pocket);
      }
    } else if (style === 'polo') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 20), mat.dark);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.07, 0.02);
      group.add(collar);
    } else {
      for (const side of [-1, 1] as const) {
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.025), mat.dark);
        collar.position.set(side * 0.095, 0.075, 0.275);
        collar.rotation.z = side * 0.34;
        group.add(collar);
      }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.025), mat.uniform);
      pocket.position.set(0.15, -0.02, 0.278);
      group.add(pocket);
    }

    chest.add(group);
  }

  private addPpe(chest: THREE.Object3D, style: HeroPpeStyle, mat: HeroMaterials): void {
    const ppe = new THREE.Group();
    ppe.name = `EI_PPE_${style.toUpperCase()}`;

    if (style === 'id-only') {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.025), mat.dark);
      clip.position.set(0.18, 0.02, 0.295);
      ppe.add(clip);
    } else if (style === 'vest') {
      // Broad vest alternative: still split in the center so the torso remains readable.
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 5, 12), mat.accent);
        panel.name = side < 0 ? 'EI_VEST_PANEL_L' : 'EI_VEST_PANEL_R';
        panel.position.set(side * 0.155, -0.11, 0.29);
        panel.scale.z = 0.32;
        ppe.add(panel);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.035, 0.025), mat.reflective);
        stripe.position.set(side * 0.155, -0.24, 0.315);
        ppe.add(stripe);
      }
    } else {
      // Canonical look from the approved concept: two padded blue vertical straps.
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.34, 6, 14), mat.accent);
        panel.name = side < 0 ? 'EI_HARNESS_PAD_L' : 'EI_HARNESS_PAD_R';
        panel.position.set(side * 0.155, -0.105, 0.29);
        panel.scale.z = 0.35;
        ppe.add(panel);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.025), mat.reflective);
        stripe.position.set(side * 0.155, -0.235, 0.315);
        ppe.add(stripe);
      }
    }

    const chestStrap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.025), mat.dark);
    chestStrap.position.set(0, -0.04, 0.31);
    ppe.add(chestStrap);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.04), mat.dark);
    radio.name = 'EI_CHEST_RADIO';
    radio.position.set(-0.235, 0.0, 0.305);
    ppe.add(radio);

    const id = new THREE.Group();
    id.name = 'EI_ID_MODULE';
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.135, 0.028), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.023, 0.008), mat.accent);
    idMark.position.set(0, 0.035, 0.018);
    id.add(idBody, idMark);
    id.position.set(0.235, -0.005, 0.31);
    ppe.add(id);

    chest.add(ppe);
  }

  private buildEquipment(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterials): void {
    const handR = this.find(root, 'handslot.r', 'hand.r');
    if (!handR) return;

    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.075), mat.dark);
    const screenMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.vest),
      emissive: new THREE.Color(appearance.vest),
      emissiveIntensity: 0.3,
      roughness: 0.22
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.085, 0.009), screenMat);
    screen.position.set(0, 0.03, 0.043);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.027, 0.009), mat.glass);
    lens.position.set(0, -0.055, 0.043);
    scanner.add(body, screen, lens);
    scanner.position.set(0, -0.11, 0.105);
    scanner.rotation.set(-0.32, 0.08, 0);
    handR.add(scanner);
  }
}
