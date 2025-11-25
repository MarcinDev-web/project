// Types
export type { WorldTemplateId, TemplateKind, TemplateMetadata, TemplateProvider, ListFilter } from './types';

// Registry
export { registerTemplates, listTemplates, getTemplate, instantiate, applyTo } from './registry/TemplateRegistry';

// Loaders
export { createJsonTemplate } from './loaders/JsonTemplate';
export { createProceduralTemplate } from './loaders/ProceduralTemplate';

// Built-in template
export { createMinimalTemplate } from './builtins/templates/Minimal';


