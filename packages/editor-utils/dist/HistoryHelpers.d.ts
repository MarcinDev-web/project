import { Scene, Entity } from '@engine/world';
/** Finds path to an entity within the scene's root hierarchy. */
export declare function computeEntityPath(scene: Scene, entity: Entity | null): number[] | null;
/** Resolves entity by path within a scene hierarchy. */
export declare function resolveEntityByPath(scene: Scene, path: number[] | null): Entity | null;
export declare function serializeScene(scene: Scene): string;
export declare function hydrateScene(scene: Scene, json: string): void;
//# sourceMappingURL=HistoryHelpers.d.ts.map