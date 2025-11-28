import { describe, it, expect } from 'vitest';
import { createMinimalTemplate } from '../src/builtins/templates/Minimal';
import { MeshComponent, MaterialComponent } from '@engine/world';

describe('Minimal Template', () => {
  it('creates a 3x3 platform of blocks at correct height', async () => {
    const provider = createMinimalTemplate();
    const scene = await provider.build();

    // Find the platform blocks
    const blocks = scene.getActiveEntities().filter(e => e.name.startsWith('StarterBlock_'));
    
    // Should be 3x3 = 9 blocks
    expect(blocks.length).toBe(9);

    const block = blocks[0];
    expect(block).toBeDefined();
    if (!block) return;

    // Check Position of one block
    // The grid is typically at y=0.
    // The block is 0.5 units high.
    // To avoid Z-fighting, the top surface (pos.y + height/2) must be strictly < 0.
    const position = block.transform.position;
    const mesh = block.getComponent(MeshComponent);
    
    expect(mesh).toBeDefined();
    const size = mesh?.options?.size as [number, number, number] | undefined;
    
    expect(size).toBeDefined();
    if (!size) return;

    // Should be half-height
    expect(size[1]).toBe(0.5);

    const height = size[1];
    const topSurfaceY = position[1] + height / 2;

    // Assert top surface is below 0 (e.g. -0.05)
    expect(topSurfaceY).toBeLessThan(-0.001);
  });

  it('configures platform blocks with Grass material', async () => {
    const provider = createMinimalTemplate();
    const scene = await provider.build();

    const block = scene.getActiveEntities().find(e => e.name.startsWith('StarterBlock_'));
    expect(block).toBeDefined();
    if (!block) return;

    const material = block.getComponent(MaterialComponent);
    expect(material).toBeDefined();
    if (!material) return;

    // Check material reference
    expect(material.materialRef).toBe('grass');
    
    // Check roughness - grass is rough
    expect(material.roughness).toBeGreaterThan(0.5);
  });
});

