
import { Scene, Entity, PhysicsComponent } from '@engine/world';
import { NpcComponent } from '../components/NpcComponent.js';

export class SimpleCarNpcSystem {
  private scene: Scene;
  private currentTime = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  update(deltaTime: number) {
    this.currentTime += deltaTime;
    
    // Simple logic to keep cars moving forward
    const cars = this.scene.queryEntities(NpcComponent);
    for (const car of cars) {
        const npc = car.getComponent(NpcComponent);
        // Only affect "simple-car" behavior
        if (npc && npc.behavior === 'patrol') { 
            // For now, we reuse 'patrol' or add a custom 'car-drive' if we extended the enum.
            // But wait, NpcBehaviorSystem handles 'patrol'. 
            // We should probably just configure them with 'patrol' and waypoints in CityDemo.ts 
            // instead of making a new system, OR make a dedicated system for cars if we want physics-based driving.
            
            // Let's use a simple physics-based drive forward logic for "car" entities
            // We can tag them via userData or a specific component configuration.
            if (car.userData.isCar) {
                this.updateCar(car);
            }
        }
    }
  }

  private updateCar(car: Entity) {
    const physics = car.getComponent(PhysicsComponent);
    if (!physics) return;

    // Simple AI: Raycast forward to avoid obstacles? 
    // For MVP: Just apply forward force and respawn if falls off world
    
    // Move forward relative to car
    // We need to get forward vector
    // ...
    // Actually, if we use NpcBehaviorSystem with 'patrol', it handles movement via CharacterController.
    // Cars might need CharacterController too to work with that system, or we just use physics forces here.
    
    // Let's stick to NpcBehaviorSystem for now if possible, or write custom logic here.
    // Given "simple vehicles (cubes) driving on roads", waypoints are best.
    // So we will generate waypoints in CityDemo.ts and let NpcBehaviorSystem drive them.
    // BUT NpcBehaviorSystem uses CharacterController. A car is a RigidBody.
    // Does CharacterController work for cars? It forces upright capsule usually.
    // For a "cube car", we might want a specific CarController or just use forces.
    
    // Let's IMPLEMENT a specialized simple car behavior here that doesn't rely on CharacterController
    // but uses PhysicsComponent directly.
    
    const npc = car.getComponent(NpcComponent);
    if (!npc || npc.patrolWaypoints.length === 0) return;
    
    // Get current waypoint
    // We need state. reusing userData for state
    let state = car.userData.carState as { currentWaypointIndex: number } | undefined;
    if (!state) {
        state = { currentWaypointIndex: 0 };
        car.userData.carState = state;
    }
    
    const target = npc.patrolWaypoints[state.currentWaypointIndex];
    if (!target) return;

    const pos = car.transform.position;
    
    // Direction to target
    const dx = target[0] - pos[0];
    const dz = target[2] - pos[2];
    const distSq = dx*dx + dz*dz;
    
    if (distSq < 4.0) { // Reached waypoint (2m radius)
        state.currentWaypointIndex = (state.currentWaypointIndex + 1) % npc.patrolWaypoints.length;
        return;
    }
    
    // Normalized direction
    const len = Math.sqrt(distSq);
    const dirX = dx / len;
    const dirZ = dz / len;
    
    // Rotate car towards target (simple lerp)
    const targetAngle = Math.atan2(dirX, dirZ);
    // Note: transform.rotation is Quaternion. 
    // Simplify: set angular velocity to turn towards target?
    // Or just snap rotation for simple cubes?
    
    // Physics-based movement
    const speed = 15.0;
    
    // We want to move in direction (dirX, 0, dirZ)
    // Apply force? Or set velocity directly for stability?
    // Set velocity directly is easier for "simple" cars
    physics.velocity = [dirX * speed, physics.velocity[1], dirZ * speed];
    
    // Set rotation to face movement
    // Euler Y rotation
    // We need to convert to Quat or Matrix. 
    // Let's just leave rotation for now or do a simple lookAt logic if we had utils.
    
    // Basic visual rotation (Y-axis)
    // q = [0, sin(angle/2), 0, cos(angle/2)]
    const halfAngle = targetAngle / 2;
    car.transform.rotation = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];
  }
}


