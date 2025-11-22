# @engine/net-server

Server-side networking primitives for Forge Engine.

## Overview

This package provides the low-level transport layer for the game server. It abstracts different transport mechanisms (WebRTC, WebSocket, WebTransport) and handles connection security.

## Features

- **Transport Agnostic**: Unified `TransportServer` interface.
- **Implementations**:
  - `WebRTCTransportServer`: High-performance unreliable channel (UDP-like).
  - `WebSocketTransportServer`: Fallback reliable channel (TCP).
  - `WebTransportServer`: Modern QUIC-based transport.
- **Security**:
  - `RateLimiter`: Connection throttling.
  - `AntiSpam`: Packet flood protection.
  - `Handshake`: Protocol version and token verification.

## Usage

```typescript
import { WebRTCTransportServer } from '@engine/net-server';

const server = new WebRTCTransportServer({
  port: 9000,
  certPath: './cert.pem',
  keyPath: './key.pem'
});

server.on('connection', (conn) => {
  console.log('New peer connected', conn.id);
  
  conn.on('message', (msg) => {
    // Handle binary message
  });
});

await server.start();
```

