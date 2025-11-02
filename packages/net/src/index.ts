/**
 * @engine/net - Multiplayer & Networking
 *
 * Client-side API for project sharing and networking functionality.
 */

export * from './types';
export * from './ShareClient';
export * from './ReplicationClient';
export * from './types/replication';
export * from './multiplayer/PlayerSync';
export * from './multiplayer/InputReplicator';
export * from './multiplayer/PhysicsSync';
export * from './multiplayer/MultiplayerGameplayManager';
export * from './collaboration/OperationReplicator';
export * from './collaboration/CursorTracker';
export * from './collaboration/StateSnapshotter';
export * from './collaboration/ConflictResolver';

// Transport negotiation & adapters
export * from './transport/ClientTransportAdapter';
export * from './transport/WebSocketClientAdapter';
export * from './transport/WebRTCClientAdapter';
export * from './transport/WebTransportClientAdapter';
export * from './transport/capabilities';
export * from './transport/Negotiation';
export * from './transport/HandshakeClient';
export * from './prediction/InputBuffer';
export * from './prediction/Reconciler';
export * from './prediction/Interpolator';

