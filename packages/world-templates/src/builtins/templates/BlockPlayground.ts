import { Entity, Scene, EnvironmentComponent, LightComponent, MeshComponent, MaterialComponent, SpawnPointComponent, CheckpointComponent } from '@engine/world';
import type { TemplateProvider } from '../../types';

/**
 * Creates a playground template with a single 30x30x1 platform block.
 * Perfect for testing and experimentation.
 */
export function createBlockPlaygroundTemplate(): TemplateProvider {
  return {
    meta: {
      id: 'template:block-playground',
      kind: 'template',
      name: 'Block Playground',
      description: 'Scene with a 30x30x1 platform block',
      tags: ['starter', 'blocks', 'playground'],
      version: '1.0.0',
    },
    build: () => {
      const scene = new Scene('Block Playground');

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

      // Platform block (30x30x1)
      const platform = new Entity('Platform');
      const platformMesh = new MeshComponent();
      platformMesh.meshType = 'cube';
      platform.addComponent(platformMesh);

      const platformMaterial = new MaterialComponent();
      platformMaterial.color = [0.7, 0.7, 0.7, 1]; // Light gray
      platform.addComponent(platformMaterial);

      platform.transform.position = [0, 0.5, 0]; // Center at y=0.5, so it sits from y=0 to y=1
      platform.transform.scale = [30, 1, 30]; // 30 wide, 1 tall, 30 deep

      scene.addEntity(platform);

      // Initial spawn point (player starts here)
      const spawnPoint = new Entity('PlayerStart');
      const spawnComponent = new SpawnPointComponent();
      spawnComponent.isDefault = true;
      spawnComponent.rotation = 0;
      spawnPoint.addComponent(spawnComponent);
      spawnPoint.transform.position = [0, 2, 0]; // Spawn 2 units above platform center
      scene.addEntity(spawnPoint);

      // Helper function to create checkpoint with visual marker
      const createCheckpoint = (name: string, x: number, z: number, radius: number = 3.0): Entity => {
        const checkpoint = new Entity(name);
        const checkpointComponent = new CheckpointComponent();
        checkpointComponent.activationRadius = radius;
        checkpointComponent.rotation = 0;
        checkpoint.addComponent(checkpointComponent);
        
        // Visual indicator (optional - semi-transparent green pillar)
        const checkpointMesh = new MeshComponent();
        checkpointMesh.meshType = 'cube';
        checkpoint.addComponent(checkpointMesh);
        const checkpointMaterial = new MaterialComponent();
        checkpointMaterial.color = [0.2, 0.8, 0.2, 0.5]; // Semi-transparent green
        checkpoint.addComponent(checkpointMaterial);
        checkpoint.transform.scale = [1, 2, 1]; // Tall checkpoint marker
        checkpoint.transform.position = [x, 1.5, z]; // Base on platform
        
        return checkpoint;
      };

      // Create checkpoints at different corners of the platform
      const checkpoint1 = createCheckpoint('Checkpoint1', 10, 0, 3.0);
      scene.addEntity(checkpoint1);
      
      const checkpoint2 = createCheckpoint('Checkpoint2', -10, 0, 3.0);
      scene.addEntity(checkpoint2);
      
      const checkpoint3 = createCheckpoint('Checkpoint3', 0, 10, 3.0);
      scene.addEntity(checkpoint3);
      
      const checkpoint4 = createCheckpoint('Checkpoint4', 0, -10, 3.0);
      scene.addEntity(checkpoint4);

      return scene;
    },
  };
}

