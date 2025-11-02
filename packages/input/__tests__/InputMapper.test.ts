/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { InputMapper } from '../src/InputMapper';
import { DEFAULT_KEYBOARD_MAPPING } from '../src/InputSource';

describe('InputMapper', () => {
  it('initializes with default mapping', () => {
    const mapper = new InputMapper();
    const mapping = mapper.getMapping();
    
    expect(mapping.movement.forward).toEqual(DEFAULT_KEYBOARD_MAPPING.movement.forward);
    expect(mapping.actions.jump).toEqual(DEFAULT_KEYBOARD_MAPPING.actions.jump);
  });

  it('allows custom mapping on construction', () => {
    const customMapping = {
      movement: {
        forward: ['KeyF'],
        backward: ['KeyB'],
        left: ['KeyL'],
        right: ['KeyR'],
      },
      actions: {
        jump: ['Space'],
        sprint: ['ShiftLeft'],
        interact: ['KeyI'],
      },
    };
    
    const mapper = new InputMapper(customMapping);
    const mapping = mapper.getMapping();
    
    expect(mapping.movement.forward).toEqual(['KeyF']);
    expect(mapping.actions.jump).toEqual(['Space']);
  });

  it('remaps single actions', () => {
    const mapper = new InputMapper();
    mapper.remapAction('jump', ['KeyJ', 'Space']);
    
    const mapping = mapper.getMapping();
    expect(mapping.actions.jump).toEqual(['KeyJ', 'Space']);
  });

  it('remaps movement directions', () => {
    const mapper = new InputMapper();
    mapper.remapMovement('forward', ['KeyF', 'ArrowUp']);
    
    const mapping = mapper.getMapping();
    expect(mapping.movement.forward).toEqual(['KeyF', 'ArrowUp']);
  });

  it('detects if key is bound', () => {
    const mapper = new InputMapper();
    
    expect(mapper.isKeyBound('KeyW')).toBe(true); // Default forward
    expect(mapper.isKeyBound('Space')).toBe(true); // Default jump
    expect(mapper.isKeyBound('KeyZ')).toBe(false); // Not bound
  });

  it('finds key bindings', () => {
    const mapper = new InputMapper();
    
    const bindings = mapper.findKeyBindings('KeyW');
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings[0].type).toBe('movement');
    expect(bindings[0].name).toBe('forward');
  });

  it('validates mapping correctly', () => {
    const mapper = new InputMapper();
    const result = mapper.validate();
    
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('detects empty bindings', () => {
    const mapper = new InputMapper();
    mapper.remapAction('jump', []);
    
    const result = mapper.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('jump'))).toBe(true);
  });

  it('detects key conflicts', () => {
    const mapper = new InputMapper();
    mapper.remapAction('jump', ['KeyW']); // Same as forward
    
    const result = mapper.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KeyW'))).toBe(true);
    expect(result.errors.some(e => e.includes('multiple'))).toBe(true);
  });

  it('serializes and deserializes mapping', () => {
    const mapper = new InputMapper();
    mapper.remapAction('jump', ['KeyJ']);
    
    const json = mapper.serialize();
    const deserialized = InputMapper.deserialize(json);
    
    expect(deserialized.actions.jump).toEqual(['KeyJ']);
  });

  it('resets to defaults', () => {
    const mapper = new InputMapper();
    mapper.remapAction('jump', ['KeyJ']);
    
    mapper.resetToDefaults();
    const mapping = mapper.getMapping();
    
    expect(mapping.actions.jump).toEqual(DEFAULT_KEYBOARD_MAPPING.actions.jump);
  });

  it('updates partial mapping', () => {
    const mapper = new InputMapper();
    mapper.setMapping({
      movement: {
        forward: ['KeyF'],
      },
    });
    
    const mapping = mapper.getMapping();
    expect(mapping.movement.forward).toEqual(['KeyF']);
    expect(mapping.movement.backward).toEqual(DEFAULT_KEYBOARD_MAPPING.movement.backward);
  });
});

