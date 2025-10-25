import { audioSystem } from './AudioSystem';
import type { Scene } from '../engine/scene';
import type { OrbitControls } from '../input';
import { normalizeVec3Like, type Vec3 } from '@engine/core/math';

export interface AudioManagerConfig {
  scene: Scene;
  orbitControls: OrbitControls;
}

export class AudioManager {
  private disposed = false;
  private updateDispose: (() => void) | null = null;

  constructor(private readonly config: AudioManagerConfig) {}

  async initialize(): Promise<void> {
    if (!audioSystem.isSupported()) {
      return;
    }
    const supported = await audioSystem.ready();
    if (!supported) {
      return;
    }
    this.updateDispose = this.observeScene();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.updateDispose) {
      this.updateDispose();
      this.updateDispose = null;
    }
  }

  private observeScene(): () => void {
    const updateListener = () => {
      const camera = this.config.scene.primaryCamera;
      let position: Vec3 = [0, 0, 0];
      let forward: Vec3 = [0, 0, -1];
      let up: Vec3 = [0, 1, 0];

      if (camera) {
        position = camera.transform.getWorldPosition();
        const forwardVec = camera.transform.getForward();
        forward = normalizeVec3Like(forwardVec);
        const upVec = camera.transform.getUp();
        up = normalizeVec3Like(upVec);
      } else {
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

