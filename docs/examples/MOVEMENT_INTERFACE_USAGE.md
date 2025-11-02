# Unified Movement Interface - Przykłady Użycia

## Przegląd

Unified Movement Interface (`MovementController`, `MovementInput`) pozwala na polimorficzne użycie różnych typów movement controllers przez wspólny API.

## Przykład 1: Polimorficzny Movement System

System który może obsługiwać różne typy movement controllers:

```typescript
import type { MovementController, MovementInput } from '@engine/world';
import { CharacterController } from '@engine/world';
// W przyszłości: import { VehicleController } from '@engine/world';

/**
 * Unified movement system that works with any MovementController
 */
class UnifiedMovementSystem {
  private controllers: MovementController[] = [];

  /**
   * Register any movement controller
   */
  registerController(controller: MovementController): void {
    this.controllers.push(controller);
  }

  /**
   * Update all registered controllers
   */
  update(deltaTime: number, getInput: (controller: MovementController) => MovementInput): void {
    for (const controller of this.controllers) {
      const input = getInput(controller);
      controller.setInput(input);
      controller.update(deltaTime);
    }
  }

  /**
   * Get all controller positions (for rendering, AI, etc.)
   */
  getAllPositions(): Vec3[] {
    return this.controllers.map(c => c.getPosition());
  }

  /**
   * Get all controller velocities (for physics sync, networking, etc.)
   */
  getAllVelocities(): Vec3[] {
    return this.controllers.map(c => c.getVelocity());
  }
}

// Użycie:
const system = new UnifiedMovementSystem();

// Możemy dodać CharacterController
const character = entity.getComponent(CharacterController);
if (character) {
  system.registerController(character);
}

// W przyszłości: VehicleController też będzie implementował MovementController
// const vehicle = entity.getComponent(VehicleController);
// if (vehicle) {
//   system.registerController(vehicle);
// }

// Wszystkie controllers obsługiwane przez jeden system!
system.update(deltaTime, (controller) => ({
  moveDirection: [0, 0, 1],
  sprint: false,
  jump: false,
}));
```

## Przykład 2: Użycie MovementInput zamiast CharacterInput

**Przed (CharacterInput):**
```typescript
import type { CharacterInput } from '@engine/world';

const input: CharacterInput = {
  moveDirection: [1, 0, 0],
  sprint: true,
  jump: false,
  cameraForward: [0, 0, -1],
  cameraRight: [1, 0, 0],
};

controller.setInput(input);
```

**Po (MovementInput - prostsze dla podstawowych przypadków):**
```typescript
import type { MovementInput } from '@engine/world';

// Prostsze API gdy nie potrzebujesz camera-relative movement
const input: MovementInput = {
  moveDirection: [1, 0, 0], // World space direction
  sprint: true,
  jump: false,
};

controller.setInput(input);
```

**Zachowana kompatybilność (CharacterInput nadal działa):**
```typescript
// Nadal możesz użyć CharacterInput gdy potrzebujesz camera-relative
const characterInput: CharacterInput = {
  moveDirection: [0, 0, 1], // Camera-relative
  sprint: true,
  jump: false,
  cameraForward: [0, 0, -1],
  cameraRight: [1, 0, 0],
};

controller.setInput(characterInput); // Działa!
```

## Przykład 3: Input Handler z Unified Interface

Input handler który zwraca MovementInput zamiast CharacterInput:

```typescript
import type { MovementInput } from '@engine/world';
import type { MovementController } from '@engine/world';

/**
 * Unified input handler - works with any MovementController
 */
class UnifiedInputHandler {
  private keys = new Map<string, boolean>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });
  }

  /**
   * Get input for any MovementController
   */
  getInput(): MovementInput {
    let x = 0, z = 0;

    if (this.keys.get('KeyW')) z += 1;
    if (this.keys.get('KeyS')) z -= 1;
    if (this.keys.get('KeyA')) x -= 1;
    if (this.keys.get('KeyD')) x += 1;

    // Normalize diagonal
    const length = Math.hypot(x, z);
    if (length > 0) {
      x /= length;
      z /= length;
    }

    return {
      moveDirection: [x, 0, z],
      sprint: this.keys.get('ShiftLeft') ?? false,
      jump: this.keys.get('Space') ?? false,
    };
  }

  /**
   * Apply input to any MovementController
   */
  applyToController(controller: MovementController): void {
    const input = this.getInput();
    controller.setInput(input);
  }
}

// Użycie z CharacterController
const inputHandler = new UnifiedInputHandler();
const controller = entity.getComponent(CharacterController);

if (controller) {
  inputHandler.applyToController(controller);
  controller.update(deltaTime);
}

// W przyszłości: ten sam handler działa z VehicleController!
// const vehicleController = entity.getComponent(VehicleController);
// if (vehicleController) {
//   inputHandler.applyToController(vehicleController);
//   vehicleController.update(deltaTime);
// }
```

## Przykład 4: System do Przełączania Typów Movement

System który pozwala przełączać między różnymi typami movement:

```typescript
import type { MovementController } from '@engine/world';
import { CharacterController } from '@engine/world';
// import { FlyingController, VehicleController } from '@engine/world';

class MovementTypeSwitcher {
  private currentController: MovementController | null = null;
  private lastInput: MovementInput = {
    moveDirection: [0, 0, 0],
    sprint: false,
    jump: false,
  };

  /**
   * Switch to a different movement controller
   */
  switchTo(controller: MovementController): void {
    if (this.currentController) {
      // Save last state
      const velocity = this.currentController.getVelocity();
      const position = this.currentController.getPosition();
      
      // Transfer state to new controller if possible
      // (zależnie od implementacji)
    }

    this.currentController = controller;
    
    // Apply last known input
    controller.setInput(this.lastInput);
  }

  /**
   * Update current movement controller
   */
  update(deltaTime: number, input: MovementInput): void {
    if (!this.currentController) return;

    this.lastInput = input;
    this.currentController.setInput(input);
    this.currentController.update(deltaTime);
  }

  /**
   * Get current controller position
   */
  getPosition(): Vec3 | null {
    return this.currentController?.getPosition() ?? null;
  }

  /**
   * Get current controller velocity
   */
  getVelocity(): Vec3 | null {
    return this.currentController?.getVelocity() ?? null;
  }
}

// Użycie:
const switcher = new MovementTypeSwitcher();

// Przełącz na CharacterController
const character = entity.getComponent(CharacterController);
if (character) {
  switcher.switchTo(character);
}

// Użytkownik naciśnie "F" żeby przelecieć
// switcher.switchTo(entity.getComponent(FlyingController)!);

// Wszystko działa przez ten sam interface!
switcher.update(deltaTime, {
  moveDirection: [0, 0, 1],
  sprint: false,
  jump: false,
});
```

## Przykład 5: Refaktoryzacja LocalPlayerController

Modyfikacja `LocalPlayerController` żeby używał MovementInput:

```typescript
// W LocalPlayerController.ts - można uprościć:

update(_deltaTime: number): void {
  if (!this.context.pawn || !this.pawnController) {
    return;
  }

  const input = this.inputHandler.getInput(); // CharacterInput

  // Convert to MovementInput if needed
  if (this.characterSystem) {
    // Use system applyIntent (multiplayer path)
    const forwardVec: Vec3 = this.fpsCamera?.getForwardDirection() ?? [0, 0, -1];
    const rightVec: Vec3 = this.fpsCamera?.getRightDirection() ?? [1, 0, 0];
    
    this.characterSystem.applyIntent(
      this.pawnController,
      {
        move: [input.moveDirection[0], input.moveDirection[2]],
        jump: input.jump,
        sprint: input.sprint,
      },
      forwardVec,
      rightVec
    );
  } else {
    // Direct input - można użyć MovementInput jeśli nie potrzebujesz camera-relative
    // const movementInput: MovementInput = {
    //   moveDirection: input.moveDirection,
    //   sprint: input.sprint,
    //   jump: input.jump,
    // };
    // this.pawnController.setInput(movementInput);
    
    // Albo zachować CharacterInput dla camera-relative movement
    const characterInput: CharacterInput = {
      moveDirection: input.moveDirection,
      sprint: input.sprint,
      jump: input.jump,
      cameraForward: this.fpsCamera?.getForwardDirection(),
      cameraRight: this.fpsCamera?.getRightDirection(),
    };
    this.pawnController.setInput(characterInput);
  }
}
```

## Przykład 6: AI System z Movement Interface

AI które może sterować różnymi typami controllers:

```typescript
import type { MovementController, MovementInput } from '@engine/world';

/**
 * AI behavior that works with any MovementController
 */
class AIMovementBehavior {
  private target: Vec3 | null = null;
  private controller: MovementController;

  constructor(controller: MovementController) {
    this.controller = controller;
  }

  /**
   * Move towards target
   */
  moveTo(target: Vec3): void {
    this.target = target;
  }

  /**
   * Update AI movement
   */
  update(deltaTime: number): void {
    if (!this.target) return;

    const position = this.controller.getPosition();
    const direction: Vec3 = [
      this.target[0] - position[0],
      this.target[1] - position[1],
      this.target[2] - position[2],
    ];

    // Normalize
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (length > 0.1) {
      direction[0] /= length;
      direction[1] /= length;
      direction[2] /= length;
    }

    const input: MovementInput = {
      moveDirection: direction,
      sprint: length > 5, // Sprint if far
      jump: false,
    };

    this.controller.setInput(input);
    this.controller.update(deltaTime);

    // Check if reached target
    const distance = Math.hypot(
      this.target[0] - position[0],
      this.target[1] - position[1],
      this.target[2] - position[2]
    );

    if (distance < 0.5) {
      this.target = null; // Reached!
    }
  }
}

// Użycie z CharacterController
const character = entity.getComponent(CharacterController);
if (character) {
  const ai = new AIMovementBehavior(character);
  ai.moveTo([10, 0, 10]);
  
  // W game loop:
  // ai.update(deltaTime);
}

// W przyszłości: ten sam AI działa z VehicleController!
// const vehicle = entity.getComponent(VehicleController);
// if (vehicle) {
//   const ai = new AIMovementBehavior(vehicle);
//   ai.moveTo([10, 0, 10]);
//   ai.update(deltaTime);
// }
```

## Przykład 7: Network Replication

Unified interface ułatwia network replication:

```typescript
import type { MovementController, MovementInput } from '@engine/world';

/**
 * Network sync dla MovementControllers
 */
class MovementReplicator {
  /**
   * Serialize movement state for network
   */
  serialize(controller: MovementController): {
    position: Vec3;
    velocity: Vec3;
    input: MovementInput;
  } {
    return {
      position: controller.getPosition(),
      velocity: controller.getVelocity(),
      input: {
        // Note: input nie jest przechowywany w controller
        // Musisz to przechować osobno lub odtworzyć
        moveDirection: [0, 0, 0],
        sprint: false,
        jump: false,
      },
    };
  }

  /**
   * Apply received movement state
   */
  applyState(controller: MovementController, state: {
    position: Vec3;
    velocity: Vec3;
    input: MovementInput;
  }): void {
    controller.setInput(state.input);
    // Position i velocity są synchronizowane przez physics system
    // lub można użyć teleport() jeśli dostępne
  }
}
```

## Korzyści Unified Movement Interface

1. **Polimorfizm** - jeden kod działa z różnymi typami movement
2. **Testability** - łatwe mockowanie MovementController w testach
3. **Extensibility** - łatwe dodawanie nowych typów movement (Vehicle, Flying, etc.)
4. **Code Reuse** - systemy input/AI działają z każdym MovementController
5. **Type Safety** - TypeScript wymusza implementację wszystkich metod

## Przyszłe Rozszerzenia

Interface może być rozszerzony o dodatkowe metody:

```typescript
export interface MovementController {
  // Obecne metody...
  setInput(input: MovementInput): void;
  update(deltaTime: number): void;
  getVelocity(): Vec3;
  getPosition(): Vec3;

  // Potencjalne przyszłe metody:
  // teleport?(position: Vec3): void;
  // setSpeed?(speed: number): void;
  // getMaxSpeed?(): number;
  // canJump?(): boolean;
}
```

## Podsumowanie

Unified Movement Interface umożliwia:
- ✅ Kod działający z różnymi typami movement
- ✅ Łatwiejsze testowanie i mockowanie
- ✅ Rozszerzalność - dodawanie nowych movement types bez zmiany istniejącego kodu
- ✅ Backward compatibility - CharacterInput nadal działa
- ✅ Type safety przez TypeScript interfaces

