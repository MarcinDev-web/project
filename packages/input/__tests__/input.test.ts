import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOrbitControls } from '@engine/camera';

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // Provide a stub style object for cursor manipulation
  Object.defineProperty(canvas, 'style', {
    value: { cursor: '' },
    writable: true,
  });
  document.body.appendChild(canvas);
  return canvas;
}

describe('createOrbitControls', () => {
  let canvas: HTMLCanvasElement;
  let controlsReturn: ReturnType<typeof createOrbitControls>;

  beforeEach(() => {
    canvas = mockCanvas();
    controlsReturn = createOrbitControls(canvas);
  });

  afterEach(() => {
    try {
      controlsReturn?.cleanup();
    } catch {}
    try {
      canvas?.remove();
    } catch {}
  });

  it('initializes with default state', () => {
    expect(controlsReturn.getState()).toEqual({ yaw: 0, pitch: 0, distance: 3 });
  });

  it('updates yaw and pitch on drag', () => {
    const { getState } = controlsReturn;
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 120 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    const state = getState();
    expect(state.yaw).not.toBe(0);
    expect(state.pitch).not.toBe(0);
  });

  it('ignores non-left-button drags', () => {
    const { getState } = controlsReturn;
    const initial = getState();
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, button: 1 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    const after = getState();
    expect(after.yaw).toBe(initial.yaw);
    expect(after.pitch).toBe(initial.pitch);
  });

  it('zooms in response to wheel events', () => {
    const { getState } = controlsReturn;
    const initial = getState().distance;
    const wheelEvent = new WheelEvent('wheel', { deltaY: -100 });
    // Need to spy on preventDefault because our logic calls it
    const preventSpy = vi.spyOn(wheelEvent, 'preventDefault');
    canvas.dispatchEvent(wheelEvent);
    expect(getState().distance).toBeLessThan(initial);
    expect(preventSpy).toHaveBeenCalled();
  });

  it('zooms proportionally to wheel magnitude and clamps to bounds', () => {
    const { getState } = controlsReturn;
    // Zoom in strongly
    const start = getState().distance;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -300 }));
    const afterStrongIn = getState().distance;
    expect(afterStrongIn).toBeLessThan(start);

    // Zoom out strongly; should not exceed MAX_DISTANCE
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 10_000 }));
    const afterStrongOut = getState().distance;
    expect(afterStrongOut).toBeLessThanOrEqual(20);
    expect(afterStrongOut).toBeGreaterThanOrEqual(0.75);

    // Tiny delta (0) should not change
    const beforeZero = getState().distance;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 0 }));
    expect(getState().distance).toBeCloseTo(beforeZero, 10);
  });

  it('clamps pitch within limits', () => {
    const { getState } = controlsReturn;
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 10_000 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    const state = getState();
    expect(state.pitch).toBeLessThanOrEqual(Math.PI / 2 - 0.01);
  });

  it('prevents default and stops propagation on mousedown', () => {
    const mousedownEvent = new MouseEvent('mousedown', {
      clientX: 50,
      clientY: 50,
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(mousedownEvent, 'preventDefault');
    const stopSpy = vi.spyOn(mousedownEvent, 'stopPropagation');
    canvas.dispatchEvent(mousedownEvent);
    expect(preventSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('disabling during drag aborts listeners and stops rotation', () => {
    const { getState, setEnabled } = controlsReturn;
    // Start a drag
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 100 }));
    const midState = getState();
    expect(midState.yaw).not.toBe(0);

    // Disable controls mid-drag
    setEnabled(false);

    // Further mouse moves should not change yaw/pitch
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));
    const afterDisable = getState();
    expect(afterDisable.yaw).toBe(midState.yaw);
    expect(afterDisable.pitch).toBe(midState.pitch);

    // Re-enable and ensure drag doesn't resume without mousedown
    setEnabled(true);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }));
    const afterReenable = getState();
    expect(afterReenable.yaw).toBe(midState.yaw);
    expect(afterReenable.pitch).toBe(midState.pitch);

    // Cleanup mouseup shouldn't throw
    window.dispatchEvent(new MouseEvent('mouseup'));
  });
});
