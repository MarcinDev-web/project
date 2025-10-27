import { describe, it, expect, beforeEach } from 'vitest';
import { listTemplates, getTemplate, registerTemplates, instantiate, applyTo } from '../src';
import { createProceduralTemplate } from '../src/loaders/ProceduralTemplate';
import { Scene, Entity } from '@engine/world';

describe('@engine/world-templates registry', () => {
  beforeEach(() => {
    // No global reset API; use unique IDs per test to avoid interference
  });

  it('registers and lists templates', () => {
    const id = `test:proc-${Math.random()}`;
    registerTemplates([
      createProceduralTemplate(
        { id, kind: 'template', name: 'Proc', tags: ['t'], version: '1.0.0' },
        () => new Scene('Proc')
      ),
    ]);

    const all = listTemplates();
    expect(all.some((m) => m.id === id)).toBe(true);

    const onlyTemplates = listTemplates({ kind: 'template' });
    expect(onlyTemplates.length).toBeGreaterThan(0);
  });

  it('gets and instantiates a template', async () => {
    const id = `test:proc2-${Math.random()}`;
    registerTemplates([
      createProceduralTemplate(
        { id, kind: 'template', name: 'Proc2' },
        () => new Scene('Proc2')
      ),
    ]);

    const provider = getTemplate(id);
    expect(provider?.meta.id).toBe(id);

    const scene = await instantiate(id);
    expect(scene).toBeInstanceOf(Scene);
  });

  it('applies to existing scene (merge and clear)', async () => {
    const id = `test:apply-${Math.random()}`;
    registerTemplates([
      createProceduralTemplate(
        { id, kind: 'template', name: 'Apply' },
        () => {
          const s = new Scene('Apply');
          s.addEntity(new Entity('A'));
          return s;
        }
      ),
    ]);

    const target = new Scene('Target');
    target.addEntity(new Entity('Existing'));

    // merge
    await applyTo(target, id);
    expect(target.rootEntities.length).toBeGreaterThan(1);

    // clear
    await applyTo(target, id, { clear: true });
    expect(target.rootEntities.length).toBe(1);
    expect(target.rootEntities[0]?.name).toBe('A');
  });
});


