import * as THREE from 'three';
import { CharacterFactory, type CharacterModel, type CharacterStyle } from './CharacterFactory';

type StaffEntry = { anchor: THREE.Group; model: CharacterModel; phase: number };

/**
 * Replaces the old prototype worker meshes while preserving their gameplay anchors.
 * Actions, prompts and markers keep pointing at the same groups; only the visual body
 * is rebuilt using the V8 character system.
 */
export class StaffDirector {
  private readonly factory = new CharacterFactory();
  private readonly staff: StaffEntry[] = [];
  private time = 0;

  rebuild(root: THREE.Object3D): void {
    const anchors: THREE.Group[] = [];
    root.traverse((node) => {
      if (node.name !== 'worker-head') return;
      const parent = node.parent;
      if (parent instanceof THREE.Group && !anchors.includes(parent)) anchors.push(parent);
    });

    anchors.forEach((anchor, index) => {
      const position = anchor.getWorldPosition(new THREE.Vector3());
      const style = this.styleFor(position);
      const marker = anchor.userData.marker as THREE.Object3D | undefined;
      const keep = marker ? new Set<THREE.Object3D>([marker]) : new Set<THREE.Object3D>();
      [...anchor.children].forEach((child) => {
        if (!keep.has(child)) anchor.remove(child);
      });

      const model = this.factory.create(style);
      model.visual.scale.setScalar(1.04);
      anchor.add(model.visual);
      anchor.name = `staff-${style.name.toLowerCase()}`;
      anchor.userData.staffName = style.name;
      anchor.userData.staffRole = style.role;
      this.staff.push({ anchor, model, phase: index * 1.37 });
    });
  }

  update(dt: number): void {
    this.time += dt;
    for (const entry of this.staff) this.factory.animateIdle(entry.model, this.time, entry.phase);
  }

  private styleFor(position: THREE.Vector3): CharacterStyle {
    if (position.x < -40 && position.z > 0) {
      return {
        name: 'Mateo', role: 'warehouse', accent: 0xf3c83f,
        skin: 0xb97855, hair: 0x2b211d, eye: 0x3e5967, hairStyle: 'short',
        helmet: true, glasses: false, beard: true, vest: true, radio: true
      };
    }

    if (position.x < 0 && position.z < -15) {
      return {
        name: 'Andrés', role: 'production', accent: 0x55b985,
        skin: 0xc88b67, hair: 0x211b18, eye: 0x4f5b40, hairStyle: 'buzz',
        helmet: true, glasses: true, beard: false, vest: true, radio: true
      };
    }

    if (position.x > 5 && position.z < -15) {
      return {
        name: 'Daniela', role: 'metrology', accent: 0x7eb7ff,
        skin: 0xd6a17f, hair: 0x3b2923, eye: 0x4a6c82, hairStyle: 'ponytail', feminine: true,
        helmet: false, glasses: true, labCoat: true, vest: false, radio: false, tablet: true
      };
    }

    return {
      name: 'Laura', role: 'quality', accent: 0x61c6f2,
      skin: 0xd9aa87, hair: 0x4b2e29, eye: 0x4d7085, hairStyle: 'bun', feminine: true,
      helmet: false, glasses: true, labCoat: false, vest: true, radio: true, tablet: true
    };
  }
}
