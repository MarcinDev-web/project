import { describe, it, expect, beforeEach } from 'vitest';
import { NpcComponent } from './NpcComponent.js';

describe('NpcComponent', () => {
  let npc: NpcComponent;

  beforeEach(() => {
    npc = new NpcComponent();
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      expect(npc.unitType).toBe('soldier');
      expect(npc.faction).toBe('neutral');
      expect(npc.behavior).toBe('idle');
      expect(npc.armyId).toBe('');
      expect(npc.patrolWaypoints).toEqual([]);
      expect(npc.patrolSpeed).toBe(3.0);
      expect(npc.guardPosition).toBeNull();
      expect(npc.guardRadius).toBe(5.0);
      expect(npc.detectionRange).toBe(20.0);
    });

    it('should create with custom data', () => {
      const custom = new NpcComponent({
        unitType: 'guard',
        faction: 'enemy',
        behavior: 'patrol',
        armyId: 'army-1',
        patrolWaypoints: [
          [0, 0, 0],
          [10, 0, 10],
        ],
        patrolSpeed: 5.0,
        guardPosition: [5, 0, 5],
        guardRadius: 10.0,
        detectionRange: 30.0,
      });

      expect(custom.unitType).toBe('guard');
      expect(custom.faction).toBe('enemy');
      expect(custom.behavior).toBe('patrol');
      expect(custom.armyId).toBe('army-1');
      expect(custom.patrolWaypoints).toEqual([
        [0, 0, 0],
        [10, 0, 10],
      ]);
      expect(custom.patrolSpeed).toBe(5.0);
      expect(custom.guardPosition).toEqual([5, 0, 5]);
      expect(custom.guardRadius).toBe(10.0);
      expect(custom.detectionRange).toBe(30.0);
    });
  });

  describe('getType', () => {
    it('should return "Npc"', () => {
      expect(npc.getType()).toBe('Npc');
    });
  });

  describe('toJSON', () => {
    it('should serialize component state', () => {
      npc.unitType = 'guard';
      npc.faction = 'enemy';
      npc.behavior = 'shoot-player';
      npc.armyId = 'army-1';
      npc.patrolWaypoints = [
        [0, 0, 0],
        [10, 0, 10],
      ];
      npc.patrolSpeed = 5.0;
      npc.guardPosition = [5, 0, 5];
      npc.guardRadius = 10.0;
      npc.detectionRange = 30.0;

      const json = npc.toJSON();
      expect(json.unitType).toBe('guard');
      expect(json.faction).toBe('enemy');
      expect(json.behavior).toBe('shoot-player');
      expect(json.armyId).toBe('army-1');
      expect(json.patrolWaypoints).toEqual([
        [0, 0, 0],
        [10, 0, 10],
      ]);
      expect(json.patrolSpeed).toBe(5.0);
      expect(json.guardPosition).toEqual([5, 0, 5]);
      expect(json.guardRadius).toBe(10.0);
      expect(json.detectionRange).toBe(30.0);
    });

    it('should not include empty patrolWaypoints', () => {
      const json = npc.toJSON();
      expect(json.patrolWaypoints).toBeUndefined();
    });
  });

  describe('clone', () => {
    it('should create a deep clone', () => {
      npc.unitType = 'guard';
      npc.faction = 'enemy';
      npc.behavior = 'patrol';
      npc.armyId = 'army-1';
      npc.patrolWaypoints = [
        [0, 0, 0],
        [10, 0, 10],
      ];
      npc.patrolSpeed = 5.0;
      npc.guardPosition = [5, 0, 5];
      npc.guardRadius = 10.0;
      npc.detectionRange = 30.0;

      const cloned = npc.clone();
      expect(cloned.unitType).toBe('guard');
      expect(cloned.faction).toBe('enemy');
      expect(cloned.behavior).toBe('patrol');
      expect(cloned.armyId).toBe('army-1');
      expect(cloned.patrolWaypoints).toEqual([
        [0, 0, 0],
        [10, 0, 10],
      ]);
      expect(cloned.patrolSpeed).toBe(5.0);
      expect(cloned.guardPosition).toEqual([5, 0, 5]);
      expect(cloned.guardRadius).toBe(10.0);
      expect(cloned.detectionRange).toBe(30.0);

      // Verify it's a deep clone (modifying original doesn't affect clone)
      npc.patrolWaypoints.push([20, 0, 20]);
      expect(cloned.patrolWaypoints.length).toBe(2);
      expect(npc.patrolWaypoints.length).toBe(3);
    });

    it('should handle null guardPosition', () => {
      const cloned = npc.clone();
      expect(cloned.guardPosition).toBeNull();
    });
  });

  describe('fromJSON', () => {
    it('should deserialize component from JSON', () => {
      const data = {
        unitType: 'guard',
        faction: 'enemy',
        behavior: 'shoot-player',
        armyId: 'army-1',
        patrolWaypoints: [
          [0, 0, 0],
          [10, 0, 10],
        ],
        patrolSpeed: 5.0,
        guardPosition: [5, 0, 5],
        guardRadius: 10.0,
        detectionRange: 30.0,
      };

      const component = NpcComponent.fromJSON(data);
      expect(component.unitType).toBe('guard');
      expect(component.faction).toBe('enemy');
      expect(component.behavior).toBe('shoot-player');
      expect(component.armyId).toBe('army-1');
      expect(component.patrolWaypoints).toEqual([
        [0, 0, 0],
        [10, 0, 10],
      ]);
      expect(component.patrolSpeed).toBe(5.0);
      expect(component.guardPosition).toEqual([5, 0, 5]);
      expect(component.guardRadius).toBe(10.0);
      expect(component.detectionRange).toBe(30.0);
    });

    it('should handle missing fields', () => {
      const data = {};
      const component = NpcComponent.fromJSON(data);
      expect(component.unitType).toBe('soldier');
      expect(component.faction).toBe('neutral');
      expect(component.behavior).toBe('idle');
    });

    it('should handle invalid patrolWaypoints', () => {
      const data = {
        patrolWaypoints: [[0, 0], [10]], // Invalid waypoints
      };
      const component = NpcComponent.fromJSON(data);
      expect(component.patrolWaypoints.length).toBe(2);
      expect(component.patrolWaypoints[0]).toEqual([0, 0, 0]);
      expect(component.patrolWaypoints[1]).toEqual([0, 0, 0]);
    });
  });
});
