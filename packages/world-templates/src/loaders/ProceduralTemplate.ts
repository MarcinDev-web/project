import type { Scene } from '@engine/world';
import { Scene as WorldScene } from '@engine/world';
import type { TemplateMetadata, TemplateProvider } from '../types';

export function createProceduralTemplate(
  meta: TemplateMetadata,
  builder: (scene?: Scene) => Scene | Promise<Scene>
): TemplateProvider {
  return {
    meta,
    build: async () => {
      const temp = new WorldScene(meta.name);
      const result = await builder(temp);
      return result ?? temp;
    },
  };
}


