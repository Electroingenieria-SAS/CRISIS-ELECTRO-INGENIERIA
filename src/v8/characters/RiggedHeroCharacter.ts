import * as THREE from 'three';
import type { HeroAppearance, HeroBuild, HeroHairStyle, HeroUniform } from '../types';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface RiggedHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

/**
 * Player-facing skeletal hero. Appearance is authored by the start-screen
 * customizer and reused by the in-game rig. The industrial hardhat is always
 * present: it is PPE, not a cosmetic option.
 */
export class RiggedHeroCharacter {
  async load(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();

    const root = new THREE.Group();
    root.name = 'V8_RIGGED_HERO';
    const skeletonScene = scene;
    skeletonScene.name = 'V8_RIGGED_HERO_SKELETON';
    skeletonScene.rotation.set(0, 0, 0);
    skeletonScene.scale.copy(this.buildScale(appearance.build));
    root.add(skeletonScene);

    this.hideOriginalIdentity(skeletonScene);
    this.rebuildMaterials(skeletonScene, appearance);
    this.addCustomIdentity(skeletonScene, appearance);

    skeletonScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
      }
    });

    const animator = new RiggedHeroAnimator(root, clips);
    return { root, animator };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.86, 0.92, 0.88);
    if (build === 'athletic') return new THREE.Vector3(0.98, 0.94, 0.96);
    return new THREE.Vector3(0.92, 0.92, 0.92);
  }

  private uniformPalette(uniform: HeroUniform): { jacket: number; sleeves: number; trousers: number } {
    if (uniform === 'graphite') return { jacket: 0x29343b, sleeves: 0x39464d, trousers: 0x202a30 };
    if (uniform === 'teal') return { jacket: 0x174a4e, sleeves: 0x24666a, trousers: 0x24363a };
    return { jacket: 0x173346, sleeves: 0x214d67, trousers: 0x26353d };
  }

  private rebuildMaterials(root: THREE.Object3D, appearance: HeroAppearance): void {
    const palette = this.uniformPalette(appearance.uniform);
    const skin = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.skin), roughness: 0.63, metalness: 0, clearcoat: 0.04 });
    const jacket = new THREE.MeshPhysicalMaterial({ color: palette.jacket, roughness: 0.5, metalness: 0.035, clearcoat: 0.16, clearcoatRoughness: 0.44 });
    const sleeves = new THREE.MeshPhysicalMaterial({ color: palette.sleeves, roughness: 0.57, metalness: 0.02, clearcoat: 0.08 });
    const trousers = new THREE.MeshStandardMaterial({ color: palette.trousers, roughness: 0.8, metalness: 0.02 });
    const boots = new THREE.MeshPhysicalMaterial({ color: 0x0e161a, roughness: 0.58, metalness: 0.12, clearcoat: 0.09 });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();
      if (name.includes('body') || name.includes('torso') || name.includes('chest')) node.material = jacket;
      else if (name.includes('arm') || name.includes('sleeve')) node.material = sleeves;
      else if (name.includes('leg') || name.includes('pants') || name.includes('trouser')) node.material = trousers;
      else if (name.includes('boot') || name.includes('shoe')) node.material = boots;
      else if (name.includes('hand')) node.material = skin;
    });
  }

  private hideOriginalIdentity(root: THREE.Object3D): void {
    root.traverse((node) => {
      const name = node.name.toLowerCase();
      if (
        name.includes('cape') ||
        name.includes('helmetvisor') ||
        name === 'knight_helmet' ||
        name === 'knight_head' ||
        name.includes('sword') ||
        name.includes('shield')
      ) node.visible = false;
    });
  }

  private addCustomIdentity(root: THREE.Object3D, appearance: HeroAppearance): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handR = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!chest || !head) throw new Error('Hero rig is missing required chest/head bones.');

    const vestColor = new THREE.Color(appearance.vest).getHex();
    const skin = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.skin), roughness: 0.62, metalness: 0, clearcoat: 0.05 });
    const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.84 });
    const accent = new THREE.MeshPhysicalMaterial({ color: vestColor, roughness: 0.39, metalness: 0.04, clearcoat: 0.32, clearcoatRoughness: 0.3 });
    const hardhat = new THREE.MeshPhysicalMaterial({ color: 0xf3c83f, roughness: 0.34, metalness: 0.035, clearcoat: 0.48, clearcoatRoughness: 0.22 });
    const reflective = new THREE.MeshPhysicalMaterial({ color: 0xf2fafb, roughness: 0.18, metalness: 0.1, clearcoat: 0.42, emissive: 0x769aa5, emissiveIntensity: 0.055 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0d1519, roughness: 0.65, metalness: 0.08 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x657780, roughness: 0.32, metalness: 0.68 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf7f8f5, roughness: 0.46 });
    const iris = new THREE.MeshStandardMaterial({ color: 0x426d82, roughness: 0.42 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x101315, roughness: 0.4 });
    const lip = new THREE.MeshStandardMaterial({ color: 0x84554f, roughness: 0.62 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xa4d3e6, roughness: 0.07, transparent: true, opacity: 0.38, transmission: 0.28, thickness: 0.025, clearcoat: 0.62 });

    this.addFace(head, appearance, skin, hair, eyeWhite, iris, pupil, lip, rubber);
    this.addMandatoryHelmet(head, hardhat, accent, reflective);
    if (appearance.glasses) this.addGlasses(head, glass, rubber);
    this.addVest(chest, accent, reflective, rubber);
    this.addBelt(chest, rubber, steel);
    if (handR) this.addScanner(handR, vestColor, rubber, glass);
  }

  private addFace(
    head: THREE.Object3D,
    appearance: HeroAppearance,
    skin: THREE.Material,
    hair: THREE.Material,
    eyeWhite: THREE.Material,
    iris: THREE.Material,
    pupil: THREE.Material,
    lip: THREE.Material,
    dark: THREE.Material
  ): void {
    const face = new THREE.Group();
    face.name = 'EI_HERO_CUSTOM_FACE';

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 28, 18), skin);
    skull.scale.set(0.96, 1.05, 0.94);
    skull.position.set(0, 0.012, 0.004);
    face.add(skull);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), skin);
      ear.scale.set(0.55, 1, 0.62);
      ear.position.set(side * 0.258, 0.005, 0);
      face.add(ear);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.054, 14, 10), eyeWhite);
      eye.scale.set(1, 0.68, 0.3);
      eye.position.set(side * 0.09, 0.055, 0.238);
      const irisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), iris);
      irisMesh.scale.z = 0.28;
      irisMesh.position.set(side * 0.09, 0.052, 0.266);
      const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6), pupil);
      pupilMesh.scale.z = 0.24;
      pupilMesh.position.set(side * 0.09, 0.052, 0.281);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.016), dark);
      brow.position.set(side * 0.09, 0.12, 0.257);
      brow.rotation.z = side * 0.035;
      face.add(eye, irisMesh, pupilMesh, brow);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 10), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.005, 0.272);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.018), lip);
    mouth.position.set(0, -0.086, 0.252);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), skin);
    chin.scale.set(1.15, 0.66, 0.9);
    chin.position.set(0, -0.155, 0.15);
    face.add(nose, mouth, chin);

    this.addHair(face, appearance.hairStyle, hair);
    head.add(face);
  }

  private addHair(face: THREE.Group, style: HeroHairStyle, hair: THREE.Material): void {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.278, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    cap.position.set(0, 0.118, -0.015);
    cap.scale.set(1.02, style === 'buzz' ? 0.58 : 0.82, 1);
    face.add(cap);

    if (style === 'side') {
      const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.07), hair);
      sweep.position.set(-0.09, 0.15, 0.18);
      sweep.rotation.z = -0.18;
      face.add(sweep);
    } else if (style === 'short') {
      for (const x of [-0.14, -0.05, 0.05, 0.14]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 8), hair);
        tuft.position.set(x, 0.21, 0.02);
        tuft.rotation.z = -x * 0.8;
        face.add(tuft);
      }
    } else if (style === 'wave') {
      for (const x of [-0.16, -0.06, 0.06, 0.16]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 7), hair);
        curl.position.set(x, 0.14 + Math.abs(x) * 0.15, 0.04);
        face.add(curl);
      }
    }
  }

  private addMandatoryHelmet(head: THREE.Object3D, hardhat: THREE.Material, accent: THREE.Material, reflective: THREE.Material): void {
    const helmet = new THREE.Group();
    helmet.name = 'EI_HARDHAT_MANDATORY';
    helmet.userData.requiredPPE = true;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.315, 30, 15, 0, Math.PI * 2, 0, Math.PI * 0.56), hardhat);
    shell.position.set(0, 0.15, 0.01);
    shell.scale.set(1.03, 0.92, 0.97);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.355, 0.045, 30), hardhat);
    brim.position.set(0, 0.04, 0.035);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.5), hardhat);
    ridge.position.set(0, 0.258, 0.015);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.02), accent);
    plate.position.set(0, 0.217, 0.29);
    const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.018), reflective);
    reflector.position.set(0, 0.17, 0.3);
    helmet.add(shell, brim, ridge, plate, reflector);
    head.add(helmet);
  }

  private addGlasses(head: THREE.Object3D, glass: THREE.Material, dark: THREE.Material): void {
    const glasses = new THREE.Group();
    glasses.name = 'EI_HERO_GLASSES';
    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 10), glass);
      lens.scale.set(1, 0.55, 0.16);
      lens.position.set(side * 0.105, 0.014, 0.282);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), dark);
      arm.position.set(side * 0.185, 0.025, 0.18);
      arm.rotation.y = side * 0.36;
      glasses.add(lens, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), dark);
    bridge.position.set(0, 0.014, 0.302);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addVest(chest: THREE.Object3D, accent: THREE.Material, reflective: THREE.Material, dark: THREE.Material): void {
    const vest = new THREE.Group();
    vest.name = 'EI_HERO_CUSTOM_VEST';
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.59, 0.105), accent);
    front.position.set(0, -0.085, 0.292);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.58, 0.09), accent);
    back.position.set(0, -0.085, -0.285);
    vest.add(front, back);
    for (const y of [-0.22, 0.025]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.705, 0.043, 0.125), reflective);
      stripe.position.set(0, y, 0.31);
      const backStripe = stripe.clone();
      backStripe.position.z = -0.305;
      vest.add(stripe, backStripe);
    }
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.205, 0.07), dark);
    radio.position.set(-0.29, 0.11, 0.355);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.02), reflective);
    badge.position.set(0.25, 0.09, 0.365);
    vest.add(radio, badge);
    chest.add(vest);
  }

  private addBelt(chest: THREE.Object3D, rubber: THREE.Material, steel: THREE.Material): void {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.028, 8, 24), rubber);
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, -0.33, 0);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), steel);
    buckle.position.set(0, -0.33, 0.31);
    chest.add(belt, buckle);
  }

  private addScanner(handR: THREE.Object3D, accentColor: number, rubber: THREE.Material, glass: THREE.Material): void {
    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.235, 0.092), rubber);
    const screenMat = new THREE.MeshPhysicalMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, roughness: 0.18, clearcoat: 0.42 });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.105, 0.013), screenMat);
    screen.position.set(0, 0.042, 0.052);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, 0.014), glass);
    window.position.set(0, 0.11, 0.051);
    scanner.add(body, screen, window);
    scanner.position.set(0, 0.07, 0.035);
    scanner.rotation.set(-0.25, 0.12, 0);
    handR.add(scanner);
  }
}
