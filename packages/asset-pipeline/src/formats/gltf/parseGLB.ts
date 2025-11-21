import type { GLTF } from './types.js';

export type ParsedGlb = {
  gltf: GLTF;
  binChunk: ArrayBuffer | null;
};

export function parseGlb(buffer: ArrayBuffer): ParsedGlb {
  const view = new DataView(buffer);
  // Header: magic (0), version (4), length (8)
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  if (magic !== 0x46546c67 || version !== 2) {
    throw new Error('Invalid GLB: expected magic glTF and version 2');
  }
  const totalLength = view.getUint32(8, true);
  let offset = 12;
  let json: GLTF | null = null;
  let bin: ArrayBuffer | null = null;

  while (offset + 8 <= totalLength) {
    const chunkLength = view.getUint32(offset, true);
    offset += 4;
    const chunkType = view.getUint32(offset, true);
    offset += 4;
    const chunkDataStart = offset;
    const chunkDataEnd = offset + chunkLength;
    const chunkData = buffer.slice(chunkDataStart, chunkDataEnd);
    // JSON = 0x4E4F534A, BIN = 0x004E4942
    if (chunkType === 0x4e4f534a) {
      const text = new TextDecoder().decode(new Uint8Array(chunkData));
      json = JSON.parse(text) as GLTF;
    } else if (chunkType === 0x004e4942) {
      bin = chunkData;
    }
    offset = chunkDataEnd;
    // Chunks are 4-byte aligned
    if (offset % 4 !== 0) offset += 4 - (offset % 4);
  }

  if (!json) throw new Error('Invalid GLB: missing JSON chunk');
  return { gltf: json, binChunk: bin };
}
