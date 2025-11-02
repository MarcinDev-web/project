import { Entity, Scene } from '@engine/world';
import { EnvironmentComponent, LightComponent, MeshComponent, MaterialComponent } from '@engine/world';
import type { TemplateProvider } from '../../types';

/**
 * Flat Platform template: minimal scene with environment and a single flat platform.
 */
export function createFlatPlatformTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:flat-platform',
      kind: 'template',
      name: 'Flat Platform',
      description: 'Minimal scene with a flat platform for building',
      tags: ['starter', 'platform'],
      version: '1.0.0',
    },
    build: () => {
      const scene = new Scene('Flat Platform');

      // Environment (procedural sky + soft ambient)
      const env = new Entity('Environment');
      const envComp = new EnvironmentComponent();
      envComp.skyboxType = 'procedural-sky';
      envComp.ambientIntensity = 0.5;
      env.addComponent(envComp);
      scene.addEntity(env);

      // Sun (directional)
      const sun = new Entity('Sun');
      const sunLight = new LightComponent();
      sunLight.lightType = 'directional';
      sunLight.color = [1, 0.98, 0.92];
      sunLight.intensity = 1.0;
      sunLight.direction = [-0.25, -1.0, -0.2];
      sun.addComponent(sunLight);
      scene.addEntity(sun);

      // Ambient light
      const ambient = new Entity('AmbientLight');
      const amb = new LightComponent();
      amb.lightType = 'ambient';
      amb.color = [1, 1, 1];
      amb.intensity = 0.25;
      ambient.addComponent(amb);
      scene.addEntity(ambient);

      // Flat platform (30x1x30) centered at origin
      const platform = new Entity('Platform');
      const mesh = new MeshComponent();
      mesh.meshType = 'cube';
      platform.addComponent(mesh);

      const mat = new MaterialComponent();
      mat.color = [0.7, 0.7, 0.72, 1];
      platform.addComponent(mat);

      platform.transform.scale = [30, 1, 30];
      platform.transform.position = [0, 0.5, 0];
      scene.addEntity(platform);

      return scene;
    },
  };
}


