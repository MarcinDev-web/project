# @engine/input

**Input Management** - Input context system, character input handlers.

## Zawartość

- **InputContextManager** - Stack-based input context management
- **CharacterInputHandler** - Keyboard input for character controllers
- **CharacterGamepadHandler** - Gamepad input for character controllers
- **Predefined contexts** - Editor, Gameplay, Menu input contexts

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

## Status

✅ **Zmigrowany** - Faza 6 zakończona (26.10.2025)

## Testy

Pakiet posiada 8 przechodzących testów:
- input.test.ts (8 testów OrbitControls - moved to @engine/camera)

```bash
pnpm test
```

## Struktura

```
packages/input/
├── src/
│   ├── InputContext.ts
│   ├── CharacterInput.ts
│   └── index.ts
└── __tests__/ (8 testów)
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)
