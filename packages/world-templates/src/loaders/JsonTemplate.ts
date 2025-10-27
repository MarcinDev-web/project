import { Scene, type SceneData } from '@engine/world';
import type { TemplateMetadata, TemplateProvider } from '../types';

export function createJsonTemplate(
  meta: TemplateMetadata,
  data: SceneData | (() => Promise<SceneData>)
): TemplateProvider {
  return {
    meta,
    build: async () => {
      const sceneData = typeof data === 'function' ? await data() : data;
      return Scene.fromJSON(sceneData);
    },
  };
}


