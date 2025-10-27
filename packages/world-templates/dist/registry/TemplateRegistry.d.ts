import type { Scene } from '@engine/world';
import type { ListFilter, TemplateMetadata, TemplateProvider, WorldTemplateId } from '../types';
export declare function registerTemplates(providers: TemplateProvider[]): void;
export declare function listTemplates(filter?: ListFilter): TemplateMetadata[];
export declare function getTemplate(id: WorldTemplateId): TemplateProvider | null;
export declare function instantiate(id: WorldTemplateId): Promise<Scene>;
export declare function applyTo(target: Scene, id: WorldTemplateId, options?: {
    clear?: boolean;
}): Promise<void>;
//# sourceMappingURL=TemplateRegistry.d.ts.map