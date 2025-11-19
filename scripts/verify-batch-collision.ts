
import { Scene } from '../packages/world/src/core/Scene.ts';
import { Entity } from '../packages/world/src/core/Entity.ts';
import { PhysicsComponent, BoxCollider, RigidbodyType, ColliderShape } from '../packages/world/src/components/PhysicsComponent.ts';
import { PhysicsSystem } from '../packages/world/src/physics/PhysicsSystem.ts';
import { init as initWasm } from '../packages/wasm-collision/src/index.ts';

async function main() {
  console.log('Initializing WASM...');
  await initWasm();
  console.log('WASM initialized.');

  const scene = new Scene();
  const physicsSystem = new PhysicsSystem(scene, { 
    useWasm: true,
    gravity: [0, 0, 0] // Disable gravity to keep positions static for test
  });

  // Helper to create entity
  function createBox(x: number, y: number, z: number, size: number = 1, isDynamic = true) {
    const entity = new Entity();
    entity.transform.position = [x, y, z];
    
    const physics = new PhysicsComponent();
    physics.rigidbodyType = isDynamic ? RigidbodyType.Dynamic : RigidbodyType.Static;
    
    // Correct way to add box collider based on PhysicsComponent.ts
    const collider = physics.addBoxCollider([size, size, size]);
    
    entity.addComponent(physics);
    scene.addEntity(entity);
    return entity;
  }

  console.log('Creating entities...');
  // Pair 1: Colliding
  const e1 = createBox(0, 0, 0);
  const e2 = createBox(0.5, 0, 0); // Overlap (size 1, centers 0.5 apart)

  // Pair 2: Not colliding
  const e3 = createBox(10, 0, 0);
  const e4 = createBox(12, 0, 0); // Gap (size 1, centers 2 apart)

  let collisionCount = 0;
  physicsSystem.onCollision((evt) => {
    // console.log(`Collision: ${evt.entityA.id} <-> ${evt.entityB.id}`);
    collisionCount++;
  });

  console.log('Running update...');
  // Run a few updates to ensure physics steps run
  physicsSystem.update(0.016);
  physicsSystem.update(0.016);

  console.log(`Collisions detected: ${collisionCount}`);

  if (collisionCount > 0) {
    console.log('✅ Verification PASSED: Collisions detected.');
  } else {
    console.error('❌ Verification FAILED: No collisions detected.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
