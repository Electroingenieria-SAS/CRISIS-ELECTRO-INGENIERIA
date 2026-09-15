import * as THREE from 'three';
import type { WorldContextTarget, WorldObjectDefinition, WorldObjectKind } from '../types';

const DEFAULT_PROMPTS: Record<WorldObjectKind, string> = {
  static: 'Examinar',
  interactable: 'Interactuar',
  pickup: 'Recoger',
  carryable: 'Levantar',
  movable: 'Empujar',
  breakable: 'Golpear',
  container: 'Abrir',
  puzzle: 'Activar',
  door: 'Abrir',
  npc: 'Hablar',
  'combat-zone': 'Entrar',
  trigger: 'Activar'
};

export class WorldObjectRegistry {
  private readonly objects = new Map<string, WorldObjectDefinition>();
  private readonly worldPosition = new THREE.Vector3();

  register(definition: WorldObjectDefinition): WorldObjectDefinition {
    definition.object.userData.worldObjectId = definition.id;
    definition.object.userData.worldObjectKind = definition.kind;
    definition.enabled ??= true;
    this.objects.set(definition.id, definition);
    return definition;
  }

  registerMany(definitions: WorldObjectDefinition[]): void {
    for (const definition of definitions) this.register(definition);
  }

  get(id: string): WorldObjectDefinition | null {
    return this.objects.get(id) ?? null;
  }

  all(): WorldObjectDefinition[] {
    return [...this.objects.values()];
  }

  byKind(...kinds: WorldObjectKind[]): WorldObjectDefinition[] {
    const accepted = new Set(kinds);
    return this.all().filter((entry) => accepted.has(entry.kind));
  }

  remove(id: string): WorldObjectDefinition | null {
    const item = this.objects.get(id) ?? null;
    if (item) this.objects.delete(id);
    return item;
  }

  setEnabled(id: string, enabled: boolean): void {
    const item = this.objects.get(id);
    if (item) item.enabled = enabled;
  }

  nearest(position: THREE.Vector3, kinds: WorldObjectKind[], maxDistance = Infinity): WorldContextTarget | null {
    const accepted = new Set(kinds);
    let best: WorldContextTarget | null = null;

    for (const entry of this.objects.values()) {
      if (entry.enabled === false || !entry.object.visible || !accepted.has(entry.kind)) continue;
      const radius = entry.radius ?? 2.0;
      const distance = entry.object.getWorldPosition(this.worldPosition).distanceTo(position);
      if (distance > Math.min(radius, maxDistance)) continue;
      if (best && distance >= best.distance) continue;

      best = {
        id: entry.id,
        kind: entry.kind,
        label: entry.label,
        prompt: entry.prompt ?? DEFAULT_PROMPTS[entry.kind],
        key: entry.key ?? (entry.kind === 'breakable' ? 'SPACE' : 'E'),
        object: entry.object,
        distance
      };
    }

    return best;
  }
}
