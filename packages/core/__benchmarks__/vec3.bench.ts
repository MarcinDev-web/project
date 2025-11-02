import { bench } from 'tinybench';
import {
  addVec3,
  dotVec3,
  crossVec3,
  normalizeVec3,
  scaleVec3,
  type Vec3,
} from '../src/math/index';

const suite = new bench({ time: 1000 });

const a: Vec3 = [1, 2, 3];
const b: Vec3 = [4, 5, 6];
const scalar = 2.5;

suite
  .add('addVec3', () => {
    addVec3(a, b);
  })
  .add('dotVec3', () => {
    dotVec3(a, b);
  })
  .add('crossVec3', () => {
    crossVec3(a, b);
  })
  .add('normalizeVec3', () => {
    normalizeVec3(a);
  })
  .add('scaleVec3', () => {
    scaleVec3(a, scalar);
  });

suite.addEventListener('complete', () => {
  const results = suite.tasks.map((task) => ({
    name: task.name,
    mean: task.result?.mean,
    stdDev: task.result?.stdDev,
    samples: task.result?.samples,
  }));
  console.log('\nVec3 Benchmarks:');
  console.table(results);
});

await suite.run();
