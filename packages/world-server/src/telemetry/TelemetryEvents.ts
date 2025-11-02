/**
 * Telemetry events for ZoneServer observability
 */

export interface TelemetryEvent {
  timestamp: number;
  type: string;
}

export interface TickEvent extends TelemetryEvent {
  type: 'tick';
  tickMs: number;
  clientCount: number;
}

export interface ClientJoinEvent extends TelemetryEvent {
  type: 'client:join';
  clientId: string;
  userId: string;
}

export interface ClientLeaveEvent extends TelemetryEvent {
  type: 'client:leave';
  clientId: string;
  userId: string;
}

export interface VoxelOpEvent extends TelemetryEvent {
  type: 'voxel:op';
  clientId: string;
  userId: string;
  operation: string;
}

export type ZoneTelemetryEvent = TickEvent | ClientJoinEvent | ClientLeaveEvent | VoxelOpEvent;
