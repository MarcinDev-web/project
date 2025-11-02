# Gateway Service

HTTP API gateway for MMO networking system. Handles zone token issuance, health checks, and zone directory management.

## Quick Start

```typescript
import { GatewayServer, DirectoryService, ZoneTokenIssuer } from '@engine/gateway';
import crypto from 'crypto';

const directory = new DirectoryService();

// Register a zone
directory.register({
  id: 'zone-1',
  endpoint: 'wss://zone1.example.com:8080',
  capacity: 300,
  load: 0,
  healthy: true,
  region: 'us-east',
});

// Create gateway server
const secret = crypto.randomBytes(32);
const gateway = new GatewayServer({
  port: 3000,
  tokenSecret: secret,
  directory,
});

await gateway.start();
```

## API Endpoints

### `POST /api/zones/:id/token`

Issue a zone access token for a user.

**Request:**
```json
{
  "userId": "user-123"
}
```

**Response:**
```json
{
  "token": "eyJ...",
  "zoneId": "zone-1",
  "endpoint": "wss://zone1.example.com:8080",
  "expiresAt": 1234567890000
}
```

### `GET /api/zones`

List available zones.

**Query params:**
- `healthy=true` - Only return healthy zones

**Response:**
```json
{
  "zones": [
    {
      "id": "zone-1",
      "endpoint": "wss://zone1.example.com:8080",
      "capacity": 300,
      "load": 150,
      "healthy": true,
      "region": "us-east"
    }
  ]
}
```

### `POST /api/zones/:id/health`

Report zone health status (called by zone servers).

**Request:**
```json
{
  "healthy": true,
  "load": 150
}
```

### `GET /health`

Health check endpoint.

## Integration with Zone Servers

Zone servers should periodically report their health:

```typescript
async function reportHealth(zoneId: string) {
  const response = await fetch(`http://gateway:3000/api/zones/${zoneId}/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      healthy: true,
      load: currentPlayerCount,
    }),
  });
}
```


