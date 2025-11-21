import { describe, it, expect } from 'vitest';

import { parseGlb } from '../formats/gltf/parseGLB';



describe('GLB Parser', () => {

  it('should parse a minimal GLB with JSON chunk only', () => {

    // Minimal GLB header + JSON chunk

    const json = { asset: { version: '2.0' } };

    const jsonText = JSON.stringify(json);

    const jsonBytes = new TextEncoder().encode(jsonText);

    

    // Pad to 4 bytes

    const padding = (4 - (jsonBytes.length % 4)) % 4;

    const paddedJsonBytes = new Uint8Array(jsonBytes.length + padding);

    paddedJsonBytes.set(jsonBytes);

    for(let i=0; i<padding; i++) paddedJsonBytes[jsonBytes.length + i] = 0x20; // Space padding



    const jsonChunkLength = paddedJsonBytes.length;

    const totalLength = 12 + 8 + jsonChunkLength;



    const buffer = new ArrayBuffer(totalLength);

    const view = new DataView(buffer);



    // Header

    view.setUint32(0, 0x46546c67, true); // magic 'glTF'

    view.setUint32(4, 2, true); // version 2

    view.setUint32(8, totalLength, true); // length



    // JSON Chunk

    view.setUint32(12, jsonChunkLength, true); // chunkLength

    view.setUint32(16, 0x4E4F534A, true); // chunkType 'JSON'

    

    const bufferBytes = new Uint8Array(buffer);

    bufferBytes.set(paddedJsonBytes, 20);



    const result = parseGlb(buffer);

    expect(result.gltf).toEqual(json);

    expect(result.binChunk).toBeNull();

  });



  it('should parse a GLB with JSON and BIN chunks', () => {

    const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] };

    const jsonText = JSON.stringify(json);

    const jsonBytes = new TextEncoder().encode(jsonText);

    

    const padding = (4 - (jsonBytes.length % 4)) % 4;

    const paddedJsonBytes = new Uint8Array(jsonBytes.length + padding);

    paddedJsonBytes.set(jsonBytes);

    for(let i=0; i<padding; i++) paddedJsonBytes[jsonBytes.length + i] = 0x20;



    const binData = new Uint8Array([1, 2, 3, 4]); // 4 bytes, aligned

    

    const jsonChunkLength = paddedJsonBytes.length;

    const binChunkLength = binData.length;

    const totalLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;



    const buffer = new ArrayBuffer(totalLength);

    const view = new DataView(buffer);



    // Header

    view.setUint32(0, 0x46546c67, true);

    view.setUint32(4, 2, true);

    view.setUint32(8, totalLength, true);



    // JSON Chunk

    view.setUint32(12, jsonChunkLength, true);

    view.setUint32(16, 0x4E4F534A, true);

    const bufferBytes = new Uint8Array(buffer);

    bufferBytes.set(paddedJsonBytes, 20);



    // BIN Chunk

    const binOffset = 20 + jsonChunkLength;

    view.setUint32(binOffset, binChunkLength, true);

    view.setUint32(binOffset + 4, 0x004E4942, true); // 'BIN\0'

    bufferBytes.set(binData, binOffset + 8);



    const result = parseGlb(buffer);

    expect(result.gltf).toEqual(json);

    expect(result.binChunk).toBeDefined();
    expect(new Uint8Array(result.binChunk!)).toEqual(binData);

  });

  it('should throw on invalid magic', () => {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setUint32(0, 0xDEADBEEF, true);
    expect(() => parseGlb(buffer)).toThrow('Invalid GLB');
  });
});
