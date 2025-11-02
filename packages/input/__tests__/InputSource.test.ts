/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardInputSource } from '../src/sources/KeyboardInputSource';
import { GamepadInputSource } from '../src/sources/GamepadInputSource';
import { InputSourcePriority, DEFAULT_KEYBOARD_MAPPING } from '../src/InputSource';
import { UnifiedInputManager, InputCombinationStrategy } from '../src/UnifiedInputManager';

// Mock gamepad API
class MockGamepad implements Gamepad {
  id = 'Mock Gamepad';
  index = 0;
  connected = true;
  timestamp = Date.now();
  mapping = 'standard';
  axes = [0, 0];
  buttons: GamepadButton[] = [
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
    { pressed: false, touched: false, value: 0 },
  ];

  constructor(index: number = 0) {
    this.index = index;
  }
}

// Setup navigator.getGamepads mock globally
function setupGamepadMock(): void {
  if (!('getGamepads' in navigator)) {
    (navigator as any).getGamepads = vi.fn(() => new Array<Gamepad | null>(4).fill(null));
  }
}

// Helper to simulate key press
function simulateKeyPress(keyCode: string, pressed: boolean): void {
  const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    code: keyCode,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

describe('KeyboardInputSource', () => {
  let source: KeyboardInputSource;

  beforeEach(() => {
    source = new KeyboardInputSource('test-keyboard', InputSourcePriority.NORMAL);
  });

  afterEach(() => {
    source.dispose();
  });

  it('initializes with default mapping', () => {
    const mapping = source.getMapping();
    expect(mapping.movement.forward).toEqual(DEFAULT_KEYBOARD_MAPPING.movement.forward);
    expect(mapping.actions.jump).toEqual(DEFAULT_KEYBOARD_MAPPING.actions.jump);
  });

  it('is enabled by default', () => {
    expect(source.enabled).toBe(true);
    expect(source.connected).toBe(true);
  });

  it('returns null input when disabled', () => {
    source.disable();
    const input = source.getInput();
    expect(input).toBeNull();
  });

  it('detects forward movement', () => {
    simulateKeyPress('KeyW', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.moveDirection[2]).toBeGreaterThan(0);
  });

  it('detects backward movement', () => {
    simulateKeyPress('KeyS', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.moveDirection[2]).toBeLessThan(0);
  });

  it('detects jump action', () => {
    simulateKeyPress('Space', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.jump).toBe(true);
  });

  it('detects sprint action', () => {
    simulateKeyPress('ShiftLeft', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.sprint).toBe(true);
  });

  it('normalizes diagonal movement', () => {
    simulateKeyPress('KeyW', true);
    simulateKeyPress('KeyD', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    
    const length = Math.sqrt(
      input!.moveDirection[0] ** 2 + input!.moveDirection[2] ** 2
    );
    expect(length).toBeCloseTo(1, 5);
  });

  it('updates camera directions', () => {
    const forward: [number, number, number] = [0, 0, 1];
    const right: [number, number, number] = [1, 0, 0];
    source.setCameraDirections(forward, right);
    
    const input = source.getInput();
    expect(input?.cameraForward).toEqual(forward);
    expect(input?.cameraRight).toEqual(right);
  });

  it('allows custom mapping', () => {
    source.setMapping({
      movement: {
        forward: ['KeyF'],
      },
    });
    
    simulateKeyPress('KeyF', true);
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.moveDirection[2]).toBeGreaterThan(0);
  });

  it('clears key states on disable', () => {
    simulateKeyPress('KeyW', true);
    source.disable();
    simulateKeyPress('KeyW', false);
    
    source.enable();
    const input = source.getInput();
    expect(input?.moveDirection[2]).toBe(0);
  });
});

describe('GamepadInputSource', () => {
  let source: GamepadInputSource;
  let mockGamepad: MockGamepad;

  beforeEach(() => {
    setupGamepadMock();
    
    // Mock navigator.getGamepads
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    mockGamepad = new MockGamepad(0);
    gamepads[0] = mockGamepad;
    
    vi.mocked(navigator.getGamepads).mockReturnValue(gamepads);
    
    source = new GamepadInputSource(0, 'test-gamepad', InputSourcePriority.NORMAL);
  });

  afterEach(() => {
    source.dispose();
    vi.restoreAllMocks();
  });

  it('reports connection status', () => {
    expect(source.connected).toBe(true);
    
    // Simulate disconnection
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    vi.mocked(navigator.getGamepads).mockReturnValue(gamepads);
    
    expect(source.connected).toBe(false);
  });

  it('returns null when disconnected', () => {
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    vi.mocked(navigator.getGamepads).mockReturnValue(gamepads);
    
    const input = source.getInput();
    expect(input).toBeNull();
  });

  it('applies dead zone to analog sticks', () => {
    mockGamepad.axes[0] = 0.1; // Below dead zone
    mockGamepad.axes[1] = 0.5; // Above dead zone
    
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.moveDirection[0]).toBe(0); // X below dead zone
    expect(input!.moveDirection[2]).toBeLessThan(0); // Y inverted and above dead zone
  });

  it('detects button presses', () => {
    mockGamepad.buttons[0] = { pressed: true, touched: false, value: 1 };
    
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.jump).toBe(true);
  });

  it('handles trigger input for sprint', () => {
    mockGamepad.buttons[7] = { pressed: false, touched: false, value: 0.7 }; // Above threshold
    
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.sprint).toBe(true);
  });

  it('allows custom mapping', () => {
    source.setMapping({
      buttons: {
        jump: 1,
        sprint: 6,
        interact: 0,
      },
    });
    
    mockGamepad.buttons[1] = { pressed: true, touched: false, value: 1 };
    const input = source.getInput();
    expect(input).not.toBeNull();
    expect(input!.jump).toBe(true);
  });
});

describe('UnifiedInputManager', () => {
  let manager: UnifiedInputManager;
  let keyboardSource: KeyboardInputSource;
  let gamepadSource: GamepadInputSource;

  beforeEach(() => {
    setupGamepadMock();
    
    manager = new UnifiedInputManager();
    keyboardSource = new KeyboardInputSource('keyboard', InputSourcePriority.NORMAL);
    
    // Mock gamepad for gamepad source
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    gamepads[0] = new MockGamepad(0);
    vi.mocked(navigator.getGamepads).mockReturnValue(gamepads);
    
    gamepadSource = new GamepadInputSource(0, 'gamepad', InputSourcePriority.HIGH);
  });

  afterEach(() => {
    manager.dispose();
    keyboardSource.dispose();
    gamepadSource.dispose();
    vi.restoreAllMocks();
  });

  it('manages multiple input sources', () => {
    manager.addSource(keyboardSource);
    manager.addSource(gamepadSource);
    
    expect(manager.getSources().length).toBe(2);
  });

  it('returns input from highest priority source', () => {
    manager.addSource(keyboardSource);
    manager.addSource(gamepadSource);
    manager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);
    
    const mockGamepad = new MockGamepad(0);
    mockGamepad.axes[0] = 0.5;
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    gamepads[0] = mockGamepad;
    vi.mocked(navigator.getGamepads).mockReturnValue(gamepads);
    
    const input = manager.getInput();
    // Gamepad has higher priority
    expect(input).not.toBeNull();
  });

  it('combines inputs from multiple sources', () => {
    manager.addSource(keyboardSource);
    manager.addSource(gamepadSource);
    manager.setCombinationStrategy(InputCombinationStrategy.COMBINE_ALL);
    
    simulateKeyPress('KeyW', true);
    
    const mockGamepad = new MockGamepad(0);
    mockGamepad.axes[1] = 0.5;
    const gamepads = new Array<Gamepad | null>(4).fill(null);
    gamepads[0] = mockGamepad;
    vi.spyOn(navigator, 'getGamepads').mockReturnValue(gamepads);
    
    const input = manager.getInput();
    expect(input).not.toBeNull();
    // Should combine keyboard forward and gamepad forward
    expect(input!.moveDirection[2]).toBeGreaterThan(0);
  });

  it('returns null when no sources are enabled', () => {
    manager.addSource(keyboardSource);
    manager.disableAll();
    
    const input = manager.getInput();
    expect(input).toBeNull();
  });

  it('updates camera directions for all sources', () => {
    manager.addSource(keyboardSource);
    manager.addSource(gamepadSource);
    
    const forward: [number, number, number] = [0, 1, 0];
    const right: [number, number, number] = [1, 0, 0];
    manager.setCameraDirections(forward, right);
    
    const input = manager.getInput();
    expect(input?.cameraForward).toEqual(forward);
    expect(input?.cameraRight).toEqual(right);
  });

  it('removes sources correctly', () => {
    manager.addSource(keyboardSource);
    manager.addSource(gamepadSource);
    
    expect(manager.getSources().length).toBe(2);
    
    manager.removeSource('keyboard');
    expect(manager.getSources().length).toBe(1);
    expect(manager.getSource('keyboard')).toBeNull();
  });
});

