import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CameraDirector } from '../src/CameraDirector';
import { OrbitCamera } from '../src/OrbitCamera';
import { FPSCamera } from '../src/FPSCamera';
import type { Vec3 } from '@engine/core/math';

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  Object.defineProperty(canvas, 'style', {
    value: { cursor: '' },
    writable: true,
  });
  document.body.appendChild(canvas);
  return canvas;
}

describe('CameraDirector', () => {
  let canvas: HTMLCanvasElement;
  let orbitCamera: OrbitCamera;
  let fpsCamera: FPSCamera;

  beforeEach(() => {
    canvas = mockCanvas();
    orbitCamera = new OrbitCamera(canvas);
    fpsCamera = new FPSCamera(canvas);
  });

  describe('initialization', () => {
    it('should initialize with free-fly mode by default', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      expect(director.getMode()).toBe('free-fly');
      expect(director.isBlending()).toBe(false);
    });

    it('should initialize view and projection matrices immediately', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const viewMatrix = director.getViewMatrix();
      const projectionMatrix = director.getProjectionMatrix();

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(projectionMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix.length).toBe(16);
      expect(projectionMatrix.length).toBe(16);
    });

    it('should use custom logger if provided', () => {
      const mockLogger = {
        debug: vi.fn(),
        warn: vi.fn(),
      };

      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
        logger: mockLogger,
      });

      // Trigger a warning to test custom logger (e.g., unknown camera mode)
      director.setMode('unknown' as any);

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('mode switching', () => {
    it('should switch modes instantly with setMode', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setMode('fps');
      expect(director.getMode()).toBe('fps');
      expect(director.isBlending()).toBe(false);

      director.setMode('orbit');
      expect(director.getMode()).toBe('orbit');
      expect(director.isBlending()).toBe(false);
    });

    it('should not change mode if already in that mode', () => {
      const mockLogger = {
        debug: vi.fn(),
        warn: vi.fn(),
      };

      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
        logger: mockLogger,
      });

      mockLogger.debug.mockClear();
      director.setMode('orbit');

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle follow mode (currently fallback to orbit)', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setMode('follow');
      expect(director.getMode()).toBe('follow');
    });
  });

  describe('camera blending', () => {
    it('should start blend between modes', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.startBlend('fps', 0.5);
      expect(director.getMode()).toBe('fps');
      expect(director.isBlending()).toBe(true);
    });

    it('should complete blend after duration', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.startBlend('fps', 0.1);
      expect(director.isBlending()).toBe(true);

      // Update past blend duration
      director.update(0.15);
      expect(director.isBlending()).toBe(false);
    });

    it('should handle instant switch with zero or negative duration', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.startBlend('fps', 0);
      expect(director.getMode()).toBe('fps');
      expect(director.isBlending()).toBe(false);

      director.startBlend('orbit', -1);
      expect(director.getMode()).toBe('orbit');
      expect(director.isBlending()).toBe(false);
    });

    it('should not start blend to same mode', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Try to blend to same mode (free-fly is the default)
      director.startBlend('free-fly', 0.5);
      expect(director.isBlending()).toBe(false);
    });

    it('should update blend progress over time', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });
      director.setPlayerPosition([0, 0, 0]);

      director.startBlend('fps', 1.0);
      expect(director.isBlending()).toBe(true);

      director.update(0.25);
      expect(director.isBlending()).toBe(true);

      director.update(0.5);
      expect(director.isBlending()).toBe(true);

      director.update(0.3);
      expect(director.isBlending()).toBe(false); // Total > 1.0
    });
  });

  describe('player position', () => {
    it('should set and get player position', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const position: Vec3 = [1, 2, 3];
      director.setPlayerPosition(position);

      const retrieved = director.getPlayerPosition();
      expect(retrieved).toEqual([1, 2, 3]);
    });

    it('should return null when no player position set', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      expect(director.getPlayerPosition()).toBeNull();
    });
  });

  describe('camera configuration', () => {
    it('should set FOV and update projection', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const initialProjection = new Float32Array(director.getProjectionMatrix());

      director.setFov(Math.PI / 3); // 60 degrees
      const newProjection = director.getProjectionMatrix();

      // Projection should have changed
      expect(newProjection).not.toEqual(initialProjection);
    });

    it('should ignore invalid FOV values', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const initialProjection = new Float32Array(director.getProjectionMatrix());

      director.setFov(0);
      director.setFov(-1);
      director.setFov(NaN);
      director.setFov(Infinity);

      const projectionAfter = director.getProjectionMatrix();
      expect(projectionAfter).toEqual(initialProjection);
    });

    it('should set camera offset', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const offset: Vec3 = [0, 1.6, 0];
      director.setCameraOffset(offset);

      // Should not throw and should update internal state
      expect(() => director.update(0)).not.toThrow();
    });

    it('should set collision radius', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setCollisionRadius(0.5);

      // Should not throw
      expect(() => director.update(0)).not.toThrow();
    });

    it('should ignore invalid collision radius', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Should silently ignore invalid values
      director.setCollisionRadius(0);
      director.setCollisionRadius(-1);

      expect(() => director.update(0)).not.toThrow();
    });
  });

  describe('FPS mode with player position', () => {
    it('should use player position in FPS mode', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setPlayerPosition([5, 0, 5]);
      director.setMode('fps');

      const viewMatrix = director.getViewMatrix();

      // View matrix should be computed (not identity)
      const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
      expect(sum).toBeGreaterThan(0);
    });

    it('should fallback to orbit if FPS camera not available', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera: null,
        canvas,
      });

      director.setMode('fps');

      // Should not throw and should use orbit fallback
      expect(() => director.getViewMatrix()).not.toThrow();
    });

    it('should use orbit position for FPS if player position not set (edit mode)', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Set orbit camera to specific position
      orbitCamera.setState({ yaw: 1.5, pitch: 0.3, distance: 10 });
      
      director.setMode('fps');

      // Should not throw and should use orbit position as base for FPS
      expect(() => director.getViewMatrix()).not.toThrow();
      
      const viewMatrix = director.getViewMatrix();
      // View matrix should be computed (not identity)
      const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
      expect(sum).toBeGreaterThan(0);
    });
  });

  describe('matrix calculations', () => {
    it('should update projection matrix on canvas resize', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      const initialProjection = new Float32Array(director.getProjectionMatrix());

      canvas.width = 1920;
      canvas.height = 1080;
      director.update(0);

      const newProjection = director.getProjectionMatrix();
      expect(newProjection).not.toEqual(initialProjection);
    });

    it('should handle zero-dimension canvas gracefully', () => {
      canvas.width = 0;
      canvas.height = 0;

      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Should not throw or produce NaN
      const projection = director.getProjectionMatrix();
      expect(Array.from(projection).every(v => !isNaN(v))).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose resources', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setPlayerPosition([1, 2, 3]);
      director.startBlend('fps', 0.5);

      director.dispose();

      expect(director.getPlayerPosition()).toBeNull();
      expect(director.isBlending()).toBe(false);
    });
  });

  describe('edit mode FPS camera', () => {
    it('should switch between orbit and FPS in edit mode seamlessly', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Set specific orbit state
      orbitCamera.setState({ yaw: 1.0, pitch: 0.5, distance: 8 });
      
      // Switch to FPS (no player position - edit mode)
      director.setMode('fps');
      const fpsView = new Float32Array(director.getViewMatrix());
      
      // Switch back to orbit
      director.setMode('orbit');
      const orbitView = director.getViewMatrix();
      
      // Views should be different (FPS uses orientation from orbit)
      expect(fpsView).not.toEqual(orbitView);
    });

    it('should use different position calculation in play vs edit mode', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      orbitCamera.setState({ yaw: 1.0, pitch: 0.5, distance: 8 });
      
      // Edit mode (no player position)
      director.setMode('fps');
      const editModeView = new Float32Array(director.getViewMatrix());
      
      // Play mode (with player position)
      director.setPlayerPosition([5, 1, 5]);
      director.update(0); // Force recalculation
      const playModeView = director.getViewMatrix();
      
      // Views should be different (different position source)
      expect(editModeView).not.toEqual(playModeView);
    });

    it('should preserve FPS camera orientation when set in edit mode', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      // Set FPS camera orientation
      fpsCamera.setYawPitch(1.5, 0.2);
      orbitCamera.setState({ yaw: 1.5, pitch: 0.2, distance: 10 });
      
      director.setMode('fps');
      
      // Get view matrix - should use FPS orientation
      const viewMatrix = director.getViewMatrix();
      expect(Array.from(viewMatrix).every(v => !isNaN(v))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid mode changes', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.setMode('fps');
      director.setMode('orbit');
      director.setMode('follow');
      director.setMode('fps');

      expect(director.getMode()).toBe('fps');
    });

    it('should handle rapid blend starts', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.startBlend('fps', 1.0);
      director.startBlend('orbit', 0.5);

      // Latest blend should take precedence
      expect(director.getMode()).toBe('orbit');
      expect(director.isBlending()).toBe(true);
    });

    it('should handle update with very large delta time', () => {
      const director = new CameraDirector({
        orbitControls: orbitCamera,
        fpsCamera,
        canvas,
      });

      director.startBlend('fps', 0.5);
      director.update(9999);

      expect(director.isBlending()).toBe(false);
    });
  });
});

