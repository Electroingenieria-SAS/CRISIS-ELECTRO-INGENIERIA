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
  shirt: number;
  pants: number;
  boots: number;
};

/**
 * V8 hero direction: compact stylized/chibi industrial character.
 * KayKit is used only as the proven humanoid skeleton + animation carrier.
 * Medieval identity meshes are hidden and the visible identity is rebuilt as
 * a coherent EI worker: blank readable head, mandatory hardhat, optional
 * safety glasses, fitted wardrobe details and modular PPE.
 */
export class RiggedHeroCharacter {
  async load(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();

    const root = new THREE.Group();
    root.name = 'V8_CHIBI_HERO';

    scene.name = 'V8_CHIBI_HERO_SKELETON';
    scene.rotation.set(0, 0, 0);
    scene.scale.copy(this.buildScale(appearance.build));
    root.add(scene);

    this.hideMedievalIdentity(scene);
    this.applyWardrobeMaterials(scene, appearance);
    this.addChibiIdentity(scene, appearance);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = 'EI Chibi Modular Hero';
    root.userData.heroStyle = 'chibi-industrial';
    root.userData.appearance = { ...appearance };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.84, 0.91, 0.87);
    if (build === 'athletic') return new THREE.Vector3(0.98, 0.94, 0.98);
    return new THREE.Vector3(0.91, 0.92, 0.92);
  }

  private palette(uniform: HeroUniform, pantsStyle: HeroPantsStyle, bootStyle: HeroBootStyle): HeroPalette {
    const shirt = uniform === 'graphite' ? 0x34434c : uniform === 'teal' ? 0x245e62 : 0x175078;
    const pants = pantsStyle === 'cargo' ? 0x35464e : pantsStyle === 'graphite' ? 0x20282e : 0x293a43;
    const boots = bootStyle === 'yellow' ? 0xb78527 : bootStyle === 'steel' ? 0x4b5d67 : 0x11191e;
    return { shirt, pants, boots };
  }

  private hideMedievalIdentity(root: THREE.Object3D): void {
    root.traverse((node) => {
      const name = node.name.toLowerCase();
      if (
        name.includes('cape') ||
        name.includes('helmetvisor') ||
        name === 'knight_helmet' ||
        name === 'knight_head' ||
        name.includes('sword') ||
        name.includes('shield') ||
        name.includes('weapon')
      ) {
        node.visible = false;
      }
    });
  }

  private applyWardrobeMaterials(root: THREE.Object3D, appearance: HeroAppearance): void {
    const colors = this.palette(appearance.uniform, appearance.pantsStyle, appearance.bootStyle);
    const skin = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.skin),
      roughness: 0.66,
      metalness: 0,
      clearcoat: 0.04
    });
    const shirt = new THREE.MeshPhysicalMaterial({
      color: colors.shirt,
      roughness: 0.58,
      metalness: 0.025,
      clearcoat: 0.1,
      clearcoatRoughness: 0.5
    });
    const pants = new THREE.MeshStandardMaterial({ color: colors.pants, roughness: 0.78, metalness: 0.02 });
    const boots = new THREE.MeshStandardMaterial({ color: colors.boots, roughness: 0.58, metalness: 0.12 });
    const gloves = new THREE.MeshStandardMaterial({ color: 0x172229, roughness: 0.72, metalness: 0.05 });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      const current = Array.isArray(node.material) ? node.material[0] : node.material;
      const materialName = current?.name?.toLowerCase() ?? '';
      const key = `${node.name} ${materialName}`.toLowerCase();

      if (key.includes('hand') || key.includes('skin')) node.material = appearance.gloves ? gloves : skin;
      else if (key.includes('boot') || key.includes('shoe') || key.includes('foot')) node.material = boots;
      else if (key.includes('leg') || key.includes('pant') || key.includes('trouser')) node.material = pants;
      else if (key.includes('head') || key.includes('face')) node.material = skin;
      else node.material = shirt;
    });
  }

  private addChibiIdentity(root: THREE.Object3D, appearance: HeroAppearance): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handR = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!chest || !head) throw new Error('Chibi hero rig is missing chest/head bones.');

    const accentColor = new THREE.Color(appearance.vest).getHex();
    const skin = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.skin),
      roughness: 0.64,
      metalness: 0,
      clearcoat: 0.05
    });
    const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.82 });
    const accent = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.43,
      metalness: 0.035,
      clearcoat: 0.2,
      clearcoatRoughness: 0.38
    });
    const reflective = new THREE.MeshPhysicalMaterial({
      color: 0xf2f8f9,
      roughness: 0.2,
      metalness: 0.08,
      clearcoat: 0.34,
      emissive: 0x779aa5,
      emissiveIntensity: 0.045
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10191e, roughness: 0.7, metalness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xa7d8e9,
      roughness: 0.07,
      transparent: true,
      opacity: 0.42,
      transmission: 0.22,
      thickness: 0.018,
      clearcoat: 0.52
    });
    const helmet = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.helmet),
      roughness: 0.32,
      metalness: 0.025,
      clearcoat: 0.46,
      clearcoatRoughness: 0.22
    });

    this.addBlankChibiHead(head, skin);
    this.addHair(head, appearance.hairStyle, hair);
    this.addMandatoryHelmet(head, helmet, accent, reflective);
    if (appearance.glasses) this.addSafetyGlasses(head, glass, dark);

    this.addTopDetails(chest, appearance.topStyle, accent, reflective, dark);
    this.addPpe(chest, appearance.ppeStyle, accent, reflective, dark);
    this.addBeltAndId(chest, accent, dark, reflective);

    if (handR) this.addScanner(handR, accentColor, dark, glass);
  }

  private addBlankChibiHead(head: THREE.Object3D, skin: THREE.Material): void {
    const identity = new THREE.Group();
    identity.name = 'EI_CHIBI_BLANK_HEAD';

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 18), skin);
    skull.scale.set(0.98, 1.03, 0.96);
    skull.position.set(0, 0.015, 0.005);
    identity.add(skull);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), skin);
      ear.scale.set(0.65, 1, 0.66);
      ear.position.set(side * 0.292, 0.005, -0.005);
      identity.add(ear);
    }

    head.add(identity);
  }

  private addHair(head: THREE.Object3D, style: HeroHairStyle, material: THREE.Material): void {
    const group = new THREE.Group();
    group.name = `EI_CHIBI_HAIR_${style.toUpperCase()}`;

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.305, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      material
    );
    cap.position.set(0, 0.105, -0.018);
    cap.scale.set(1.01, style === 'buzz' ? 0.48 : 0.68, 1);
    group.add(cap);

    if (style === 'short') {
      for (const x of [-0.15, -0.05, 0.05, 0.15]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.11, 7), material);
        tuft.position.set(x, 0.155, 0.005);
        tuft.rotation.z = -x * 0.8;
        group.add(tuft);
      }
    } else if (style === 'side') {
      const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), material);
      side.position.set(-0.20, 0.035, -0.02);
      side.rotation.z = -0.18;
      group.add(side);
    } else if (style === 'wave') {
      for (const x of [-0.22, -0.12, 0.12, 0.22]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 11, 8), material);
        curl.position.set(x, 0.02 + Math.abs(x) * 0.16, -0.01);
        group.add(curl);
      }
    }

    head.add(group);
  }

  private addMandatoryHelmet(
    head: THREE.Object3D,
    helmetMaterial: THREE.Material,
    accent: THREE.Material,
    reflective: THREE.Material
  ): void {
    const hardhat = new THREE.Group();
    hardhat.name = 'EI_HARDHAT_MANDATORY';
    hardhat.userData.requiredPPE = true;

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.342, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      helmetMaterial
    );
    shell.position.set(0, 0.175, 0.004);
    shell.scale.set(1.02, 0.9, 0.98);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.043, 28), helmetMaterial);
    brim.position.set(0, 0.067, 0.035);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.48), helmetMaterial);
    ridge.position.set(0, 0.285, 0.004);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.018), accent);
    badge.position.set(0, 0.218, 0.318);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.018, 0.014), reflective);
    stripe.position.set(0, 0.174, 0.326);

    hardhat.add(shell, brim, ridge, badge, stripe);
    head.add(hardhat);
  }

  private addSafetyGlasses(head: THREE.Object3D, glass: THREE.Material, dark: THREE.Material): void {
    const glasses = new THREE.Group();
    glasses.name = 'EI_CHIBI_SAFETY_GLASSES';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 10), glass);
      lens.scale.set(1, 0.52, 0.16);
      lens.position.set(side * 0.112, 0.035, 0.284);
      glasses.add(lens);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.018, 0.018), dark);
      arm.position.set(side * 0.205, 0.042, 0.18);
      arm.rotation.y = side * 0.34;
      glasses.add(arm);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), dark);
    bridge.position.set(0, 0.035, 0.31);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addTopDetails(
    chest: THREE.Object3D,
    style: HeroTopStyle,
    accent: THREE.Material,
    reflective: THREE.Material,
    dark: THREE.Material
  ): void {
    const group = new THREE.Group();
    group.name = `EI_TOP_${style.toUpperCase()}`;

    if (style === 'workshirt') {
      for (const side of [-1, 1] as const) {
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 0.035), dark);
        collar.position.set(side * 0.11, 0.19, 0.31);
        collar.rotation.z = side * 0.36;
        group.add(collar);
      }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.03), accent);
      pocket.position.set(0.19, -0.03, 0.32);
      group.add(pocket);
    } else if (style === 'polo') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 18), dark);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.19, 0.04);
      group.add(collar);
      for (const y of [0.12, 0.06]) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), reflective);
        button.position.set(0, y, 0.33);
        group.add(button);
      }
    } else {
      const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.53, 0.025), reflective);
      zipper.position.set(0, -0.045, 0.33);
      group.add(zipper);
      for (const side of [-1, 1] as const) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.075, 0.06), accent);
        shoulder.position.set(side * 0.25, 0.18, 0.18);
        shoulder.rotation.z = side * -0.08;
        group.add(shoulder);
      }
    }

    chest.add(group);
  }

  private addPpe(
    chest: THREE.Object3D,
    style: HeroPpeStyle,
    accent: THREE.Material,
    reflective: THREE.Material,
    dark: THREE.Material
  ): void {
    const ppe = new THREE.Group();
    ppe.name = `EI_PPE_${style.toUpperCase()}`;

    if (style === 'harness') {
      for (const side of [-1, 1] as const) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.54, 0.035), accent);
        strap.position.set(side * 0.17, -0.05, 0.34);
        strap.rotation.z = side * 0.15;
        ppe.add(strap);
      }
      for (const y of [-0.2, 0.02]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.038), reflective);
        band.position.set(0, y, 0.35);
        ppe.add(band);
      }
    } else if (style === 'vest') {
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.39, 4, 10), accent);
        panel.scale.set(1.05, 1, 0.32);
        panel.position.set(side * 0.18, -0.06, 0.335);
        ppe.add(panel);
      }
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.04), reflective);
      waist.position.set(0, -0.22, 0.35);
      ppe.add(waist);
    } else {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.025), dark);
      clip.position.set(0.20, 0.13, 0.34);
      ppe.add(clip);
    }

    chest.add(ppe);
  }

  private addBeltAndId(
    chest: THREE.Object3D,
    accent: THREE.Material,
    dark: THREE.Material,
    reflective: THREE.Material
  ): void {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), dark);
    belt.position.set(0, -0.34, 0.01);
    chest.add(belt);

    const card = new THREE.Group();
    card.name = 'EI_HERO_ID_CARD';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.025), reflective);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.035, 0.008), accent);
    mark.position.set(0, 0.045, 0.017);
    card.add(body, mark);
    card.position.set(0.23, 0.08, 0.37);
    chest.add(card);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.07), dark);
    radio.position.set(-0.29, 0.12, 0.34);
    chest.add(radio);
  }

  private addScanner(handR: THREE.Object3D, accentColor: number, dark: THREE.Material, glass: THREE.Material): void {
    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.23, 0.09), dark);
    const screenMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.32,
      roughness: 0.24
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.105, 0.012), screenMat);
    screen.position.set(0, 0.035, 0.052);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.012), glass);
    lens.position.set(0, -0.07, 0.052);
    scanner.add(body, screen, lens);
    scanner.position.set(0, -0.14, 0.12);
    scanner.rotation.set(-0.35, 0.08, 0);
    handR.add(scanner);
  }
}
