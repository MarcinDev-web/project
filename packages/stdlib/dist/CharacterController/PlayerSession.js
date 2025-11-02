export class PlayerSession {
    profile;
    controller = null;
    constructor(profile) {
        this.profile = profile;
    }
    /**
     * Get player ID from profile
     */
    get id() {
        return this.profile.id;
    }
    /**
     * Get player display name from profile
     */
    get displayName() {
        return this.profile.displayName;
    }
    bindController(controller) {
        if (this.controller !== null) {
            console.warn(`[PlayerSession] Overwriting existing controller for player ${this.profile.id}. ` +
                `Previous controller ID: ${this.controller.id}, new controller ID: ${controller.id}`);
        }
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
    /**
     * Dispose of this session and clean up resources.
     * Safe to call multiple times (idempotent).
     */
    dispose() {
        this.unbindController();
    }
}
//# sourceMappingURL=PlayerSession.js.map