import { PhysicsManager } from '../physics/PhysicsManager.js';

console.log('Initializing PhysicsManager...');
const physics = new PhysicsManager();

console.log('Adding player...');
physics.addPlayer('user1', 0, 10, 0);

console.log('Stepping simulation...');
for (let i = 0; i < 60; i++) {
  physics.step(1.0 / 60.0);
  const pos = physics.getPlayerPosition('user1');
  if (i % 10 === 0) {
    console.log(`Step ${i}: Player y = ${pos?.y.toFixed(2)}`);
  }
}

console.log('Done.');

