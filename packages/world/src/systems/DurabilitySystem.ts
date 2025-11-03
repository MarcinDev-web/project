import type { Scene } from '../core/Scene.js';
import { DurabilityComponent } from '../components/DurabilityComponent.js';

export class DurabilitySystem {
  private readonly scene: Scene;
  constructor(scene: Scene) { this.scene = scene; }

  update(): void {
    const entities = this.scene.queryEntities(DurabilityComponent);
    for (const e of entities) {
      const d = e.getComponent(DurabilityComponent);
      if (!d) continue;
      // Placeholder: passive decay could be applied here
      void d;
    }
  }
}


