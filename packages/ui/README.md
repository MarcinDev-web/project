# @engine/ui

Shared React UI component library for Forge Engine applications.

## Overview

This package provides a consistent design system and reusable components for engine tools, editors, and dashboards. It includes:
- **Components**: Button, Input, Card, Modal, etc.
- **Styles**: CSS variables and base styles.

## Installation

```bash
pnpm add @engine/ui
```

## Usage

### Importing Components

```tsx
import { Button, Card } from '@engine/ui';

function MyComponent() {
  return (
    <Card>
      <h1>Hello World</h1>
      <Button onClick={() => console.log('clicked')}>Click Me</Button>
    </Card>
  );
}
```

### Styles

Import the main stylesheet in your application entry point (e.g., `main.tsx` or `App.tsx`):

```typescript
import '@engine/ui/styles.css';
```

## Development

Components are written in React (TypeScript) and styled with plain CSS using CSS variables for theming.

