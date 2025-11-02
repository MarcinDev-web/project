export type { WorldTemplateId, TemplateKind, TemplateMetadata, TemplateProvider, ListFilter } from './types';
export { registerTemplates, listTemplates, getTemplate, instantiate, applyTo } from './registry/TemplateRegistry';
export { createJsonTemplate } from './loaders/JsonTemplate';
export { createProceduralTemplate } from './loaders/ProceduralTemplate';
export { createEmptyTemplate } from './builtins/templates/Empty';
export { createBasicLightingTemplate } from './builtins/templates/BasicLighting';
export { createBlockPlaygroundTemplate } from './builtins/templates/BlockPlayground';
export { createCornellBoxSeed } from './builtins/seeds/CornellBox';
//# sourceMappingURL=index.d.ts.map