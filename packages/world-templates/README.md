# @engine/world-templates

Reusable world templates for @engine/world scenes.

## Usage

```ts
import {
  registerTemplates,
  listTemplates,
  instantiate,
  applyTo,
  createMinimalTemplate,
} from '@engine/world-templates';

registerTemplates([
  createMinimalTemplate(),
]);

const cards = listTemplates({ kind: 'template' });
const scene = await instantiate('template:minimal');
await applyTo(existingScene, 'template:minimal', { clear: true });
```

See `src/types.ts` and `src/registry/TemplateRegistry.ts` for API.
