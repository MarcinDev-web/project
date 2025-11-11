import { Entity, Scene } from '@engine/world';
import { EnvironmentComponent, LightComponent, MeshComponent, MaterialComponent } from '@engine/world';
import type { TemplateProvider } from '../../types';

/**
 * Starter Block template: minimal scene with a single small block at the origin.
 * No large platform. Intended as the default authoring start point.
 */
export function createStarterBlockTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:starter-block',
      kind: 'template',
      name: 'Starter Block',
      description: 'Single small block at origin with basic lighting',
      tags: ['starter', 'minimal'],
      version: '1.0.0',
    },
    build: () => {
      const scene = new Scene('Starter Block');

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

      // Single small block (1x1x1) centered at origin, resting on ground plane (y=0..1)
      const block = new Entity('StarterBlock');
      const mesh = new MeshComponent();
      mesh.meshType = 'cube';
      block.addComponent(mesh);

      const mat = new MaterialComponent();
      mat.color = [0.25, 0.25, 0.26, 1];
      block.addComponent(mat);

      block.transform.scale = [1, 1, 1];
      block.transform.position = [0, 0.5, 0];
      scene.addEntity(block);

      return scene;
    },
  };
}



