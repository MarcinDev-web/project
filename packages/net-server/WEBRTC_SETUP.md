# WebRTC Server Setup

This package uses `wrtc` for Node.js WebRTC support.

## Installation

The `wrtc` package requires native compilation and may need system dependencies:

### Linux
```bash
sudo apt-get install build-essential python3
pnpm install
```

### macOS
```bash
# Requires Xcode Command Line Tools
xcode-select --install
pnpm install
```

### Windows
```bash
# Requires Visual Studio Build Tools or Windows SDK
pnpm install
```

## Usage

```typescript
import { WebRTCTransportServer } from '@engine/net-server';

const server = new WebRTCTransportServer({
  signalingPort: 8080,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN server for NAT traversal
    // { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
  ],
});

await server.start();
```

## TURN Server

For production, configure a TURN server (e.g., coturn) for clients behind NAT/firewall.

### Configuration

TURN server is configured via environment variables in `collab-server`:

```bash
# Required for production
TURN_URL=turn:turn.example.com:3478
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-credential
```

If TURN is not configured in production, a warning will be logged. For development, STUN-only configuration is sufficient.

### Setting up coturn

Example coturn configuration (`/etc/turnserver.conf`):

```
listening-port=3478
realm=your-domain.com
user=username:password
```

Then configure in environment:
```bash
TURN_URL=turn:your-domain.com:3478
TURN_USERNAME=username
TURN_CREDENTIAL=password
```

## Troubleshooting

- If `wrtc` fails to build, ensure Python 3 and build tools are installed
- For Alpine Linux, install `python3`, `make`, `g++`
- Check Node.js version compatibility (wrtc 0.4.7 supports Node 14+)

