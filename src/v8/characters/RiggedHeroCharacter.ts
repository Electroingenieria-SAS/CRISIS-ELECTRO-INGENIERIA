import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface RiggedHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

/**
 * Local, skeletal hero pipeline. Uses the KayKit Rig_Medium already vendored
 * in public/assets, so Pages/Vercel never depend on a remote asset host.
 */
export class RiggedHeroCharacter {
  private readonly loader = new GLTFLoader();

  async load(accentColor: number): Promise<RiggedHeroAsset> {
    const base = import.meta.env.BASE_URL || '/';
    const [character, movement, general] = await Promise.all([
      this.loader.loadAsync(`${base}assets/kaykit/characters/Knight.glb`),
      this.loader.loadAsync(`${base}assets/kaykit/animations/Rig_Medium_MovementBasic.glb`),
      this.loader.loadAsync(`${base}assets/kaykit/animations/Rig_Medium_General.glb`)
    ]);

    const root = new THREE.Group();
    root.name = 'V8_RIGGED_HERO';
    const skeletonScene = character.scene;
    skeletonScene.name = 'V8_RIGGED_HERO_SKELETON';
    skeletonScene.scale.setScalar(0.92);
    // KayKit's authored forward axis is opposite the V8 world convention.
    // Keep the correction on the inner skeleton so Player can rotate `root`
    // freely toward movement without losing the asset-space correction.
    skeletonScene.rotation.y = Math.PI;
    root.add(skeletonScene);

    this.rebuildMaterials(skeletonScene, accentColor);
    this.hideMedievalParts(skeletonScene);
    this.addIndustrialPPE(skeletonScene, accentColor);

    skeletonScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
      }
    });

    const idle = this.clip(general.animations, 'Idle_A') ?? this.required(general.animations, 'Idle_B');
    const walk = this.clip(movement.animations, 'Walking_A') ?? this.required(movement.animations, 'Walking_B');
    const run = this.clip(movement.animations, 'Running_A') ?? this.required(movement.animations, 'Running_B');
    const interact = this.clip(general.animations, 'Interact');
    const pickup = this.clip(general.animations, 'PickUp');
    const useItem = this.clip(general.animations, 'Use_Item');
    const animator = new RiggedHeroAnimator(root, { idle, walk, run, interact, pickup, useItem });

    return { root, animator };
  }

  private rebuildMaterials(root: THREE.Object3D, accentColor: number): void {
    const navy = new THREE.MeshPhysicalMaterial({ color: 0x173346, roughness: 0.56, metalness: 0.08, clearcoat: 0.16, clearcoatRoughness: 0.42 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x293840, roughness: 0.78, metalness: 0.03 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x214d67, roughness: 0.64, metalness: 0.04 });
    const accent = new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.42, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.34 });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (node.name.includes('Body')) node.material = navy;
      else if (node.name.includes('Leg')) node.material = pants;
      else if (node.name.includes('Arm')) node.material = sleeve;
      // Keep the original head material: it carries authored facial texture/detail.
      node.userData.heroAccent = accent;
    });
  }

  private hideMedievalParts(root: THREE.Object3D): void {
    for (const name of ['Knight_Cape', 'Knight_Helmet', 'Knight_HelmetVisor']) {
      const object = root.getObjectByName(name);
      if (object) object.visible = false;
    }
  }

  private addIndustrialPPE(root: THREE.Object3D, accentColor: number): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handR = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!chest || !head) return;

    const accent = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.43,
      metalness: 0.05,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34
    });
    const reflective = new THREE.MeshStandardMaterial({
      color: 0xf2fbfc,
      roughness: 0.25,
      metalness: 0.08,
      emissive: 0xaed6de,
      emissiveIntensity: 0.08
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x10181c, roughness: 0.7, metalness: 0.12 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x9bc7db,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.4,
      transmission: 0.2,
      thickness: 0.025
    });

    // Rigid vest/harness follows the animated chest bone.
    const vest = new THREE.Group();
    vest.name = 'EI_SAFETY_VEST';
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.58, 0.12), accent);
    front.position.set(0, -0.08, 0.29);
    vest.add(front);
    for (const y of [-0.21, 0.02]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.135), reflective);
      stripe.position.set(0, y, 0.3);
      vest.add(stripe);
    }
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.61, 0.03), reflective);
      strap.position.set(side * 0.2, -0.06, 0.355);
      strap.rotation.z = side * -0.08;
      vest.add(strap);
    }
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.065), dark);
    radio.position.set(-0.29, 0.13, 0.35);
    vest.add(radio);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.018), reflective);
    badge.position.set(0.24, 0.1, 0.36);
    vest.add(badge);
    chest.add(vest);

    // Industrial hardhat + glasses follow the head bone.
    const helmet = new THREE.Group();
    helmet.name = 'EI_HARDHAT';
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.305, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), accent);
    shell.position.set(0, 0.12, 0.01);
    shell.scale.z = 0.94;
    helmet.add(shell);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.44), accent);
    brim.position.set(0, 0.015, 0.09);
    helmet.add(brim);
    const frontReflector = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.018), reflective);
    frontReflector.position.set(0, 0.22, 0.275);
    helmet.add(frontReflector);
    head.add(helmet);

    const glasses = new THREE.Group();
    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.085, 0.02), glass);
      lens.position.set(side * 0.095, 0.015, 0.29);
      glasses.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.018), dark);
    bridge.position.set(0, 0.015, 0.305);
    glasses.add(bridge);
    head.add(glasses);

    if (handR) {
      const scanner = new THREE.Group();
      scanner.name = 'EI_HAND_SCANNER_RIGGED';
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.23, 0.09), dark);
      const screenMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.42, roughness: 0.25 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.1, 0.012), screenMat);
      screen.position.z = 0.051;
      scanner.add(body, screen);
      scanner.position.set(0, 0.07, 0.035);
      scanner.rotation.set(-0.25, 0.12, 0);
      handR.add(scanner);
    }
  }

  private clip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
    return THREE.AnimationClip.findByName(clips, name);
  }

  private required(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip {
    const clip = this.clip(clips, name);
    if (!clip) throw new Error(`Missing required rig animation: ${name}`);
    return clip;
  }
}
