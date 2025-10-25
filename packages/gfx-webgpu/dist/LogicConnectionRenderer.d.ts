/**
 * LogicConnectionRenderer - Renders 3D beams between connected logic cubes.
 */
import type { Scene } from '@engine/world';
import type { LogicConnectionManager } from '../logic/LogicConnectionManager';
import type { Mat4 } from '@engine/core/math';
/**
 * Renders visual connections between logic cubes
 */
export declare class LogicConnectionRenderer {
    private scene;
    private connectionManager;
    private device;
    private pipeline;
    private uniformBuffer;
    private uniformBindGroup;
    private vertexBuffer;
    private animationTime;
    private lineSegments;
    constructor(scene: Scene, connectionManager: LogicConnectionManager);
    /**
     * Initializes GPU resources
     */
    initialize(device: GPUDevice, presentationFormat: GPUTextureFormat): Promise<void>;
    /**
     * Updates connection geometry based on current connections
     */
    private updateConnectionGeometry;
    /**
     * Gets color for a connection based on its type
     */
    private getConnectionColor;
    /**
     * Renders all connection beams
     */
    render(passEncoder: GPURenderPassEncoder, viewProjectionMatrix: Mat4, cameraPosition: [number, number, number]): void;
    /**
     * Updates beam animations
     */
    update(deltaTime: number): void;
    /**
     * Cleanup
     */
    dispose(): void;
}
//# sourceMappingURL=LogicConnectionRenderer.d.ts.map