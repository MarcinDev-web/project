# Water System - Usage Guide

Guide for game creators on how to use the water rendering system.

## Quick Start

### Basic Water Creation

```typescript
import { Scene, createWater, addWaterToEntity } from '@engine/world';

// Create a scene
const scene = new Scene();

// Create water entity using preset
const waterEntity = scene.createEntity('Lake');
const water = addWaterToEntity(waterEntity, 'calm_lake', [50, 50]);

// Position the water
waterEntity.transform.position = [0, 0, 0];
```

### Available Presets

- `'calm_lake'` - Still, reflective lake water
- `'ocean'` - Ocean with medium waves
- `'pool'` - Clear swimming pool water
- `'river'` - Flowing river water
- `'pond'` - Small pond water
- `'stormy_ocean'` - High waves, stormy conditions

### Custom Water

```typescript
import { createCustomWater } from '@engine/world';

const customWater = createCustomWater({
  size: [100, 100],
  waveHeight: 0.5,
  waveSpeed: 1.5,
  waterColor: [0.1, 0.3, 0.5, 0.8],
  foamColor: [1.0, 1.0, 1.0, 0.9],
  transparency: 0.2,
  reflectionStrength: 0.8,
  causticsEnabled: true,
});

const entity = scene.createEntity('CustomWater');
entity.addComponent(customWater);
```

## Helper Functions

### Basic Operations

```typescript
import {
  hasWater,
  getWater,
  setWaterSize,
  setWaterPosition,
  setWaterEnabled,
  setWaterSpeed,
  setWaterColor,
  setWaterTransparency,
} from '@engine/world';

// Check if entity has water
if (hasWater(entity)) {
  // Get water component
  const water = getWater(entity);
  
  // Modify properties
  setWaterSize(entity, [100, 100]);
  setWaterPosition(entity, [0, -5, 0]);
  setWaterSpeed(entity, 2.0);
  setWaterColor(entity, 0.1, 0.3, 0.5, 0.8);
  setWaterTransparency(entity, 0.3);
  
  // Enable/disable rendering
  setWaterEnabled(entity, true);
}
```

## Water Properties

### Size and Position

```typescript
// Set water plane size (width, height)
water.size = [50, 50];

// Position via entity transform
waterEntity.transform.position = [0, 0, 0];
waterEntity.transform.scale = [1, 1, 1]; // Scale affects size
```

### Wave Parameters

```typescript
// Wave animation speed
water.waveSpeed = 1.5; // Higher = faster waves

// Wave height (amplitude)
water.waveHeight = 0.5; // How high waves go

// Wave frequency (how many waves per unit)
water.waveFrequency = 1.2; // Higher = more waves

// Wave direction (normalized 2D vector)
water.waveDirection = [1, 0]; // Waves move in X direction
water.normalizeWaveDirection(); // Ensure it's normalized
```

### Visual Properties

```typescript
// Water base color (RGBA)
water.waterColor = [0.2, 0.5, 0.8, 0.7]; // Blue water

// Foam color at edges and wave peaks (RGBA)
water.foamColor = [1.0, 1.0, 1.0, 0.9]; // White foam

// Foam threshold (0-1, higher = more foam)
water.foamThreshold = 0.7;

// Transparency (0 = opaque, 1 = fully transparent)
water.transparency = 0.3;

// Refraction strength (distortion effect)
water.refractionStrength = 0.1;

// Reflection intensity (0-1)
water.reflectionStrength = 0.8;

// Enable caustics (light patterns underwater)
water.causticsEnabled = true;

// Enable/disable rendering
water.enabled = true;
```

## Examples

### Creating a Swimming Pool

```typescript
const pool = scene.createEntity('SwimmingPool');
const poolWater = addWaterToEntity(pool, 'pool', [10, 10]);
pool.transform.position = [0, 0, 0];
```

### Creating an Ocean

```typescript
const ocean = scene.createEntity('Ocean');
const oceanWater = addWaterToEntity(ocean, 'ocean', [200, 200]);
ocean.transform.position = [0, -10, 0]; // Below ground level
```

### Dynamic Water Effects

```typescript
// Change water properties during gameplay
function createStorm() {
  const water = getWater(waterEntity);
  if (water) {
    water.waveSpeed = 2.5;
    water.waveHeight = 1.0;
    water.waterColor = [0.05, 0.15, 0.3, 0.9]; // Darker
    water.foamThreshold = 0.4; // More foam
  }
}

function calmWater() {
  const water = getWater(waterEntity);
  if (water) {
    water.waveSpeed = 0.5;
    water.waveHeight = 0.1;
    water.foamThreshold = 0.85; // Less foam
  }
}
```

### Multiple Water Bodies

```typescript
// Create multiple water bodies in scene
const lake1 = scene.createEntity('Lake1');
addWaterToEntity(lake1, 'calm_lake', [50, 50]);
lake1.transform.position = [-50, 0, -50];

const lake2 = scene.createEntity('Lake2');
addWaterToEntity(lake2, 'pond', [20, 20]);
lake2.transform.position = [50, 0, 50];

const river = scene.createEntity('River');
addWaterToEntity(river, 'river', [100, 10]);
river.transform.position = [0, 0, 0];
```

## Tips

1. **Size**: Larger water bodies (ocean) benefit from higher wave values
2. **Position**: Place water at Y=0 or below ground level for realistic look
3. **Performance**: More water entities = more draw calls. Use larger single bodies when possible
4. **Transparency**: Lower transparency values make water more visible
5. **Reflections**: Higher reflection strength works best with environment cubemaps
6. **Foam**: Adjust foam threshold based on wave height - higher waves need lower threshold

## Integration with Editor

Water components are fully serializable and can be saved/loaded in scenes:

```typescript
// Save scene (water components included)
const sceneData = scene.toJSON();

// Load scene (water components restored)
scene.fromJSON(sceneData);
```

