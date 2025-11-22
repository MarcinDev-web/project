# @engine/net-protocol

Network protocol definitions and serialization utilities for Forge Engine multiplayer.

## Overview

This package contains shared protocol definitions used by both client (`@engine/net`) and server (`@engine/net-server`). It ensures binary compatibility and provides efficient serialization tools.

## Features

- **BitStream**: Efficient `BitReader` and `BitWriter` for tight binary packing.
- **Snapshot Serialization**: Logic for delta compression and state snapshots.
- **Auth Tokens**: Zone token verification and Proof of Possession (PoP) mechanisms.
- **Control Messages**: Codecs for system control messages.

## Usage

```typescript
import { BitWriter } from '@engine/net-protocol';

const writer = new BitWriter(1024);
writer.writeUInt8(1); // Message ID
writer.writeString("Hello");
const packet = writer.toBuffer();
```

