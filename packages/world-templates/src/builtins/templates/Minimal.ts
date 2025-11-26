import { Entity, Scene } from '@engine/world';
import { EnvironmentComponent, LightComponent, MeshComponent, MaterialComponent } from '@engine/world';
import type { TemplateProvider } from '../../types';

/**
 * Minimal template: scene with basic lighting and a 3x3 starter platform.
 * Contains: Environment, Sun (directional), Ambient light, and a starter platform.
 */
export function createMinimalTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:minimal',
      kind: 'template',
      name: 'Minimal Scene',
      description: 'Scene with basic lighting and a 3x3 starter platform',
      tags: ['starter', 'minimal'],
      version: '1.1.0',
    },
    build: () => {
      const scene = new Scene('New Project');

      // Environment (procedural sky with volumetric clouds)
      // Note: IBL is now generated without clouds to prevent lighting artifacts
      const env = new Entity('Environment');
      const envComp = new EnvironmentComponent();
      envComp.skyboxType = 'procedural-sky';
      envComp.ambientIntensity = 0.4;
      envComp.cloudsEnabled = true; // Volumetric clouds in the sky
      envComp.cloudDensity = 0.5;
      env.addComponent(envComp);
      scene.addEntity(env);

      // Sun (directional light)
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
      ambLight.intensity = 0.35;
      ambient.addComponent(ambLight);
      scene.addEntity(ambient);

      // Starter platform (3x3x0.5)
      const platform = new Entity('StarterPlatform');
      platform.transform.position = [0, -0.25, 0]; // Slightly below origin so top is at y=0
      
      const platformMesh = new MeshComponent();
      platformMesh.meshType = 'box';
      platformMesh.options = { size: [3, 0.5, 3] };
      platform.addComponent(platformMesh);
      
      // Add material with a neutral gray color and no reflections
      const platformMaterial = new MaterialComponent();
      platformMaterial.color = [0.6, 0.6, 0.65, 1]; // Light gray-blue
      platformMaterial.roughness = 1.0; // Fully rough (no specular reflections)
      platformMaterial.metallic = 0; // Non-metallic
      platform.addComponent(platformMaterial);
      
      scene.addEntity(platform);

      return scene;
    },
  };
}

