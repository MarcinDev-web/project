# @engine/input

**Input Management** - Keyboard, mouse, gamepad, touch.

## Zawartość

- **InputManager** - Main input manager
- **InputContext** - Stack-based contexts
- **CharacterInput** - Character controller input

## Zależności

- `@engine/core`

## Instalacja

```bash
pnpm add @engine/input
```

## Użycie

```typescript
import { InputManager, InputContextManager } from '@engine/input';

const inputManager = new InputManager(canvas);
const contextManager = new InputContextManager();

// Push context
contextManager.push({
  name: 'Gameplay',
  bindings: [
    { action: 'forward', keys: ['W'], callback: () => moveForward() },
    { action: 'jump', keys: ['Space'], callback: () => jump() },
  ],
});

// Update
function update() {
  inputManager.update();
  contextManager.processInput(inputManager);
}
```

## Status

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

