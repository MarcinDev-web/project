# @engine/avatar

Avatar system for the Forge Engine, handling humanoid character generation, customization, and animation.

## Overview

This package provides the core logic for:
- **Avatar Mesh Generation**: Procedural generation of avatar meshes (torso, limbs).
- **Skeleton & Animation**: Bone hierarchy and animation system adapters.
- **Loadout & Customization**: Managing avatar parts, slots, and definitions.
- **Default Assets**: Default animations and part definitions for quick prototyping.

## Installation

```bash
pnpm add @engine/avatar
```

## Usage

### Creating an Avatar Instance

```typescript
import { AvatarInstance } from '@engine/avatar';

const avatar = new AvatarInstance();
// Configuration and setup...
```

### Geometry Generation

```typescript
import { generateHeroicTorsoMesh, generateCapsuleY } from '@engine/avatar';

// Generate mesh data for rendering
const torso = generateHeroicTorsoMesh();
const capsule = generateCapsuleY(1.0, 2.0);
```

### Default Loadout

```typescript
import { DEFAULT_AVATAR_LOADOUT } from '@engine/avatar';

console.log(DEFAULT_AVATAR_LOADOUT);
```

## Components

- **Skeleton**: Manages bone transforms and hierarchy.
- **Slots**: Defines attachment points for avatar parts (Head, Chest, Legs, etc.).
- **AnimationAdapter**: Bridges the avatar skeleton with the animation system.
- **PartLibrary**: Collection of available avatar parts.

