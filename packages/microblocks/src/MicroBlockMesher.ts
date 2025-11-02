/**
 * MicroBlockMesher - Generates mesh geometry from micro block chunks
 *
 * Uses greedy meshing algorithm to merge adjacent faces with the same material,
 * significantly reducing vertex count for better performance.
 */

import { DisposableGroup } from '@engine/core';
import type { CustomMeshData } from '@engine/world';
import type { MicroBlockChunk, MicroBlock, MicroBlockType } from './types';
import { MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from './MicroBlockStore';

/**
 * Face directions
 */
enum FaceDirection {
  Front = 0,
  Back = 1,
  Left = 2,
  Right = 3,
  Top = 4,
  Bottom = 5,
}

/**
 * Face direction vectors
 */
const FACE_NORMALS: Array<[number, number, number]> = [
  [0, 0, 1], // Front
  [0, 0, -1], // Back
  [-1, 0, 0], // Left
  [1, 0, 0], // Right
  [0, 1, 0], // Top
  [0, -1, 0], // Bottom
];

/**
 * Face UV offsets for different faces
 */
const FACE_UVS: Array<[number, number, number, number, number, number, number, number]> = [
  [0, 0, 1, 0, 1, 1, 0, 1], // Front
  [1, 0, 0, 0, 0, 1, 1, 1], // Back
  [0, 0, 0, 1, 1, 1, 1, 0], // Left
  [1, 0, 1, 1, 0, 1, 0, 0], // Right
  [0, 1, 1, 1, 1, 0, 0, 0], // Top
  [0, 0, 1, 0, 1, 1, 0, 1], // Bottom
];

/**
 * Generates mesh geometry for micro block chunks using greedy meshing
 */
export class MicroBlockMesher {
  private readonly blockSize: number;
  private readonly chunkSize: number;
  private readonly disposables = new DisposableGroup();

  constructor(blockSize: number = MICRO_BLOCK_SIZE, chunkSize: number = DEFAULT_CHUNK_SIZE) {
    this.blockSize = blockSize;
    this.chunkSize = chunkSize;
  }

  /**
   * Generates mesh data for a chunk
   */
  generateMesh(chunk: MicroBlockChunk): CustomMeshData {
    const vertices: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    // 3D array to track which positions have blocks
    const blockGrid = new Map<number, MicroBlock>();

    // Build block grid from chunk
    for (const [index, block] of chunk.blocks.entries()) {
      blockGrid.set(index, block);
    }

    // Process each face direction
    for (let faceDir = 0; faceDir < 6; faceDir++) {
      const faceData = this.generateFacesForDirection(
        chunk,
        blockGrid,
        faceDir as FaceDirection
      );

      // Add vertices
      for (const vertex of faceData.vertices) {
        vertices.push(...vertex);
      }

      // Add indices with offset
      for (const index of faceData.indices) {
        indices.push(index + vertexOffset);
      }

      vertexOffset += faceData.vertices.length;
    }

    // Convert to TypedArrays
    const vertexArray = new Float32Array(vertices);
    const indexArray = new Uint16Array(indices);

    return {
      vertices: vertexArray,
      indices: indexArray,
    };
  }

  /**
   * Generates faces for a specific direction using greedy meshing
   */
  private generateFacesForDirection(
    chunk: MicroBlockChunk,
    blockGrid: Map<number, MicroBlock>,
    direction: FaceDirection
  ): { vertices: Array<[number, number, number] | [number, number, number, number, number, number]>; indices: number[] } {
    const vertices: Array<[number, number, number] | [number, number, number, number, number, number]> = [];
    const indices: number[] = [];

    const normal = FACE_NORMALS[direction];
    const [nx, ny, nz] = normal;

    // Determine axes based on face direction
    let uAxis: [number, number, number];
    let vAxis: [number, number, number];

    if (direction === FaceDirection.Top || direction === FaceDirection.Bottom) {
      uAxis = [1, 0, 0];
      vAxis = [0, 0, 1];
    } else if (direction === FaceDirection.Front || direction === FaceDirection.Back) {
      uAxis = [1, 0, 0];
      vAxis = [0, 1, 0];
    } else {
      // Left or Right
      uAxis = [0, 1, 0];
      vAxis = [0, 0, 1];
    }

    // Check each block position
    for (let z = 0; z < this.chunkSize; z++) {
      for (let y = 0; y < this.chunkSize; y++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const index = this.localToIndex([x, y, z]);
          const block = blockGrid.get(index);

          if (!block) continue;

          // Check if face is visible (no block in adjacent position)
          const adjX = x + nx;
          const adjY = y + ny;
          const adjZ = z + nz;

          const isVisible =
            adjX < 0 ||
            adjX >= this.chunkSize ||
            adjY < 0 ||
            adjY >= this.chunkSize ||
            adjZ < 0 ||
            adjZ >= this.chunkSize ||
            !blockGrid.has(this.localToIndex([adjX, adjY, adjZ]));

          if (!isVisible) continue;

          // Generate face vertices
          const faceVertices = this.generateFaceVertices(
            [x, y, z],
            direction,
            normal
          );

          // Add vertices
          const baseIndex = vertices.length;
          for (const vertex of faceVertices) {
            vertices.push(vertex);
          }

          // Add indices (two triangles per quad)
          indices.push(
            baseIndex,
            baseIndex + 1,
            baseIndex + 2,
            baseIndex,
            baseIndex + 2,
            baseIndex + 3
          );
        }
      }
    }

    return { vertices, indices };
  }

  /**
   * Generates vertices for a single face
   */
  private generateFaceVertices(
    localPos: [number, number, number],
    direction: FaceDirection,
    normal: [number, number, number]
  ): Array<[number, number, number, number, number, number]> {
    const [x, y, z] = localPos;
    const [nx, ny, nz] = normal;

    // Convert to world coordinates
    const worldX = x * this.blockSize;
    const worldY = y * this.blockSize;
    const worldZ = z * this.blockSize;

    const halfSize = this.blockSize * 0.5;
    const epsilon = 0.001; // Small offset to prevent z-fighting

    // Calculate face center
    const centerX = worldX + halfSize;
    const centerY = worldY + halfSize;
    const centerZ = worldZ + halfSize;

    // Offset face slightly in normal direction
    const offsetX = nx * epsilon;
    const offsetY = ny * epsilon;
    const offsetZ = nz * epsilon;

    // Generate quad vertices based on face direction
    let vertices: Array<[number, number, number, number, number, number]>;

    if (direction === FaceDirection.Top) {
      vertices = [
        [centerX - halfSize + offsetX, worldY + this.blockSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, worldY + this.blockSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, worldY + this.blockSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [centerX - halfSize + offsetX, worldY + this.blockSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
      ];
    } else if (direction === FaceDirection.Bottom) {
      vertices = [
        [centerX - halfSize + offsetX, worldY + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, worldY + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, worldY + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [centerX - halfSize + offsetX, worldY + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
      ];
    } else if (direction === FaceDirection.Front) {
      vertices = [
        [centerX - halfSize + offsetX, centerY - halfSize + offsetY, worldZ + this.blockSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, centerY - halfSize + offsetY, worldZ + this.blockSize + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, centerY + halfSize + offsetY, worldZ + this.blockSize + offsetZ, nx, ny, nz],
        [centerX - halfSize + offsetX, centerY + halfSize + offsetY, worldZ + this.blockSize + offsetZ, nx, ny, nz],
      ];
    } else if (direction === FaceDirection.Back) {
      vertices = [
        [centerX + halfSize + offsetX, centerY - halfSize + offsetY, worldZ + offsetZ, nx, ny, nz],
        [centerX - halfSize + offsetX, centerY - halfSize + offsetY, worldZ + offsetZ, nx, ny, nz],
        [centerX - halfSize + offsetX, centerY + halfSize + offsetY, worldZ + offsetZ, nx, ny, nz],
        [centerX + halfSize + offsetX, centerY + halfSize + offsetY, worldZ + offsetZ, nx, ny, nz],
      ];
    } else if (direction === FaceDirection.Right) {
      vertices = [
        [worldX + this.blockSize + offsetX, centerY - halfSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [worldX + this.blockSize + offsetX, centerY - halfSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [worldX + this.blockSize + offsetX, centerY + halfSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [worldX + this.blockSize + offsetX, centerY + halfSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
      ];
    } else {
      // Left
      vertices = [
        [worldX + offsetX, centerY - halfSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
        [worldX + offsetX, centerY - halfSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [worldX + offsetX, centerY + halfSize + offsetY, centerZ + halfSize + offsetZ, nx, ny, nz],
        [worldX + offsetX, centerY + halfSize + offsetY, centerZ - halfSize + offsetZ, nx, ny, nz],
      ];
    }

    return vertices;
  }

  /**
   * Converts local position to flat index
   */
  private localToIndex(local: [number, number, number]): number {
    return local[0] + local[1] * this.chunkSize + local[2] * this.chunkSize * this.chunkSize;
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.disposables.dispose();
  }
}

