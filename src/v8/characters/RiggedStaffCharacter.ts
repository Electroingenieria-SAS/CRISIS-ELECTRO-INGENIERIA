import * as THREE from 'three';
import type { CharacterRole } from '../visual/CharacterFactory';
import { RiggedCharacterLibrary } from './RiggedCharacterLibrary';

export interface RiggedStaffStyle {
  id: string;
  role: CharacterRole;
  accent: number;
  feminine?: boolean;
  helmet?: boolean;
  glasses?: boolean;
  labCoat?: boolean;
  tablet?: boolean;
  hairColor?: number;
}

export interface RiggedStaffAsset {
  root: THREE.Group;
  visual: THREE.Group;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  interact?: THREE.AnimationAction;
  useItem?: THREE.AnimationAction;
  head?: THREE.Object3D;
}

/** Rigged staff visual using the same cached local skeleton as the hero. */
export class RiggedStaffCharacter {
  async load(style: RiggedStaffStyle): Promise<RiggedStaffAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();
    const root = new THREE.Group();
    root.name = `${style.id}-rigged`;
    const visual = scene;
    visual.name = `${style.id}-skeleton`;
    visual.rotation.y = Math.PI;
    visual.scale.set(0.9 * (style.feminine ? 0.96 : 1), 0.9 * (style.feminine ? 0.98 : 1), 0.9);
    root.add(visual);

    this.hideMedieval(visual);
    this.applyRoleMaterials(visual, style);
    this.addRoleIdentity(visual, style);

    visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = true;
      }
    });

    const mixer = new THREE.AnimationMixer(root);
    const idle = mixer.clipAction(clips.idle);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.play();

    const interact = clips.interact ? mixer.clipAction(clips.interact) : undefined;
    if (interact) {
      interact.setLoop(THREE.LoopOnce, 1);
      interact.clampWhenFinished = false;
    }
    const useItem = clips.useItem ? mixer.clipAction(clips.useItem) : undefined;
    if (useItem) {
      useItem.setLoop(THREE.LoopOnce, 1);
      useItem.clampWhenFinished = false;
    }

    return { root, visual, mixer, idle, interact, useItem, head: visual.getObjectByName('head') };
  }

  private hideMedieval(root: THREE.Object3D): void {
    root.traverse((node) => {
      const name = node.name.toLowerCase();
      if (name.includes('cape') || name.includes('helmetvisor') || name === 'knight_helmet' || name.includes('sword') || name.includes('shield')) node.visible = false;
    });
  }

  private applyRoleMaterials(root: THREE.Object3D, style: RiggedStaffStyle): void {
    const palette = this.palette(style.role);
    const shirt = new THREE.MeshPhysicalMaterial({ color: palette.shirt, roughness: 0.58, metalness: 0.025, clearcoat: 0.08 });
    const trousers = new THREE.MeshStandardMaterial({ color: palette.trousers, roughness: 0.8, metalness: 0.02 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x10171b, roughness: 0.66, metalness: 0.1 });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();
      if (name.includes('body') || name.includes('torso') || name.includes('arm')) node.material = shirt;
      else if (name.includes('leg') || name.includes('pants')) node.material = trousers;
      else if (name.includes('boot') || name.includes('shoe')) node.material = boots;
    });
  }

  private addRoleIdentity(root: THREE.Object3D, style: RiggedStaffStyle): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handL = root.getObjectByName('handslot.l') ?? root.getObjectByName('hand.l');
    if (!chest || !head) return;

    const accent = new THREE.MeshPhysicalMaterial({ color: style.accent, roughness: 0.42, metalness: 0.04, clearcoat: 0.24, clearcoatRoughness: 0.34 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeaf0f1, roughness: 0.74, metalness: 0.01 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111a1f, roughness: 0.7, metalness: 0.1 });
    const reflective = new THREE.MeshPhysicalMaterial({ color: 0xf4fbfc, roughness: 0.22, metalness: 0.08, clearcoat: 0.3, emissive: 0x749ca6, emissiveIntensity: 0.045 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9cc6d8, roughness: 0.08, transparent: true, opacity: 0.36, transmission: 0.24, thickness: 0.02 });
    const hair = new THREE.MeshStandardMaterial({ color: style.hairColor ?? 0x362720, roughness: 0.84 });

    if (style.labCoat) {
      const coat = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.74, 0.09), white);
      back.position.set(0, -0.12, -0.28);
      coat.add(back);
      for (const side of [-1, 1] as const) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.62, 0.075), white);
        lapel.position.set(side * 0.18, -0.08, 0.29);
        lapel.rotation.z = side * 0.07;
        coat.add(lapel);
      }
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.018), accent);
      badge.position.set(0.23, 0.11, 0.35);
      coat.add(badge);
      chest.add(coat);
    } else {
      const vest = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.1), accent);
      front.position.set(0, -0.09, 0.29);
      vest.add(front);
      for (const y of [-0.2, 0.01]) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.042, 0.12), reflective);
        stripe.position.set(0, y, 0.31);
        vest.add(stripe);
      }
      chest.add(vest);
    }

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairCap.position.set(0, 0.09, -0.018);
    hairCap.scale.set(style.feminine ? 0.98 : 1, style.feminine ? 0.9 : 0.8, 0.98);
    head.add(hairCap);
    if (style.feminine) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 4, 8), hair);
      tail.position.set(0, -0.08, -0.28);
      tail.rotation.x = -0.12;
      head.add(tail);
    }

    if (style.helmet !== false) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), accent);
      shell.position.set(0, 0.14, 0.008);
      shell.scale.set(1.02, 0.92, 0.96);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.345, 0.043, 24), accent);
      brim.position.set(0, 0.035, 0.03);
      head.add(shell, brim);
    }

    if (style.glasses) {
      for (const side of [-1, 1] as const) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 8), glass);
        lens.scale.set(1, 0.55, 0.15);
        lens.position.set(side * 0.103, 0.015, 0.282);
        head.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.018), dark);
      bridge.position.set(0, 0.015, 0.302);
      head.add(bridge);
    }

    const roleAccessory = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.065), dark);
    roleAccessory.position.set(-0.28, 0.11, 0.35);
    chest.add(roleAccessory);

    if (style.tablet && handL) {
      const tablet = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.035), dark);
      const screenMat = new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.accent, emissiveIntensity: 0.16, roughness: 0.3 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.012), screenMat);
      screen.position.z = 0.024;
      tablet.add(frame, screen);
      tablet.position.set(0, 0.08, 0.03);
      tablet.rotation.set(-0.3, 0.1, 0.1);
      handL.add(tablet);
    }
  }

  private palette(role: CharacterRole): { shirt: number; trousers: number } {
    if (role === 'quality' || role === 'metrology') return { shirt: 0xdce8ed, trousers: 0x34434a };
    if (role === 'warehouse' || role === 'dispatch') return { shirt: 0x25465b, trousers: 0x2c383f };
    if (role === 'production') return { shirt: 0x294f43, trousers: 0x29383d };
    if (role === 'maintenance') return { shirt: 0x5b4c2a, trousers: 0x30383a };
    return { shirt: 0x3f3d5b, trousers: 0x30353d };
  }
}
