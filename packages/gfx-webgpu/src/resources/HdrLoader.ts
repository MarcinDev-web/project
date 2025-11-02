/**
 * HDR (Radiance RGBE) file format loader
 * Converts HDR files to RGBA Float32Array data
 */

/**
 * Parses a Radiance RGBE (.hdr) file format
 * @param arrayBuffer Raw file data
 * @returns Image data with width, height, and Float32Array RGBA pixels
 */
export function parseHdrFile(arrayBuffer: ArrayBuffer): {
  width: number;
  height: number;
  data: Float32Array;
} {
  const view = new DataView(arrayBuffer);
  let offset = 0;

  // Read header - check for "#?RADIANCE" or "#?RGBE"
  const header = new TextDecoder().decode(
    new Uint8Array(arrayBuffer, 0, Math.min(256, arrayBuffer.byteLength))
  );

  if (!header.includes('#?RADIANCE') && !header.includes('#?RGBE')) {
    throw new Error('Invalid HDR file format');
  }

  // Skip header until resolution line (format: -Y height +X width)
  const resolutionMatch = header.match(/(-Y\s+(\d+)\s+\+X\s+(\d+))/);
  if (!resolutionMatch) {
    throw new Error('Could not find resolution in HDR file');
  }

  const height = parseInt(resolutionMatch[2]!, 10);
  const width = parseInt(resolutionMatch[3]!, 10);
  const pixelCount = width * height;

  // Find end of header (empty line after resolution)
  const resolutionLineEnd = header.indexOf('\n', header.indexOf(resolutionMatch[0]!));
  if (resolutionLineEnd === -1) {
    throw new Error('Could not find end of resolution line');
  }
  offset = resolutionLineEnd + 1; // Skip resolution line and newline

  // Read RGBE data
  const rgbeData = new Uint8Array(arrayBuffer, offset, pixelCount * 4);
  if (rgbeData.length < pixelCount * 4) {
    throw new Error('HDR file too small for declared resolution');
  }
  const floatData = new Float32Array(pixelCount * 4);

  // Convert RGBE to RGB float
  for (let i = 0; i < pixelCount; i++) {
    const r = rgbeData[i * 4]!;
    const g = rgbeData[i * 4 + 1]!;
    const b = rgbeData[i * 4 + 2]!;
    const e = rgbeData[i * 4 + 3]!;

    if (e === 0) {
      floatData[i * 4] = 0;
      floatData[i * 4 + 1] = 0;
      floatData[i * 4 + 2] = 0;
    } else {
      const exponent = Math.pow(2, e - 128);
      floatData[i * 4] = (r + 0.5) / 256 * exponent;
      floatData[i * 4 + 1] = (g + 0.5) / 256 * exponent;
      floatData[i * 4 + 2] = (b + 0.5) / 256 * exponent;
    }
    floatData[i * 4 + 3] = 1.0; // Alpha
  }

  return { width, height, data: floatData };
}

/**
 * Loads an HDR file from URL or File and parses it
 */
export async function loadHdrFile(source: string | File): Promise<{
  width: number;
  height: number;
  data: Float32Array;
}> {
  let arrayBuffer: ArrayBuffer;

  if (source instanceof File) {
    arrayBuffer = await source.arrayBuffer();
  } else {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load HDR file: ${response.statusText}`);
    }
    arrayBuffer = await response.arrayBuffer();
  }

  return parseHdrFile(arrayBuffer);
}

