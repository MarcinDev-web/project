import type { Scene } from '@engine/world';
export type WorldTemplateId = string;
export type TemplateKind = 'template' | 'seed';
export interface TemplateMetadata {
    id: WorldTemplateId;
    kind: TemplateKind;
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    thumbnail?: string;
}
export interface TemplateProvider {
    meta: TemplateMetadata;
    build: () => Promise<Scene> | Scene;
}
export interface ListFilter {
    kind?: TemplateKind;
    tags?: string[];
}
//# sourceMappingURL=types.d.ts.map