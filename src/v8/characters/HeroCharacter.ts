import * as THREE from 'three';
import type { HeroAppearance } from '../types';
import { CharacterFactory, type CharacterModel, type CharacterRole, type HairStyle } from '../visual/CharacterFactory';

export interface HeroStyle {
  name: string;
  role: CharacterRole;
  accent: number;
  appearance: HeroAppearance;
}

/** Customized procedural fallback shown only until the skeletal hero is ready. */
export class HeroCharacter {
  private readonly factory = new CharacterFactory();

  create(style: HeroStyle): CharacterModel {
    const appearance = style.appearance;
    const hairStyle: HairStyle = appearance.hairStyle === 'wave' ? 'side' : appearance.hairStyle;
    const model = this.factory.create({
      name: style.name,
      role: style.role,
      accent: style.accent,
      skin: new THREE.Color(appearance.skin).getHex(),
      hair: new THREE.Color(appearance.hair).getHex(),
      eye: 0x4b7184,
      hairStyle,
      helmet: true,
      glasses: appearance.glasses,
      vest: true,
      radio: true,
      tablet: true
    });

    if (appearance.build === 'slim') model.visual.scale.set(0.92, 1, 0.94);
    else if (appearance.build === 'athletic') model.visual.scale.set(1.08, 1.02, 1.04);

    this.addMandatoryHelmetCue(model);
    this.finish(model);
    return model;
  }

  private addMandatoryHelmetCue(model: CharacterModel): void {
    const yellow = new THREE.MeshPhysicalMaterial({ color: 0xf3c83f, roughness: 0.34, clearcoat: 0.42, clearcoatRoughness: 0.24 });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.48), yellow);
    ridge.position.set(0, 0.25, 0.015);
    ridge.name = 'fallback-hardhat-ridge';
    model.rig.head.add(ridge);
    model.rig.head.userData.requiredPPE = true;
  }

  private finish(model: CharacterModel): void {
    model.visual.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    model.root.userData.heroQuality = true;
  }
}
