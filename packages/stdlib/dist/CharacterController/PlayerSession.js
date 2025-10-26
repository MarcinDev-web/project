export class PlayerSession {
    profile;
    controller = null;
    constructor(profile) {
        this.profile = profile;
    }
    bindController(controller) {
        this.controller = controller;
    }
    unbindController() {
        this.controller?.unpossess();
        this.controller = null;
    }
    update(deltaTime) {
        this.controller?.update(deltaTime);
    }
    getController() {
        return this.controller;
    }
}
//# sourceMappingURL=PlayerSession.js.map