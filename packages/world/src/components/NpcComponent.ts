import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * NPC unit type
 */
export type NpcUnitType = 'soldier' | 'guard' | 'civilian' | 'custom';

/**
 * NPC faction (for team identification)
 */
export type NpcFaction = 'ally' | 'enemy' | 'neutral';

/**
 * NPC behavior/order type
 */
export type NpcBehaviorType =
  | 'idle'
  | 'patrol'
  | 'shoot-player'
  | 'follow-player'
  | 'guard-position';

/**
 * NPC Component data
 */
export interface NpcComponentData {
  /** Unit type */
  unitType?: NpcUnitType;
  /** Faction (ally/enemy/neutral) */
  faction?: NpcFaction;
  /** Current behavior/order */
  behavior?: NpcBehaviorType;
  /** Army ID for grouping units */
  armyId?: string;
  /** Patrol waypoints (for patrol behavior) */
  patrolWaypoints?: Array<[number, number, number]>;
  /** Patrol speed (units per second) */
  patrolSpeed?: number;
  /** Guard position (for guard-position behavior) */
  guardPosition?: [number, number, number];
  /** Guard radius (for guard-position behavior) */
  guardRadius?: number;
  /** Detection range for player (for shoot-player behavior) */
  detectionRange?: number;
}

/**
 * NpcComponent manages NPC unit data and configuration
 */
export class NpcComponent extends Component {
  static readonly type = 'Npc';

  /** Unit type */
  unitType: NpcUnitType = 'soldier';

  /** Faction (ally/enemy/neutral) */
  faction: NpcFaction = 'neutral';

  /** Current behavior/order */
  behavior: NpcBehaviorType = 'idle';

  /** Army ID for grouping units */
  armyId: string = '';

  /** Patrol waypoints (for patrol behavior) */
  patrolWaypoints: Array<[number, number, number]> = [];

  /** Patrol speed (units per second) */
  patrolSpeed: number = 3.0;

  /** Guard position (for guard-position behavior) */
  guardPosition: [number, number, number] | null = null;

  /** Guard radius (for guard-position behavior) */
  guardRadius: number = 5.0;

  /** Detection range for player (for shoot-player behavior) */
  detectionRange: number = 20.0;

  constructor(data?: NpcComponentData) {
    super();
    if (data) {
      this.unitType = data.unitType ?? this.unitType;
      this.faction = data.faction ?? this.faction;
      this.behavior = data.behavior ?? this.behavior;
      this.armyId = data.armyId ?? this.armyId;
      this.patrolWaypoints = data.patrolWaypoints ? [...data.patrolWaypoints] : [];
      this.patrolSpeed = data.patrolSpeed ?? this.patrolSpeed;
      if (data.guardPosition) {
        this.guardPosition = [data.guardPosition[0], data.guardPosition[1], data.guardPosition[2]];
      }
      this.guardRadius = data.guardRadius ?? this.guardRadius;
      this.detectionRange = data.detectionRange ?? this.detectionRange;
    }
  }

  /**
   * Get the type of this component
   */
  getType(): string {
    return 'Npc';
  }

  /**
   * Serializes component state into JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      unitType: this.unitType,
      faction: this.faction,
      behavior: this.behavior,
      armyId: this.armyId,
      patrolWaypoints: this.patrolWaypoints.length > 0 ? this.patrolWaypoints : undefined,
      patrolSpeed: this.patrolSpeed,
      guardPosition: this.guardPosition,
      guardRadius: this.guardRadius,
      detectionRange: this.detectionRange,
    };
  }

  /**
   * Creates a deep clone of this component
   */
  clone(): NpcComponent {
    const cloned = new NpcComponent();
    cloned.unitType = this.unitType;
    cloned.faction = this.faction;
    cloned.behavior = this.behavior;
    cloned.armyId = this.armyId;
    cloned.patrolWaypoints = this.patrolWaypoints.map(
      (wp) => [wp[0], wp[1], wp[2]] as [number, number, number]
    );
    cloned.patrolSpeed = this.patrolSpeed;
    cloned.guardPosition = this.guardPosition
      ? [this.guardPosition[0], this.guardPosition[1], this.guardPosition[2]]
      : null;
    cloned.guardRadius = this.guardRadius;
    cloned.detectionRange = this.detectionRange;
    return cloned;
  }

  /**
   * Deserialize the component
   */
  static fromJSON(data: Record<string, unknown>): NpcComponent {
    const component = new NpcComponent();
    if (typeof data.unitType === 'string') {
      component.unitType = data.unitType as NpcUnitType;
    }
    if (typeof data.faction === 'string') {
      component.faction = data.faction as NpcFaction;
    }
    if (typeof data.behavior === 'string') {
      component.behavior = data.behavior as NpcBehaviorType;
    }
    if (typeof data.armyId === 'string') {
      component.armyId = data.armyId;
    }
    if (Array.isArray(data.patrolWaypoints)) {
      component.patrolWaypoints = data.patrolWaypoints.map((wp) => {
        if (Array.isArray(wp) && wp.length >= 3) {
          return [Number(wp[0]), Number(wp[1]), Number(wp[2])] as [number, number, number];
        }
        return [0, 0, 0] as [number, number, number];
      });
    }
    if (typeof data.patrolSpeed === 'number') {
      component.patrolSpeed = data.patrolSpeed;
    }
    if (Array.isArray(data.guardPosition) && data.guardPosition.length >= 3) {
      component.guardPosition = [
        Number(data.guardPosition[0]),
        Number(data.guardPosition[1]),
        Number(data.guardPosition[2]),
      ] as [number, number, number];
    }
    if (typeof data.guardRadius === 'number') {
      component.guardRadius = data.guardRadius;
    }
    if (typeof data.detectionRange === 'number') {
      component.detectionRange = data.detectionRange;
    }
    return component;
  }
}

// Register component
registerComponent(NpcComponent.type, NpcComponent);
