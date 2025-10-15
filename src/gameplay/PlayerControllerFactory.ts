import type { CharacterInputHandler } from '../input/CharacterInput';
import type { CameraDirector } from '../editor/camera/CameraDirector';
import type { FPSCamera } from '../editor/camera/FPSCamera';
import type { CharacterControllerSystem } from '../scene/CharacterControllerSystem';
import type { PlayerController } from './Controller';
import { LocalPlayerController } from './LocalPlayerController';
import type { ControllerBindings } from '../editor/core/PlayManifest';

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