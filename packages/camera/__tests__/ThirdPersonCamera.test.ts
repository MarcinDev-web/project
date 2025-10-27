import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThirdPersonCamera } from '../src/ThirdPersonCamera';
import type { PhysicsWorld, RaycastHit } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

describe('ThirdPersonCamera', () => {
  let canvas: HTMLCanvasElement;
  let mockPhysicsWorld: PhysicsWorld | null;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    
    mockPhysicsWorld = null;
  });

  afterEach(() => {
    document.body.removeChild(canvas);
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      const config = camera.getConfig();

      expect(config.distance).toBe(3.5);
      expect(config.height).toBe(1.2);
      expect(config.shoulderOffset).toBe(0.6);
      expect(config.followSpeed).toBe(5.0);
      expect(config.rotationSpeed).toBe(3.0);
      expect(config.collisionRadius).toBe(0.3);
      expect(config.pitchRange[0]).toBeCloseTo(-30, 5);
      expect(config.pitchRange[1]).toBeCloseTo(60, 5);
      expect(config.mouseSensitivity).toBe(0.003);
      expect(config.enableAutoRotation).toBe(true);
    });

    it('should initialize with custom config', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        distance: 5.0,
        height: 2.0,
        shoulderOffset: 1.0,
        followSpeed: 10.0,
        rotationSpeed: 5.0,
        collisionRadius: 0.5,
        pitchRange: [-45, 45],
        mouseSensitivity: 0.005,
        enableAutoRotation: false,
      });
      
      const config = camera.getConfig();

      expect(config.distance).toBe(5.0);
      expect(config.height).toBe(2.0);
      expect(config.shoulderOffset).toBe(1.0);
      expect(config.followSpeed).toBe(10.0);
      expect(config.rotationSpeed).toBe(5.0);
      expect(config.collisionRadius).toBe(0.5);
      expect(config.pitchRange).toEqual([-45, 45]);
      expect(config.mouseSensitivity).toBe(0.005);
      expect(config.enableAutoRotation).toBe(false);
    });

    it('should start disabled', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      expect(camera.isEnabled()).toBe(false);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable camera', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();
      expect(camera.isEnabled()).toBe(true);
    });

    it('should disable camera', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();
      camera.disable();
      expect(camera.isEnabled()).toBe(false);
    });

    it('should not enable when disposed', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.dispose();
      camera.enable();
      expect(camera.isEnabled()).toBe(false);
    });
  });

  describe('Mouse Drag Rotation', () => {
    it('should rotate camera on mouse drag', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      const { yaw: initialYaw, pitch: initialPitch } = camera.getOrientation();

      // Simulate mouse down
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 80,
      });
      window.dispatchEvent(mouseMoveEvent);

      const { yaw: newYaw, pitch: newPitch } = camera.getOrientation();

      // Yaw should have increased (moved right)
      expect(newYaw).toBeGreaterThan(initialYaw);
      // Pitch should have increased (moved up)
      expect(newPitch).toBeGreaterThan(initialPitch);
    });

    it('should stop rotating on mouse up', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      // Mouse down
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Mouse move
      const mouseMoveEvent1 = new MouseEvent('mousemove', {
        clientX: 150,
        clientY: 100,
      });
      window.dispatchEvent(mouseMoveEvent1);

      const { yaw: yawAfterDrag } = camera.getOrientation();

      // Mouse up
      const mouseUpEvent = new MouseEvent('mouseup', {
        button: 0,
      });
      window.dispatchEvent(mouseUpEvent);

      // Mouse move again (should not change rotation)
      const mouseMoveEvent2 = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 100,
      });
      window.dispatchEvent(mouseMoveEvent2);

      const { yaw: yawAfterMouseUp } = camera.getOrientation();

      expect(yawAfterMouseUp).toBe(yawAfterDrag);
    });

    it('should clamp pitch within range', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        pitchRange: [-30, 60],
      });
      camera.enable();

      // Set pitch beyond max
      camera.setOrientation(0, Math.PI); // 180 degrees
      const { pitch } = camera.getOrientation();

      // Should be clamped to 60 degrees
      expect(pitch).toBeCloseTo((60 * Math.PI) / 180, 5);
    });
  });

  describe('Auto-rotation', () => {
    it('should rotate toward player forward direction', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        rotationSpeed: 10.0, // Fast rotation for testing
      });
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [1, 0, 0]; // Player facing +X

      // Set camera to face backward
      camera.setOrientation(Math.PI, 0);

      const initialYaw = camera.getOrientation().yaw;

      // Update camera (should rotate toward player forward)
      camera.update(playerPosition, playerForward, 0.1);

      const newYaw = camera.getOrientation().yaw;

      // Yaw should have changed toward the target
      expect(newYaw).not.toBe(initialYaw);
    });

    it('should not auto-rotate when disabled', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        enableAutoRotation: false,
      });
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [1, 0, 0];

      camera.setOrientation(Math.PI, 0);
      const initialYaw = camera.getOrientation().yaw;

      camera.update(playerPosition, playerForward, 0.1);

      const newYaw = camera.getOrientation().yaw;

      // Yaw should not have changed
      expect(newYaw).toBe(initialYaw);
    });
  });

  describe('Position Smoothing', () => {
    it('should smoothly follow player position', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        followSpeed: 5.0,
      });
      camera.enable();

      const playerPosition1: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [0, 0, -1];

      camera.update(playerPosition1, playerForward, 0.1);
      const position1 = camera.getPosition();

      // Move player
      const playerPosition2: Vec3 = [10, 0, 0];
      camera.update(playerPosition2, playerForward, 0.1);
      const position2 = camera.getPosition();

      // Camera should have moved toward player
      expect(position2[0]).toBeGreaterThan(position1[0]);
      
      // But not instantly (due to smoothing)
      expect(position2[0]).toBeLessThan(playerPosition2[0] + 3);
    });

    it('should reach player position over time', () => {
      const camera = new ThirdPersonCamera(canvas, null, {
        followSpeed: 10.0, // Fast follow
      });
      camera.enable();

      const playerPosition: Vec3 = [10, 0, 0];
      const playerForward: Vec3 = [0, 0, -1];

      // Update multiple times to reach target
      for (let i = 0; i < 20; i++) {
        camera.update(playerPosition, playerForward, 0.1);
      }

      const finalPosition = camera.getPosition();

      // Should be close to desired offset from player
      expect(Math.abs(finalPosition[0] - playerPosition[0])).toBeLessThan(1);
    });
  });

  describe('Collision Detection', () => {
    it('should pull camera closer when hitting wall', () => {
      // Mock physics world with hit
      const mockHit: RaycastHit = {
        entity: null as any,
        distance: 2.0,
        point: [1, 1, 1],
        normal: [-1, 0, 0],
        collider: null as any,
      };

      mockPhysicsWorld = {
        raycast: vi.fn().mockReturnValue(mockHit),
      } as any;

      const camera = new ThirdPersonCamera(canvas, mockPhysicsWorld, {
        distance: 3.5,
        collisionRadius: 0.3,
      });
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [0, 0, -1];

      // Update camera
      camera.update(playerPosition, playerForward, 1.0);

      // Raycast should have been called
      expect(mockPhysicsWorld.raycast).toHaveBeenCalled();

      // Camera should be closer than desired distance due to collision
      const position = camera.getPosition();
      const distanceFromPlayer = Math.sqrt(
        position[0] * position[0] +
        position[1] * position[1] +
        position[2] * position[2]
      );

      // Should be less than full distance
      expect(distanceFromPlayer).toBeLessThan(3.5);
    });

    it('should not pull camera closer when no collision', () => {
      // Mock physics world with no hit
      mockPhysicsWorld = {
        raycast: vi.fn().mockReturnValue(null),
      } as any;

      const camera = new ThirdPersonCamera(canvas, mockPhysicsWorld, {
        distance: 3.5,
      });
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [0, 0, -1];

      // Update camera multiple times to reach target
      for (let i = 0; i < 20; i++) {
        camera.update(playerPosition, playerForward, 0.1);
      }

      // Camera should be at full distance
      const position = camera.getPosition();
      const distanceFromPlayer = Math.sqrt(
        position[0] * position[0] +
        position[1] * position[1] +
        position[2] * position[2]
      );

      // Should be close to desired distance
      expect(distanceFromPlayer).toBeCloseTo(3.5, 0);
    });

    it('should work without physics world', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const playerForward: Vec3 = [0, 0, -1];

      // Should not throw
      expect(() => {
        camera.update(playerPosition, playerForward, 0.1);
      }).not.toThrow();
    });
  });

  describe('View Matrix', () => {
    it('should return valid view matrix', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      const playerPosition: Vec3 = [0, 0, 0];
      const viewMatrix = camera.getViewMatrix(playerPosition);

      // Should be a 16-element array
      expect(viewMatrix.length).toBe(16);
      
      // Should not contain NaN or Infinity
      for (let i = 0; i < 16; i++) {
        expect(Number.isFinite(viewMatrix[i])).toBe(true);
      }
    });

    it('should look at player position', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      const playerPosition: Vec3 = [5, 2, 3];
      const playerForward: Vec3 = [0, 0, -1];

      camera.update(playerPosition, playerForward, 1.0);
      const viewMatrix = camera.getViewMatrix(playerPosition);

      // Verify it's a valid matrix (non-zero)
      const hasNonZero = Array.from(viewMatrix).some(v => v !== 0);
      expect(hasNonZero).toBe(true);
    });
  });

  describe('Config Updates', () => {
    it('should update distance', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ distance: 5.0 });
      expect(camera.getConfig().distance).toBe(5.0);
    });

    it('should update height', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ height: 2.0 });
      expect(camera.getConfig().height).toBe(2.0);
    });

    it('should update shoulder offset', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ shoulderOffset: 1.0 });
      expect(camera.getConfig().shoulderOffset).toBe(1.0);
    });

    it('should update follow speed', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ followSpeed: 10.0 });
      expect(camera.getConfig().followSpeed).toBe(10.0);
    });

    it('should update rotation speed', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ rotationSpeed: 5.0 });
      expect(camera.getConfig().rotationSpeed).toBe(5.0);
    });

    it('should update collision radius', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ collisionRadius: 0.5 });
      expect(camera.getConfig().collisionRadius).toBe(0.5);
    });

    it('should update pitch range', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ pitchRange: [-45, 45] });
      expect(camera.getConfig().pitchRange).toEqual([-45, 45]);
    });

    it('should update mouse sensitivity', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ mouseSensitivity: 0.005 });
      expect(camera.getConfig().mouseSensitivity).toBe(0.005);
    });

    it('should update auto-rotation enable', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setConfig({ enableAutoRotation: false });
      expect(camera.getConfig().enableAutoRotation).toBe(false);
    });
  });

  describe('Orientation', () => {
    it('should get orientation', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      const orientation = camera.getOrientation();
      
      expect(orientation).toHaveProperty('yaw');
      expect(orientation).toHaveProperty('pitch');
    });

    it('should set orientation', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setOrientation(Math.PI / 4, Math.PI / 6);
      
      const orientation = camera.getOrientation();
      expect(orientation.yaw).toBeCloseTo(Math.PI / 4, 5);
      expect(orientation.pitch).toBeCloseTo(Math.PI / 6, 5);
    });
  });

  describe('Position', () => {
    it('should get position', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      const position = camera.getPosition();
      
      expect(position).toHaveLength(3);
      expect(position[0]).toBeTypeOf('number');
      expect(position[1]).toBeTypeOf('number');
      expect(position[2]).toBeTypeOf('number');
    });

    it('should set position', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.setPosition([1, 2, 3]);
      
      const position = camera.getPosition();
      expect(position).toEqual([1, 2, 3]);
    });
  });

  describe('Disposal', () => {
    it('should dispose camera', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();
      camera.dispose();
      
      expect(camera.isEnabled()).toBe(false);
    });

    it('should remove event listeners on disposal', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();
      
      const addEventListenerSpy = vi.spyOn(canvas, 'removeEventListener');
      camera.dispose();
      
      expect(addEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Window Blur', () => {
    it('should clear input state on window blur', () => {
      const camera = new ThirdPersonCamera(canvas, null);
      camera.enable();

      // Start mouse drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Blur window
      const blurEvent = new Event('blur');
      window.dispatchEvent(blurEvent);

      // Mouse move should not affect camera
      const { yaw: yawBeforeMove } = camera.getOrientation();
      
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 100,
      });
      window.dispatchEvent(mouseMoveEvent);

      const { yaw: yawAfterMove } = camera.getOrientation();
      expect(yawAfterMove).toBe(yawBeforeMove);
    });
  });
});

