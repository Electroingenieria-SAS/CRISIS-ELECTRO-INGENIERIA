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
  glass: THREE.MeshPhysicalMaterial;
  helmet: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshStandardMaterial;
  boots: THREE.MeshPhysicalMaterial;
};

/**
 * Second-pass KayKit engineer conversion.
 *
 * Important design rule: the original KayKit head/face remains authoritative.
 * We never add replacement eyes. Black eyes, nose and mouth come from the
 * Adventurers asset itself; industrial equipment is layered around that face.
 */
export class EngineerHeroCharacterV2 {
  async load(appearance: HeroAppearance): Promise<EngineerHeroAssetV2> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();
    const root = new THREE.Group();
    root.name = 'V8_ENGINEER_HERO_V2';

    scene.name = 'V8_ENGINEER_HERO_V2_RIG';
    scene.rotation.set(0, 0, 0);
    scene.scale.copy(this.buildScale(appearance.build));
    root.add(scene);

    const mat = this.materials(appearance);
    this.convertKayKitSurface(scene, appearance);
    this.addHairAccent(scene, appearance, mat);
    this.addIndustrialHelmet(scene, mat);
    if (appearance.glasses) this.addSafetyGlasses(scene, mat);
    this.addIndustrialPpe(scene, appearance, mat);
    this.addWorkDetails(scene, appearance, mat);
    this.addScanner(scene, mat);

    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = true;
    });

    root.userData.heroAsset = 'KayKit Knight → EI Engineer V2';
    root.userData.heroStyle = 'kaykit-engineer-v2';
    root.userData.usesKayKitFace = true;
    root.userData.extraEyes = false;
    root.userData.appearance = { ...appearance };

    return { root, animator: new RiggedHeroAnimator(root, clips) };
  }

  private buildScale(build: HeroBuild): THREE.Vector3 {
    if (build === 'slim') return new THREE.Vector3(0.95, 0.99, 0.95);
    if (build === 'athletic') return new THREE.Vector3(1.055, 1.01, 1.035);
    return new THREE.Vector3(1, 1, 1);
  }

  private materials(appearance: HeroAppearance): HeroMaterialsV2 {
    const bootColor = appearance.bootStyle === 'yellow' ? 0x9e7324 : appearance.bootStyle === 'steel' ? 0x44545e : 0x11181d;
    return {
      accent: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.vest),
        roughness: 0.46,
        metalness: 0.01,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x11181d, roughness: 0.72, metalness: 0.06 }),
      reflective: new THREE.MeshPhysicalMaterial({
        color: 0xf0f5f5,
        roughness: 0.28,
        metalness: 0.06,
        clearcoat: 0.18,
        emissive: 0x688d9a,
        emissiveIntensity: 0.025
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xdff6fb,
        transparent: true,
        opacity: 0.10,
        transmission: 0.03,
        thickness: 0.01,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false
      }),
      helmet: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(appearance.helmet),
        roughness: 0.32,
        metalness: 0.01,
        clearcoat: 0.32,
        clearcoatRoughness: 0.28
      }),
      hair: new THREE.MeshStandardMaterial({ color: new THREE.Color(appearance.hair), roughness: 0.82 }),
      boots: new THREE.MeshPhysicalMaterial({
        color: bootColor,
        roughness: 0.52,
        metalness: 0.05,
        clearcoat: 0.08,
        clearcoatRoughness: 0.55
      })
    };
  }

  private convertKayKitSurface(root: THREE.Object3D, appearance: HeroAppearance): void {
    const uniformColor = appearance.uniform === 'graphite' ? 0x4a5359 : appearance.uniform === 'teal' ? 0x5d8586 : 0x4e7b91;
    const pantsColor = appearance.pantsStyle === 'graphite' ? 0x4c5054 : appearance.pantsStyle === 'technical' ? 0x54717a : 0x5a6c71;
    const skinTint = new THREE.Color(appearance.skin).lerp(new THREE.Color(0xffffff), 0.18);

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();

      if (name.includes('cape') || name.includes('helmetvisor') || name === 'knight_helmet') {
        node.visible = false;
        return;
      }

      // Preserve the original KayKit texture. This keeps the authored black eyes,
      // brows, nose and mouth. We only multiply the mapped material by a tint.
      if (name === 'knight_head') this.tintMappedMesh(node, skinTint, 0.66);
      else if (name.includes('leg')) this.tintMappedMesh(node, pantsColor, 0.74);
      else if (name.includes('arm') || name.includes('body')) this.tintMappedMesh(node, uniformColor, 0.66);
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

    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => cloneMaterial(m))
      : cloneMaterial(mesh.material);
  }

  private addHairAccent(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    if (appearance.hairStyle === 'buzz') return;
    const head = root.getObjectByName('head');
    if (!head) return;

    const hair = new THREE.Group();
    hair.name = 'EI_ENGINEER_HAIR_ACCENT';

    for (const side of [-1, 1] as const) {
      const sideLock = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035, appearance.hairStyle === 'wave' ? 0.13 : 0.08, 4, 8),
        mat.hair
      );
      sideLock.position.set(side * 0.43, 0.59, 0.00);
      sideLock.rotation.z = side * 0.10;
      hair.add(sideLock);
    }

    if (appearance.hairStyle === 'side') {
      const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), mat.hair);
      sweep.position.set(-0.14, 0.77, 0.27);
      sweep.rotation.z = -0.72;
      hair.add(sweep);
    } else if (appearance.hairStyle === 'wave') {
      for (const x of [-0.20, 0, 0.20]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 7), mat.hair);
        curl.position.set(x, 0.77 + Math.abs(x) * 0.06, 0.16);
        hair.add(curl);
      }
    }

    head.add(hair);
  }

  private addIndustrialHelmet(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const hardhat = new THREE.Group();
    hardhat.name = 'EI_ENGINEER_HARDHAT_V2';
    hardhat.userData.requiredPPE = true;

    // The head bone sits at the base of the KayKit head. The brim is therefore
    // intentionally above eye height (~0.50 local Y), not across the face.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.50, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.50),
      mat.helmet
    );
    shell.position.set(0, 0.82, -0.005);
    shell.scale.set(1.0, 0.70, 0.92);
    hardhat.add(shell);

    const brimRing = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.032, 8, 36), mat.helmet);
    brimRing.rotation.x = Math.PI / 2;
    brimRing.position.set(0, 0.79, 0.00);
    hardhat.add(brimRing);

    const frontBrim = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.026, 0.15), mat.helmet);
    frontBrim.position.set(0, 0.785, 0.43);
    hardhat.add(frontBrim);

    const crownRidge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.038, 0.34), mat.helmet);
    crownRidge.position.set(0, 1.095, 0.005);
    hardhat.add(crownRidge);

    for (const side of [-1, 1] as const) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.045), mat.dark);
      clip.position.set(side * 0.41, 0.80, 0.02);
      hardhat.add(clip);
    }

    head.add(hardhat);
  }

  private addSafetyGlasses(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const head = root.getObjectByName('head');
    if (!head) return;

    const glasses = new THREE.Group();
    glasses.name = 'EI_ENGINEER_SAFETY_GLASSES_V2';

    // Clear, flat lenses: the original KayKit black eyes remain fully visible.
    for (const side of [-1, 1] as const) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.105, 0.010), mat.glass);
      lens.position.set(side * 0.145, 0.505, 0.548);
      glasses.add(lens);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.016, 0.016), mat.dark);
      brow.position.set(side * 0.145, 0.568, 0.557);
      glasses.add(brow);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.014), mat.dark);
      temple.position.set(side * 0.31, 0.525, 0.45);
      temple.rotation.y = side * 0.46;
      glasses.add(temple);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.014, 0.014), mat.dark);
    bridge.position.set(0, 0.525, 0.557);
    glasses.add(bridge);
    head.add(glasses);
  }

  private addIndustrialPpe(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    const chest = root.getObjectByName('chest');
    const hips = root.getObjectByName('hips');
    if (!chest || !hips) return;

    const ppe = new THREE.Group();
    ppe.name = `EI_ENGINEER_PPE_V2_${appearance.ppeStyle.toUpperCase()}`;

    if (appearance.ppeStyle === 'vest') this.buildVest(ppe, mat);
    else if (appearance.ppeStyle === 'harness') this.buildHarness(ppe, mat);

    this.addIdAndRadio(ppe, mat);
    chest.add(ppe);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.060, 0.43), mat.dark);
    belt.name = 'EI_ENGINEER_BELT_V2';
    belt.position.set(0, 0.085, 0.00);
    hips.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.070, 0.040), mat.reflective);
    buckle.position.set(0, 0.085, 0.235);
    hips.add(buckle);
  }

  private buildVest(parent: THREE.Group, mat: HeroMaterialsV2): void {
    for (const side of [-1, 1] as const) {
      const panel = new THREE.Mesh(this.vestPanelGeometry(side), mat.accent);
      panel.position.set(0, 0, 0.385);
      parent.add(panel);

      const reflective = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.032, 0.018), mat.reflective);
      reflective.position.set(side * 0.17, -0.080, 0.422);
      parent.add(reflective);

      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.045, 0.024), mat.accent);
      shoulder.position.set(side * 0.22, 0.235, 0.365);
      shoulder.rotation.z = side * 0.50;
      parent.add(shoulder);
    }

    const waistReflective = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.032, 0.018), mat.reflective);
    waistReflective.position.set(0, -0.185, 0.420);
    parent.add(waistReflective);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.026), mat.accent);
    back.position.set(0, 0.005, -0.385);
    parent.add(back);

    const backBand = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.032, 0.018), mat.reflective);
    backBand.position.set(0, -0.070, -0.405);
    parent.add(backBand);
  }

  private buildHarness(parent: THREE.Group, mat: HeroMaterialsV2): void {
    for (const side of [-1, 1] as const) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.47, 0.024), mat.accent);
      strap.position.set(side * 0.16, 0.015, 0.395);
      strap.rotation.z = side * 0.11;
      parent.add(strap);

      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.024), mat.accent);
      shoulder.position.set(side * 0.20, 0.235, 0.365);
      shoulder.rotation.z = side * 0.47;
      parent.add(shoulder);
    }

    const chestBand = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.045, 0.024), mat.reflective);
    chestBand.position.set(0, 0.055, 0.415);
    parent.add(chestBand);

    const waistBand = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.026), mat.accent);
    waistBand.position.set(0, -0.180, 0.405);
    parent.add(waistBand);
  }

  private vestPanelGeometry(side: -1 | 1): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    const xOuter = side * 0.31;
    const xInner = side * 0.035;
    const xShoulder = side * 0.145;

    shape.moveTo(xInner, -0.22);
    shape.lineTo(xOuter, -0.22);
    shape.lineTo(xOuter, 0.16);
    shape.lineTo(xShoulder, 0.27);
    shape.lineTo(xInner, 0.17);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.008,
      bevelThickness: 0.007,
      steps: 1,
      curveSegments: 4
    });
    geometry.translate(0, 0, -0.013);
    return geometry;
  }

  private addIdAndRadio(parent: THREE.Group, mat: HeroMaterialsV2): void {
    const id = new THREE.Group();
    const idBody = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, 0.018), mat.reflective);
    const idMark = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.020, 0.006), mat.accent);
    idMark.position.set(0, 0.032, 0.013);
    id.add(idBody, idMark);
    id.position.set(0.255, 0.095, 0.420);
    parent.add(id);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.135, 0.050), mat.dark);
    radio.position.set(-0.275, 0.100, 0.405);
    parent.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.085, 7), mat.dark);
    antenna.position.set(-0.275, 0.205, 0.405);
    parent.add(antenna);
  }

  private addWorkDetails(root: THREE.Object3D, appearance: HeroAppearance, mat: HeroMaterialsV2): void {
    for (const side of ['l', 'r'] as const) {
      const hand = root.getObjectByName(`hand.${side}`);
      const foot = root.getObjectByName(`foot.${side}`);
      if (hand && appearance.gloves) {
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 10), mat.dark);
        glove.scale.set(0.84, 0.95, 0.82);
        glove.position.set(0, 0.028, 0);
        hand.add(glove);
      }

      if (foot) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 9), mat.boots);
        toe.scale.set(1.0, 0.62, 1.20);
        toe.position.set(0, 0.080, 0.105);
        foot.add(toe);

        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.030, 0.315), mat.dark);
        sole.position.set(0, 0.018, 0.080);
        foot.add(sole);
      }
    }
  }

  private addScanner(root: THREE.Object3D, mat: HeroMaterialsV2): void {
    const hand = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!hand) return;

    const scanner = new THREE.Group();
    scanner.name = 'EI_HAND_SCANNER_RIGGED';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.190, 0.075), mat.dark);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.080, 0.010), mat.accent);
    screen.position.set(0, 0.030, 0.043);
    scanner.add(body, screen);
    scanner.position.set(0, -0.120, 0.095);
    scanner.rotation.set(-0.35, 0.08, 0);
    scanner.visible = false;
    hand.add(scanner);
  }
}
