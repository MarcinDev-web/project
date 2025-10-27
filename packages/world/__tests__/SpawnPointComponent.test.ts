import { describe, it, expect } from 'vitest';
import { SpawnPointComponent } from '../src/components/SpawnPointComponent';

describe('SpawnPointComponent', () => {
  describe('Creation', () => {
    it('should create component with default values', () => {
      const component = new SpawnPointComponent();
      
      expect(component.getType()).toBe('SpawnPoint');
      expect(component.isDefault).toBe(false);
      expect(component.rotation).toBe(0);
    });

    it('should have correct static type', () => {
      expect(SpawnPointComponent.type).toBe('SpawnPoint');
    });
  });

  describe('Properties', () => {
    it('should set isDefault flag', () => {
      const component = new SpawnPointComponent();
      component.isDefault = true;
      
      expect(component.isDefault).toBe(true);
    });

    it('should set rotation', () => {
      const component = new SpawnPointComponent();
      component.rotation = Math.PI / 2;
      
      expect(component.rotation).toBe(Math.PI / 2);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const component = new SpawnPointComponent();
      component.isDefault = true;
      component.rotation = Math.PI / 4;
      
      const json = component.toJSON();
      
      expect(json.isDefault).toBe(true);
      expect(json.rotation).toBe(Math.PI / 4);
    });

    it('should deserialize from JSON', () => {
      const component = new SpawnPointComponent();
      component.fromJSON({
        isDefault: true,
        rotation: Math.PI / 3,
      });
      
      expect(component.isDefault).toBe(true);
      expect(component.rotation).toBe(Math.PI / 3);
    });

    it('should handle partial JSON', () => {
      const component = new SpawnPointComponent();
      component.isDefault = true;
      component.rotation = 1.5;
      
      component.fromJSON({ isDefault: false });
      
      expect(component.isDefault).toBe(false);
      expect(component.rotation).toBe(1.5); // Should remain unchanged
    });

    it('should ignore invalid JSON properties', () => {
      const component = new SpawnPointComponent();
      const initialDefault = component.isDefault;
      const initialRotation = component.rotation;
      
      component.fromJSON({
        isDefault: 'not a boolean' as any,
        rotation: 'not a number' as any,
      });
      
      expect(component.isDefault).toBe(initialDefault);
      expect(component.rotation).toBe(initialRotation);
    });
  });

  describe('Clone', () => {
    it('should clone component', () => {
      const original = new SpawnPointComponent();
      original.isDefault = true;
      original.rotation = Math.PI / 6;
      
      const clone = original.clone();
      
      expect(clone).toBeInstanceOf(SpawnPointComponent);
      expect(clone.isDefault).toBe(original.isDefault);
      expect(clone.rotation).toBe(original.rotation);
    });

    it('should create independent clone', () => {
      const original = new SpawnPointComponent();
      original.isDefault = false;
      
      const clone = original.clone();
      clone.isDefault = true;
      
      // Original should not be affected
      expect(original.isDefault).toBe(false);
      expect(clone.isDefault).toBe(true);
    });
  });

  describe('Round-trip Serialization', () => {
    it('should maintain data through serialize-deserialize cycle', () => {
      const original = new SpawnPointComponent();
      original.isDefault = true;
      original.rotation = 2.5;
      
      const json = original.toJSON();
      const restored = new SpawnPointComponent();
      restored.fromJSON(json);
      
      expect(restored.isDefault).toBe(original.isDefault);
      expect(restored.rotation).toBe(original.rotation);
    });
  });
});

