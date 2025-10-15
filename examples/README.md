# Logic Cubes Examples

This directory contains example code demonstrating the Logic Cube visual scripting system.

## Files

- `logic-cubes-demo.ts` - Complete demo scenes showcasing various logic patterns

## Examples Included

### 1. Click Counter
A simple counter that increments when a button is clicked.

**Pattern**: `OnClick → Counter → SendMessage`

**Use case**: Tracking player interactions, achievements

### 2. Timer System
A repeating timer that triggers actions at regular intervals.

**Pattern**: `OnTimer → Log → SendMessage`

**Use case**: Enemy spawning, periodic events, cooldowns

### 3. Conditional Logic
A system that routes signals based on a condition.

**Pattern**: `OnClick → CompareVariable → [True/False] → Different Actions`

**Use case**: Quest systems, difficulty scaling, state machines

### 4. AND Gate Logic
Requires multiple inputs to trigger an output.

**Pattern**: `Button1 → AND Gate ← Button2 → Action`

**Use case**: Puzzle solving, multi-step interactions, combinations

### 5. Delayed Action
Adds a time delay between trigger and action.

**Pattern**: `OnClick → Delay Gate → Action`

**Use case**: Timed sequences, cutscenes, delayed responses

### 6. Complete Game Loop
A full game system combining multiple logic patterns.

**Components**:
- Game start initialization
- Timed enemy spawning
- Score tracking
- Win condition checking

## Usage

### In Your Application

```typescript
import { createClickCounterDemo, createAllDemos } from './examples/logic-cubes-demo';
import { Scene } from './src/scene/Scene';

// Create a scene
const scene = new Scene('Demo Scene');

// Create a single demo
const { triggerCube, counterCube, actionCube } = createClickCounterDemo(scene);

// Or create all demos at once
createAllDemos(scene);
```

### Running Tests

```bash
# Run all logic cube tests
npm test -- LogicCube

# Run specific test file
npm test -- LogicCubeSystem
npm test -- LogicCubes
```

## Creating Custom Logic Cubes

### Example: Custom Trigger Cube

```typescript
import { LogicCube } from '../logic/cubes/LogicCube';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from '../logic/cubes/types';

export class CustomTrigger extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'customTrigger',
      displayName: 'Custom Trigger',
      category: 'trigger',
      description: 'My custom trigger cube',
      inputs: [],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Output',
        },
      ],
      parameters: [
        {
          key: 'myParam',
          label: 'My Parameter',
          type: 'number',
          defaultValue: 1,
        },
      ],
    };
  }

  onSignalReceived(portId: string, signal: LogicSignal): Map<string, LogicSignal> | null {
    // Implement your logic here
    return null;
  }
}

// Register your cube
import { LogicCubeRegistry } from '../logic/LogicCubeSystem';
LogicCubeRegistry.register('customTrigger', CustomTrigger);
```

## Best Practices

1. **Keep it Simple**: Start with basic patterns and combine them
2. **Name Clearly**: Use descriptive names for cubes and connections
3. **Test Incrementally**: Test each connection as you build
4. **Avoid Loops**: Be careful with circular connections (system prevents infinite loops but it's better to avoid them)
5. **Use Variables**: Share data between cubes using the VariableStorage system
6. **Organize Spatially**: Arrange cubes in a logical flow for easier debugging

## Common Patterns

### State Machine
```
Trigger → Compare State → [State1] → Action1 → Set State
                       → [State2] → Action2 → Set State
```

### Spawn Manager
```
Timer → Counter → Compare Count → [< Max] → Spawn Enemy
                                → [>= Max] → Stop Timer
```

### Achievement System
```
Action → Counter → Compare Score → [Threshold Met] → SendMessage('Achievement')
```

### Cooldown System
```
Input → Check Variable → [Ready] → Action → Set Cooldown → Timer → Reset
                      → [Not Ready] → Ignore
```

## Troubleshooting

**Connections not working?**
- Check that cube types are registered (`registerBuiltInLogicCubes()`)
- Verify port types are compatible (trigger → trigger, data → data)
- Ensure LogicCubeSystem is updating each frame

**Performance issues?**
- Limit signal propagation depth
- Use delays to spread out processing
- Check for unintended circular connections

**Variables not persisting?**
- Variables are stored per scene
- Make sure you're using the same VariableStorage instance
- Check variable names match exactly (case-sensitive)

## Further Reading

- See `LOGIC_CUBES_README.md` for system architecture
- Check `src/logic/cubes/` for all built-in cube implementations
- Review tests in `src/__tests__/LogicCubes.test.ts` for usage patterns

