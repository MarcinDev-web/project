import type { Scene } from '@engine/world';
export interface OrbitControls {
    getState(): {
        yaw: number;
        pitch: number;
        distance: number;
    };
}
export interface AudioManagerConfig {
    scene: Scene;
    orbitControls: OrbitControls;
}
export declare class AudioManager {
    private readonly config;
    private disposed;
    private updateDispose;
    constructor(config: AudioManagerConfig);
    initialize(): Promise<void>;
    dispose(): void;
    private observeScene;
}
//# sourceMappingURL=AudioManager.d.ts.map