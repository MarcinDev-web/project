import { Entity } from '@engine/world';
import type { Scene } from '@engine/world';
import type { GltfLite } from './GltfOptimizer';
type OptimizeFn = (file: File) => Promise<GltfLite>;
export declare class AssetImporter {
    private readonly scene;
    private readonly optimize;
    constructor(scene: Scene, opts?: {
        optimize?: OptimizeFn;
    });
    importGLTF(file: File): Promise<Entity>;
    private loadAndOptimize;
    private convertToEntity;
}
export {};
//# sourceMappingURL=AssetImporter.d.ts.map