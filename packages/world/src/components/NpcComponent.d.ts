import { Component } from './Component.js';
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
export type NpcBehaviorType = 'idle' | 'patrol' | 'shoot-player' | 'follow-player' | 'guard-position';
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
export declare class NpcComponent extends Component {
    static readonly type = "Npc";
    /** Unit type */
    unitType: NpcUnitType;
    /** Faction (ally/enemy/neutral) */
    faction: NpcFaction;
    /** Current behavior/order */
    behavior: NpcBehaviorType;
    /** Army ID for grouping units */
    armyId: string;
    /** Patrol waypoints (for patrol behavior) */
    patrolWaypoints: Array<[number, number, number]>;
    /** Patrol speed (units per second) */
    patrolSpeed: number;
    /** Guard position (for guard-position behavior) */
    guardPosition: [number, number, number] | null;
    /** Guard radius (for guard-position behavior) */
    guardRadius: number;
    /** Detection range for player (for shoot-player behavior) */
    detectionRange: number;
    constructor(data?: NpcComponentData);
    /**
     * Get the type of this component
     */
    getType(): string;
    /**
     * Serializes component state into JSON
     */
    toJSON(): Record<string, unknown>;
    /**
     * Creates a deep clone of this component
     */
    clone(): NpcComponent;
    /**
     * Deserialize the component
     */
    static fromJSON(data: Record<string, unknown>): NpcComponent;
}
//# sourceMappingURL=NpcComponent.d.ts.map