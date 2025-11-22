# @engine/world-server

Authoritative game server logic for Forge Engine.

## Overview

This package manages the server-side representation of the game world. It orchestrates:
- **Zone Management**: Handling player assignment to zones.
- **State Replication**: Syncing ECS state to clients via snapshots.
- **Area of Interest (AoI)**: Optimizing network traffic by sending updates only for nearby entities.
- **Persistence**: Saving/loading world state.

## Features

- **ZoneServer**: Main entry point for a world instance.
- **EcsReplicator**: Replicates entity components to clients.
- **GridAoI**: Spatial partitioning for networking.
- **Persistence**: Database abstraction for world data.

## Usage

```typescript
import { ZoneServer } from '@engine/world-server';

const zone = new ZoneServer({
  worldId: 'world-1',
  port: 9000
});

await zone.start();
```

