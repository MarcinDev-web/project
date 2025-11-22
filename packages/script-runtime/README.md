# @engine/script-runtime

Sandboxed execution environment for user scripts in Forge Engine.

## Overview

This package handles the safe execution of user-generated logic. It uses isolation techniques to prevent scripts from crashing the engine or accessing unauthorized resources.

## Features

- **IsolatedVM**: Execution sandbox for JavaScript/TypeScript code.
- **Resource Limits**: Mechanisms to limit CPU and memory usage of user scripts.
- **Interop**: Safe bridging between engine host and scripted logic.

## Usage

```typescript
import { IsolatedVM } from '@engine/script-runtime';

const vm = new IsolatedVM();
await vm.execute(`
  console.log("Hello from sandbox");
`);
```

