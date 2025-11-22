import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlacementMode } from './PlacementMode';
import { Scene, Entity } from '@engine/world';
import { SnapSystem } from '@engine/editor-utils';
import { CollisionDetector } from './CollisionDetector';
import type { AssetPreset } from '../types/BlockAssetTypes';
import { quatToEuler } from '@engine/core/math';

// Mock the WASM collision worker to avoid environment issues
vi.mock('../../wasm/collisionWorkerClient', () => ({
  warmupCollisionWorker: vi.fn(),
  requestCheckTrs: vi.fn().mockResolvedValue(new Uint32Array(0)),
}));

// Mock the collision module specifically for this test file as well, just in case
vi.mock('@engine/wasm-collision', () => ({
  init: vi.fn().mockResolvedValue({}),
  getTrsBuffers: () => ({ positions: new Float32Array(0), rotations: new Float32Array(0), scales: new Float32Array(0) }),
  releaseTrsBuffers: vi.fn(),
}));

describe('PlacementMode New Features', () => {
  let scene: Scene;
  let snapSystem: SnapSystem;
  let collisionDetector: CollisionDetector;
  let placementMode: PlacementMode;

  const testAsset: AssetPreset = {
    name: 'TestCube',
    scale: [1, 1, 1],
    color: [0.5, 0.5, 0.5, 1],
    blockId: 'plastic_red',
  };

  const torchAsset: AssetPreset = {
    name: 'Torch',
    scale: [0.2, 0.8, 0.2],
    color: [1, 1, 0, 1],
    blockId: 'torch_red', // Trigger heuristic
  };

  beforeEach(() => {
    scene = new Scene('Test Scene');
    snapSystem = new SnapSystem({ enabled: true, increment: 1 });
    collisionDetector = new CollisionDetector(scene);
    placementMode = new PlacementMode(scene, snapSystem, collisionDetector, {
      animationEnabled: false,
    });
  });

  describe('Surface Alignment', () => {
    it('should align wall-mountable items to surface normal', async () => {
      placementMode.startPlacement(torchAsset);
      
      // Normal pointing UP (0, 1, 0) -> Rotation should be identity (or default Y rotation)
      await placementMode.updatePreviewPosition([0, 0, 0], { surfaceNormal: [0, 1, 0] });
      let preview = placementMode.getPreviewEntity();
      // Expect mostly upright
      let euler = quatToEuler(preview!.transform.rotation);
      // Depending on default, pitch/roll should be near 0
      expect(Math.abs(euler[0])).toBeLessThan(0.01);
      expect(Math.abs(euler[2])).toBeLessThan(0.01);

      // Normal pointing RIGHT (1, 0, 0) -> Should rotate 90 deg around Z (approx)
      await placementMode.updatePreviewPosition([0, 0, 0], { surfaceNormal: [1, 0, 0] });
      preview = placementMode.getPreviewEntity();
      euler = quatToEuler(preview!.transform.rotation);
      // Just check it's not identity anymore
      expect(preview!.transform.rotation).not.toEqual([0, 0, 0, 1]);
    });

    it('should NOT align standard blocks to surface normal', async () => {
      placementMode.startPlacement(testAsset); // plastic_red
      
      // Normal pointing RIGHT (1, 0, 0)
      await placementMode.updatePreviewPosition([0, 0, 0], { surfaceNormal: [1, 0, 0] });
      const preview = placementMode.getPreviewEntity();
      const euler = quatToEuler(preview!.transform.rotation);
      
      // Should remain upright (0, 0, 0) because blocks don't align
      expect(Math.abs(euler[0])).toBeLessThan(0.01);
      expect(Math.abs(euler[2])).toBeLessThan(0.01);
    });
  });

  describe('Rotation Snapping', () => {
    it('should update rotation increment via config', async () => {
      // Default is PI/4 (45 deg)
      placementMode.startPlacement(testAsset);
      await placementMode.rotatePreview(1);
      let preview = placementMode.getPreview();
      expect(Math.abs(preview.rotationAngle - Math.PI / 4)).toBeLessThan(0.001);

      // Change to 90 deg
      placementMode.setConfig({ rotationIncrement: Math.PI / 2 });
      await placementMode.rotatePreview(1); // Add another step (now 90)
      preview = placementMode.getPreview();
      // 45 + 90 = 135 deg (3*PI/4)
      expect(Math.abs(preview.rotationAngle - 3 * Math.PI / 4)).toBeLessThan(0.001);
    });
  });
});
