import { World as EnvironmentWorld } from './WorldEnvironmentCore';
import { installVerticalSliceFurnitureColliders } from './world/ZoneCollisionProfiles';

/**
 * Public V8 world entry point.
 *
 * The environment compositor remains the single runtime implementation. This
 * thin entry point installs the audited collision profile after sector geometry
 * is composed, keeping gameplay collision data centralized and inspectable.
 */
export class World extends EnvironmentWorld {
  override init(): void {
    super.init();
    installVerticalSliceFurnitureColliders(this.colliders);
  }
}
