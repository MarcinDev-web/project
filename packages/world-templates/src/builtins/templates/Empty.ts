import { Entity, Scene } from '@engine/world';
import { EnvironmentComponent, LightComponent, MeshComponent } from '@engine/world';
import type { TemplateProvider } from '../../types';

export function createEmptyTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:empty',
      kind: 'template',
      name: 'Empty Scene',
      description: 'Empty scene with grid floor, ambient and sun',
      tags: ['starter', 'lighting'],
      version: '1.0.0',
    },
    build: () => {
      const scene = new Scene('Empty');

      // Environment (procedural sky + ambient)
      const env = new Entity('Environment');
      const envComp = new EnvironmentComponent();
      envComp.skyboxType = 'procedural-sky';
      envComp.ambientIntensity = 0.6;
      env.addComponent(envComp);
      scene.addEntity(env);

      // Sun (directional)
      const sun = new Entity('Sun');
      const sunLight = new LightComponent();
      sunLight.lightType = 'directional';
      sunLight.color = [1, 0.98, 0.92];
      sunLight.intensity = 1.2;
      sunLight.direction = [-0.3, -1.0, -0.2];
      sun.addComponent(sunLight);
      scene.addEntity(sun);

      // Ambient light
      const ambient = new Entity('AmbientLight');
      const ambLight = new LightComponent();
      ambLight.lightType = 'ambient';
      ambLight.color = [1, 1, 1];
      ambLight.intensity = 0.3;
      ambient.addComponent(ambLight);
      scene.addEntity(ambient);

      // Grid-like floor (simple large, thin cube)
      const floor = new Entity('GridFloor');
      const mesh = new MeshComponent();
      mesh.meshType = 'cube';
      floor.addComponent(mesh);
      floor.transform.scale = [50, 0.05, 50];
      floor.transform.position = [0, -0.025, 0];
      scene.addEntity(floor);

      return scene;
    },
  };
}


