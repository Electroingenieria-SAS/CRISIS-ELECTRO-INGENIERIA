import * as THREE from 'three';
import { World as WorldCore } from './WorldCore';
import { StaffDirector } from './visual/StaffDirector';

export class World extends WorldCore {
  private readonly staff = new StaffDirector();

  constructor(scene: THREE.Scene) {
    super(scene);
  }

  override init(): void {
    super.init();
    this.staff.rebuild(this.group);
  }

  override update(dt: number): void {
    super.update(dt);
    this.staff.update(dt);
  }
}
