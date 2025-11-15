# Multiplayer Usage Guide

**Guide for using multiplayer features in UGC 3D Platform**

---

## 📚 Spis treści

1. [Quick Start](#quick-start)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Server Integration](#server-integration)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation

Multiplayer packages are already included in the monorepo. For client-side usage:

```typescript
import { ReplicationClient, MultiplayerGameplayManager } from '@engine/net';
```

### Minimal Example

```typescript
import { Scene, PhysicsWorld } from '@engine/world';
import { ReplicationClient, MultiplayerGameplayManager } from '@engine/net';

// 1. Create ReplicationClient
const wsUrl = 'wss://your-server.com/ws';
const jwtToken = await getJWTToken(); // Get from auth system
const replicationClient = new ReplicationClient(wsUrl, jwtToken);

// 2. Create MultiplayerGameplayManager
const scene = new Scene('GameScene');
const physicsWorld = new PhysicsWorld();
const multiplayerManager = new MultiplayerGameplayManager(
  replicationClient,
  scene,
  physicsWorld
);

// 3. Start session
const sessionId = 'game-session-123';
const localPlayerEntity = scene.createEntity('LocalPlayer');
// ... setup player entity with CharacterController ...

await multiplayerManager.startSession(sessionId, localPlayerEntity);

// 4. Update every frame
function gameLoop(deltaTime: number) {
  multiplayerManager.update(deltaTime);
}

// 5. Process input
function handleInput(input: CharacterInput) {
  multiplayerManager.processInput(input);
}

// 6. Cleanup
await multiplayerManager.stopSession();
multiplayerManager.dispose();
```

---

## Basic Usage

### 1. Setting Up ReplicationClient

`ReplicationClient` handles the WebSocket connection and message routing.

```typescript
import { ReplicationClient } from '@engine/net';

const replicationClient = new ReplicationClient(
  wsUrl,           // WebSocket URL (e.g., 'wss://server.com/ws')
  jwtToken,        // JWT token for authentication
  {
    enableTransportNegotiation: true,  // Try WebRTC/WebTransport first
    clientId: 'optional-client-id',    // Optional custom client ID
    iceServers: [                      // Optional WebRTC ICE servers
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
);

// Subscribe to connection state changes
replicationClient.onStateChange((state) => {
  console.log('Connection state:', state);
  // States: Disconnected, Connecting, Connected, Joined, Error
});

// Subscribe to user events
replicationClient.onUserJoined((user) => {
  console.log('User joined:', user.email);
});

replicationClient.onUserLeft((userId) => {
  console.log('User left:', userId);
});

// Connect to session
await replicationClient.connect('session-id');
```

### 2. Creating MultiplayerGameplayManager

`MultiplayerGameplayManager` orchestrates all multiplayer systems.

```typescript
import { MultiplayerGameplayManager } from '@engine/net';

const multiplayerManager = new MultiplayerGameplayManager(
  replicationClient,  // ReplicationClient instance
  scene,              // Scene instance
  physicsWorld,       // PhysicsWorld instance
  errorHandler        // Optional ErrorHandler
);

// Subscribe to errors
multiplayerManager.onError((error) => {
  console.error('Multiplayer error:', error);
});

// Start session
await multiplayerManager.startSession(sessionId, localPlayerEntity);

// Check if session is active
if (multiplayerManager.isSessionActive()) {
  console.log('Multiplayer session active');
}

// Get connection state
const state = multiplayerManager.getConnectionState();
```

### 3. Player Entity Setup

Your local player entity must have a `CharacterController` component:

```typescript
import { Entity, CharacterController } from '@engine/world';

const playerEntity = scene.createEntity('LocalPlayer');
playerEntity.transform.position = [0, 1, 0];

const controller = new CharacterController({
  moveSpeed: 5.0,
  sprintMultiplier: 1.5,
  jumpForce: 8.0,
  gravityMultiplier: 1.0,
  maxSlopeAngle: 45,
  stepHeight: 0.3,
  groundCheckDistance: 0.1,
  airControlMultiplier: 0.3,
  rotationSpeed: 10,
  autoRotate: true,
});
playerEntity.addComponent(controller);

// Mark as local player (optional, but recommended)
playerEntity.userData.isLocalPlayer = true;
playerEntity.userData.userId = 'your-user-id';
```

### 4. Input Processing

Process character input through `MultiplayerGameplayManager`:

```typescript
import type { CharacterInput } from '@engine/world';

function handleInput(input: CharacterInput) {
  // MultiplayerGameplayManager will:
  // 1. Apply input to local CharacterController
  // 2. Replicate input to other clients
  multiplayerManager.processInput(input);
}

// Example input object
const input: CharacterInput = {
  moveDirection: [0, 0, 1],      // Forward movement
  cameraForward: [0, 0, -1],     // Camera forward vector
  cameraRight: [1, 0, 0],        // Camera right vector
  jump: false,
  sprint: false,
};
```

### 5. Update Loop

Call `update()` every frame:

```typescript
function gameLoop(deltaTime: number) {
  // Update multiplayer systems
  // This handles:
  // - Sending player position updates
  // - Sending physics state updates
  // - Interpolating remote players
  // - Handling reconnection
  multiplayerManager.update(deltaTime);
  
  // Update your game systems
  // ...
}
```

### 6. Cleanup

Always cleanup when done:

```typescript
// Stop session (disconnects from multiplayer)
await multiplayerManager.stopSession();

// Dispose resources
multiplayerManager.dispose();
```

---

## Advanced Features

### Reconnection Handling

`MultiplayerGameplayManager` automatically handles reconnection:

```typescript
// Subscribe to connection state changes
replicationClient.onStateChange((state) => {
  if (state === ReplicationState.Disconnected) {
    console.log('Connection lost, will attempt reconnection...');
  } else if (state === ReplicationState.Connected) {
    console.log('Reconnected successfully!');
  }
});

// Manual reconnection
try {
  await multiplayerManager.reconnect();
} catch (error) {
  console.error('Reconnection failed:', error);
}
```

### Error Handling

Use `ErrorHandler` for centralized error management:

```typescript
import { ErrorHandler } from '@engine/net/multiplayer';

const errorHandler = new ErrorHandler({
  onError: (error) => {
    console.error('Multiplayer error:', error);
    // Show error to user, log to analytics, etc.
  },
  throttleMs: 1000,  // Throttle duplicate errors
});

const multiplayerManager = new MultiplayerGameplayManager(
  replicationClient,
  scene,
  physicsWorld,
  errorHandler
);
```

### Remote Player Management

`MultiplayerGameplayManager` automatically spawns remote player avatars:

```typescript
// Get all remote players
const remotePlayers = multiplayerManager.getRemotePlayers();
for (const [userId, entity] of remotePlayers.entries()) {
  console.log(`Remote player ${userId}:`, entity);
}

// Remote players are automatically:
// - Spawned when user joins
// - Removed when user leaves
// - Updated with position/rotation from network
```

### Custom Player Sync Configuration

You can access individual sync systems:

```typescript
// Note: These are created automatically by MultiplayerGameplayManager
// You typically don't need to access them directly

// But if you need custom configuration, you can create them manually:
import { PlayerSync, InputReplicator, PhysicsSync } from '@engine/net';

const playerSync = new PlayerSync({
  localPlayerEntity,
  replicationClient,
  localUserId: 'user-id',
  sendInterval: 100,           // Send updates every 100ms
  interpolationTime: 100,      // Interpolate over 100ms
  enablePrediction: true,      // Enable client-side prediction
});

const inputReplicator = new InputReplicator({
  replicationClient,
  enableBuffering: true,       // Buffer inputs for lag compensation
  bufferSize: 50,              // Buffer up to 50 inputs
  enableTimestampSync: true,    // Synchronize timestamps
});

const physicsSync = new PhysicsSync({
  physicsWorld,
  scene,
  replicationClient,
  sendInterval: 100,           // Send physics updates every 100ms
  enableServerAuthority: false, // Client-authoritative (for now)
  interpolationTime: 100,      // Interpolate over 100ms
});
```

---

## Server Integration

### Server-Side Message Handling

The server (`apps/net-server`) automatically handles multiplayer messages:

```typescript
// Server receives and broadcasts:
// - 'player-update' messages
// - 'input' messages
// - 'physics-state' messages

// All messages are validated and broadcast to other users in the session
```

### WebSocket URL

Get WebSocket URL from your server:

```typescript
// Example: Get WebSocket URL for a game session
const buildId = 'game-build-123';
const response = await fetch(`/api/marketplace/${buildId}/ws-url`, {
  credentials: 'include',
});
const data = await response.json();
const wsUrl = data.url; // e.g., 'wss://server.com/ws/game/123'
```

### JWT Token

Get JWT token for authentication:

```typescript
// Option 1: From cookies
function getJWTFromCookies(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'authToken' || name === 'jwt' || name === 'token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Option 2: From API
async function getJWTFromAPI(): Promise<string | null> {
  const response = await fetch('/api/auth/token', {
    credentials: 'include',
  });
  if (response.ok) {
    const data = await response.json();
    return data.token;
  }
  return null;
}
```

---

## Best Practices

### 1. Always Cleanup

```typescript
// Always dispose when done
multiplayerManager.dispose();
replicationClient.dispose(); // If you created it separately
```

### 2. Handle Errors Gracefully

```typescript
multiplayerManager.onError((error) => {
  // Log error
  console.error('Multiplayer error:', error);
  
  // Show user-friendly message
  if (error.severity === 'critical') {
    showErrorDialog('Connection lost. Please reconnect.');
  }
  
  // Report to analytics
  analytics.trackError('multiplayer', error);
});
```

### 3. Check Connection State

```typescript
// Before sending important data
if (!multiplayerManager.isSessionActive()) {
  console.warn('Session not active, skipping multiplayer update');
  return;
}

// Or check connection state
const state = multiplayerManager.getConnectionState();
if (state === ReplicationState.Joined) {
  // Safe to send updates
}
```

### 4. Use Appropriate Update Rates

```typescript
// PlayerSync: 10 updates/second (100ms interval) - good for most games
// PhysicsSync: 10 updates/second (100ms interval) - good for most games
// InputReplicator: Up to 20 updates/second (50ms throttle) - good for responsive input

// Adjust based on your game's needs:
// - Fast-paced action games: Lower intervals (50-80ms)
// - Slower games: Higher intervals (150-200ms)
```

### 5. Validate Input Data

```typescript
// InputReplicator automatically validates:
// - moveDirection: Normalized [-1, 1] range
// - cameraForward/cameraRight: Finite numbers, reasonable bounds
// - Timestamps: Not too old or in future

// But you should also validate on your side:
function validateInput(input: CharacterInput): boolean {
  if (!input.moveDirection) return false;
  const [x, y, z] = input.moveDirection;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return false;
  }
  return true;
}
```

### 6. Handle Reconnection

```typescript
// MultiplayerGameplayManager handles reconnection automatically
// But you can also handle it manually:

replicationClient.onStateChange((state) => {
  if (state === ReplicationState.Disconnected) {
    // Show "Reconnecting..." UI
    showReconnectingUI();
  } else if (state === ReplicationState.Connected) {
    // Hide "Reconnecting..." UI
    hideReconnectingUI();
  }
});
```

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to server

**Solutions:**
1. Check WebSocket URL is correct
2. Verify JWT token is valid and not expired
3. Check server is running and accessible
4. Check CORS settings on server
5. Check network/firewall settings

```typescript
replicationClient.onError((error, code) => {
  if (code === 'CONNECTION_FAILED') {
    console.error('Failed to connect:', error);
    // Retry connection
    setTimeout(() => replicationClient.connect(sessionId), 5000);
  }
});
```

### Player Not Syncing

**Problem:** Local player position not updating for other players

**Solutions:**
1. Verify `localPlayerEntity` has `CharacterController` component
2. Check `localUserId` is set correctly
3. Verify `startSession()` was called
4. Check `update()` is called every frame
5. Verify connection state is `Joined`

```typescript
// Debug: Check if player sync is working
const playerSync = multiplayerManager.getPlayerSync(); // If exposed
console.log('Last sent position:', playerSync?.getLastSentPosition());
```

### Remote Players Not Appearing

**Problem:** Remote players not spawning

**Solutions:**
1. Verify `onUserJoined` callback is being called
2. Check `MultiplayerGameplayManager` is initialized
3. Verify session is active
4. Check for errors in console

```typescript
replicationClient.onUserJoined((user) => {
  console.log('User joined event received:', user);
  // MultiplayerGameplayManager should automatically spawn avatar
});
```

### Input Not Replicating

**Problem:** Input events not being sent to server

**Solutions:**
1. Verify `processInput()` is called with valid input
2. Check `InputReplicator` is initialized
3. Verify connection state is `Joined`
4. Check for throttling (InputReplicator throttles to 20 updates/second)

```typescript
// Debug: Check input replication
const inputReplicator = multiplayerManager.getInputReplicator(); // If exposed
console.log('Current sequence:', inputReplicator?.getCurrentSequence());
console.log('Buffered inputs:', inputReplicator?.getBufferedInputs(0, 100));
```

### Physics Not Syncing

**Problem:** Physics objects not synchronizing

**Solutions:**
1. Verify `PhysicsSync` is initialized
2. Check entities have `PhysicsComponent` with `RigidbodyType.Dynamic`
3. Verify `update()` is called after physics update
4. Check for errors in console

```typescript
// Debug: Check physics sync
const physicsSync = multiplayerManager.getPhysicsSync(); // If exposed
console.log('Frame number:', physicsSync?.getFrameNumber());
```

### High Latency

**Problem:** High latency in multiplayer

**Solutions:**
1. Reduce update intervals (but increases bandwidth)
2. Use interpolation for smoother movement
3. Enable client-side prediction
4. Use WebRTC instead of WebSocket (lower latency)
5. Check network conditions

```typescript
// Optimize for lower latency
const playerSync = new PlayerSync({
  localPlayerEntity,
  replicationClient,
  sendInterval: 50,  // 20 updates/second (lower latency)
  interpolationTime: 50,  // Faster interpolation
  enablePrediction: true,  // Enable prediction
});
```

---

## API Reference

### MultiplayerGameplayManager

```typescript
class MultiplayerGameplayManager {
  constructor(
    replicationClient: ReplicationClient,
    scene: Scene,
    physicsWorld: PhysicsWorld,
    errorHandler?: ErrorHandler
  );
  
  // Session management
  startSession(sessionId: string, localPlayerEntity: Entity): Promise<void>;
  stopSession(): Promise<void>;
  reconnect(): Promise<void>;
  
  // State queries
  isSessionActive(): boolean;
  getSessionId(): string | null;
  getConnectionState(): ReplicationState;
  isConnectedToServer(): boolean;
  
  // Player management
  getLocalPlayerEntity(): Entity | null;
  getRemotePlayers(): Map<string, Entity>;
  
  // Input processing
  processInput(input: CharacterInput): void;
  
  // Update loop
  update(deltaTime: number): void;
  
  // Error handling
  onError(callback: ErrorCallback): () => void;
  getErrorHandler(): ErrorHandler;
  
  // Cleanup
  dispose(): void;
}
```

### ReplicationClient

```typescript
class ReplicationClient {
  constructor(
    wsUrl: string,
    jwtToken: string,
    options?: {
      enableTransportNegotiation?: boolean;
      clientId?: string;
      iceServers?: RTCIceServer[];
    }
  );
  
  // Connection
  connect(sessionId: string): Promise<void>;
  disconnect(): void;
  
  // State queries
  getState(): ReplicationState;
  getLocalUserId(): string | null;
  getSessionId(): string | null;
  
  // Event subscriptions
  onStateChange(callback: (state: ReplicationState) => void): () => void;
  onUserJoined(callback: (user: PublicUser) => void): () => void;
  onUserLeft(callback: (userId: string) => void): () => void;
  onError(callback: (error: string, code?: string) => void): () => void;
  
  // Message sending
  sendPlayerUpdate(message: PlayerUpdateMessage): void;
  sendInput(message: InputMessage): void;
  sendPhysicsState(message: PhysicsStateMessage): void;
  
  // Message receiving
  onPlayerUpdate(callback: (message: PlayerUpdateMessage) => void): () => void;
  onInput(callback: (message: InputMessage) => void): () => void;
  onPhysicsState(callback: (message: PhysicsStateMessage) => void): () => void;
}
```

---

## Examples

### Complete Game Integration

See `apps/player/src/managers/PlayerModeManager.ts` for a complete example of multiplayer integration in a game application.

### Simple Multiplayer Scene

```typescript
import { Scene, Entity, CharacterController, PhysicsWorld } from '@engine/world';
import { ReplicationClient, MultiplayerGameplayManager } from '@engine/net';

async function setupMultiplayerGame() {
  // 1. Setup scene and physics
  const scene = new Scene('MultiplayerGame');
  const physicsWorld = new PhysicsWorld();
  physicsWorld.start();
  
  // 2. Create local player
  const playerEntity = scene.createEntity('Player');
  playerEntity.transform.position = [0, 1, 0];
  const controller = new CharacterController({ moveSpeed: 5.0 });
  playerEntity.addComponent(controller);
  
  // 3. Setup multiplayer
  const wsUrl = await getWebSocketUrl();
  const jwtToken = await getJWTToken();
  const replicationClient = new ReplicationClient(wsUrl, jwtToken);
  
  const multiplayerManager = new MultiplayerGameplayManager(
    replicationClient,
    scene,
    physicsWorld
  );
  
  // 4. Start session
  await multiplayerManager.startSession('game-123', playerEntity);
  
  // 5. Game loop
  function gameLoop(deltaTime: number) {
    physicsWorld.update(deltaTime);
    multiplayerManager.update(deltaTime);
    // ... render, etc.
  }
  
  // 6. Input handling
  function handleInput(input: CharacterInput) {
    multiplayerManager.processInput(input);
  }
  
  return { scene, multiplayerManager, gameLoop, handleInput };
}
```

---

**For more information, see:**
- [Multiplayer Readiness Report](./MULTIPLAYER_READINESS_REPORT.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Codebase Patterns](./CODEBASE_PATTERNS.md)

