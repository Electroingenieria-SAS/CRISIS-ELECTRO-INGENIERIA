import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { HeroAppearance, HeroBuild, HeroHairStyle, HeroUniform } from '../types';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator, type RiggedHeroClips } from './RiggedHeroAnimator';

export interface RiggedHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

interface QuaterniusSource {
  scene: THREE.Group;
  clips: RiggedHeroClips;
}

/**
 * Premium hero pipeline. The primary body and face use Quaternius Universal
 * Base Characters + Universal Animation Library (CC0). Assets are acquired at
 * build time and served from this project's own static bundle. V8 adds its
 * original industrial uniform/PPE on animation joints. KayKit remains a local
 * fallback if the primary asset cannot initialize.
 */
export class RiggedHeroCharacter {
  private static quaterniusPromise: Promise<QuaterniusSource> | null = null;

  async load(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    try {
      return await this.loadQuaternius(appearance);
    } catch (error) {
      console.warn('[V8] Quaternius hero unavailable; using local KayKit fallback.', error);
      return this.loadKayKitFallback(appearance);
    }
  }

  private async loadQuaternius(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    const source = await RiggedHeroCharacter.quaterniusSource();
    const model = cloneSkeleton(source.scene) as THREE.Group;
    model.name = 'V8_QUATERNIUS_HERO_MODEL';
    model.rotation.set(0, 0, 0);
    model.scale.copy(this.buildScale(appearance.build));

    const root = new THREE.Group();
    root.name = 'V8_RIGGED_HERO';
    root.add(model);

    this.prepareBaseModel(model, appearance);
    this.addIndustrialKit(model, appearance);

    model.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
      }
    });

    root.userData.heroAsset = 'Quaternius Universal Base Characters';
    root.userData.heroLicense = 'CC0-1.0';
    root.userData.appearance = { ...appearance };
    const animator = new RiggedHeroAnimator(root, source.clips);
    return { root, animator };
  }

  private static quaterniusSource(): Promise<QuaterniusSource> {
    if (!this.quaterniusPromise) this.quaterniusPromise = this.loadQuaterniusSource();
    return this.quaterniusPromise;
  }

  private static async loadQuaterniusSource(): Promise<QuaterniusSource> {
    const loader = new GLTFLoader();
    const base = import.meta.env.BASE_URL || '/';
    const [character, animationLibrary] = await Promise.all([
      loader.loadAsync(`${base}assets/quaternius/hero.glb`),
      loader.loadAsync(`${base}assets/quaternius/universal-animation-library.glb`)
    ]);

    const byName = new Map(animationLibrary.animations.map((clip) => [clip.name, clip]));
    const required = (name: string): THREE.AnimationClip => {
      const clip = byName.get(name);
      if (!clip) throw new Error(`Missing Quaternius animation: ${name}`);
      return clip;
    };
    const optional = (...names: string[]): THREE.AnimationClip | undefined => {
      for (const name of names) {
        const clip = byName.get(name);
        if (clip) return clip;
      }
      return undefined;
    };

    const interact = optional('Interact', 'Idle_Talking_Loop');
    return {
      scene: character.scene,
      clips: {
        idle: required('Idle_Loop'),
        walk: optional('Walk_Loop', 'Jog_Fwd_Loop') ?? required('Jog_Fwd_Loop'),
        run: required('Sprint_Loop'),
        interact,
        pickup: optional('Pick_Up', 'Pickup', 'Interact') ?? interact,
        useItem: optional('Interact', 'Fixing_Kneeling') ?? interact
      }
    };
  }

  private async loadKayKitFallback(appearance: HeroAppearance): Promise<RiggedHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();
    const root = new THREE.Group();
    root.name = 'V8_RIGGED_HERO_FALLBACK';
    scene.rotation.set(0, 0, 0);
    scene.scale.copy(this.buildScale(appearance.build).multiplyScalar(0.92));
    root.add(scene);
    this.addFallbackPPE(scene, appearance);
    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.88, 0.96, 0.88);
    if (build === 'athletic') return new THREE.Vector3(1.06, 1.0, 1.04);
    return new THREE.Vector3(0.97, 0.98, 0.97);
  }

  private uniformPalette(uniform: HeroUniform): { shirt: number; trousers: number } {
    if (uniform === 'graphite') return { shirt: 0x313d44, trousers: 0x202a30 };
    if (uniform === 'teal') return { shirt: 0x1d5b5f, trousers: 0x23363a };
    return { shirt: 0x194b69, trousers: 0x26353d };
  }

  private prepareBaseModel(model: THREE.Group, appearance: HeroAppearance): void {
    const skinTint = new THREE.Color(appearance.skin);
    const hairTint = new THREE.Color(appearance.hair);

    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const nodeName = node.name.toLowerCase();
      const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
      const cloned = sourceMaterials.map((surface) => {
        const material = surface.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          const materialName = material.name.toLowerCase();
          material.roughness = Math.max(0.46, material.roughness);
          material.metalness = Math.min(0.08, material.metalness);
          if (materialName.includes('hair') || nodeName.includes('hair')) material.color.copy(hairTint);
          else if (materialName.includes('eye') || nodeName.includes('eye')) material.roughness = 0.32;
          else material.color.multiply(skinTint.clone().lerp(new THREE.Color(0xffffff), 0.34));
        }
        return material;
      });
      node.material = Array.isArray(node.material) ? cloned : cloned[0]!;
    });

    const head = model.getObjectByName('Head');
    if (head) {
      if (appearance.face === 'soft') head.scale.set(1.13, 1.07, 1.1);
      else if (appearance.face === 'angular') head.scale.set(1.0, 1.13, 1.02);
      else head.scale.set(1.07, 1.07, 1.07);
    }
  }

  private addIndustrialKit(model: THREE.Group, appearance: HeroAppearance): void {
    const chest = model.getObjectByName('spine_02') ?? model.getObjectByName('spine_03');
    const upperChest = model.getObjectByName('spine_03') ?? chest;
    const head = model.getObjectByName('Head');
    const handR = model.getObjectByName('hand_r');
    const upperArmL = model.getObjectByName('upperarm_l');
    const upperArmR = model.getObjectByName('upperarm_r');
    const thighL = model.getObjectByName('thigh_l');
    const thighR = model.getObjectByName('thigh_r');
    if (!chest || !upperChest || !head) throw new Error('Quaternius hero is missing required humanoid joints.');

    const palette = this.uniformPalette(appearance.uniform);
    const vestColor = new THREE.Color(appearance.vest).getHex();
    const shirt = new THREE.MeshPhysicalMaterial({ color: palette.shirt, roughness: 0.64, metalness: 0.02, clearcoat: 0.08 });
    const trousers = new THREE.MeshStandardMaterial({ color: palette.trousers, roughness: 0.78, metalness: 0.025 });
    const vest = new THREE.MeshPhysicalMaterial({ color: vestColor, roughness: 0.44, metalness: 0.035, clearcoat: 0.24, clearcoatRoughness: 0.36 });
    const reflective = new THREE.MeshPhysicalMaterial({ color: 0xf4fbfc, roughness: 0.2, metalness: 0.1, clearcoat: 0.34, emissive: 0x7299a4, emissiveIntensity: 0.05 });
    const hardhat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.helmet), roughness: 0.32, metalness: 0.03, clearcoat: 0.48, clearcoatRoughness: 0.22 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10191e, roughness: 0.68, metalness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xa7d8e9, roughness: 0.08, transparent: true, opacity: 0.36, transmission: 0.26, thickness: 0.018, clearcoat: 0.5 });
    const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.78 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.185, 0.39, 14), shirt);
    torso.name = 'EI_HERO_FITTED_UNIFORM';
    torso.scale.set(1.18, 1, 0.74);
    torso.position.set(0, 0.045, 0);
    chest.add(torso);

    for (const joint of [upperArmL, upperArmR]) {
      if (!joint) continue;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.098, 0.2, 12), shirt);
      sleeve.position.y = 0.075;
      joint.add(sleeve);
    }
    for (const joint of [thighL, thighR]) {
      if (!joint) continue;
      const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.13, 0.24, 12), trousers);
      trouser.position.y = 0.1;
      joint.add(trouser);
    }

    const harness = new THREE.Group();
    harness.name = 'EI_HERO_FITTED_HARNESS';
    for (const x of [-0.105, 0.105]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.33, 0.018), vest);
      strap.position.set(x, 0.045, -0.155);
      harness.add(strap);
    }
    for (const y of [-0.06, 0.07]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.02), reflective);
      band.position.set(0, y, -0.158);
      harness.add(band);
    }
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.014), reflective);
    badge.position.set(0.115, 0.12, -0.165);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.105, 0.035), dark);
    radio.position.set(-0.13, 0.13, -0.165);
    harness.add(badge, radio);
    upperChest.add(harness);

    this.addHair(head, appearance.hairStyle, hair);
    this.addMandatoryHelmet(head, hardhat, vest, reflective);
    if (appearance.glasses) this.addGlasses(head, glass, dark);

    if (handR) {
      const scanner = new THREE.Group();
      scanner.name = 'EI_HAND_SCANNER_RIGGED';
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.038), dark);
      const screenMat = new THREE.MeshStandardMaterial({ color: vestColor, emissive: vestColor, emissiveIntensity: 0.3, roughness: 0.25 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.047, 0.008), screenMat);
      screen.position.z = 0.023;
      scanner.add(body, screen);
      scanner.position.set(0, 0.02, 0.055);
      scanner.rotation.set(-0.18, 0.08, 0);
      handR.add(scanner);
    }
  }

  private addHair(head: THREE.Object3D, style: HeroHairStyle, material: THREE.Material): void {
    const group = new THREE.Group();
    group.name = `EI_HERO_HAIR_${style.toUpperCase()}`;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.48), material);
    cap.position.set(0, 0.075, -0.008);
    cap.scale.set(1.04, style === 'buzz' ? 0.5 : 0.72, 1.02);
    group.add(cap);

    if (style === 'short') {
      for (const x of [-0.07, -0.024, 0.024, 0.07]) {
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), material);
        tuft.position.set(x, 0.13, 0.005);
        tuft.rotation.z = -x * 1.4;
        group.add(tuft);
      }
    } else if (style === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 3, 7), material);
      sweep.position.set(-0.06, 0.105, 0.06);
      sweep.rotation.z = -0.62;
      group.add(sweep);
    } else if (style === 'wave') {
      for (const x of [-0.075, -0.025, 0.025, 0.075]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.034, 9, 6), material);
        curl.position.set(x, 0.11 + Math.abs(x) * 0.25, 0.025);
        group.add(curl);
      }
    }
    head.add(group);
  }

  private addMandatoryHelmet(head: THREE.Object3D, helmetMaterial: THREE.Material, accent: THREE.Material, reflective: THREE.Material): void {
    const helmet = new THREE.Group();
    helmet.name = 'EI_HARDHAT_MANDATORY';
    helmet.userData.requiredPPE = true;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.148, 22, 11, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMaterial);
    shell.position.set(0, 0.105, 0);
    shell.scale.set(1.04, 0.9, 0.98);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.022, 22), helmetMaterial);
    brim.position.set(0, 0.045, 0.018);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.22), helmetMaterial);
    ridge.position.set(0, 0.17, 0.005);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.011), accent);
    mark.position.set(0, 0.135, 0.139);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.01), reflective);
    strip.position.set(0, 0.105, 0.145);
    helmet.add(shell, brim, ridge, mark, strip);
    head.add(helmet);
  }

  private addGlasses(head: THREE.Object3D, glass: THREE.Material, dark: THREE.Material): void {
    const glasses = new THREE.Group();
    glasses.name = 'EI_HERO_GLASSES';
    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glass);
      lens.scale.set(1, 0.52, 0.13);
      lens.position.set(side * 0.052, 0.012, 0.117);
      glasses.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.01, 0.01), dark);
    bridge.position.set(0, 0.012, 0.126);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addFallbackPPE(root: THREE.Group, appearance: HeroAppearance): void {
    const head = root.getObjectByName('head');
    if (!head) return;
    const helmet = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(appearance.helmet), roughness: 0.34, clearcoat: 0.42 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.vest) });
    const reflective = new THREE.MeshStandardMaterial({ color: 0xf4fbfc });
    this.addMandatoryHelmet(head, helmet, accent, reflective);
  }
}
