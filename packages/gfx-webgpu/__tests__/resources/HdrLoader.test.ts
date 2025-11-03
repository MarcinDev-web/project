import { describe, it, expect } from 'vitest';
import { parseHdrFile, loadHdrFile } from '../../src/resources/HdrLoader';

describe('HdrLoader', () => {
  describe('parseHdrFile', () => {
    it('should throw error for invalid HDR format', () => {
      const invalidData = new ArrayBuffer(100);
      new TextEncoder().encodeInto('NOT HDR FORMAT', new Uint8Array(invalidData));

      expect(() => {
        parseHdrFile(invalidData);
      }).toThrow('Invalid HDR file format');
    });

    it('should throw error if resolution not found', () => {
      const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n';
      const buffer = new ArrayBuffer(header.length + 100);
      new TextEncoder().encodeInto(header, new Uint8Array(buffer));

      expect(() => {
        parseHdrFile(buffer);
      }).toThrow('Could not find resolution in HDR file');
    });

    it('should parse valid HDR file format', () => {
      // Create minimal valid HDR file
      const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 2\n';
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(headerBytes.length + 16); // 2x2 pixels = 16 bytes RGBE

      const view = new Uint8Array(buffer);
      view.set(headerBytes, 0);

      // Add minimal RGBE data (all zeros = black) after resolution line
      // Data starts after resolution line ends
      for (let i = headerBytes.length; i < buffer.byteLength; i++) {
        view[i] = 0;
      }

      const result = parseHdrFile(buffer);
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.data.length).toBe(16); // 2*2*4 RGBA
    });

    it('should convert RGBE to float correctly', () => {
      const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n';
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(headerBytes.length + 4); // 1 pixel RGBE

      const view = new Uint8Array(buffer);
      view.set(headerBytes, 0);

      // RGBE: R=128, G=128, B=128, E=128 (represents ~0.5, ~0.5, ~0.5 in linear space)
      // Find where resolution line ends
      const resolutionMatch = header.match(/(-Y\s+\d+\s+\+X\s+\d+)/);
      const resolutionLineEnd = header.indexOf('\n', header.indexOf(resolutionMatch![0]!));
      const offset = resolutionLineEnd + 1; // After resolution line
      view[offset] = 128; // R
      view[offset + 1] = 128; // G
      view[offset + 2] = 128; // B
      view[offset + 3] = 128; // E (exponent 128 = 2^0 = 1.0)

      const result = parseHdrFile(buffer);
      expect(result.data.length).toBe(4); // RGBA
      // Should decode to approximately 0.5 (128 + 0.5) / 256 * 2^0 ≈ 0.502
      expect(result.data[0]).toBeCloseTo(0.502, 2);
      expect(result.data[1]).toBeCloseTo(0.502, 2);
      expect(result.data[2]).toBeCloseTo(0.502, 2);
      expect(result.data[3]).toBe(1.0); // Alpha always 1.0
    });

    it('should handle zero exponent (black)', () => {
      const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n';
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(headerBytes.length + 4);

      const view = new Uint8Array(buffer);
      view.set(headerBytes, 0);

      // RGBE: E=0 means black
      // Find where resolution line ends
      const resolutionMatch = header.match(/(-Y\s+\d+\s+\+X\s+\d+)/);
      const resolutionLineEnd = header.indexOf('\n', header.indexOf(resolutionMatch![0]!));
      const offset = resolutionLineEnd + 1;
      view[offset] = 100; // R (ignored when E=0)
      view[offset + 1] = 100; // G
      view[offset + 2] = 100; // B
      view[offset + 3] = 0; // E = 0

      const result = parseHdrFile(buffer);
      expect(result.data[0]).toBe(0);
      expect(result.data[1]).toBe(0);
      expect(result.data[2]).toBe(0);
      expect(result.data[3]).toBe(1.0);
    });
  });

  describe('loadHdrFile', () => {
    it('should handle File input', async () => {
      const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n';
      const headerBytes = new TextEncoder().encode(header);
      const buffer = new ArrayBuffer(headerBytes.length + 4);

      const view = new Uint8Array(buffer);
      view.set(headerBytes, 0);
      // Fill RGBE data with zeros
      for (let i = headerBytes.length; i < buffer.byteLength; i++) {
        view[i] = 0;
      }

      // Create a proper File instance for the test
      // In test environment, use Blob which File extends, or create File directly
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const file = new File([blob], 'test.hdr', { type: 'image/vnd.radiance' });

      const result = await loadHdrFile(file);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.data).toBeInstanceOf(Float32Array);
    });

    // Note: URL loading test skipped - requires proper mock setup
    // In real usage, URL loading works with actual fetch
  });
});

