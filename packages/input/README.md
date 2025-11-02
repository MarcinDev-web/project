# @engine/input

**Input Management** - Input context system, character input handlers, and Enhanced Input Abstraction.

## Zawartość

### Core Features
- **InputContextManager** - Stack-based input context management
- **CharacterInputHandler** - Keyboard input for character controllers (backward compatible)
- **CharacterGamepadHandler** - Gamepad input for character controllers (backward compatible)
- **Predefined contexts** - Editor, Gameplay, Menu input contexts

### Enhanced Input Abstraction (NEW)
- **InputSource** - Unified interface for all input sources (keyboard, gamepad, touch, etc.)
- **KeyboardInputSource** - Keyboard input source implementation
- **GamepadInputSource** - Gamepad input source implementation
- **UnifiedInputManager** - Aggregates multiple input sources with priority and combination strategies
- **InputMapper** - Key rebinding and input mapping management

## Zależności

- `@engine/core` (math types)
- `@engine/world` (CharacterInput type)

## Instalacja

```bash
pnpm add @engine/input
```

## Użycie

### Input Context Manager

```typescript
import { InputContextManager, GameplayInputContext } from '@engine/input';

const canvas = document.querySelector('canvas');
const inputManager = new InputContextManager(canvas);

// Push gameplay context
inputManager.push({
  ...GameplayInputContext,
  onAction: (action) => {
    console.log(`Action triggered: ${action}`);
  },
});

// Pop context
inputManager.pop();

// Check active actions
const isJumping = inputManager.isActionActive('jump');
```

### Character Input Handler

```typescript
import { CharacterInputHandler } from '@engine/input';

const inputHandler = new CharacterInputHandler();

// In game loop
function update() {
  const input = inputHandler.getInput();
  // input.moveDirection: [x, y, z]
  // input.jump: boolean
  // input.sprint: boolean
}

// Set camera directions for camera-relative movement
inputHandler.setCameraDirections(forward, right);
```

### Gamepad Support

```typescript
import { CharacterGamepadHandler } from '@engine/input';

const gamepadHandler = new CharacterGamepadHandler(0); // Player 1

if (gamepadHandler.isConnected()) {
  const input = gamepadHandler.getInput();
  // Use gamepad input
}
```

### Enhanced Input Abstraction

#### Unified Input Manager

```typescript
import { 
  UnifiedInputManager, 
  KeyboardInputSource, 
  GamepadInputSource,
  InputSourcePriority,
  InputCombinationStrategy 
} from '@engine/input';

// Create unified input manager
const inputManager = new UnifiedInputManager();

// Add keyboard source
const keyboard = new KeyboardInputSource('keyboard', InputSourcePriority.NORMAL);
inputManager.addSource(keyboard);

// Add gamepad source
const gamepad = new GamepadInputSource(0, 'gamepad', InputSourcePriority.HIGH);
inputManager.addSource(gamepad);

// Set combination strategy
inputManager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);

// In game loop
function update() {
  const input = inputManager.getInput();
  // Unified input from all sources
}

// Update camera directions for all sources
inputManager.setCameraDirections(forward, right);
```

#### Input Mapping

```typescript
import { InputMapper } from '@engine/input';

const mapper = new InputMapper();

// Remap keys
mapper.remapAction('jump', ['KeyJ', 'Space']);
mapper.remapMovement('forward', ['KeyW', 'ArrowUp']);

// Validate mapping
const validation = mapper.validate();
if (!validation.valid) {
  console.error('Mapping errors:', validation.errors);
}

// Get mapping
const mapping = mapper.getMapping();
keyboardSource.setMapping(mapping);
```

#### Custom Input Sources

You can create custom input sources by implementing the `InputSource` interface:

```typescript
import { InputSource, InputSourcePriority } from '@engine/input';
import type { CharacterInput } from '@engine/world';

class TouchInputSource implements InputSource {
  readonly id = 'touch';
  readonly priority = InputSourcePriority.NORMAL;
  readonly enabled = true;
  readonly connected = true;

  getInput(): CharacterInput | null {
    // Return touch input state
    return null;
  }

  setCameraDirections(forward: Vec3, right: Vec3): void {
    // Update camera directions
  }

  enable(): void { /* ... */ }
  disable(): void { /* ... */ }
  dispose(): void { /* ... */ }
}
```

## Status

✅ **Zmigrowany** - Faza 6 zakończona (26.10.2025)

## Testy

Pakiet posiada 43 przechodzące testy:
- `input.test.ts` (8 testów OrbitControls - moved to @engine/camera)
- `InputSource.test.ts` (23 testy dla Enhanced Input Abstraction)
- `InputMapper.test.ts` (12 testów dla InputMapper)

```bash
pnpm test
```

## Struktura

```
packages/input/
├── src/
│   ├── InputContext.ts           # Stack-based input context management
│   ├── CharacterInput.ts        # Legacy handlers (now use Enhanced Abstraction)
│   ├── InputSource.ts            # InputSource interface and types
│   ├── InputMapper.ts            # Key rebinding and mapping
│   ├── UnifiedInputManager.ts   # Aggregates multiple input sources
│   ├── sources/
│   │   ├── KeyboardInputSource.ts
│   │   └── GamepadInputSource.ts
│   └── index.ts
└── __tests__/ (43 testy)
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)
