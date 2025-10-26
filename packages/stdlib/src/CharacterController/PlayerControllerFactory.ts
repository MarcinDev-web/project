import type { PlayerController } from './Controller';
import { LocalPlayerController, type CharacterInputHandler, type CameraDirector, type FPSCamera, type CharacterControllerSystem } from './LocalPlayerController';
import type { ControllerBindings } from './ManifestBindings';

export interface LocalControllerOptions {
  id: string;
  bindings: ControllerBindings;
  inputHandler: CharacterInputHandler;
  cameraDirector: CameraDirector;
  fpsCamera: FPSCamera | null;
  characterSystem: CharacterControllerSystem | null;
}

export class DefaultControllerFactory {
  createLocalController(options: LocalControllerOptions): PlayerController {
    return new LocalPlayerController({
      id: options.id,
      preferences: options.bindings.preferences,
      inputHandler: options.inputHandler,
      cameraDirector: options.cameraDirector,
      fpsCamera: options.fpsCamera,
      characterSystem: options.characterSystem,
    });
  }
}

