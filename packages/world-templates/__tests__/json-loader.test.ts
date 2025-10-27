import { describe, it, expect } from 'vitest';
import { createJsonTemplate } from '../src/loaders/JsonTemplate';
import { instantiate } from '../src/registry/TemplateRegistry';
import { Scene } from '@engine/world';

describe('JsonTemplate loader', () => {
  it('instantiates from inline SceneData', async () => {
    const data = new Scene('Inline').toJSON();
    const provider = createJsonTemplate(
      { id: 'test:inline', kind: 'template', name: 'Inline' },
      data
    );
    const id = provider.meta.id;
    // instantiate requires registration; call provider.build directly
    const scene = await provider.build();
    expect(scene).toBeInstanceOf(Scene);
  });
});


