import type { Scene } from '@engine/world';
export interface OrbitCameraSystemConfig {
    logger?: {
        debug: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        error: (msg: string, error?: Error) => void;
    };
}
/**
 * System that updates entities with OrbitCameraComponent.
 * Reads input deltas, updates target state, applies FPS-independent smoothing,
 * and writes entity Transform position and CameraComponent FOV/target.
 */
export declare class OrbitCameraSystem {
    private readonly scene;
    private readonly logger;
    constructor(scene: Scene, config?: OrbitCameraSystemConfig);
    update(dt: number): void;
}
//# sourceMappingURL=OrbitCameraSystem.d.ts.map