/**
 * Types and interfaces for the Logic Cube system.
 */

import type { EntityId } from '@engine/world';

/**
 * Port direction: input receives signals, output sends signals
 */
export type PortDirection = 'input' | 'output';

/**
 * Port type determines what kind of data flows through the connection
 */
export type PortType = 'trigger' | 'data' | 'condition';

/**
 * Logic cube category for organization
 *
 * Note: While we provide built-in categories, we allow custom categories
 * via the string intersection type to support extensions without
 * TypeScript narrowing issues.
 */
export type LogicCubeCategory =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'data'
  | 'logic'
  | (string & {});

/**
 * Data types that can flow through data ports
 */
export type LogicDataType = 'number' | 'string' | 'boolean' | 'entity' | 'any';

/**
 * Port definition for logic cube inputs/outputs
 */
export interface LogicPort {
  /** Unique port identifier within the cube */
  id: string;
  /** Port type (trigger, data, or condition) */
  type: PortType;
  /** Direction of data flow */
  direction: PortDirection;
  /** Display name for editor UI */
  label: string;
  /** Optional data type constraint for data ports */
  dataType?: LogicDataType;
  /** Optional description for tooltips */
  description?: string;
}

/**
 * Connection between two logic cube ports
 */
export interface LogicConnection {
  /** Unique connection identifier */
  id: string;
  /** Source entity (output port owner) */
  sourceEntityId: EntityId;
  /** Source port identifier */
  sourcePort: string;
  /** Target entity (input port owner) */
  targetEntityId: EntityId;
  /** Target port identifier */
  targetPort: string;
}

/**
 * Signal that flows through connections
 */
export interface LogicSignal {
  /** Signal type */
  type: PortType;
  /** Optional data payload for data signals */
  data?: unknown;
  /** Source entity that emitted the signal */
  sourceEntityId: EntityId;
  /** Timestamp when signal was created */
  timestamp: number;
}

/**
 * Execution context for logic cube operations
 */
export interface LogicExecutionContext {
  /** Delta time since last update (for timers) */
  deltaTime: number;
  /** Current game time */
  gameTime: number;
  /** Signal that triggered execution (if any) */
  signal?: LogicSignal;
}

/**
 * Configuration parameter for logic cubes
 */
export interface LogicParameter {
  /** Parameter key */
  key: string;
  /** Display label */
  label: string;
  /** Parameter type */
  type: 'number' | 'string' | 'boolean' | 'select' | 'entity';
  /** Default value */
  defaultValue: unknown;
  /** Optional validation constraints */
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: unknown }>;
  /** Optional description */
  description?: string;
}

/**
 * Metadata for logic cube types (for editor/library)
 */
export interface LogicCubeMetadata {
  /** Unique type identifier */
  type: string;
  /** Display name */
  displayName: string;
  /** Category for organization */
  category: LogicCubeCategory;
  /** Description for tooltips */
  description: string;
  /** Icon name (can reference icon system) */
  icon?: string;
  /** Input port definitions */
  inputs: LogicPort[];
  /** Output port definitions */
  outputs: LogicPort[];
  /** Configurable parameters */
  parameters: LogicParameter[];
  /** Visual color for the cube (RGB normalized) */
  color?: [number, number, number];
}

/**
 * Serializable state for logic cube component
 */
export interface LogicCubeState {
  /** Cube type identifier */
  cubeType: string;
  /** Configuration parameters */
  config: Record<string, unknown>;
  /** Whether cube is enabled */
  enabled: boolean;
  /** Current cooldown remaining (seconds) */
  cooldown: number;
  /** Custom state data specific to cube type */
  state?: Record<string, unknown>;
}
