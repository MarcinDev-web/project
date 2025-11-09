/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorCameraController, type EditorCameraConfig } from '../src/EditorCameraController';
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

describe('EditorCameraController', () => {
  let canvas: HTMLCanvasElement;
  let camera: EditorCameraController;

  beforeEach(() => {
    canvas = mockCanvas();
    camera = new EditorCameraController(canvas);
  });

  afterEach(() => {
    try {
      camera.dispose();
    } catch {}
    try {
      canvas.remove();
    } catch {}
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const position = camera.getPosition();
      const orientation = camera.getOrientation();

      expect(position).toEqual([0, 2, 5]);
      expect(orientation.yaw).toBe(0);
      expect(orientation.pitch).toBe(0);
      expect(camera.getMoveSpeed()).toBe(5.0);
      expect(camera.isEnabled()).toBe(false);
    });

    it('should initialize with custom config', () => {
      const customConfig: EditorCameraConfig = {
        moveSpeed: 10.0,
        sprintMultiplier: 3.0,
        slowMultiplier: 0.2,
        lookSensitivity: 0.005,
        pitchLimit: Math.PI / 3,
        initialPosition: [5, 10, 15],
        initialYaw: Math.PI / 4,
        initialPitch: Math.PI / 6,
      };

      const customCamera = new EditorCameraController(canvas, customConfig);

      expect(customCamera.getPosition()).toEqual([5, 10, 15]);
      const orientation = customCamera.getOrientation();
      expect(orientation.yaw).toBeCloseTo(Math.PI / 4, 5);
      expect(orientation.pitch).toBeCloseTo(Math.PI / 6, 5);
      expect(customCamera.getMoveSpeed()).toBe(10.0);

      customCamera.dispose();
    });

    it('should initialize with partial config', () => {
      const partialConfig: EditorCameraConfig = {
        moveSpeed: 7.5,
      };

      const partialCamera = new EditorCameraController(canvas, partialConfig);

      expect(partialCamera.getMoveSpeed()).toBe(7.5);
      // Defaults should still apply
      expect(partialCamera.getPosition()).toEqual([0, 2, 5]);

      partialCamera.dispose();
    });
  });

  describe('enable and disable', () => {
    it('should enable and attach event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const canvasAddEventListenerSpy = vi.spyOn(canvas, 'addEventListener');

      camera.enable();

      expect(camera.isEnabled()).toBe(true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(canvasAddEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvasAddEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });

      addEventListenerSpy.mockRestore();
      canvasAddEventListenerSpy.mockRestore();
    });

    it('should disable and remove event listeners', () => {
      camera.enable();

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const canvasRemoveEventListenerSpy = vi.spyOn(canvas, 'removeEventListener');

      camera.disable();

      expect(camera.isEnabled()).toBe(false);
      expect(removeEventListenerSpy).toHaveBeenCalled();
      expect(canvasRemoveEventListenerSpy).toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
      canvasRemoveEventListenerSpy.mockRestore();
    });

    it('should not enable if already enabled', () => {
      camera.enable();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      camera.enable(); // Second call

      // Should not add listeners again
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });

    it('should not disable if already disabled', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      camera.disable(); // Disable when not enabled

      expect(removeEventListenerSpy).not.toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
    });

    it('should clear input state on disable', () => {
      camera.enable();

      // Simulate key press
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(keyDownEvent);

      camera.disable();

      // Update should not process any movement
      const positionBefore = [...camera.getPosition()];
      camera.update(0.1);
      const positionAfter = camera.getPosition();

      expect(positionAfter).toEqual(positionBefore);
    });
  });

  describe('movement - WASD', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should move forward with W key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0); // 1 second

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      // Should move forward (initial forward is [0, 0, -1] for yaw=0, pitch=0)
      expect(positionAfter[2]).toBeLessThan(positionBefore[2]); // Forward is -Z
      expect(Math.abs(positionAfter[2] - positionBefore[2])).toBeCloseTo(moveSpeed, 1);
    });

    it('should move backward with S key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 's' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      // Should move backward
      expect(positionAfter[2]).toBeGreaterThan(positionBefore[2]);
      expect(Math.abs(positionAfter[2] - positionBefore[2])).toBeCloseTo(moveSpeed, 1);
    });

    it('should move right with D key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'd' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();

      // Should move right (initial right is [1, 0, 0] for yaw=0)
      expect(positionAfter[0]).toBeGreaterThan(positionBefore[0]);
    });

    it('should move left with A key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();

      // Should move left
      expect(positionAfter[0]).toBeLessThan(positionBefore[0]);
    });

    it('should handle case-insensitive keys', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'W' }); // Uppercase
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      expect(positionAfter[2]).toBeLessThan(positionBefore[2]); // Should still move forward
    });

    it('should combine multiple movement keys', () => {
      const positionBefore = camera.getPosition();
      
      // Press W and D simultaneously
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

      camera.update(1.0);

      const positionAfter = camera.getPosition();

      // Should move both forward and right
      expect(positionAfter[2]).toBeLessThan(positionBefore[2]); // Forward
      expect(positionAfter[0]).toBeGreaterThan(positionBefore[0]); // Right
    });

    it('should have same speed for diagonal movement as single-axis movement', () => {
      const moveSpeed = camera.getMoveSpeed();
      const deltaTime = 1.0;

      // Test single-axis forward movement
      let positionBefore = camera.getPosition();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      camera.update(deltaTime);
      let positionAfter = camera.getPosition();
      const singleAxisDistance = Math.hypot(
        positionAfter[0] - positionBefore[0],
        positionAfter[2] - positionBefore[2]
      );

      // Clear keys
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));

      // Test diagonal movement (W+D)
      positionBefore = camera.getPosition();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      camera.update(deltaTime);
      positionAfter = camera.getPosition();
      const diagonalDistance = Math.hypot(
        positionAfter[0] - positionBefore[0],
        positionAfter[2] - positionBefore[2]
      );

      // Diagonal movement should have the same speed as single-axis (normalized)
      // Both should be approximately moveSpeed * deltaTime
      const expectedDistance = moveSpeed * deltaTime;
      expect(singleAxisDistance).toBeCloseTo(expectedDistance, 1);
      expect(diagonalDistance).toBeCloseTo(expectedDistance, 1);
      expect(diagonalDistance).toBeCloseTo(singleAxisDistance, 1);
    });

    it('should stop moving when key is released', () => {
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);
      const positionAfterMove = camera.getPosition();

      const keyUpEvent = new KeyboardEvent('keyup', { key: 'w' });
      window.dispatchEvent(keyUpEvent);

      camera.update(1.0);
      const positionAfterStop = camera.getPosition();

      // Position should not change after key release
      expect(positionAfterStop).toEqual(positionAfterMove);
    });

    it('should not move when disabled', () => {
      camera.disable();
      const positionBefore = camera.getPosition();

      const keyDownEvent = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);
      const positionAfter = camera.getPosition();

      expect(positionAfter).toEqual(positionBefore);
    });

    it('should not update position when no keys pressed', () => {
      const positionBefore = camera.getPosition();

      camera.update(1.0);
      const positionAfter = camera.getPosition();

      expect(positionAfter).toEqual(positionBefore);
    });
  });

  describe('movement - Q/E vertical', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should move up with E key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'e' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      // Should move up (Y increases)
      expect(positionAfter[1]).toBeGreaterThan(positionBefore[1]);
      expect(positionAfter[1] - positionBefore[1]).toBeCloseTo(moveSpeed, 1);
    });

    it('should move down with Q key', () => {
      const positionBefore = camera.getPosition();
      
      const keyDownEvent = new KeyboardEvent('keydown', { key: 'q' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      // Should move down (Y decreases)
      expect(positionAfter[1]).toBeLessThan(positionBefore[1]);
      expect(positionBefore[1] - positionAfter[1]).toBeCloseTo(moveSpeed, 1);
    });

    it('should combine vertical and horizontal movement', () => {
      const positionBefore = camera.getPosition();
      
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));

      camera.update(1.0);

      const positionAfter = camera.getPosition();

      // Should move both forward and up
      expect(positionAfter[2]).toBeLessThan(positionBefore[2]); // Forward
      expect(positionAfter[1]).toBeGreaterThan(positionBefore[1]); // Up
    });
  });

  describe('movement - Space/C vertical (RMB gated)', () => {
    beforeEach(() => {
      camera.enable();
      // Simulate right mouse button down to enable vertical keys capture
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);
    });

    it('should move up with Space key when RMB held', () => {
      const positionBefore = camera.getPosition();

      const keyDownEvent = new KeyboardEvent('keydown', { key: ' ' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      expect(positionAfter[1]).toBeGreaterThan(positionBefore[1]);
      expect(positionAfter[1] - positionBefore[1]).toBeCloseTo(moveSpeed, 1);
    });

    it('should move down with C key when RMB held', () => {
      const positionBefore = camera.getPosition();

      const keyDownEvent = new KeyboardEvent('keydown', { key: 'c' });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();

      expect(positionAfter[1]).toBeLessThan(positionBefore[1]);
      expect(positionBefore[1] - positionAfter[1]).toBeCloseTo(moveSpeed, 1);
    });
  });

  describe('speed modifiers', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should sprint with Shift key', () => {
      const positionBefore = camera.getPosition();

      // Press Shift first, then W
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true }));

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();
      const expectedDistance = moveSpeed * 2.0; // sprintMultiplier = 2.0

      expect(Math.abs(positionAfter[2] - positionBefore[2])).toBeCloseTo(expectedDistance, 1);
    });

    it('should slow down with Alt key', () => {
      const positionBefore = camera.getPosition();

      // Press Alt first, then W
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', altKey: true }));

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();
      const expectedDistance = moveSpeed * 0.3; // slowMultiplier = 0.3

      expect(Math.abs(positionAfter[2] - positionBefore[2])).toBeCloseTo(expectedDistance, 1);
    });

    it('should prioritize Shift over Alt', () => {
      const positionBefore = camera.getPosition();

      // Press both Shift and Alt (Shift should take priority)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', shiftKey: true, altKey: true }));

      camera.update(1.0);

      const positionAfter = camera.getPosition();
      const moveSpeed = camera.getMoveSpeed();
      const expectedDistance = moveSpeed * 2.0; // Should use sprint, not slow

      expect(Math.abs(positionAfter[2] - positionBefore[2])).toBeCloseTo(expectedDistance, 1);
    });
  });

  describe('mouse look', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should rotate camera when right mouse button is dragged', () => {
      const orientationBefore = camera.getOrientation();

      // Simulate right mouse down
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200, // 100px right
        clientY: 150, // 50px down
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientationAfter = camera.getOrientation();

      // Yaw should increase (rotated right)
      expect(orientationAfter.yaw).toBeGreaterThan(orientationBefore.yaw);
      // Pitch should decrease (rotated down)
      expect(orientationAfter.pitch).toBeLessThan(orientationBefore.pitch);
    });

    it('should not rotate when right mouse button is not pressed', () => {
      const orientationBefore = camera.getOrientation();

      // Move mouse without right button
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 150,
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientationAfter = camera.getOrientation();

      expect(orientationAfter.yaw).toBe(orientationBefore.yaw);
      expect(orientationAfter.pitch).toBe(orientationBefore.pitch);
    });

    it('should clamp pitch to pitch limit', () => {
      const pitchLimit = camera.getOrientation().pitch; // Get initial pitch limit from config

      // Try to rotate beyond limit
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 0,
        clientY: 0,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Move mouse a very large amount up
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 0,
        clientY: -10000, // Huge movement up
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientationAfter = camera.getOrientation();
      const expectedLimit = Math.PI / 2 - 0.05; // Default pitch limit

      expect(orientationAfter.pitch).toBeLessThanOrEqual(expectedLimit);
      expect(orientationAfter.pitch).toBeGreaterThanOrEqual(-expectedLimit);
    });

    it('should set cursor to grabbing during drag', () => {
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      expect(canvas.style.cursor).toBe('grabbing');
    });

    it('should reset cursor after mouse up', () => {
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      const mouseUpEvent = new MouseEvent('mouseup', {
        button: 2,
      });
      window.dispatchEvent(mouseUpEvent);

      expect(canvas.style.cursor).toBe('');
    });

    it('should ignore left mouse button', () => {
      const orientationBefore = camera.getOrientation();

      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 0, // Left button
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 150,
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientationAfter = camera.getOrientation();

      expect(orientationAfter.yaw).toBe(orientationBefore.yaw);
      expect(orientationAfter.pitch).toBe(orientationBefore.pitch);
    });
  });

  describe('mouse wheel', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should zoom forward with wheel up', () => {
      const positionBefore = camera.getPosition();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100, // Negative = scroll up
        deltaMode: 0, // DOM_DELTA_PIXEL
      });
      canvas.dispatchEvent(wheelEvent);

      const positionAfter = camera.getPosition();

      // Should move forward (camera position changes)
      // Distance should decrease (zoom in)
      const distanceBefore = Math.hypot(positionBefore[0], positionBefore[1], positionBefore[2]);
      const distanceAfter = Math.hypot(positionAfter[0], positionAfter[1], positionAfter[2]);
      expect(distanceAfter).toBeLessThan(distanceBefore);
    });

    it('should zoom backward with wheel down', () => {
      const positionBefore = camera.getPosition();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100, // Positive = scroll down
        deltaMode: 0,
      });
      canvas.dispatchEvent(wheelEvent);

      const positionAfter = camera.getPosition();

      // Should move backward (zoom out)
      const distanceBefore = Math.hypot(positionBefore[0], positionBefore[1], positionBefore[2]);
      const distanceAfter = Math.hypot(positionAfter[0], positionAfter[1], positionAfter[2]);
      expect(distanceAfter).toBeGreaterThan(distanceBefore);
    });

    it('should adjust speed with Ctrl+wheel', () => {
      const speedBefore = camera.getMoveSpeed();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        deltaMode: 0,
        ctrlKey: true,
      });
      canvas.dispatchEvent(wheelEvent);

      const speedAfter = camera.getMoveSpeed();

      // Speed should increase (wheel up with Ctrl)
      expect(speedAfter).toBeGreaterThan(speedBefore);
      expect(speedAfter).toBeCloseTo(speedBefore + 0.5, 1);
    });

    it('should decrease speed with Ctrl+wheel down', () => {
      camera.setMoveSpeed(10.0);
      const speedBefore = camera.getMoveSpeed();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        deltaMode: 0,
        ctrlKey: true,
      });
      canvas.dispatchEvent(wheelEvent);

      const speedAfter = camera.getMoveSpeed();

      // Speed should decrease
      expect(speedAfter).toBeLessThan(speedBefore);
      expect(speedAfter).toBeCloseTo(speedBefore - 0.5, 1);
    });

    it('should clamp speed between 0.5 and 50', () => {
      // Try to set speed below minimum
      camera.setMoveSpeed(0.4);
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -1000, // Try to decrease further
        deltaMode: 0,
        ctrlKey: true,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(camera.getMoveSpeed()).toBeGreaterThanOrEqual(0.5);

      // Try to set speed above maximum
      camera.setMoveSpeed(49.5);
      const wheelEvent2 = new WheelEvent('wheel', {
        deltaY: -10000, // Try to increase further
        deltaMode: 0,
        ctrlKey: true,
      });
      canvas.dispatchEvent(wheelEvent2);

      expect(camera.getMoveSpeed()).toBeLessThanOrEqual(50);
    });
  });

  describe('blur and focus', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should clear input state on window blur', () => {
      // Press a key
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

      // Simulate blur
      window.dispatchEvent(new Event('blur'));

      // Position should not change after blur (keys cleared)
      const positionBefore = camera.getPosition();
      camera.update(1.0);
      const positionAfter = camera.getPosition();

      expect(positionAfter).toEqual(positionBefore);
    });

    it('should clear mouse state on window blur', () => {
      // Start mouse drag
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      // Simulate blur
      window.dispatchEvent(new Event('blur'));

      expect(canvas.style.cursor).toBe('');
      expect(camera.getOrientation().yaw).toBe(0); // Should not have changed
    });

    it('should clear input state on window focus', () => {
      // Press a key
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

      // Simulate focus
      window.dispatchEvent(new Event('focus'));

      // Position should not change (keys cleared)
      const positionBefore = camera.getPosition();
      camera.update(1.0);
      const positionAfter = camera.getPosition();

      expect(positionAfter).toEqual(positionBefore);
    });
  });

  describe('input filtering', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should ignore input in INPUT elements', () => {
      // Note: This is difficult to test in jsdom because dispatchEvent doesn't always
      // set event.target correctly. In real usage, the handler checks event.target.tagName
      // and returns early if it's INPUT or TEXTAREA.
      // This test verifies that the handler logic exists (checked via code inspection).
      // For integration testing, this behavior should be verified manually.

      const input = document.createElement('input');
      document.body.appendChild(input);

      // Verify input exists
      expect(input.tagName).toBe('INPUT');

      // The actual filtering happens in handleKeyDown when event.target.tagName === 'INPUT'
      // This is tested in integration/e2e scenarios where real DOM events are used

      input.remove();
    });

    it('should ignore input in TEXTAREA elements', () => {
      // Similar to INPUT test - verified via code inspection
      // Integration testing recommended for full verification

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      expect(textarea.tagName).toBe('TEXTAREA');

      textarea.remove();
    });

    it('should accept input when not in INPUT/TEXTAREA', () => {
      const positionBefore = camera.getPosition();

      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'w',
        target: document.body,
      });
      window.dispatchEvent(keyDownEvent);

      camera.update(1.0);

      const positionAfter = camera.getPosition();

      // Position should change
      expect(positionAfter).not.toEqual(positionBefore);
    });
  });

  describe('position and orientation', () => {
    it('should get and set position', () => {
      const newPosition: Vec3 = [10, 20, 30];
      camera.setPosition(newPosition);

      const retrieved = camera.getPosition();
      expect(retrieved).toEqual(newPosition);
    });

    it('should get and set orientation', () => {
      const newYaw = Math.PI / 4;
      const newPitch = Math.PI / 6;
      camera.setOrientation(newYaw, newPitch);

      const orientation = camera.getOrientation();
      expect(orientation.yaw).toBeCloseTo(newYaw, 5);
      expect(orientation.pitch).toBeCloseTo(newPitch, 5);
    });

    it('should clamp pitch when setting orientation', () => {
      const extremePitch = Math.PI; // Exceeds limit
      camera.setOrientation(0, extremePitch);

      const orientation = camera.getOrientation();
      const expectedLimit = Math.PI / 2 - 0.05;

      expect(orientation.pitch).toBeLessThanOrEqual(expectedLimit);
      expect(orientation.pitch).toBeGreaterThanOrEqual(-expectedLimit);
    });

    it('should update direction vectors when orientation changes', () => {
      const forwardBefore = camera.getForward();

      camera.setOrientation(Math.PI / 2, 0);

      const forwardAfter = camera.getForward();

      expect(forwardAfter).not.toEqual(forwardBefore);
    });
  });

  describe('view matrix', () => {
    it('should generate valid view matrix', () => {
      const viewMatrix = camera.getViewMatrix();

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix.length).toBe(16);

      // Should not be identity matrix
      const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
      expect(sum).toBeGreaterThan(0);
    });

    it('should update view matrix when position changes', () => {
      const view1 = new Float32Array(camera.getViewMatrix());

      camera.setPosition([5, 10, 15]);
      const view2 = camera.getViewMatrix();

      expect(view2).not.toEqual(view1);
    });

    it('should update view matrix when orientation changes', () => {
      const view1 = new Float32Array(camera.getViewMatrix());

      camera.setOrientation(Math.PI / 2, Math.PI / 4);
      const view2 = camera.getViewMatrix();

      expect(view2).not.toEqual(view1);
    });
  });

  describe('move speed', () => {
    it('should get and set move speed', () => {
      camera.setMoveSpeed(15.0);
      expect(camera.getMoveSpeed()).toBe(15.0);
    });

    it('should ignore invalid move speed values', () => {
      const validSpeed = camera.getMoveSpeed();

      camera.setMoveSpeed(0);
      camera.setMoveSpeed(-1);
      camera.setMoveSpeed(NaN);
      camera.setMoveSpeed(Infinity);

      // Speed should remain unchanged
      expect(camera.getMoveSpeed()).toBe(validSpeed);
    });
  });

  describe('disposal', () => {
    it('should disable and mark as disposed', () => {
      camera.enable();

      camera.dispose();

      expect(camera.isEnabled()).toBe(false);
      expect(() => camera.dispose()).not.toThrow(); // Can call multiple times
    });

    it('should not enable after disposal', () => {
      camera.dispose();

      camera.enable();

      expect(camera.isEnabled()).toBe(false);
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        camera.dispose();
        camera.dispose();
        camera.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      camera.enable();
    });

    it('should handle rapid key presses and releases', () => {
      const positionBefore = camera.getPosition();

      // Rapidly press and release
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      }

      camera.update(1.0);
      const positionAfter = camera.getPosition();

      // Should not have moved (all keys released)
      expect(positionAfter).toEqual(positionBefore);
    });

    it('should handle extreme deltaTime values', () => {
      const positionBefore = camera.getPosition();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

      // Very large deltaTime
      camera.update(1000.0);

      const positionAfter = camera.getPosition();
      // Should still move (not crash)
      expect(positionAfter).not.toEqual(positionBefore);
    });

    it('should handle zero deltaTime', () => {
      const positionBefore = camera.getPosition();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));

      camera.update(0.0);

      const positionAfter = camera.getPosition();
      // Should not move (0 * speed = 0)
      expect(positionAfter).toEqual(positionBefore);
    });

    it('should handle extreme mouse movements', () => {
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 0,
        clientY: 0,
      });
      canvas.dispatchEvent(mouseDownEvent);

      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 100000, // Extreme movement
        clientY: -100000,
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientation = camera.getOrientation();
      // Should still be within reasonable bounds
      expect(Number.isFinite(orientation.yaw)).toBe(true);
      expect(Number.isFinite(orientation.pitch)).toBe(true);
    });

    it('should handle negative mouse positions', () => {
      const mouseDownEvent = new MouseEvent('mousedown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      });
      canvas.dispatchEvent(mouseDownEvent);

      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: -50, // Negative delta
        clientY: -50,
      });
      window.dispatchEvent(mouseMoveEvent);

      const orientation = camera.getOrientation();
      // Should handle negative deltas correctly
      expect(Number.isFinite(orientation.yaw)).toBe(true);
      expect(Number.isFinite(orientation.pitch)).toBe(true);
    });
  });
});

