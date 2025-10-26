import { audioSystem } from './AudioSystem';
import { normalizeVec3Like } from '@engine/core/math';
export class AudioManager {
    config;
    disposed = false;
    updateDispose = null;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        if (!audioSystem.isSupported()) {
            return;
        }
        const supported = await audioSystem.ready();
        if (!supported) {
            return;
        }
        this.updateDispose = this.observeScene();
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.updateDispose) {
            this.updateDispose();
            this.updateDispose = null;
        }
    }
    observeScene() {
        const updateListener = () => {
            const camera = this.config.scene.primaryCamera;
            let position = [0, 0, 0];
            let forward = [0, 0, -1];
            let up = [0, 1, 0];
            if (camera) {
                position = camera.transform.getWorldPosition();
                const forwardVec = camera.transform.getForward();
                forward = normalizeVec3Like(forwardVec);
                const upVec = camera.transform.getUp();
                up = normalizeVec3Like(upVec);
            }
            else {
                const orbitState = this.config.orbitControls.getState();
                const { yaw, pitch, distance } = orbitState;
                const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
                const eyeY = Math.sin(pitch) * distance;
                const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
                position = [eyeX, eyeY, eyeZ];
            }
            void audioSystem.updateListener(position, forward, up);
        };
        updateListener();
        const interval = window.setInterval(updateListener, 1000 / 30);
        return () => window.clearInterval(interval);
    }
}
//# sourceMappingURL=AudioManager.js.map