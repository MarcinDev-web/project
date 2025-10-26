import { LocalPlayerController } from './LocalPlayerController';
export class DefaultControllerFactory {
    createLocalController(options) {
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
//# sourceMappingURL=PlayerControllerFactory.js.map