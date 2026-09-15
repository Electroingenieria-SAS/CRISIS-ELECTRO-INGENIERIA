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

type HairStyle = 'bun' | 'buzz' | 'short' | 'pony' | 'side' | 'wave' | 'crop';

interface IdentityProfile {
  scale: [number, number, number];
  skin: number;
  hair: number;
  eyes: number;
  headScale: [number, number, number];
  hairStyle: HairStyle;
  helmetColor?: number;
  vestDepth: number;
  accessory: 'radio' | 'tools' | 'clipboard' | 'tablet' | 'badge';
}

/**
 * Skeletal staff actors share a rig for performance, but not an appearance.
 * Every named NPC receives its own proportions, face, hair, palette and props.
 */
export class RiggedStaffCharacter {
  async load(style: RiggedStaffStyle): Promise<RiggedStaffAsset> {
    const { scene, clips } = await RiggedCharacterLibrary.clone();
    const profile = this.identity(style);

    const root = new THREE.Group();
    root.name = `${style.id}-rigged`;
    const visual = scene;
    visual.name = `${style.id}-skeleton`;

    // KayKit characters face +Z. World/NPC controllers rotate the outer root;
    // an extra 180-degree turn here caused the same backwards-facing issue as
    // the hero locomotion.
    visual.rotation.set(0, 0, 0);
    visual.scale.set(...profile.scale);
    root.add(visual);

    this.hideMedieval(visual);
    this.applyRoleMaterials(visual, style);
    this.addRoleIdentity(visual, style, profile);

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

  private applyRoleMaterials(root: THREE.Object3D, style: RiggedStaffStyle): void {
    const palette = this.palette(style);
    const shirt = new THREE.MeshPhysicalMaterial({ color: palette.shirt, roughness: 0.56, metalness: 0.025, clearcoat: 0.09, clearcoatRoughness: 0.5 });
    const trousers = new THREE.MeshStandardMaterial({ color: palette.trousers, roughness: 0.79, metalness: 0.02 });
    const boots = new THREE.MeshStandardMaterial({ color: palette.boots, roughness: 0.64, metalness: 0.1 });

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = node.name.toLowerCase();
      if (name.includes('body') || name.includes('torso') || name.includes('arm')) node.material = shirt;
      else if (name.includes('leg') || name.includes('pants')) node.material = trousers;
      else if (name.includes('boot') || name.includes('shoe')) node.material = boots;
    });
  }

  private addRoleIdentity(root: THREE.Object3D, style: RiggedStaffStyle, profile: IdentityProfile): void {
    const chest = root.getObjectByName('chest');
    const head = root.getObjectByName('head');
    const handL = root.getObjectByName('handslot.l') ?? root.getObjectByName('hand.l');
    const handR = root.getObjectByName('handslot.r') ?? root.getObjectByName('hand.r');
    if (!chest || !head) return;

    const accent = new THREE.MeshPhysicalMaterial({ color: style.accent, roughness: 0.4, metalness: 0.04, clearcoat: 0.26, clearcoatRoughness: 0.32 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe9f0f2, roughness: 0.72, metalness: 0.01 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111a1f, roughness: 0.69, metalness: 0.1 });
    const reflective = new THREE.MeshPhysicalMaterial({ color: 0xf4fbfc, roughness: 0.2, metalness: 0.08, clearcoat: 0.34, emissive: 0x739aa5, emissiveIntensity: 0.045 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9cc6d8, roughness: 0.08, transparent: true, opacity: 0.36, transmission: 0.24, thickness: 0.02 });
    const hair = new THREE.MeshStandardMaterial({ color: profile.hair, roughness: 0.84 });
    const skin = new THREE.MeshPhysicalMaterial({ color: profile.skin, roughness: 0.62, metalness: 0, clearcoat: 0.05 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf6f7f5, roughness: 0.48 });
    const iris = new THREE.MeshStandardMaterial({ color: profile.eyes, roughness: 0.42 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.4 });
    const lip = new THREE.MeshStandardMaterial({ color: style.feminine ? 0xa75d61 : 0x7c5149, roughness: 0.62 });

    this.addUniform(chest, style, profile, accent, white, dark, reflective);
    this.addCustomFace(head, style, profile, skin, eyeWhite, iris, pupil, lip, hair, dark);
    this.addHeadPPE(head, style, profile, accent, glass, dark, reflective);
    this.addRoleAccessory(chest, handL, handR, style, profile, accent, dark, reflective);
  }

  private addUniform(
    chest: THREE.Object3D,
    style: RiggedStaffStyle,
    profile: IdentityProfile,
    accent: THREE.Material,
    white: THREE.Material,
    dark: THREE.Material,
    reflective: THREE.Material
  ): void {
    if (style.labCoat) {
      const coat = new THREE.Group();
      coat.name = `${style.id}-lab-coat`;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.76, 0.09), white);
      back.position.set(0, -0.12, -0.29);
      coat.add(back);
      for (const side of [-1, 1] as const) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.075), white);
        lapel.position.set(side * 0.18, -0.08, 0.295);
        lapel.rotation.z = side * 0.075;
        coat.add(lapel);
      }
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.025), accent);
      pocket.position.set(0.23, -0.13, 0.35);
      coat.add(pocket);
      chest.add(coat);
      return;
    }

    const vest = new THREE.Group();
    vest.name = `${style.id}-vest`;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, profile.vestDepth), accent);
    front.position.set(0, -0.09, 0.29);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.54, profile.vestDepth * 0.82), accent);
    back.position.set(0, -0.09, -0.285);
    vest.add(front, back);
    for (const y of [-0.2, 0.01]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.69, 0.042, profile.vestDepth + 0.02), reflective);
      stripe.position.set(0, y, 0.31);
      vest.add(stripe);
    }
    if (style.role === 'maintenance') {
      const shoulderGuard = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.24), dark);
      shoulderGuard.position.set(0, 0.22, 0.04);
      vest.add(shoulderGuard);
    }
    chest.add(vest);
  }

  private addCustomFace(
    head: THREE.Object3D,
    style: RiggedStaffStyle,
    profile: IdentityProfile,
    skin: THREE.Material,
    eyeWhite: THREE.Material,
    iris: THREE.Material,
    pupil: THREE.Material,
    lip: THREE.Material,
    hair: THREE.Material,
    dark: THREE.Material
  ): void {
    const face = new THREE.Group();
    face.name = `${style.id}-custom-face`;

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.268, 24, 16), skin);
    skull.scale.set(...profile.headScale);
    skull.position.set(0, 0.015, 0.005);
    face.add(skull);

    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), skin);
      ear.scale.set(0.55, 1, 0.62);
      ear.position.set(side * 0.265 * profile.headScale[0], 0.01, 0);
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
      face.add(eye, irisMesh, pupilMesh);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.016), dark);
      brow.position.set(side * 0.09, 0.12, 0.257);
      brow.rotation.z = side * (style.id === 'npc-andres' ? -0.12 : 0.04);
      face.add(brow);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 10), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.005, 0.272);
    face.add(nose);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(style.feminine ? 0.095 : 0.082, 0.018, 0.018), lip);
    mouth.position.set(0, -0.085, 0.252);
    face.add(mouth);

    this.addHair(face, profile, hair);
    head.add(face);
  }

  private addHair(face: THREE.Group, profile: IdentityProfile, hair: THREE.Material): void {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.276, 22, 11, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    cap.position.set(0, 0.12, -0.015);
    cap.scale.set(1.02, profile.hairStyle === 'buzz' ? 0.58 : 0.82, 1.0);
    face.add(cap);

    if (profile.hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), hair);
      bun.position.set(0, 0.12, -0.265);
      face.add(bun);
    } else if (profile.hairStyle === 'pony') {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), hair);
      tail.position.set(0, -0.06, -0.29);
      tail.rotation.x = -0.18;
      face.add(tail);
    } else if (profile.hairStyle === 'side') {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.08), hair);
      side.position.set(-0.13, 0.075, -0.06);
      side.rotation.z = -0.2;
      face.add(side);
    } else if (profile.hairStyle === 'wave') {
      for (const x of [-0.16, -0.06, 0.06, 0.16]) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 7), hair);
        curl.position.set(x, 0.12 + Math.abs(x) * 0.18, 0.03);
        face.add(curl);
      }
    } else if (profile.hairStyle === 'crop') {
      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.055), hair);
      fringe.position.set(0.06, 0.145, 0.205);
      fringe.rotation.z = -0.08;
      face.add(fringe);
    }
  }

  private addHeadPPE(
    head: THREE.Object3D,
    style: RiggedStaffStyle,
    profile: IdentityProfile,
    accent: THREE.Material,
    glass: THREE.Material,
    dark: THREE.Material,
    reflective: THREE.Material
  ): void {
    if (style.helmet !== false) {
      const helmetMaterial = new THREE.MeshPhysicalMaterial({
        color: profile.helmetColor ?? style.accent,
        roughness: 0.34,
        metalness: 0.03,
        clearcoat: 0.42,
        clearcoatRoughness: 0.24
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.305, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMaterial);
      shell.position.set(0, 0.15, 0.01);
      shell.scale.set(1.02, 0.92, 0.96);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.325, 0.345, 0.043, 24), helmetMaterial);
      brim.position.set(0, 0.04, 0.03);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.018), accent);
      front.position.set(0, 0.205, 0.282);
      head.add(shell, brim, front);
    }

    if (style.glasses) {
      for (const side of [-1, 1] as const) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 8), glass);
        lens.scale.set(1, 0.55, 0.15);
        lens.position.set(side * 0.103, 0.04, 0.285);
        head.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.018), dark);
      bridge.position.set(0, 0.04, 0.304);
      head.add(bridge);
    }

    if (style.role === 'quality' || style.role === 'metrology') {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.03), reflective);
      clip.position.set(0.25, -0.08, 0.08);
      head.add(clip);
    }
  }

  private addRoleAccessory(
    chest: THREE.Object3D,
    handL: THREE.Object3D | undefined,
    handR: THREE.Object3D | undefined,
    style: RiggedStaffStyle,
    profile: IdentityProfile,
    accent: THREE.Material,
    dark: THREE.Material,
    reflective: THREE.Material
  ): void {
    if (profile.accessory === 'radio') {
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.07), dark);
      radio.position.set(-0.28, 0.11, 0.35);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 8), dark);
      antenna.position.set(-0.315, 0.27, 0.35);
      chest.add(radio, antenna);
    } else if (profile.accessory === 'tools') {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), dark);
      pouch.position.set(0.28, -0.3, 0.23);
      chest.add(pouch);
      if (handR) {
        const wrench = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.035), reflective);
        wrench.position.set(0, 0.08, 0.03);
        wrench.rotation.z = 0.18;
        handR.add(wrench);
      }
    } else if (profile.accessory === 'clipboard' && handL) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.028), dark);
      board.position.set(0, 0.08, 0.025);
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.012), reflective);
      page.position.set(0, 0.08, 0.045);
      handL.add(board, page);
    } else if ((profile.accessory === 'tablet' || style.tablet) && handL) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.035), dark);
      const screenMat = new THREE.MeshStandardMaterial({ color: style.accent, emissive: style.accent, emissiveIntensity: 0.16, roughness: 0.3 });
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.012), screenMat);
      screen.position.z = 0.024;
      const tablet = new THREE.Group();
      tablet.add(frame, screen);
      tablet.position.set(0, 0.08, 0.03);
      tablet.rotation.set(-0.3, 0.1, 0.1);
      handL.add(tablet);
    } else {
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.018), accent);
      badge.position.set(0.24, 0.1, 0.35);
      chest.add(badge);
    }
  }

  private identity(style: RiggedStaffStyle): IdentityProfile {
    const profiles: Record<string, IdentityProfile> = {
      'npc-laura': {
        scale: [0.84, 0.9, 0.84], skin: 0xd7a481, hair: 0x3a2925, eyes: 0x4c7088,
        headScale: [0.96, 1.04, 0.93], hairStyle: 'bun', vestDepth: 0.09, accessory: 'clipboard'
      },
      'npc-mateo': {
        scale: [0.97, 0.93, 0.98], skin: 0xb97957, hair: 0x241b18, eyes: 0x56665a,
        headScale: [1.05, 0.98, 1.01], hairStyle: 'buzz', helmetColor: 0xf3c83f, vestDepth: 0.125, accessory: 'radio'
      },
      'npc-andres': {
        scale: [0.91, 0.95, 0.91], skin: 0xc98e69, hair: 0x1f1b1a, eyes: 0x385e70,
        headScale: [0.99, 1.02, 0.96], hairStyle: 'crop', helmetColor: 0x4f9b68, vestDepth: 0.105, accessory: 'badge'
      },
      'npc-daniela': {
        scale: [0.82, 0.89, 0.83], skin: 0xdfad8c, hair: 0x50362d, eyes: 0x436d79,
        headScale: [0.94, 1.05, 0.92], hairStyle: 'pony', vestDepth: 0.09, accessory: 'tablet'
      },
      'npc-maintenance': {
        scale: [1.0, 0.94, 1.02], skin: 0xac7353, hair: 0x201c19, eyes: 0x536f78,
        headScale: [1.04, 0.99, 1.02], hairStyle: 'buzz', helmetColor: 0xf0b92f, vestDepth: 0.13, accessory: 'tools'
      },
      'npc-dispatch': {
        scale: [0.87, 0.91, 0.87], skin: 0xd6a07d, hair: 0x402a25, eyes: 0x4d6d79,
        headScale: [0.96, 1.03, 0.94], hairStyle: 'wave', helmetColor: 0xe2894d, vestDepth: 0.1, accessory: 'tablet'
      },
      'npc-capa-lead': {
        scale: [0.88, 0.93, 0.88], skin: 0xd3a083, hair: 0x342722, eyes: 0x566f80,
        headScale: [0.98, 1.04, 0.94], hairStyle: 'side', vestDepth: 0.09, accessory: 'tablet'
      }
    };

    return profiles[style.id] ?? {
      scale: [0.9, 0.92, 0.9], skin: 0xc98f6c, hair: style.hairColor ?? 0x352820, eyes: 0x4c6772,
      headScale: [1, 1, 1], hairStyle: style.feminine ? 'bun' : 'short', vestDepth: 0.1, accessory: style.tablet ? 'tablet' : 'badge'
    };
  }

  private palette(style: RiggedStaffStyle): { shirt: number; trousers: number; boots: number } {
    const byId: Record<string, { shirt: number; trousers: number; boots: number }> = {
      'npc-laura': { shirt: 0xcbdde5, trousers: 0x32434b, boots: 0x20282d },
      'npc-mateo': { shirt: 0x244d67, trousers: 0x303b40, boots: 0x151a1d },
      'npc-andres': { shirt: 0x315a4b, trousers: 0x27373d, boots: 0x151a1c },
      'npc-daniela': { shirt: 0xe3edf0, trousers: 0x42505a, boots: 0x242b30 },
      'npc-maintenance': { shirt: 0x6a562a, trousers: 0x343b3d, boots: 0x111719 },
      'npc-dispatch': { shirt: 0x6a3d2c, trousers: 0x2e3941, boots: 0x171b1d },
      'npc-capa-lead': { shirt: 0x514b72, trousers: 0x343945, boots: 0x1b2025 }
    };
    if (byId[style.id]) return byId[style.id];
    if (style.role === 'quality' || style.role === 'metrology') return { shirt: 0xdce8ed, trousers: 0x34434a, boots: 0x1d252a };
    if (style.role === 'warehouse' || style.role === 'dispatch') return { shirt: 0x25465b, trousers: 0x2c383f, boots: 0x151a1d };
    if (style.role === 'production') return { shirt: 0x294f43, trousers: 0x29383d, boots: 0x151a1d };
    if (style.role === 'maintenance') return { shirt: 0x5b4c2a, trousers: 0x30383a, boots: 0x111719 };
    return { shirt: 0x3f3d5b, trousers: 0x30353d, boots: 0x181d22 };
  }
}
