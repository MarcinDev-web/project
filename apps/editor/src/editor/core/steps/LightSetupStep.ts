import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';
import { LightManager } from '@engine/gfx-webgpu/lighting/LightManager';
import { LightComponent } from '@engine/world/components/LightComponent';

export class LightSetupStep implements LoadingStep {
  readonly name = 'Ensure scene lighting';
  readonly weight = 1;
  readonly canRetry = false;
  readonly critical = false;

  async execute(context: LoadingContext): Promise<void> {
    const scene = context.worldManager.getRuntimeWorld();
    if (!scene) return;
    const lights = scene.queryEntities(LightComponent);
    const hasAnyLight = lights.length > 0 && lights.some((e) => {
      const lc = e.getComponent(LightComponent);
      return !!lc && lc.enabled && e.active;
    });
    if (!hasAnyLight) {
      LightManager.createDefaultLights(scene);
      context.emitProgress({ step: this.name, current: 1, total: 1, percentage: 0, message: 'Default lights injected' });
    }
  }
}


