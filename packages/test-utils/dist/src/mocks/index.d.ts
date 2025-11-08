/**
 * Reusable mock objects and utilities
 */
/**
 * Creates a mock HTMLCanvasElement with common methods and properties
 */
export declare function createMockCanvas(width?: number, height?: number): HTMLCanvasElement;
/**
 * Creates a mock WebGPU device with common methods
 */
export declare function createMockGPUDevice(): {
    createBuffer: import("vitest").Mock<() => {
        destroy: import("vitest").Mock<(...args: any[]) => any>;
        getMappedRange: import("vitest").Mock<(...args: any[]) => any>;
        mapAsync: import("vitest").Mock<() => Promise<void>>;
        unmap: import("vitest").Mock<(...args: any[]) => any>;
    }>;
    createTexture: import("vitest").Mock<() => {
        destroy: import("vitest").Mock<(...args: any[]) => any>;
        createView: import("vitest").Mock<() => {}>;
    }>;
    createShaderModule: import("vitest").Mock<() => {
        getCompilationInfo: import("vitest").Mock<() => Promise<{
            messages: never[];
        }>>;
    }>;
    createRenderPipeline: import("vitest").Mock<() => {}>;
    createComputePipeline: import("vitest").Mock<() => {}>;
    createCommandEncoder: import("vitest").Mock<() => {
        beginRenderPass: import("vitest").Mock<() => {
            end: import("vitest").Mock<(...args: any[]) => any>;
            setPipeline: import("vitest").Mock<(...args: any[]) => any>;
            draw: import("vitest").Mock<(...args: any[]) => any>;
        }>;
        finish: import("vitest").Mock<() => {}>;
    }>;
    createBindGroup: import("vitest").Mock<() => {}>;
    createBindGroupLayout: import("vitest").Mock<() => {}>;
    createPipelineLayout: import("vitest").Mock<() => {}>;
    createSampler: import("vitest").Mock<() => {}>;
    destroy: import("vitest").Mock<(...args: any[]) => any>;
    queue: {
        submit: import("vitest").Mock<(...args: any[]) => any>;
        writeBuffer: import("vitest").Mock<(...args: any[]) => any>;
        writeTexture: import("vitest").Mock<(...args: any[]) => any>;
    };
};
/**
 * Creates a mock WebGPU navigator with adapter support
 */
export declare function createMockGPU(): {
    requestAdapter: import("vitest").Mock<() => Promise<{
        requestDevice: import("vitest").Mock<() => Promise<{
            createBuffer: import("vitest").Mock<() => {
                destroy: import("vitest").Mock<(...args: any[]) => any>;
                getMappedRange: import("vitest").Mock<(...args: any[]) => any>;
                mapAsync: import("vitest").Mock<() => Promise<void>>;
                unmap: import("vitest").Mock<(...args: any[]) => any>;
            }>;
            createTexture: import("vitest").Mock<() => {
                destroy: import("vitest").Mock<(...args: any[]) => any>;
                createView: import("vitest").Mock<() => {}>;
            }>;
            createShaderModule: import("vitest").Mock<() => {
                getCompilationInfo: import("vitest").Mock<() => Promise<{
                    messages: never[];
                }>>;
            }>;
            createRenderPipeline: import("vitest").Mock<() => {}>;
            createComputePipeline: import("vitest").Mock<() => {}>;
            createCommandEncoder: import("vitest").Mock<() => {
                beginRenderPass: import("vitest").Mock<() => {
                    end: import("vitest").Mock<(...args: any[]) => any>;
                    setPipeline: import("vitest").Mock<(...args: any[]) => any>;
                    draw: import("vitest").Mock<(...args: any[]) => any>;
                }>;
                finish: import("vitest").Mock<() => {}>;
            }>;
            createBindGroup: import("vitest").Mock<() => {}>;
            createBindGroupLayout: import("vitest").Mock<() => {}>;
            createPipelineLayout: import("vitest").Mock<() => {}>;
            createSampler: import("vitest").Mock<() => {}>;
            destroy: import("vitest").Mock<(...args: any[]) => any>;
            queue: {
                submit: import("vitest").Mock<(...args: any[]) => any>;
                writeBuffer: import("vitest").Mock<(...args: any[]) => any>;
                writeTexture: import("vitest").Mock<(...args: any[]) => any>;
            };
        }>>;
    }>>;
};
/**
 * Creates a mock ResizeObserver
 */
export declare function createMockResizeObserver(): {
    ResizeObserver: import("vitest").Mock<() => {
        observe: import("vitest").Mock<(...args: any[]) => any>;
        unobserve: import("vitest").Mock<(...args: any[]) => any>;
        disconnect: import("vitest").Mock<(...args: any[]) => any>;
    }>;
    observe: import("vitest").Mock<(...args: any[]) => any>;
    unobserve: import("vitest").Mock<(...args: any[]) => any>;
    disconnect: import("vitest").Mock<(...args: any[]) => any>;
};
/**
 * Creates a mock performance timer
 */
export declare function createMockPerformance(): {
    now: import("vitest").Mock<() => number>;
    advance: (ms: number) => void;
    reset: () => void;
};
/**
 * Creates a mock requestAnimationFrame
 */
export declare function createMockAnimationFrame(): {
    requestAnimationFrame: import("vitest").Mock<(callback: FrameRequestCallback) => number>;
    cancelAnimationFrame: import("vitest").Mock<(id: number) => void>;
    tick: (deltaTime?: number) => void;
    getCurrentTime: () => number;
    reset: () => void;
};
/**
 * Creates a mock event dispatcher
 */
export declare function createMockEventDispatcher<T extends Event = Event>(): {
    addEventListener: import("vitest").Mock<(type: string, listener: EventListener) => void>;
    removeEventListener: import("vitest").Mock<(type: string, listener: EventListener) => void>;
    dispatchEvent: import("vitest").Mock<(event: T) => boolean>;
    clearListeners: () => void;
};
//# sourceMappingURL=index.d.ts.map