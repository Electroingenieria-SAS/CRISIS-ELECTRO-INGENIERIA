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
 * The authored KayKit face/body remain authoritative. Fantasy props are hidden
 * with a strict allow-list; all industrial PPE is purpose-built and intersects
 * the authored body deliberately so no visible gaps appear between clothing and
 * equipment.
 */
export class EngineerHeroCharacterV2 {
  private static readonly CANONICAL_CHARACTER_SCALE = 0.94;
  private static readonly CANONICAL_CHARACTER_HEIGHT = 2.35;

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

    this.normalizeHeight(scene, EngineerHeroCharacterV2.CANONICAL_CHARACTER_HEIGHT);

    root.userData.heroAsset = `KayKit ${appearance.base} → EI Engineer`;
    root.userData.heroStyle = 'kaykit-engineer-v6';
    root.userData.usesKayKitFace = true;
    root.userData.extraEyes = false;
    root.userData.fantasyPropsStripped = true;
    root.userData.canonicalScale = EngineerHeroCharacterV2.CANONICAL_CHARACTER_SCALE;
    root.userData.canonicalHeight = EngineerHeroCharacterV2.CANONICAL_CHARACTER_HEIGHT;
    root.userData.appearance = { ...appearance, ppeStyle: 'vest' };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(_build: HeroBuild): THREE.Vector3 {
    const s = EngineerHeroCharacterV2.CANONICAL_CHARACTER_SCALE;
    return new THREE.Vector3(s, s, s);
  }

  private normalizeHeight(object: THREE.Object3D, targetHeight: number): void {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const currentHeight = box.max.y - box.min.y;
    if (!Number.isFinite(currentHeight) || currentHeight <= 0.001) return;
    object.scale.multiplyScalar(targetHeight / currentHeight);
    object.updateMatrixWorld(true);
  }

  private materials(appearance: HeroAppearance): HeroMaterialsV2 {
    const bootColor = appearance.bootStyle === 'yellow' ? 0x9e7324 : appearance.bootStyle === 'steel' ? 0x44545e : 0x11181d;
    return {
      accent: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.vest),
        roughness: 0.46,
        metalness: 0.01,
        clearcoat: 0.12,
        clearcoatRoughness: 0.48
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.48, metalness: 0.08 }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xf4f7f6,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.20,
        emissive: 0x668590,
        emissiveIntensity: 0.018
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.22,
        metalness: 0.01,
        clearcoat: 0.52,
        clearcoatRoughness: 0.16,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
        side: THREE.FrontSide
      }),
      boots: new THREE.MeshPhysicalMaterial({
        color: bootColor,
        roughness: 0.52,
        metalness: 0.05,
        clearcoat: 0.08,
        clearcoatRoughness: 0.55
      }),
      sunglassLens: new THREE.MeshPhysicalMaterial({
        color: 0x020304,
        transparent: true,
        opacity: 0.92,
        roughness: 0.07,
        metalness: 0.02,
        clearcoat: 0.34,
        clearcoatRoughness: 0.08,
        depthWrite: true
      })
    };
  }

  /** Keep only authored body meshes; all fantasy props/weapons disappear. */
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
   * Professional industrial hardhat V6.
   * Everything visible uses the selected helmet colour: no black inner liner is
   * exposed. The lower shell overlaps the authored skull and closes the helmet.
   */
  private addIndustrialHelmet(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const hardhat = new THREE.Group();
    hardhat.name = 'EI_ENGINEER_HARDHAT_V6';
    hardhat.userData.requiredPPE = true;

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.625, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.64),
      mat.helmet
    );
    dome.position.set(0, 0.700, -0.018);
    dome.scale.set(1.00, 0.82, 0.97);
    dome.castShadow = true;
    hardhat.add(dome);

    const lowerShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.585, 0.598, 0.245, 48, 1, false),
      mat.helmet
    );
    lowerShell.position.set(0, 0.500, -0.010);
    lowerShell.scale.z = 0.95;
    lowerShell.castShadow = true;
    hardhat.add(lowerShell);

    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.665, 0.675, 0.030, 48, 1, false),
      mat.helmet
    );
    brim.position.set(0, 0.375, 0.000);
    brim.scale.z = 0.91;
    brim.castShadow = true;
    hardhat.add(brim);

    const frontPeak = new THREE.Mesh(this.roundedPanelGeometry(0.48, 0.16, 0.035, 0.032), mat.helmet);
    frontPeak.rotation.x = Math.PI / 2;
    frontPeak.position.set(0, 0.372, 0.525);
    hardhat.add(frontPeak);

    const crownRidge = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.040, 0.36), mat.helmet);
    crownRidge.position.set(0, 1.060, -0.020);
    hardhat.add(crownRidge);

    for (const side of [-1, 1] as const) {
      const sideRib = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.205, 0.060), mat.helmet);
      sideRib.position.set(side * 0.445, 0.705, -0.020);
      sideRib.rotation.z = side * -0.20;
      hardhat.add(sideRib);
    }

    const badgeBase = new THREE.Mesh(this.roundedPanelGeometry(0.105, 0.060, 0.014, 0.012), mat.reflective);
    badgeBase.position.set(0, 0.525, 0.575);
    hardhat.add(badgeBase);
    const badgeMark = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.012, 0.006), mat.dark);
    badgeMark.position.set(0, 0.525, 0.584);
    hardhat.add(badgeMark);

    head.add(hardhat);
  }

  /** Dark rounded sunglasses aligned lower, directly over the authored eyes. */
  private addBlackSafetyGlasses(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const glasses = new THREE.Group();
    glasses.name = 'EI_BLACK_SUNGLASSES_V5';

    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(this.roundedPanelGeometry(0.205, 0.112, 0.028, 0.018), mat.sunglassLens);
      lens.position.set(side * 0.125, 0.392, 0.535);
      glasses.add(lens);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.018, 0.020), mat.dark);
      brow.position.set(side * 0.125, 0.452, 0.548);
      glasses.add(brow);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.018, 0.020), mat.dark);
      temple.position.set(side * 0.285, 0.414, 0.455);
      temple.rotation.y = side * 0.52;
      glasses.add(temple);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.020, 0.020), mat.dark);
    bridge.position.set(0, 0.410, 0.550);
    glasses.add(bridge);

    head.add(glasses);
  }

  /** Always use one solid squared EI vest that physically overlaps the torso. */
  private addIndustrialPpe(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const chest = root.getObjectByName('chest');
    const hips = root.getObjectByName('hips');
    if (!chest || !hips) return;

    const ppe = new THREE.Group();
    ppe.name = 'EI_ENGINEER_SOLID_VEST_V5';
    this.buildProfessionalVest(ppe, mat);
    this.addIdAndRadio(ppe, mat);
    chest.add(ppe);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.052, 0.42), mat.dark);
    belt.name = 'EI_ENGINEER_BELT_V5';
    belt.position.set(0, 0.082, 0.00);
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.058, 0.036), mat.reflective);
    buckle.position.set(0, 0.082, 0.220);
    hips.add(buckle);
  }

  private buildProfessionalVest(parent: THREE.Group, mat: HeroMaterialsV2): void {
    const vestBlock = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.535, 0.72), mat.accent);
    vestBlock.name = 'EI_VEST_SOLID_BLOCK';
    vestBlock.position.set(0, -0.035, 0.015);
    parent.add(vestBlock);

    const frontZ = 0.382;
    const centerSeam = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.455, 0.018), mat.dark);
    centerSeam.position.set(0, -0.035, frontZ);
    parent.add(centerSeam);

    const upperBand = new THREE.Mesh(new THREE.BoxGeometry(0.575, 0.032, 0.018), mat.reflective);
    upperBand.position.set(0, 0.045, frontZ + 0.002);
    parent.add(upperBand);

    const lowerBand = new THREE.Mesh(new THREE.BoxGeometry(0.575, 0.032, 0.018), mat.reflective);
    lowerBand.position.set(0, -0.145, frontZ + 0.002);
    parent.add(lowerBand);

    const backBand = new THREE.Mesh(new THREE.BoxGeometry(0.555, 0.032, 0.018), mat.reflective);
    backBand.position.set(0, -0.070, -0.354);
    parent.add(backBand);

    for (const side of [-1, 1] as const) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.085, 0.16), mat.accent);
      shoulder.position.set(side * 0.235, 0.245, 0.010);
      shoulder.rotation.z = side * 0.20;
      parent.add(shoulder);
    }
  }

  private addIdAndRadio(parent: THREE.Group, mat: HeroMaterialsV2): void {
    const id = new THREE.Group();
    id.name = 'EI_ENGINEER_ID_V5';
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.078, 0.012), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.011, 0.004), mat.accent);
    idMark.position.set(0, 0.019, 0.009);
    id.add(idBody, idMark);
    id.position.set(0.235, 0.105, 0.398);
    parent.add(id);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.076, 0.028), mat.dark);
    radio.position.set(-0.245, 0.112, 0.392);
    parent.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.046, 6), mat.dark);
    antenna.position.set(-0.245, 0.171, 0.392);
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

  private roundedPanelGeometry(width: number, height: number, radius: number, depth: number): THREE.ExtrudeGeometry {
    const w = width / 2;
    const h = height / 2;
    const r = Math.min(radius, w, h);
    const shape = new THREE.Shape();
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: Math.min(0.008, r * 0.35),
      bevelThickness: Math.min(0.006, depth * 0.35),
      steps: 1,
      curveSegments: 8
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }
}
