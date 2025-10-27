# @engine/world-templates

Reusable world templates and example seeds for @engine/world scenes.

- Templates: starting skeletons (Empty, Basic Lighting)
- Seeds: curated example worlds (Cornell Box)

## Usage

```ts
import {
  registerTemplates,
  listTemplates,
  instantiate,
  applyTo,
  createEmptyTemplate,
  createBasicLightingTemplate,
} from '@engine/world-templates';

registerTemplates([
  createEmptyTemplate(),
  createBasicLightingTemplate(),
]);

const cards = listTemplates({ kind: 'template' });
const scene = await instantiate('template:empty');
await applyTo(existingScene, 'template:basic-lighting', { clear: true });
```

See `src/types.ts` and `src/registry/TemplateRegistry.ts` for API.
