import type { PlayerController } from './Controller';
import { type CharacterInputHandler, type CameraDirector, type FPSCamera, type CharacterControllerSystem } from './LocalPlayerController';
import type { ControllerBindings } from './ManifestBindings';
export interface LocalControllerOptions {
    id: string;
    bindings: ControllerBindings;
    inputHandler: CharacterInputHandler;
    cameraDirector: CameraDirector;
    fpsCamera: FPSCamera | null;
    characterSystem: CharacterControllerSystem | null;
}
export declare class DefaultControllerFactory {
    createLocalController(options: LocalControllerOptions): PlayerController;
}
//# sourceMappingURL=PlayerControllerFactory.d.ts.map