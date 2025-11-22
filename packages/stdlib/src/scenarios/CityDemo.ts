import {
  Scene,
  Entity,
  Transform,
  MeshComponent,
  PhysicsComponent,
  MaterialComponent,
  RigidbodyType,
  HealthComponent,
} from '@engine/world';
import { NpcComponent } from '@engine/world/components/NpcComponent';
import type { Vec3 } from '@engine/core/math';
import {
  createCheckpoint,
  createSpeedZone,
  createLaunchPad,
} from '../FunKit/FunKitPrefabs';

/**
 * Creates a procedural city demo scene.
 * 
 * Features:
 * - Infinite-looking ground plane (grid of planes)
 * - Procedural city blocks with buildings
 * - Checkpoints and race elements
 * - Physics props (ramps, obstacles)
 * - Destructible crates with HealthComponent
 * - Simple traffic (NPC cars)
 */
export function createCityDemoScene(): Scene {
  const scene = new Scene('GTA Style City Demo');

  // 1. Create Ground Plane (Roads/Asphalt)
  // We create a large tiled ground to avoid one massive mesh
  const groundSize = 200;
  const groundTiles = 3; // 3x3 grid
  const offset = (groundSize * groundTiles) / 2 - groundSize / 2;

  for (let x = 0; x < groundTiles; x++) {
    for (let z = 0; z < groundTiles; z++) {
      const ground = new Entity(`Ground_${x}_${z}`, new Transform());
      ground.transform.position = [
        x * groundSize - offset,
        -0.5,
        z * groundSize - offset,
      ];
      
      // Visual mesh
      const mesh = new MeshComponent();
      mesh.meshType = 'plane';
      mesh.options = { width: groundSize, depth: groundSize };
      ground.addComponent(mesh);

      // Dark asphalt color
      const material = new MaterialComponent();
      material.primaryColor = [0.2, 0.2, 0.2, 1]; // Dark grey
      material.roughness = 0.8;
      ground.addComponent(material);

      // Physics
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Static;
      physics.addBoxCollider([groundSize / 2, 0.5, groundSize / 2]);
      ground.addComponent(physics);

      scene.addEntity(ground);
    }
  }

  // 2. Procedural Buildings & Roads logic
  // Generate a grid of city blocks
  const blockSize = 40;
  const streetWidth = 15;
  const citySize = 4; // 4x4 blocks

  // Collect road waypoints for traffic
  const roadIntersections: Vec3[] = [];

  for (let x = -citySize; x <= citySize; x++) {
    for (let z = -citySize; z <= citySize; z++) {
      // Store intersection points (center of intersections)
      const centerX = x * (blockSize + streetWidth) - (blockSize + streetWidth) / 2;
      const centerZ = z * (blockSize + streetWidth) - (blockSize + streetWidth) / 2;
      roadIntersections.push([centerX, 1, centerZ]);

      // Skip center for spawn area
      if (Math.abs(x) < 1 && Math.abs(z) < 1) continue;

      // Random building properties
      const height = 10 + Math.random() * 30;
      const width = blockSize - Math.random() * 10;
      const depth = blockSize - Math.random() * 10;
      
      const building = new Entity(`Building_${x}_${z}`, new Transform());
      building.transform.position = [
        x * (blockSize + streetWidth),
        height / 2,
        z * (blockSize + streetWidth),
      ];

      // Visual
      const mesh = new MeshComponent();
      mesh.meshType = 'box';
      mesh.options = { size: [width, height, depth] };
      building.addComponent(mesh);

      // Material (randomized building colors)
      const material = new MaterialComponent();
      // Simple HSV to RGB approx or just random variations
      if (Math.random() > 0.7) {
        // Glass/Modern look
        material.primaryColor = [0.7, 0.8, 0.9, 1];
        material.metallic = 0.8;
        material.roughness = 0.1;
      } else {
        // Concrete/Brick look
        material.primaryColor = [
          0.5 + Math.random() * 0.3,
          0.5 + Math.random() * 0.3,
          0.5 + Math.random() * 0.3,
          1
        ];
        material.roughness = 0.9;
      }
      building.addComponent(material);

      // Physics
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Static;
      physics.addBoxCollider([width / 2, height / 2, depth / 2]);
      building.addComponent(physics);

      scene.addEntity(building);
    }
  }

  // 3. Race Course Elements (FunKit)
  
  // Start Line
  const startGate = new Entity('StartLine', new Transform());
  startGate.transform.position = [0, 0, -10];
  // Add visual marker for start
  const startMesh = new MeshComponent();
  startMesh.meshType = 'box';
  startMesh.options = { size: [10, 0.2, 1] };
  startGate.addComponent(startMesh);
  const startMat = new MaterialComponent();
  startMat.primaryColor = [0, 1, 0, 0.5]; // Green transparent
  startMat.flags |= MaterialComponent.FLAG_TRANSPARENT;
  startGate.addComponent(startMat);
  scene.addEntity(startGate);

  // Checkpoints in a loop
  const checkpoints: Vec3[] = [
    [0, 2, -50],
    [50, 2, -50],
    [50, 2, 50],
    [-50, 2, 50],
    [-50, 2, -20],
    [0, 2, 0], // Finish
  ];

  checkpoints.forEach((pos) => {
    createCheckpoint(scene, pos, 0, 5);
  });

  // Speed Boosts on the straights
  createSpeedZone(scene, [25, 1, -50], 2.0, [1, 0, 0]); // Boost East
  createSpeedZone(scene, [-25, 1, 50], 2.0, [-1, 0, 0]); // Boost West

  // 4. Ramps & Stunts
  const ramp = new Entity('MegaRamp', new Transform());
  ramp.transform.position = [0, 0, 80];
  ramp.transform.setEulerAngles(Math.PI / 6, 0, 0); // 30 deg incline
  
  const rampMesh = new MeshComponent();
  rampMesh.meshType = 'box';
  rampMesh.options = { size: [10, 1, 20] };
  ramp.addComponent(rampMesh);
  
  const rampPhys = new PhysicsComponent();
  rampPhys.rigidbodyType = RigidbodyType.Static;
  rampPhys.addBoxCollider([5, 0.5, 10]);
  ramp.addComponent(rampPhys);
  
  scene.addEntity(ramp);

  // Add a launch pad at the end of the ramp
  createLaunchPad(scene, [0, 5, 90], [0, 1, 1], 20);

  // 5. Dynamic Obstacles (Crates)
  for (let i = 0; i < 20; i++) {
    const crate = new Entity(`Crate_${i}`, new Transform());
    crate.transform.position = [
      (Math.random() - 0.5) * 20,
      5 + i * 2,
      (Math.random() - 0.5) * 20 + 20
    ];
    
    const crateMesh = new MeshComponent();
    crateMesh.meshType = 'cube';
    crate.addComponent(crateMesh);
    
    const crateMat = new MaterialComponent();
    crateMat.primaryColor = [0.8, 0.6, 0.4, 1]; // Wood color
    crate.addComponent(crateMat);
    
    const cratePhys = new PhysicsComponent();
    cratePhys.rigidbodyType = RigidbodyType.Dynamic;
    cratePhys.mass = 10;
    cratePhys.addBoxCollider([0.5, 0.5, 0.5]);
    crate.addComponent(cratePhys);

    // Add HealthComponent to make it destructible
    const crateHealth = new HealthComponent();
    crateHealth.maxHealth = 50;
    crateHealth.currentHealth = 50;
    crate.addComponent(crateHealth);
    
    scene.addEntity(crate);
  }

  // 6. NPC Traffic
  // Spawn simple cars that drive between road intersections
  const carCount = 15;
  
  for (let i = 0; i < carCount; i++) {
    const startIdx = Math.floor(Math.random() * roadIntersections.length);
    const startPos = roadIntersections[startIdx];
    if (!startPos) continue;

    const car = new Entity(`TrafficCar_${i}`, new Transform());
    // Offset Y to be above ground
    car.transform.position = [startPos[0], 1.5, startPos[2]]; 
    car.userData.isCar = true;

    // Visual (Car body)
    const mesh = new MeshComponent();
    mesh.meshType = 'box';
    mesh.options = { size: [2, 1.5, 4] }; // Car dimensions
    car.addComponent(mesh);

    // Random car color
    const mat = new MaterialComponent();
    mat.primaryColor = [Math.random(), Math.random(), Math.random(), 1];
    mat.roughness = 0.2; // Shiny car paint
    mat.metallic = 0.6;
    car.addComponent(mat);

    // Physics
    const phys = new PhysicsComponent();
    phys.rigidbodyType = RigidbodyType.Dynamic;
    phys.mass = 1500; // Car mass
    phys.addBoxCollider([1, 0.75, 2]);
    // Keep car upright-ish but allow some tilt (or freeze rotation for simple arcade)
    // Let's freeze X/Z rotation for stability in this simple demo
    phys.freezeRotationX = true;
    phys.freezeRotationZ = true;
    car.addComponent(phys);

    // Destructible
    const health = new HealthComponent();
    health.maxHealth = 200;
    health.currentHealth = 200;
    car.addComponent(health);

    // NPC Component for pathfinding (used by SimpleCarNpcSystem)
    const npc = new NpcComponent();
    npc.behavior = 'patrol'; // We reuse patrol mode
    
    // Generate a random route of waypoints from intersections
    const routeLength = 10;
    const waypoints: Vec3[] = [];
    for (let w = 0; w < routeLength; w++) {
        const wpIdx = Math.floor(Math.random() * roadIntersections.length);
        if (roadIntersections[wpIdx]) {
            waypoints.push(roadIntersections[wpIdx]);
        }
    }
    npc.patrolWaypoints = waypoints;
    car.addComponent(npc);

    scene.addEntity(car);
  }

  return scene;
}
