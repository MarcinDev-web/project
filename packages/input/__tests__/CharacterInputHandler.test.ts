/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CharacterInputHandler } from '../src/CharacterInput';

// Helper to simulate key press
function simulateKeyPress(keyCode: string, pressed: boolean): void {
  const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    code: keyCode,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

describe('CharacterInputHandler', () => {
  let handler: CharacterInputHandler;

  beforeEach(() => {
    handler = new CharacterInputHandler();
  });

  afterEach(() => {
    handler.dispose();
  });

  describe('enable/disable', () => {
    it('should be enabled by default', () => {
      expect(handler.isEnabled()).toBe(true);
    });

    it('should disable input handling', () => {
      handler.disable();
      expect(handler.isEnabled()).toBe(false);
    });

    it('should enable input handling', () => {
      handler.disable();
      handler.enable();
      expect(handler.isEnabled()).toBe(true);
    });

    it('should return empty input when disabled', () => {
      handler.disable();
      
      // Press keys
      simulateKeyPress('KeyW', true);
      
      const input = handler.getInput();
      expect(input.moveDirection).toEqual([0, 0, 0]);
      expect(input.sprint).toBe(false);
      expect(input.jump).toBe(false);
    });

    it('should return input when enabled after being disabled', () => {
      handler.disable();
      simulateKeyPress('KeyW', true);
      
      // Should return empty input when disabled
      let input = handler.getInput();
      expect(input.moveDirection).toEqual([0, 0, 0]);
      
      // Enable and press key again (key state was cleared when disabled)
      handler.enable();
      simulateKeyPress('KeyW', true);
      input = handler.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0); // Forward movement
    });

    it('should enable all input sources when enabled', () => {
      const enableAllSpy = vi.spyOn((handler as any).inputManager, 'enableAll');
      
      handler.enable();
      
      expect(enableAllSpy).toHaveBeenCalled();
    });

    it('should disable all input sources when disabled', () => {
      const disableAllSpy = vi.spyOn((handler as any).inputManager, 'disableAll');
      
      handler.disable();
      
      expect(disableAllSpy).toHaveBeenCalled();
    });
  });

  describe('getInput', () => {
    it('should return default input when no keys are pressed', () => {
      const input = handler.getInput();
      
      expect(input.moveDirection).toEqual([0, 0, 0]);
      expect(input.sprint).toBe(false);
      expect(input.jump).toBe(false);
      expect(input.cameraForward).toBeDefined();
      expect(input.cameraRight).toBeDefined();
    });

    it('should return forward movement when W is pressed', () => {
      simulateKeyPress('KeyW', true);
      
      const input = handler.getInput();
      
      expect(input.moveDirection[2]).toBeGreaterThan(0); // Forward (positive Z)
      expect(input.moveDirection[0]).toBe(0); // No sideways movement
      expect(input.moveDirection[1]).toBe(0); // No vertical movement
    });

    it('should return backward movement when S is pressed', () => {
      simulateKeyPress('KeyS', true);
      
      const input = handler.getInput();
      
      expect(input.moveDirection[2]).toBeLessThan(0); // Backward (negative Z)
    });

    it('should return left movement when A is pressed', () => {
      simulateKeyPress('KeyA', true);
      
      const input = handler.getInput();
      
      expect(input.moveDirection[0]).toBeLessThan(0); // Left (negative X)
    });

    it('should return right movement when D is pressed', () => {
      simulateKeyPress('KeyD', true);
      
      const input = handler.getInput();
      
      expect(input.moveDirection[0]).toBeGreaterThan(0); // Right (positive X)
    });

    it('should return diagonal movement when W and D are pressed', () => {
      simulateKeyPress('KeyW', true);
      simulateKeyPress('KeyD', true);
      
      const input = handler.getInput();
      
      expect(input.moveDirection[2]).toBeGreaterThan(0); // Forward
      expect(input.moveDirection[0]).toBeGreaterThan(0); // Right
      
      // Should be normalized
      const length = Math.sqrt(
        input.moveDirection[0] ** 2 + input.moveDirection[2] ** 2
      );
      expect(length).toBeCloseTo(1, 5);
    });

    it('should return jump action when Space is pressed', () => {
      simulateKeyPress('Space', true);
      
      const input = handler.getInput();
      
      expect(input.jump).toBe(true);
    });

    it('should return sprint action when Shift is pressed', () => {
      simulateKeyPress('ShiftLeft', true);
      
      const input = handler.getInput();
      
      expect(input.sprint).toBe(true);
    });

    it('should include camera directions in input', () => {
      const forward: [number, number, number] = [0, 0, 1];
      const right: [number, number, number] = [1, 0, 0];
      
      handler.setCameraDirections(forward, right);
      
      const input = handler.getInput();
      
      expect(input.cameraForward).toEqual(forward);
      expect(input.cameraRight).toEqual(right);
    });

    it('should return empty input when disabled even if keys are pressed', () => {
      simulateKeyPress('KeyW', true);
      simulateKeyPress('Space', true);
      simulateKeyPress('ShiftLeft', true);
      
      handler.disable();
      
      const input = handler.getInput();
      
      expect(input.moveDirection).toEqual([0, 0, 0]);
      expect(input.sprint).toBe(false);
      expect(input.jump).toBe(false);
    });

    it('should return input with camera directions even when disabled', () => {
      const forward: [number, number, number] = [0, 0, 1];
      const right: [number, number, number] = [1, 0, 0];
      
      handler.setCameraDirections(forward, right);
      handler.disable();
      
      const input = handler.getInput();
      
      expect(input.cameraForward).toEqual(forward);
      expect(input.cameraRight).toEqual(right);
    });

    it('should stop returning movement when key is released', () => {
      simulateKeyPress('KeyW', true);
      
      let input = handler.getInput();
      expect(input.moveDirection[2]).toBeGreaterThan(0);
      
      simulateKeyPress('KeyW', false);
      
      input = handler.getInput();
      expect(input.moveDirection[2]).toBe(0);
    });
  });

  describe('setCameraDirections', () => {
    it('should update camera directions', () => {
      const forward: [number, number, number] = [0, 1, 0];
      const right: [number, number, number] = [-1, 0, 0];
      
      handler.setCameraDirections(forward, right);
      
      const input = handler.getInput();
      expect(input.cameraForward).toEqual(forward);
      expect(input.cameraRight).toEqual(right);
    });

    it('should update camera directions for input manager', () => {
      const setCameraDirSpy = vi.spyOn((handler as any).inputManager, 'setCameraDirections');
      const forward: [number, number, number] = [0, 1, 0];
      const right: [number, number, number] = [-1, 0, 0];
      
      handler.setCameraDirections(forward, right);
      
      expect(setCameraDirSpy).toHaveBeenCalledWith(forward, right);
    });
  });

  describe('dispose', () => {
    it('should dispose input manager', () => {
      const disposeSpy = vi.spyOn((handler as any).inputManager, 'dispose');
      
      handler.dispose();
      
      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should not throw when disposing multiple times', () => {
      handler.dispose();
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});

