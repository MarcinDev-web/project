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
      name: 'Starter Platform',
      description: 'Blue platform at origin with basic lighting',
      tags: ['starter', 'minimal', 'platform'],
      version: '1.1.0',
    },
    build: () => {
      const scene = new Scene('Starter Block');

      // Environment (procedural sky + soft ambient)
      // Position far away to avoid collision/interaction - this is not a visible mesh
      const env = new Entity('Environment');
      const envComp = new EnvironmentComponent();
      envComp.skyboxType = 'procedural-sky';
      envComp.ambientIntensity = 0.5;
      envComp.cloudsEnabled = true;
      envComp.cloudDensity = 0.85;
      envComp.cloudSpeed = 0.02;
      env.addComponent(envComp);
      // Position far away so it doesn't interfere with scene objects
      env.transform.position = [0, -1000, 0];
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

      // Blue platform (10x0.5x10) centered at origin, top surface at y=0
      const platform = new Entity('StarterPlatform');
      const mesh = new MeshComponent();
      mesh.meshType = 'box'; // Use box to allow non-uniform scaling
      // Specify dimensions in options instead of transform scale
      mesh.options = { 
        width: 10, 
        height: 0.5, 
        depth: 10 
      };
      platform.addComponent(mesh);

      const mat = new MaterialComponent();
      mat.color = [0.2, 0.5, 0.9, 1]; // Blue
      mat.emissiveColor = [0.2, 0.5, 0.9, 1]; // Self-illuminated for visibility debug
      mat.emissiveIntensity = 0.2;
      platform.addComponent(mat);

      // Platform geometry
      platform.transform.scale = [1, 1, 1]; // Scale is baked into mesh
      platform.transform.position = [0, -0.25, 0];
      scene.addEntity(platform);

      return scene;
    },
  };
}



