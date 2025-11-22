import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene, Entity } from '@engine/world';
import { SnapSystem } from '@engine/editor-utils';
import type { AssetPreset } from '../types/BlockAssetTypes';
import { LinePlacementTool } from './tools/LinePlacementTool';
import { BoxPlacementTool } from './tools/BoxPlacementTool';
import { PaintPlacementTool } from './tools/PaintPlacementTool';
import type { PlacementToolContext } from './tools/PlacementTool';

// Mock CollisionDetector interface/class structure
const mockCheckCollisionOBB = vi.fn().mockResolvedValue({ hasCollision: false, collidingEntities: [] });
const MockCollisionDetector = {
  checkCollisionOBB: mockCheckCollisionOBB
} as any;

describe('Placement Tools (Isolated)', () => {
  let scene: Scene;
  let snapSystem: SnapSystem;
  let context: PlacementToolContext;

  const testAsset: AssetPreset = {
    name: 'TestCube',
    scale: [1, 1, 1],
    color: [0.5, 0.5, 0.5, 1],
    blockId: 'plastic_red',
  };

  beforeEach(() => {
    scene = new Scene('Test Scene');
    snapSystem = new SnapSystem({ enabled: true, increment: 1 });
    
    context = {
      scene,
      snapSystem,
      collisionDetector: MockCollisionDetector,
      config: {
        validColor: [0, 1, 0, 0.5],
        invalidColor: [1, 0, 0, 0.5],
        ghostOpacity: 0.5,
        rotationIncrement: 0.1,
        contactTolerance: 0.001
      }
    };
    
    mockCheckCollisionOBB.mockClear();
  });

  describe('LinePlacementTool', () => {
    let tool: LinePlacementTool;
    
    beforeEach(() => {
      tool = new LinePlacementTool(context);
      tool.startPlacement(testAsset);
    });

    it('should start with single preview before drag', () => {
        const previews = tool.getPreviewEntities();
        expect(previews.length).toBe(1);
    });

    it('should handle drag input to generate line', async () => {
      await tool.updatePreview([0, 0, 0], [0, 1, 0]);
      tool.handleInput('down', { origin: [0, 10, 0], direction: [0, -1, 0] });
      await tool.updatePreview([5, 0, 0], [0, 1, 0]);
      
      const previews = tool.getPreviewEntities();
      expect(previews.length).toBe(6);
      expect(previews[0].transform.position).toEqual([0, 0, 0]);
      expect(previews[5].transform.position).toEqual([5, 0, 0]);
    });
  });

  describe('BoxPlacementTool', () => {
    let tool: BoxPlacementTool;
    
    beforeEach(() => {
      tool = new BoxPlacementTool(context);
      tool.startPlacement(testAsset);
    });

    it('should generate grid on XZ plane', async () => {
      await tool.updatePreview([0, 0, 0], [0, 1, 0]);
      tool.handleInput('down', { origin: [0, 10, 0], direction: [0, -1, 0] });
      await tool.updatePreview([2, 0, 2], [0, 1, 0]);
      
      const previews = tool.getPreviewEntities();
      expect(previews.length).toBe(9);
    });
  });

  describe('PaintPlacementTool', () => {
    let tool: PaintPlacementTool;
    
    beforeEach(() => {
      tool = new PaintPlacementTool(context);
      tool.startPlacement(testAsset);
    });

    it('should highlight target entity', async () => {
      const target = new Entity('Target');
      target.transform.position = [1, 2, 3];
      target.transform.scale = [1, 1, 1];
      scene.addEntity(target);
      
      await tool.updatePreview([0, 0, 0], [0, 1, 0], { targetEntity: target });
      
      const previews = tool.getPreviewEntities();
      expect(previews.length).toBe(1);
      expect(previews[0].transform.position).toEqual([1, 2, 3]);
    });
  });
});
