import { bench } from 'tinybench';
import { World, Scene, Entity } from '../src/index';
import { Transform } from '../src/core/Transform';
import { MeshComponent } from '../src/components/MeshComponent';

const suite = new bench({ time: 1000 });

suite
  .add('createEntity', () => {
    const world = new World();
    const scene = new Scene('Benchmark');
    world.addScene(scene);
    const entity = scene.createEntity('Test');
    world.update(1 / 60);
  })
  .add('addComponent', () => {
    const world = new World();
    const scene = new Scene('Benchmark');
    world.addScene(scene);
    const entity = scene.createEntity('Test');
    entity.addComponent(MeshComponent);
    world.update(1 / 60);
  })
  .add('queryEntities', () => {
    const world = new World();
    const scene = new Scene('Benchmark');
    world.addScene(scene);
    // Create 100 entities
    for (let i = 0; i < 100; i++) {
      const entity = scene.createEntity(`Entity${i}`);
      if (i % 2 === 0) {
        entity.addComponent(MeshComponent);
      }
    }
    // Query entities with MeshComponent
    const entities = scene.queryEntities((e) => e.hasComponent(MeshComponent));
    return entities.length;
  })
  .add('updateWorld', () => {
    const world = new World();
    const scene = new Scene('Benchmark');
    world.addScene(scene);
    // Create 50 entities
    for (let i = 0; i < 50; i++) {
      const entity = scene.createEntity(`Entity${i}`);
      entity.addComponent(Transform);
    }
    world.update(1 / 60);
  });

suite.addEventListener('complete', () => {
  const results = suite.tasks.map((task) => ({
    name: task.name,
    mean: task.result?.mean,
    stdDev: task.result?.stdDev,
    samples: task.result?.samples,
  }));
  console.log('\nECS Benchmarks:');
  console.table(results);
});

await suite.run();
