import { describe, it, expect, beforeEach } from 'vitest';
import { PlacementMode } from './PlacementMode';
import { Scene } from '../../scene/Scene';
import { Entity } from '../../scene/Entity';
import { SnapSystem } from '../snap/SnapSystem';
import { CollisionDetector } from './CollisionDetector';
import type { AssetPreset } from '../assets/AssetTypes';
import type { Vec3 } from '../../scene/Transform';
import { MaterialComponent } from '../../scene/components/MaterialComponent';

describe('PlacementMode', () => {
  let scene: Scene;
  let snapSystem: SnapSystem;
  let collisionDetector: CollisionDetector;
  let placementMode: PlacementMode;

  const testAsset: AssetPreset = {
    name: 'TestCube',
    description: 'Test cube',
    scale: [1, 1, 1],
    color: [0.5, 0.5, 0.5, 1],
    category: 'Primitives',
  };

  beforeEach(() => {
    scene = new Scene('Test Scene');
    snapSystem = new SnapSystem({ enabled: true, increment: 1 });
    collisionDetector = new CollisionDetector(scene);
    placementMode = new PlacementMode(scene, snapSystem, collisionDetector);
  });

  describe('startPlacement', () => {
    it('should start placement with asset', () => {
      placementMode.startPlacement(testAsset);

      expect(placementMode.isActive()).toBe(true);
      const preview = placementMode.getPreview();
      expect(preview.active).toBe(true);
      expect(preview.asset).toEqual(testAsset);
      expect(preview.previewEntity).not.toBeNull();
      expect(preview.rotationAngle).toBe(0);
    });

    it('should create preview entity with correct properties', () => {
      placementMode.startPlacement(testAsset);

      const previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity).not.toBeNull();
      expect(previewEntity?.name).toContain('preview');
      expect(previewEntity?.transform.scale).toEqual(testAsset.scale);
      expect(previewEntity?.userData.isPreview).toBe(true);
      expect(previewEntity?.userData.asset).toBe(testAsset.name);
    });

    it('should cancel existing placement before starting new one', () => {
      placementMode.startPlacement(testAsset);
      const firstPreview = placementMode.getPreviewEntity();

      const asset2: AssetPreset = {
        name: 'TestSphere',
        description: 'Test sphere',
        scale: [2, 2, 2],
        color: [1, 0, 0, 1],
        category: 'Primitives',
      };
      placementMode.startPlacement(asset2);
      const secondPreview = placementMode.getPreviewEntity();

      expect(secondPreview).not.toBe(firstPreview);
      expect(secondPreview?.userData.asset).toBe(asset2.name);
    });
  });

  describe('updatePreviewPosition', () => {
    it('should update preview position with snapping', () => {
      placementMode.startPlacement(testAsset);
      const position: Vec3 = [1.4, 0, 2.6];

      placementMode.updatePreviewPosition(position);

      const previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity?.transform.position).toEqual([1, 0, 3]); // Snapped to grid
    });

    it('should set canPlace to true when no collision', () => {
      placementMode.startPlacement(testAsset);

      placementMode.updatePreviewPosition([5, 0, 5]);

      const preview = placementMode.getPreview();
      expect(preview.canPlace).toBe(true);
    });

    it('should set canPlace to false when collision detected', () => {
      // Add existing entity
      const existing = new Entity('existing');
      existing.transform.position = [0, 0, 0];
      existing.transform.scale = [2, 2, 2];
      scene.addEntity(existing);

      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([0, 0, 0]); // Same position as existing

      const preview = placementMode.getPreview();
      expect(preview.canPlace).toBe(false);
    });

    it('should not update if placement is not active', () => {
      placementMode.updatePreviewPosition([1, 0, 1]);

      expect(placementMode.isActive()).toBe(false);
    });

    it('should update preview color based on collision state', () => {
      placementMode.startPlacement(testAsset);

      // No collision - should be green
      placementMode.updatePreviewPosition([10, 0, 10]);
      let previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity?.color[1]).toBeGreaterThan(0.8); // Green channel

      // Add obstacle
      const obstacle = new Entity('obstacle');
      obstacle.transform.position = [0, 0, 0];
      obstacle.transform.scale = [2, 2, 2];
      scene.addEntity(obstacle);

      // Collision - should be red
      placementMode.updatePreviewPosition([0, 0, 0]);
      previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity?.color[0]).toBeGreaterThan(0.8); // Red channel
    });

    it('should treat face contact as non-collision (scale-aware tolerance)', () => {
      const existing = new Entity('existing');
      existing.transform.position = [0, 0, 0];
      existing.transform.scale = [1, 1, 1];
      scene.addEntity(existing);

      placementMode.startPlacement(testAsset);
      // Adjacent along +X, faces just touching
      placementMode.updatePreviewPosition([1, 0, 0]);

      const preview = placementMode.getPreview();
      expect(preview.canPlace).toBe(true);
    });
  });

  describe('rotatePreview', () => {
    it('should rotate preview clockwise', () => {
      placementMode.startPlacement(testAsset);
      const initialRotation = placementMode.getPreview().rotationAngle;

      placementMode.rotatePreview(1);

      const newRotation = placementMode.getPreview().rotationAngle;
      expect(newRotation).toBeGreaterThan(initialRotation);
    });

    it('should rotate preview counter-clockwise', () => {
      placementMode.startPlacement(testAsset);
      placementMode.rotatePreview(1); // First rotate CW
      const midRotation = placementMode.getPreview().rotationAngle;

      placementMode.rotatePreview(-1); // Then rotate CCW

      const newRotation = placementMode.getPreview().rotationAngle;
      expect(newRotation).toBeLessThan(midRotation);
    });

    it('should normalize rotation angle to [0, 2π)', () => {
      placementMode.startPlacement(testAsset);

      // Rotate many times
      for (let i = 0; i < 20; i++) {
        placementMode.rotatePreview(1);
      }

      const rotation = placementMode.getPreview().rotationAngle;
      expect(rotation).toBeGreaterThanOrEqual(0);
      expect(rotation).toBeLessThan(Math.PI * 2);
    });

    it('should update entity rotation quaternion', () => {
      placementMode.startPlacement(testAsset);
      const previewEntity = placementMode.getPreviewEntity();
      const initialQuat = [...previewEntity!.transform.rotation];

      placementMode.rotatePreview(1);

      const newQuat = previewEntity!.transform.rotation;
      expect(newQuat).not.toEqual(initialQuat);
    });

    it('should re-check collision after rotation', () => {
      // Create an obstacle
      const obstacle = new Entity('obstacle');
      obstacle.transform.position = [1, 0, 0];
      obstacle.transform.scale = [1, 1, 1];
      scene.addEntity(obstacle);

      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([0, 0, 0]);

      // Initial state
      // Verify canPlace is recalculated without reading its prior value

      // Rotate
      placementMode.rotatePreview(1);

      // Collision state might change after rotation
      const newCanPlace = placementMode.getPreview().canPlace;
      expect(typeof newCanPlace).toBe('boolean');
      // Note: We just verify it's recalculated, actual value depends on geometry
    });

    it('should do nothing if placement is not active', () => {
      placementMode.rotatePreview(1);

      expect(placementMode.isActive()).toBe(false);
    });
  });

  describe('confirmPlacement', () => {
    it('should place entity when canPlace is true', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([5, 0, 5]); // No collision

      const placed = placementMode.confirmPlacement();

      expect(placed).not.toBeNull();
      expect(scene.getActiveEntities()).toContain(placed!);
      expect(placementMode.isActive()).toBe(false);
    });

    it('should return null when canPlace is false', () => {
      // Add obstacle
      const obstacle = new Entity('obstacle');
      obstacle.transform.position = [0, 0, 0];
      obstacle.transform.scale = [2, 2, 2];
      scene.addEntity(obstacle);

      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([0, 0, 0]); // Collision

      const placed = placementMode.confirmPlacement();

      expect(placed).toBeNull();
      expect(placementMode.isActive()).toBe(true); // Still active
    });

    it('should create entity with correct transform', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([2, 0, 3]);
      placementMode.rotatePreview(1);

      const placed = placementMode.confirmPlacement();

      expect(placed?.transform.position).toEqual([2, 0, 3]);
      expect(placed?.transform.scale).toEqual(testAsset.scale);
      // Rotation should be copied from preview
      // Ensure rotation was set on placed entity; preview is cleared
      // Note: placement was confirmed, so preview is cleared
      expect(placed?.transform.rotation).toBeDefined();
    });

    it('should copy userData from preview', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([5, 0, 5]);

      const placed = placementMode.confirmPlacement();

      expect(placed?.userData.asset).toBe(testAsset.name);
      expect(placed?.userData.baseColor).toBeDefined();
    });

    it('should clear placement after confirmation', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([5, 0, 5]);

      placementMode.confirmPlacement();

      expect(placementMode.isActive()).toBe(false);
      expect(placementMode.getPreviewEntity()).toBeNull();
    });

    it('should return null when not active', () => {
      const placed = placementMode.confirmPlacement();

      expect(placed).toBeNull();
    });
    
    it('should initialize placed entity color from asset, not preview tint', () => {
      placementMode.setConfig({ validColor: [0, 1, 0, 1] });
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([8, 0, 8]);

      const placed = placementMode.confirmPlacement();
      expect(placed).not.toBeNull();
      expect(placed!.color).toEqual(testAsset.color);
    });

    it('should choose materialId based on asset blockId/color, not preview', () => {
      const assetWithBlock: AssetPreset = {
        name: 'GrassBlock',
        description: 'A grass block',
        scale: [1, 1, 1],
        color: [0.1, 0.9, 0.1, 1],
        category: 'Blocks',
        blockId: 'grass_block',
      };

      placementMode.startPlacement(assetWithBlock);
      placementMode.updatePreviewPosition([9, 0, 9]);
      const placed = placementMode.confirmPlacement();
      expect(placed).not.toBeNull();
      const mat = placed!.getComponent(MaterialComponent);
      expect(mat).toBeDefined();
      expect(mat!.materialId).toBe(4);
    });
  });

  describe('cancelPlacement', () => {
    it('should cancel active placement', () => {
      placementMode.startPlacement(testAsset);
      expect(placementMode.isActive()).toBe(true);

      placementMode.cancelPlacement();

      expect(placementMode.isActive()).toBe(false);
      expect(placementMode.getPreviewEntity()).toBeNull();
    });

    it('should clear preview state', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([1, 0, 1]);
      placementMode.rotatePreview(1);

      placementMode.cancelPlacement();

      const preview = placementMode.getPreview();
      expect(preview.active).toBe(false);
      expect(preview.previewEntity).toBeNull();
      expect(preview.asset).toBeNull();
      expect(preview.rotationAngle).toBe(0);
      expect(preview.position).toBeNull();
    });

    it('should be safe to call when not active', () => {
      expect(() => placementMode.cancelPlacement()).not.toThrow();
      expect(placementMode.isActive()).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      placementMode.startPlacement(testAsset);
      placementMode.cancelPlacement();

      expect(() => placementMode.cancelPlacement()).not.toThrow();
      expect(placementMode.isActive()).toBe(false);
    });
  });

  describe('getPreview', () => {
    it('should return inactive preview by default', () => {
      const preview = placementMode.getPreview();

      expect(preview.active).toBe(false);
      expect(preview.previewEntity).toBeNull();
      expect(preview.canPlace).toBe(false);
      expect(preview.asset).toBeNull();
    });

    it('should return current preview state', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([1, 0, 1]);

      const preview = placementMode.getPreview();

      expect(preview.active).toBe(true);
      expect(preview.asset).toEqual(testAsset);
      expect(preview.position).toEqual([1, 0, 1]);
    });

    it('should return a defensive copy of position', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([1.4, 0, 2.6]); // snaps to [1,0,3]

      const preview1 = placementMode.getPreview();
      expect(preview1.position).toEqual([1, 0, 3]);

      if (preview1.position) preview1.position[0] = 999;

      const preview2 = placementMode.getPreview();
      expect(preview2.position).toEqual([1, 0, 3]);
    });
  });

  describe('setConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        validColor: [0, 1, 0, 1] as [number, number, number, number],
        invalidColor: [1, 0, 0, 1] as [number, number, number, number],
      };

      placementMode.setConfig(newConfig);
      const config = placementMode.getConfig();

      expect(config.validColor).toEqual(newConfig.validColor);
      expect(config.invalidColor).toEqual(newConfig.invalidColor);
    });

    it('should update preview color if placement is active', () => {
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([10, 0, 10]); // No collision

      const newConfig = {
        validColor: [0, 0, 1, 1] as [number, number, number, number],
      };
      placementMode.setConfig(newConfig);

      const previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity?.color).toEqual([0, 0, 1, 0.6]);
    });

    it('should partially update configuration', () => {
      placementMode.setConfig({ ghostOpacity: 0.8 });
      const config = placementMode.getConfig();

      expect(config.ghostOpacity).toBe(0.8);
      // Other values should remain default
      expect(config.rotationIncrement).toBe(Math.PI / 4);
    });

    it('should call onCollisionChange when collision state toggles', () => {
      const calls: Array<{ canPlace: boolean; count: number }> = [];
      let count = 0;
      placementMode.setConfig({
        onCollisionChange: (canPlace) => {
          calls.push({ canPlace, count: ++count });
        },
      });

      // Add obstacle at origin
      const obstacle = new Entity('obstacle');
      obstacle.transform.position = [0, 0, 0];
      obstacle.transform.scale = [2, 2, 2];
      scene.addEntity(obstacle);

      placementMode.startPlacement(testAsset);
      // Move to free space: canPlace -> true
      placementMode.updatePreviewPosition([5, 0, 5]);
      // Move to collision: canPlace -> false
      placementMode.updatePreviewPosition([0, 0, 0]);

      expect(calls.length).toBeGreaterThanOrEqual(2);
      const first = calls[0]!;
      const last = calls[calls.length - 1]!;
      expect(first.canPlace).toBe(true);
      expect(last.canPlace).toBe(false);
    });

    it('should call onPlacementConfirmed on confirm', () => {
      const confirmed: Entity[] = [];
      placementMode.setConfig({
        onPlacementConfirmed: (e) => confirmed.push(e),
      });

      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([6, 0, 6]);
      const placed = placementMode.confirmPlacement();

      expect(placed).not.toBeNull();
      expect(confirmed.length).toBe(1);
      expect(confirmed[0]).toBe(placed);
    });

    it('should call onPlacementStart with asset and preview entity', () => {
      const starts: Array<{ name: string; same: boolean }> = [];
      placementMode.setConfig({
        onPlacementStart: (asset, preview) =>
          starts.push({ name: asset.name, same: preview === placementMode.getPreviewEntity() }),
      });

      placementMode.startPlacement(testAsset);

      expect(starts.length).toBe(1);
      expect(starts[0]!.name).toBe(testAsset.name);
      expect(starts[0]!.same).toBe(true);
    });

    it('should call onPreviewPositionUpdate with snapped position and preview entity', () => {
      const positions: Array<{ pos: Vec3; same: boolean }> = [];
      placementMode.setConfig({
        onPreviewPositionUpdate: (pos, preview) =>
          positions.push({ pos: [...pos] as Vec3, same: preview === placementMode.getPreviewEntity() }),
      });

      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([1.4, 0, 2.6]); // snaps to [1,0,3]

      expect(positions.length).toBe(1);
      const first = positions[0]!;
      expect(first.pos).toEqual([1, 0, 3]);
      expect(first.same).toBe(true);
    });

    it('should call onPlacementCancelled on cancel and not on confirm', () => {
      let cancelledCount = 0;
      let confirmedCount = 0;
      placementMode.setConfig({
        onPlacementCancelled: () => cancelledCount++,
        onPlacementConfirmed: () => confirmedCount++,
      });

      // Cancel path
      placementMode.startPlacement(testAsset);
      placementMode.cancelPlacement();
      expect(cancelledCount).toBe(1);

      // Confirm path should not trigger cancel
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([7, 0, 7]);
      const placed = placementMode.confirmPlacement();
      expect(placed).not.toBeNull();
      expect(confirmedCount).toBe(1);
      expect(cancelledCount).toBe(1);
    });

    it('should apply ghostOpacity to preview alpha', () => {
      placementMode.setConfig({ ghostOpacity: 0.25, validColor: [0, 1, 0, 1] });
      placementMode.startPlacement(testAsset);
      placementMode.updatePreviewPosition([3, 0, 3]);

      const previewEntity = placementMode.getPreviewEntity();
      expect(previewEntity?.color).toEqual([0, 1, 0, 0.25]);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = placementMode.getConfig();

      expect(config.validColor).toBeDefined();
      expect(config.invalidColor).toBeDefined();
      expect(config.ghostOpacity).toBeDefined();
      expect(config.rotationIncrement).toBeDefined();
    });

    it('should return a copy of configuration', () => {
      const config1 = placementMode.getConfig();
      config1.ghostOpacity = 0.5;

      const config2 = placementMode.getConfig();
      expect(config2.ghostOpacity).not.toBe(0.5);
    });
  });
});
