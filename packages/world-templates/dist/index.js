// Registry
export { registerTemplates, listTemplates, getTemplate, instantiate, applyTo } from './registry/TemplateRegistry';
// Loaders
export { createJsonTemplate } from './loaders/JsonTemplate';
export { createProceduralTemplate } from './loaders/ProceduralTemplate';
// Built-in templates/seeds
export { createEmptyTemplate } from './builtins/templates/Empty';
export { createBasicLightingTemplate } from './builtins/templates/BasicLighting';
export { createCornellBoxSeed } from './builtins/seeds/CornellBox';
//# sourceMappingURL=index.js.map