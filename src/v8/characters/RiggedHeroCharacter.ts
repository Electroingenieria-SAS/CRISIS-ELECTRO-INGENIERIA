import * as THREE from 'three';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';
import { RiggedHeroAnimator } from './RiggedHeroAnimator';

export interface RiggedHeroAsset {
  root: THREE.Group;
  animator: RiggedHeroAnimator;
}

/**
 * Premium local skeletal hero. The authored KayKit skin provides deformation
 * and facial topology while V8 rebuilds the visual identity as an industrial
 * engineer with PBR materials and equipment attached to animated bones.
 */
export class RiggedHeroCharacter {
  async load(accentColor: number): Promise<RiggedHeroAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();

    const root = new THREE.Group();
    root.name = 'V8_RIGGED_HERO';
    const skeletonScene = scene;
    skeletonScene.name = 'V8_RIGGED_HERO_SKELETON';
    skeletonScene.scale.setScalar(0.92);
    // KayKit authored forward is opposite the V8 convention. Keep this on the
    // inner skeleton so Player may rotate the outer root toward movement.
    skeletonScene.rotation.y = Math.PI;
    root.add(skeletonScene);

    this.rebuildMaterials(skeletonScene, accentColor);
    this.hideMedievalParts(skeletonScene);
    this.addIndustrialIdentity(skeletonScene, accentColor);

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

  private rebuildMaterials(root: THREE.Object3D, accentColor: number): void {
    const jacket = new THREE.MeshPhysicalMaterial({
      color: 0x173346,
      roughness: 0.52,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.48
    });
    const sleeves = new THREE.MeshPhysicalMaterial({
      color: 0x214d67,
      roughness: 0.58,
      metalness: 0.025,
      clearcoat: 0.08,
      clearcoatRoughness: 0.52
    });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x27343b, roughness: 0.8, metalness: 0.025 });
    const boots = new THREE.MeshPhysicalMaterial({ color: 0x10181c, roughness: 0.58, metalness: 0.12, clearcoat: 0.08 });
    const accent = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.4,
      metalness: 0.055,
      clearcoat: 0.3,
      clearcoatRoughness: 0.32
    });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();
      if (name.includes('body') || name.includes('torso') || name.includes('chest')) node.material = jacket;
      else if (name.includes('arm') || name.includes('sleeve')) node.material = sleeves;
      else if (name.includes('leg') || name.includes('pants') || name.includes('trouser')) node.material = trousers;
      else if (name.includes('boot') || name.includes('shoe')) node.material = boots;
      node.userData.heroAccent = accent;
    });
  }

  private hideMedievalParts(root: THREE.Object3D): void {
    root.traverse((node) => {
      const name = node.name.toLowerCase();
      if (name.includes('cape') || name.includes('helmetvisor') || name === 'knight_helmet' || name.includes('sword') || name.includes('shield')) {
        node.visible = false;
      }
    });
  }

  private addIndustrialIdentity(root: THREE.Object3D, accentColor: number): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handR = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!chest || !head) return;

    const accent = new THREE.MeshPhysicalMaterial({
      color: accentColor,
      roughness: 0.4,
      metalness: 0.045,
      clearcoat: 0.32,
      clearcoatRoughness: 0.3
    });
    const fabricDark = new THREE.MeshStandardMaterial({ color: 0x18282f, roughness: 0.78, metalness: 0.02 });
    const reflective = new THREE.MeshPhysicalMaterial({
      color: 0xf1fafb,
      roughness: 0.2,
      metalness: 0.11,
      clearcoat: 0.4,
      emissive: 0x7da9b4,
      emissiveIntensity: 0.055
    });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0e1519, roughness: 0.66, metalness: 0.08 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x5d6e76, roughness: 0.34, metalness: 0.68 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x9bc7db,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      transmission: 0.28,
      thickness: 0.03,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12
    });
    const hair = new THREE.MeshStandardMaterial({ color: 0x352821, roughness: 0.82, metalness: 0 });

    // Layered high-visibility vest: front, back and side straps follow the chest.
    const vest = new THREE.Group();
    vest.name = 'EI_SAFETY_VEST_PREMIUM';
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.59, 0.1), accent);
    front.position.set(0, -0.085, 0.292);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.58, 0.085), accent);
    back.position.set(0, -0.085, -0.285);
    vest.add(front, back);
    for (const y of [-0.22, 0.025]) {
      const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(0.705, 0.043, 0.125), reflective);
      frontStripe.position.set(0, y, 0.31);
      const backStripe = frontStripe.clone();
      backStripe.position.z = -0.305;
      vest.add(frontStripe, backStripe);
    }
    for (const side of [-1, 1] as const) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.61, 0.035), reflective);
      shoulder.position.set(side * 0.205, -0.055, 0.355);
      shoulder.rotation.z = side * -0.085;
      const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.38, 0.42), fabricDark);
      sidePanel.position.set(side * 0.355, -0.12, 0);
      vest.add(shoulder, sidePanel);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 8, 20, Math.PI), fabricDark);
    collar.rotation.set(Math.PI / 2, 0, Math.PI);
    collar.position.set(0, 0.24, 0.07);
    vest.add(collar);

    const radio = new THREE.Group();
    radio.name = 'EI_RADIO';
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.205, 0.07), rubber);
    const radioFace = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.055, 0.012), steel);
    radioFace.position.set(0, 0.03, 0.041);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8), rubber);
    antenna.position.set(-0.035, 0.16, 0);
    radio.add(radioBody, radioFace, antenna);
    radio.position.set(-0.29, 0.11, 0.355);
    vest.add(radio);

    const badgeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.205, 0.025), rubber);
    badgeFrame.position.set(0.25, 0.09, 0.355);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.168, 0.012), reflective);
    badge.position.set(0.25, 0.09, 0.37);
    vest.add(badgeFrame, badge);

    const utilityPouch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.09), fabricDark);
    utilityPouch.position.set(0.28, -0.32, 0.23);
    vest.add(utilityPouch);
    chest.add(vest);

    // Hair remains visible around the hardhat, giving the hero an actual head silhouette.
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.276, 22, 11, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairCap.position.set(0, 0.095, -0.015);
    hairCap.scale.set(1, 0.82, 0.98);
    head.add(hairCap);

    // Industrial hardhat with shell, brim, suspension cue and front reflector.
    const helmet = new THREE.Group();
    helmet.name = 'EI_HARDHAT_PREMIUM';
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), accent);
    shell.position.set(0, 0.145, 0.01);
    shell.scale.set(1.02, 0.92, 0.96);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.355, 0.045, 28), accent);
    brim.position.set(0, 0.035, 0.035);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.49), accent);
    ridge.position.set(0, 0.255, 0.015);
    const frontReflector = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.018), reflective);
    frontReflector.position.set(0, 0.215, 0.286);
    helmet.add(shell, brim, ridge, frontReflector);
    head.add(helmet);

    // Safety glasses with separate lenses, bridge and side arms.
    const glasses = new THREE.Group();
    glasses.name = 'EI_SAFETY_GLASSES';
    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 10), glass);
      lens.scale.set(1, 0.55, 0.16);
      lens.position.set(side * 0.105, 0.014, 0.282);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), rubber);
      arm.position.set(side * 0.185, 0.025, 0.18);
      arm.rotation.y = side * 0.36;
      glasses.add(lens, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.018), rubber);
    bridge.position.set(0, 0.014, 0.302);
    glasses.add(bridge);
    head.add(glasses);

    if (handR) {
      const scanner = new THREE.Group();
      scanner.name = 'EI_HAND_SCANNER_RIGGED';
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.235, 0.092), rubber);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.07), rubber);
      grip.position.set(0, -0.16, -0.015);
      grip.rotation.x = -0.15;
      const screenMat = new THREE.MeshPhysicalMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        clearcoat: 0.42
      });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.105, 0.013), screenMat);
      screen.position.set(0, 0.042, 0.052);
      const scanWindow = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, 0.014), glass);
      scanWindow.position.set(0, 0.11, 0.051);
      scanner.add(body, grip, screen, scanWindow);
      scanner.position.set(0, 0.07, 0.035);
      scanner.rotation.set(-0.25, 0.12, 0);
      handR.add(scanner);
    }

    // Small belt hardware adds scale cues close to the camera without new textures.
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.028, 8, 24), rubber);
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, -0.33, 0);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), steel);
    buckle.position.set(0, -0.33, 0.31);
    chest.add(belt, buckle);
  }
}
