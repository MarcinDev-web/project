import {
  Scene,
  Entity,
  Transform,
  CameraComponent,
  MeshComponent,
  MaterialComponent,
} from '@engine/world';

/**
 * SDF Matter Simulator Demo
 * 
 * This scene demonstrates the Signed Distance Field (SDF) renderer capabilities.
 * The actual rendering is handled by the SDFRenderer which is triggered by the scene name.
 */
export function createSDFDemoScene(): Scene {
  const scene = new Scene('SDF Matter Simulator');

  // 1. Create Camera
  // We need a camera for the renderer to know where to look
  const camera = new Entity('MainCamera', new Transform());
  camera.transform.position = [0, 2, 5]; // Look at center from slightly above
  camera.transform.lookAt([0, 0, 0]); // Look at origin
  
  const camComp = new CameraComponent();
  camComp.fov = 60;
  camComp.near = 0.1;
  camComp.far = 1000;
  camComp.primary = true;
  camera.addComponent(camComp);
  scene.addEntity(camera);

  // 2. Optional: Add some dummy entities to show standard rendering mixing (if desired)
  // For now, we keep it clean to focus on SDF. 
  // The SDF renderer clears the screen or draws over it?
  // In our implementation it draws ON TOP (loadOp: 'load').
  // So if we have a skybox or other objects, they will appear behind the SDF objects (if depth allows).
  // But SDF shader writes depth? Our prototype SDF shader might not write correct depth to depth buffer 
  // if it's just a full screen quad. 
  // Actually, SDF renderer usually outputs depth or uses discard.
  // Our simple prototype draws a full screen quad. It effectively overwrites everything behind it 
  // unless we use blending or discard pixels.
  // The current WGSL shader returns opacity 1.0 everywhere, so it will obscure the standard scene.
  // That's fine for a demo "mode".

  // Add a placeholder floor just in case
  const floor = new Entity('PlaceholderFloor', new Transform());
  floor.transform.position = [0, -1, 0];
  const floorMesh = new MeshComponent();
  floorMesh.meshType = 'plane';
  floorMesh.options = { width: 10, depth: 10 };
  floor.addComponent(floorMesh);
  const floorMat = new MaterialComponent();
  floorMat.primaryColor = [0.1, 0.1, 0.1, 1];
  floor.addComponent(floorMat);
  // scene.addEntity(floor); // Commented out to let SDF take full stage

  return scene;
}

