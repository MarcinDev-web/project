import { Component } from '@engine/world';
import type { Vec3 } from '@engine/core';
import { type IOrbitCameraInput, type OrbitCameraClamps, type OrbitCameraConfig, type OrbitCameraDamping, type OrbitCameraSensitivity, type OrbitCameraZoomMix } from '../types';
/**
 * ECS Orbit camera component holding state and configuration.
 * System updates this data based on input and applies transforms to the entity.
 */
export declare class OrbitCameraComponent extends Component {
    static readonly type = "OrbitCameraControl";
    yaw: number;
    pitch: number;
    radius: number;
    fov: number;
    targetYaw: number;
    targetPitch: number;
    targetRadius: number;
    targetFov: number;
    pivot: Vec3;
    worldUp: Vec3;
    clamp: OrbitCameraClamps;
    damping: OrbitCameraDamping;
    sensitivity: OrbitCameraSensitivity;
    zoomMix: OrbitCameraZoomMix;
    /** Optional input adapter injected by application */
    input?: IOrbitCameraInput;
    constructor(config?: OrbitCameraConfig);
    getType(): string;
    clone(): OrbitCameraComponent;
    toJSON(): Record<string, unknown>;
    fromJSON(data: unknown): void;
    protected onDetach(): void;
}
//# sourceMappingURL=OrbitCameraComponent.d.ts.map