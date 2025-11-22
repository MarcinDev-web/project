# @engine/asset-pipeline

Asset loading, processing, and management pipeline for the Forge Engine.

## Overview

This package handles the loading and parsing of game assets, including:
- GLTF/GLB models
- Textures
- Binary data parsing

It is designed to be platform-agnostic where possible, though some loaders (like `TextureLoader`) may depend on browser APIs (Image, etc.).

## Installation

```bash
pnpm add @engine/asset-pipeline
```

## Usage

### Asset Pipeline

The `AssetPipeline` class is the main entry point for managing asset loading operations.

```typescript
import { AssetPipeline } from '@engine/asset-pipeline';

const pipeline = new AssetPipeline();
// Usage examples would go here once implementation details are confirmed
```

### GLB Parsing

Parse binary GLTF (GLB) files into structured data.

```typescript
import { parseGLB } from '@engine/asset-pipeline';

const buffer = await fetch('model.glb').then(r => r.arrayBuffer());
const glb = parseGLB(buffer);

console.log(glb.json); // JSON chunk
console.log(glb.binaryChunk); // Binary buffer
```

### Texture Loading

Load textures from URLs.

```typescript
import { TextureLoader } from '@engine/asset-pipeline';

const loader = new TextureLoader();
const texture = await loader.load('path/to/texture.png');
```

## Features

- **GLB Parser**: Efficient parsing of binary GLTF files.
- **Texture Loader**: Async texture loading with promise support.
- **Typed Assets**: TypeScript definitions for asset formats.

