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

      // Starter platform: 3x3 grid of grass blocks
      // Center y is -0.3 (top surface at -0.05) to avoid z-fighting with grid
      // This replaces the previous single 'StarterPlatform' entity
      const platformY = -0.3;
      
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const block = new Entity(`StarterBlock_${x}_${z}`);
          block.transform.position = [x, platformY, z];
          
          const blockMesh = new MeshComponent();
          blockMesh.meshType = 'box';
          blockMesh.options = { size: [1, 0.5, 1] }; // Half-height blocks
          block.addComponent(blockMesh);
          
          const blockMaterial = new MaterialComponent();
          blockMaterial.materialRef = 'grass'; // Use grass texture from atlas
          blockMaterial.roughness = 1.0; // High roughness for organic material
          blockMaterial.metallic = 0;
          block.addComponent(blockMaterial);
          
          scene.addEntity(block);
        }
      }

      return scene;
    },
  };
}

