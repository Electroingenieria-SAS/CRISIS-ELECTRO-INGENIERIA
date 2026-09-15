import * as THREE from 'three';
import type { HeroAppearance, HeroBuild } from '../types';
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
  boots: THREE.MeshPhysicalMaterial;
  sunglassLens: THREE.MeshPhysicalMaterial;
};

/**
 * KayKit Adventurer → EI Engineer conversion.
 *
 * The authored KayKit face and body proportions stay authoritative. Fantasy
 * meshes are stripped with a strict body-part allow-list and industrial PPE is
 * layered on top without replacing the face or adding extra eyes.
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
    this.stripFantasyProps(scene);
    this.convertKayKitSurface(scene, appearance);
    this.addIndustrialHelmet(scene, mat);
    if (appearance.glasses) this.addBlackSafetyGlasses(scene, mat);
    this.addIndustrialPpe(scene, mat);
    this.addWorkDetails(scene, appearance, mat);
    this.addScanner(scene, mat);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = `KayKit ${appearance.base} → EI Engineer`;
    root.userData.heroStyle = 'kaykit-engineer-v4';
    root.userData.usesKayKitFace = true;
    root.userData.extraEyes = false;
    root.userData.fantasyPropsStripped = true;
    root.userData.appearance = { ...appearance, ppeStyle: 'vest' };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.985, 1, 0.985);
    if (build === 'athletic') return new THREE.Vector3(1.015, 1, 1.01);
    return new THREE.Vector3(1, 1, 1);
  }

  private materials(appearance: HeroAppearance): HeroMaterialsV2 {
    const bootColor = appearance.bootStyle === 'yellow' ? 0x9e7324 : appearance.bootStyle === 'steel' ? 0x44545e : 0x11181d;
    return {
      accent: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.vest),
        roughness: 0.50,
        metalness: 0.01,
        clearcoat: 0.10,
        clearcoatRoughness: 0.54
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 0.54, metalness: 0.07 }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xf3f6f5,
        roughness: 0.24,
        metalness: 0.05,
        clearcoat: 0.18,
        emissive: 0x668590,
        emissiveIntensity: 0.018
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.27,
        metalness: 0.01,
        clearcoat: 0.42,
        clearcoatRoughness: 0.20
      }),
      boots: new THREE.MeshPhysicalMaterial({
        color: bootColor,
        roughness: 0.52,
        metalness: 0.05,
        clearcoat: 0.08,
        clearcoatRoughness: 0.55
      }),
      sunglassLens: new THREE.MeshPhysicalMaterial({
        color: 0x030405,
        transparent: true,
        opacity: 0.82,
        roughness: 0.10,
        metalness: 0.02,
        clearcoat: 0.28,
        clearcoatRoughness: 0.12,
        depthWrite: true
      })
    };
  }

  /** Keep only the six authored body meshes. Everything fantasy becomes hidden. */
  private stripFantasyProps(root: THREE.Object3D): void {
    const allowed = ['_armleft', '_armright', '_body', '_head', '_legleft', '_legright'];
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();
      node.visible = allowed.some((suffix) => name.includes(suffix));
    });
  }

  private convertKayKitSurface(root: THREE.Object3D, appearance: HeroAppearance): void {
    const uniformColor = appearance.uniform === 'graphite' ? 0x465159 : appearance.uniform === 'teal' ? 0x2b7175 : 0x176383;
    const pantsColor = appearance.pantsStyle === 'graphite' ? 0x333b40 : appearance.pantsStyle === 'technical' ? 0x38545d : 0x40545a;
    const skinTint = new THREE.Color(appearance.skin).lerp(new THREE.Color(0xffffff), 0.30);

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      const name = node.name.toLowerCase();
      if (name.includes('_head')) this.tintMappedMesh(node, skinTint, 0.68);
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

  /**
   * Industrial hardhat V4: large enough to contain the authored KayKit skull,
   * lower on the forehead and with a true surrounding lower band. This prevents
   * the head/hair geometry from piercing through the dome.
   */
  private addIndustrialHelmet(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const hardhat = new THREE.Group();
    hardhat.name = 'EI_ENGINEER_HARDHAT_V4';
    hardhat.userData.requiredPPE = true;

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.565, 40, 22, 0, Math.PI * 2, 0, Math.PI * 0.62),
      mat.helmet
    );
    shell.position.set(0, 0.655, -0.010);
    shell.scale.set(1.00, 0.82, 0.99);
    hardhat.add(shell);

    const lowerBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.525, 0.535, 0.145, 40, 1, true),
      mat.helmet
    );
    lowerBand.position.set(0, 0.555, -0.005);
    hardhat.add(lowerBand);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.565, 0.575, 0.025, 40), mat.helmet);
    brim.position.set(0, 0.510, 0.005);
    brim.scale.z = 0.94;
    hardhat.add(brim);

    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.125), mat.helmet);
    frontLip.position.set(0, 0.505, 0.485);
    hardhat.add(frontLip);

    const crownRidge = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.030, 0.34), mat.helmet);
    crownRidge.position.set(0, 0.995, -0.010);
    hardhat.add(crownRidge);

    head.add(hardhat);
  }

  /** Dark, compact safety sunglasses mounted tightly to the authored face. */
  private addBlackSafetyGlasses(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const glasses = new THREE.Group();
    glasses.name = 'EI_BLACK_SUNGLASSES_V4';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.CapsuleGeometry(0.067, 0.085, 6, 16), mat.sunglassLens);
      lens.rotation.z = Math.PI / 2;
      lens.scale.z = 0.11;
      lens.position.set(side * 0.142, 0.468, 0.535);
      glasses.add(lens);

      const outerArm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.014, 0.014), mat.dark);
      outerArm.position.set(side * 0.285, 0.472, 0.455);
      outerArm.rotation.y = side * 0.50;
      glasses.add(outerArm);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.016, 0.016), mat.dark);
    bridge.position.set(0, 0.472, 0.548);
    glasses.add(bridge);

    head.add(glasses);
  }

  /** Always use the approved squared EI safety vest. */
  private addIndustrialPpe(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const chest = root.getObjectByName('chest');
    const hips = root.getObjectByName('hips');
    if (!chest || !hips) return;

    const ppe = new THREE.Group();
    ppe.name = 'EI_ENGINEER_SQUARE_VEST_V4';
    this.buildProfessionalVest(ppe, mat);
    this.addIdAndRadio(ppe, mat);
    chest.add(ppe);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.050, 0.40), mat.dark);
    belt.name = 'EI_ENGINEER_BELT_V4';
    belt.position.set(0, 0.082, 0.00);
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.056, 0.034), mat.reflective);
    buckle.position.set(0, 0.082, 0.220);
    hips.add(buckle);
  }

  private buildProfessionalVest(parent: THREE.Group, mat: HeroMaterialsV2): void {
    // One large squared front block deliberately covers the torso cleanly.
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.565, 0.455, 0.050), mat.accent);
    front.position.set(0, 0.005, 0.390);
    parent.add(front);

    // Center opening / zipper gives the block a readable vest construction.
    const centerSeam = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.405, 0.012), mat.dark);
    centerSeam.position.set(0, -0.005, 0.422);
    parent.add(centerSeam);

    // Shoulder pieces connect the vest visually to the body instead of floating.
    for (const side of [-1, 1] as const) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.075, 0.044), mat.accent);
      shoulder.position.set(side * 0.195, 0.250, 0.335);
      shoulder.rotation.z = side * 0.30;
      parent.add(shoulder);
    }

    const upperBand = new THREE.Mesh(new THREE.BoxGeometry(0.485, 0.030, 0.014), mat.reflective);
    upperBand.position.set(0, 0.060, 0.423);
    parent.add(upperBand);

    const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(0.485, 0.030, 0.014), mat.reflective);
    lowerBand.position.set(0, -0.115, 0.423);
    parent.add(lowerBand);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.545, 0.445, 0.042), mat.accent);
    back.position.set(0, 0.005, -0.365);
    parent.add(back);

    const backBand = new THREE.Mesh(new THREE.BoxGeometry(0.455, 0.030, 0.014), mat.reflective);
    backBand.position.set(0, -0.070, -0.393);
    parent.add(backBand);

    for (const side of [-1, 1] as const) {
      const sideStrap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.200, 0.070), mat.dark);
      sideStrap.position.set(side * 0.300, -0.015, 0.000);
      parent.add(sideStrap);
    }
  }

  private addIdAndRadio(parent: THREE.Group, mat: HeroMaterialsV2): void {
    const id = new THREE.Group();
    id.name = 'EI_ENGINEER_ID_V4';
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.082, 0.012), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.012, 0.004), mat.accent);
    idMark.position.set(0, 0.020, 0.009);
    id.add(idBody, idMark);
    id.position.set(0.225, 0.120, 0.428);
    parent.add(id);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.080, 0.030), mat.dark);
    radio.position.set(-0.235, 0.125, 0.420);
    parent.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.050, 6), mat.dark);
    antenna.position.set(-0.235, 0.188, 0.420);
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
