import { suite, add, cycle, complete, save } from 'benny';
import { VoxelChunkMesher } from '../../packages/voxel/src/mesh/VoxelChunkMesher';
import { init } from '../../packages/wasm-voxel/src/index';
import { MicroBlockMesher } from '../../packages/world/src/utils/MicroBlockMesher';
import { MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from '../../packages/microblocks/src/MicroBlockStore';

async function runBenchmark() {
  // Initialize WASM
  await init();
  await VoxelChunkMesher.init();

  const chunkSize = DEFAULT_CHUNK_SIZE;
  const totalVoxels = chunkSize * chunkSize * chunkSize;
  
  // Create a random chunk
  const randomVoxels = new Uint16Array(totalVoxels);
  const sparseMap = new Map();
  
  for (let i = 0; i < totalVoxels; i++) {
    if (Math.random() > 0.5) {
      randomVoxels[i] = 1;
      sparseMap.set(i, { type: 'cube', materialId: 'stone' });
    }
  }

  const microBlockMesher = new MicroBlockMesher(MICRO_BLOCK_SIZE, chunkSize);
  // Wait for mesher init
  await new Promise(resolve => setTimeout(resolve, 100));

  await suite(
    'Voxel Meshing',

    add('WASM: VoxelChunkMesher', () => {
      VoxelChunkMesher.meshChunk(randomVoxels, chunkSize);
    }),

    add('WASM: MicroBlockMesher (Wrapper)', () => {
       microBlockMesher.generateMesh({
         coord: [0, 0, 0],
         blocks: sparseMap,
         dirty: true
       });
    }),

    cycle(),
    complete(),
    save({ file: 'voxel-meshing', version: '1.0.0' }),
  );
}

runBenchmark().catch(console.error);

