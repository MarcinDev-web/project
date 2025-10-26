export interface ControllerBindings {
    preferences: {
        fov: number;
        invertY: boolean;
        sensitivity: number;
        hudLayout: string;
    };
}
export interface PawnConfig {
    [key: string]: unknown;
}
export interface PlayManifest {
    controller: ControllerBindings;
    pawn: PawnConfig;
}
export declare function extractControllerBindings(manifest: PlayManifest): ControllerBindings;
export declare function extractPawnConfig(manifest: PlayManifest): PawnConfig;
//# sourceMappingURL=ManifestBindings.d.ts.map