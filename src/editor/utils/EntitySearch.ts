import type { Scene } from '../../scene/Scene';
import type { Entity } from '../../scene/Entity';

export class EntitySearch {
  constructor(private readonly scene: Scene) {}

  filter(predicate: (entity: Entity) => boolean): Entity[] {
    return this.scene.getAllEntities().filter(predicate);
  }

  search(query: string): Entity[] {
    const q = (query ?? '').toLowerCase();
    if (!q) return [];
    return this.scene.getAllEntities().filter((e) => e.name.toLowerCase().includes(q));
  }

  filterByType(meshType: string): Entity[] {
    return this.scene.getAllEntities().filter((e) => e.meshType === (meshType as any));
  }
}
