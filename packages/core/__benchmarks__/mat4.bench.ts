import { bench } from 'tinybench';
import {
  mat4Multiply,
  mat4LookAt,
  mat4Perspective,
  mat4FromQuatTranslation,
  type Mat4,
  type Vec3,
  type Quat,
} from '../src/math/index';

const suite = new bench({ time: 1000 });

const out = new Float32Array(16) as Mat4;
const a = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]) as Mat4;
const b = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1]) as Mat4;
const eye: Vec3 = [0, 0, 5];
const target: Vec3 = [0, 0, 0];
const up: Vec3 = [0, 1, 0];
const quat: Quat = [0, 0, 0, 1];
const translation: Vec3 = [1, 2, 3];

suite
  .add('mat4Multiply', () => {
    mat4Multiply(out, a, b);
  })
  .add('mat4LookAt', () => {
    mat4LookAt(out, eye, target, up);
  })
  .add('mat4Perspective', () => {
    mat4Perspective(out, Math.PI / 4, 16 / 9, 0.1, 1000);
  })
  .add('mat4FromQuatTranslation', () => {
    mat4FromQuatTranslation(out, quat, translation);
  });

suite.addEventListener('complete', () => {
  const results = suite.tasks.map((task) => ({
    name: task.name,
    mean: task.result?.mean,
    stdDev: task.result?.stdDev,
    samples: task.result?.samples,
  }));
  console.log('\nMat4 Benchmarks:');
  console.table(results);
});

await suite.run();
