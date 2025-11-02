import type { MaterialTextureData } from '../textures/TextureAtlas';

type RGBA = [number, number, number, number];
type HeightPalette = Record<string, number>;

interface Palette {
  [symbol: string]: RGBA;
}

interface PatternDefinition {
  /** Base pattern rows (square). */
  base: string[];
  /** Palette mapping of symbols to RGBA colors. */
  palette: Palette;
  /** Repeat count to tile the base pattern (defaults to 1). */
  repeat?: number;
  /** Optional per-symbol height values (0-1) for normal-map generation. */
  heightPalette?: HeightPalette;
  /** Optional normal intensity multiplier (defaults to 1). */
  normalScale?: number;
}

interface AtlasMaterialPreset {
  name: string;
  side: PatternDefinition;
  top?: PatternDefinition;
  saturation: number;
  metallic: number;
  roughness: number;
}

export interface BuiltAtlasMaterial {
  material: MaterialTextureData;
  params: {
    saturation: number;
    metallic: number;
    roughness: number;
  };
}

function tilePattern(def: PatternDefinition): {
  rows: string[];
  size: number;
  palette: Palette;
  heightPalette?: HeightPalette;
  normalScale: number;
} {
  const baseSize = def.base.length;
  if (baseSize === 0) {
    throw new Error('Pattern definition requires at least one row.');
  }
  const repeat = def.repeat ?? 1;
  for (const row of def.base) {
    if (row.length !== baseSize) {
      throw new Error(`Pattern rows must be square. Expected ${baseSize}, got ${row.length}.`);
    }
  }

  const rows: string[] = [];
  for (let yRepeat = 0; yRepeat < repeat; yRepeat++) {
    for (const baseRow of def.base) {
      let row = '';
      for (let xRepeat = 0; xRepeat < repeat; xRepeat++) {
        row += baseRow;
      }
      rows.push(row);
    }
  }

  return {
    rows,
    size: baseSize * repeat,
    palette: def.palette,
    heightPalette: def.heightPalette,
    normalScale: def.normalScale ?? 1,
  };
}

function patternToTexture(rows: string[], palette: Palette, targetSize: number): Uint8Array {
  const patternSize = rows.length;
  if (patternSize === 0) {
    throw new Error('Cannot convert empty pattern to texture.');
  }
  for (const row of rows) {
    if (row.length !== patternSize) {
      throw new Error('Expanded pattern must remain square.');
    }
  }
  if (targetSize % patternSize !== 0) {
    throw new Error(`Target texture size ${targetSize} must be a multiple of pattern size ${patternSize}.`);
  }
  const scale = targetSize / patternSize;
  const data = new Uint8Array(targetSize * targetSize * 4);

  for (let y = 0; y < targetSize; y++) {
    const srcRowIndex = Math.floor(y / scale);
    const srcRow = rows[srcRowIndex];
    if (!srcRow) {
      throw new Error(`Row index ${srcRowIndex} is out of bounds for pattern size ${patternSize}.`);
    }
    for (let x = 0; x < targetSize; x++) {
      const symbolIndex = Math.floor(x / scale);
      const symbol = srcRow[symbolIndex];
      if (symbol === undefined) {
        throw new Error(`Column index ${symbolIndex} is out of bounds for pattern size ${patternSize}.`);
      }
      const color = palette[symbol];
      if (!color) {
        throw new Error(`Missing palette entry for symbol "${symbol}".`);
      }
      const idx = (y * targetSize + x) * 4;
      data[idx + 0] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = color[3];
    }
  }

  return data;
}

function patternToHeightMap(rows: string[], heightPalette: HeightPalette, targetSize: number): Float32Array {
  const patternSize = rows.length;
  if (patternSize === 0) {
    throw new Error('Cannot convert empty pattern to height map.');
  }
  for (const row of rows) {
    if (row.length !== patternSize) {
      throw new Error('Expanded height pattern must remain square.');
    }
  }
  if (targetSize % patternSize !== 0) {
    throw new Error(`Target height map size ${targetSize} must be a multiple of pattern size ${patternSize}.`);
  }
  const scale = targetSize / patternSize;
  const data = new Float32Array(targetSize * targetSize);

  for (let y = 0; y < targetSize; y++) {
    const srcRowIndex = Math.floor(y / scale);
    const srcRow = rows[srcRowIndex];
    if (!srcRow) {
      throw new Error(`Row index ${srcRowIndex} is out of bounds for height pattern size ${patternSize}.`);
    }
    for (let x = 0; x < targetSize; x++) {
      const symbolIndex = Math.floor(x / scale);
      const symbol = srcRow[symbolIndex];
      if (symbol === undefined) {
        throw new Error(`Column index ${symbolIndex} is out of bounds for height pattern size ${patternSize}.`);
      }
      const height = heightPalette[symbol] ?? 0;
      data[y * targetSize + x] = height;
    }
  }

  return data;
}

function heightMapToNormalTexture(heightMap: Float32Array, size: number, strength: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);

  const sample = (x: number, y: number): number => {
    const clampedX = Math.min(size - 1, Math.max(0, x));
    const clampedY = Math.min(size - 1, Math.max(0, y));
    return heightMap[clampedY * size + clampedX] ?? 0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;

      let nx = -dx;
      let ny = 1;
      let nz = -dy;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;

      const idx = (y * size + x) * 4;
      data[idx + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  return data;
}

function buildNormalTexture(
  pattern: ReturnType<typeof tilePattern>,
  targetSize: number
): Uint8Array | undefined {
  if (!pattern.heightPalette) {
    return undefined;
  }
  const heightMap = patternToHeightMap(pattern.rows, pattern.heightPalette, targetSize);
  return heightMapToNormalTexture(heightMap, targetSize, pattern.normalScale);
}

const DEBUG_SIDE: PatternDefinition = {
  base: [
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
  ],
  palette: {
    a: [180, 160, 140, 255],
  },
  repeat: 2,
};

const DEBUG_TOP: PatternDefinition = {
  base: [...DEBUG_SIDE.base],
  palette: { ...DEBUG_SIDE.palette },
  repeat: DEBUG_SIDE.repeat,
};

const STONE_SIDE: PatternDefinition = {
  base: [
    'abacbdad',
    'bacdbaca',
    'cadbadac',
    'dbadcaba',
    'acbdadcb',
    'bdacabad',
    'cabdacba',
    'dacbadac',
  ],
  palette: {
    a: [138, 138, 138, 255],
    b: [120, 120, 120, 255],
    c: [158, 158, 158, 255],
    d: [104, 104, 104, 255],
  },
  heightPalette: {
    a: 0.65,
    b: 0.45,
    c: 0.75,
    d: 0.3,
  },
  normalScale: 1.2,
  repeat: 2,
};

const GRASS_SIDE: PatternDefinition = {
  base: [
    'ghgighgi',
    'higgihgg',
    'ghhigihg',
    'fefdfefe',
    'dedfedef',
    'ededfedd',
    'dfededef',
    'fdeddefe',
  ],
  palette: {
    g: [108, 166, 74, 255],
    h: [124, 182, 92, 255],
    i: [94, 150, 64, 255],
    d: [121, 92, 52, 255],
    e: [108, 80, 44, 255],
    f: [136, 104, 60, 255],
  },
  heightPalette: {
    g: 0.85,
    h: 0.9,
    i: 0.8,
    d: 0.35,
    e: 0.3,
    f: 0.4,
  },
  normalScale: 1.1,
  repeat: 2,
};

const GRASS_TOP: PatternDefinition = {
  base: [
    'higgihgg',
    'ghhigihg',
    'iggihggi',
    'ghgighgi',
    'higgihgg',
    'ghhigihg',
    'iggihggi',
    'ghgighgi',
  ],
  palette: {
    g: [108, 166, 74, 255],
    h: [124, 182, 92, 255],
    i: [94, 150, 64, 255],
  },
  heightPalette: {
    g: 0.85,
    h: 0.9,
    i: 0.8,
  },
  normalScale: 1.0,
  repeat: 2,
};

const OAK_PLANK_SIDE: PatternDefinition = {
  base: [
    'ooqqooqq',
    'ooqqooqq',
    'oprrqopp',
    'ooqqooqq',
    'ooqqooqq',
    'oqooqqoo',
    'ooqqooqq',
    'opqrqopp',
  ],
  palette: {
    o: [155, 107, 60, 255],
    p: [138, 90, 45, 255],
    q: [171, 125, 78, 255],
    r: [112, 76, 38, 255],
  },
  heightPalette: {
    o: 0.65,
    p: 0.55,
    q: 0.75,
    r: 0.35,
  },
  normalScale: 1.0,
  repeat: 2,
};

const OAK_PLANK_TOP: PatternDefinition = {
  base: [
    'qqooqqoo',
    'qqooqqoo',
    'opqrqopp',
    'qqooqqoo',
    'qqooqqoo',
    'ooqqooqq',
    'qqooqqoo',
    'oprrqopp',
  ],
  palette: {
    o: [155, 107, 60, 255],
    p: [138, 90, 45, 255],
    q: [171, 125, 78, 255],
    r: [112, 76, 38, 255],
  },
  heightPalette: {
    o: 0.65,
    p: 0.55,
    q: 0.75,
    r: 0.35,
  },
  normalScale: 1.0,
  repeat: 2,
};

const OAK_LOG_SIDE: PatternDefinition = {
  base: [
    'abacbcab',
    'bbadcbba',
    'acbcabac',
    'cbadbacb',
    'abacbcab',
    'bbadcbba',
    'acbcabac',
    'cbadbacb',
  ],
  palette: {
    a: [133, 94, 56, 255],
    b: [112, 78, 42, 255],
    c: [148, 110, 68, 255],
    d: [96, 64, 32, 255],
  },
  heightPalette: {
    a: 0.65,
    b: 0.5,
    c: 0.75,
    d: 0.35,
  },
  normalScale: 1.1,
  repeat: 2,
};

const OAK_LOG_TOP: PatternDefinition = {
  base: [
    'ffffeeee',
    'ffedddff',
    'fedccdef',
    'edcbbdce',
    'edcbbdce',
    'fedccdef',
    'ffedddff',
    'ffffeeee',
  ],
  palette: {
    b: [112, 78, 42, 255],
    c: [148, 110, 68, 255],
    d: [96, 64, 32, 255],
    e: [168, 126, 84, 255],
    f: [198, 154, 102, 255],
  },
  heightPalette: {
    b: 0.5,
    c: 0.65,
    d: 0.4,
    e: 0.75,
    f: 0.85,
  },
  normalScale: 1.2,
  repeat: 2,
};

const SAND_SIDE: PatternDefinition = {
  base: [
    'abacbcab',
    'bacabcdc',
    'cabcdabc',
    'bacdcaba',
    'abacbcab',
    'bacabcdc',
    'cabcdabc',
    'bacdcaba',
  ],
  palette: {
    a: [226, 208, 170, 255],
    b: [214, 196, 156, 255],
    c: [236, 220, 182, 255],
    d: [204, 188, 150, 255],
  },
  heightPalette: {
    a: 0.55,
    b: 0.5,
    c: 0.6,
    d: 0.45,
  },
  normalScale: 0.6,
  repeat: 2,
};

const SAND_TOP: PatternDefinition = {
  base: [
    'ccdccdcc',
    'cceeedcc',
    'dceeefdd',
    'cdefgfcd',
    'cdefgfcd',
    'dceeefdd',
    'cceeedcc',
    'ccdccdcc',
  ],
  palette: {
    c: [238, 224, 190, 255],
    d: [226, 210, 176, 255],
    e: [246, 234, 202, 255],
    f: [236, 222, 190, 255],
    g: [252, 240, 210, 255],
  },
  heightPalette: {
    c: 0.6,
    d: 0.54,
    e: 0.66,
    f: 0.62,
    g: 0.7,
  },
  normalScale: 0.5,
  repeat: 2,
};

const BRICK_SIDE: PatternDefinition = {
  base: [
    'rrrttsss',
    'rrrttsss',
    'mmmmmmmm',
    'tssrrrtt',
    'tssrrrtt',
    'mmmmmmmm',
    'rrrttsss',
    'tssrrrtt',
  ],
  palette: {
    r: [178, 70, 58, 255],
    s: [146, 52, 44, 255],
    t: [198, 92, 76, 255],
    m: [116, 110, 104, 255],
  },
  heightPalette: {
    r: 0.75,
    s: 0.7,
    t: 0.8,
    m: 0.3,
  },
  normalScale: 1.3,
  repeat: 2,
};

const IRON_SIDE: PatternDefinition = {
  base: [
    'cccccccc',
    'caaabacc',
    'cabddbac',
    'caddddac',
    'caddddac',
    'cabddbac',
    'caaabacc',
    'cccccccc',
  ],
  palette: {
    a: [210, 214, 222, 255],
    b: [190, 194, 202, 255],
    c: [230, 234, 242, 255],
    d: [176, 180, 188, 255],
  },
  heightPalette: {
    a: 0.78,
    b: 0.65,
    c: 0.88,
    d: 0.6,
  },
  normalScale: 0.9,
  repeat: 2,
};

const DIRT_SIDE: PatternDefinition = {
  base: [
    'ddeeddee',
    'eedddfee',
    'ddeeffdd',
    'eefddfee',
    'ddfeeedd',
    'eefddfee',
    'ddeeddee',
    'eedddfee',
  ],
  palette: {
    d: [118, 78, 44, 255],
    e: [104, 68, 36, 255],
    f: [136, 92, 54, 255],
  },
  heightPalette: {
    d: 0.52,
    e: 0.46,
    f: 0.58,
  },
  normalScale: 0.9,
  repeat: 2,
};

const DIRT_TOP: PatternDefinition = {
  base: [
    'gghghhgg',
    'hijjjiih',
    'gjjkkjgg',
    'hjkllkjh',
    'hjkllkjh',
    'gjjkkjgg',
    'hijjjiih',
    'gghghhgg',
  ],
  palette: {
    g: [126, 86, 48, 255],
    h: [138, 94, 54, 255],
    i: [148, 102, 60, 255],
    j: [134, 92, 52, 255],
    k: [156, 110, 66, 255],
    l: [168, 120, 74, 255],
  },
  heightPalette: {
    g: 0.55,
    h: 0.6,
    i: 0.66,
    j: 0.58,
    k: 0.7,
    l: 0.74,
  },
  normalScale: 0.85,
  repeat: 2,
};

const COBBLE_SIDE: PatternDefinition = {
  base: [
    'abcdeedc',
    'bcdefecd',
    'cdefgfee',
    'defgafef',
    'efgabcfe',
    'fgabcdee',
    'gabcdefd',
    'fgabcdee',
  ],
  palette: {
    a: [156, 156, 156, 255],
    b: [134, 134, 134, 255],
    c: [178, 178, 178, 255],
    d: [120, 120, 120, 255],
    e: [104, 104, 104, 255],
    f: [166, 166, 166, 255],
    g: [190, 190, 190, 255],
  },
  heightPalette: {
    a: 0.65,
    b: 0.5,
    c: 0.75,
    d: 0.45,
    e: 0.35,
    f: 0.7,
    g: 0.82,
  },
  normalScale: 1.4,
  repeat: 2,
};

const COPPER_SIDE: PatternDefinition = {
  base: [
    'mmnnoopp',
    'mmnnoopp',
    'llmmnnoo',
    'kkllmmnn',
    'jjkkllmm',
    'iijjkkll',
    'hhiijjkk',
    'gghhiijj',
  ],
  palette: {
    g: [134, 88, 60, 255],
    h: [146, 96, 66, 255],
    i: [158, 108, 74, 255],
    j: [170, 120, 82, 255],
    k: [182, 134, 92, 255],
    l: [194, 148, 102, 255],
    m: [206, 160, 112, 255],
    n: [198, 144, 88, 255],
    o: [210, 156, 96, 255],
    p: [220, 168, 108, 255],
  },
  heightPalette: {
    g: 0.45,
    h: 0.5,
    i: 0.55,
    j: 0.6,
    k: 0.65,
    l: 0.7,
    m: 0.75,
    n: 0.68,
    o: 0.72,
    p: 0.76,
  },
  normalScale: 1.0,
  repeat: 2,
};

const GOLD_SIDE: PatternDefinition = {
  base: [
    'qqrrsstt',
    'qqrrsstt',
    'ppqqrrss',
    'ooppqqrr',
    'nnooppqq',
    'mmnnoopp',
    'llmmnnoo',
    'kkllmmnn',
  ],
  palette: {
    k: [198, 150, 48, 255],
    l: [210, 162, 58, 255],
    m: [222, 174, 68, 255],
    n: [234, 186, 78, 255],
    o: [246, 198, 92, 255],
    p: [238, 182, 64, 255],
    q: [250, 206, 108, 255],
    r: [246, 194, 96, 255],
    s: [238, 182, 84, 255],
    t: [230, 170, 72, 255],
  },
  heightPalette: {
    k: 0.6,
    l: 0.65,
    m: 0.72,
    n: 0.78,
    o: 0.82,
    p: 0.86,
    q: 0.9,
    r: 0.83,
    s: 0.78,
    t: 0.72,
  },
  normalScale: 0.95,
  repeat: 2,
};

const GLASS_SIDE: PatternDefinition = {
  base: [
    'aaabaaaa',
    'aabbbaaa',
    'abcccbaa',
    'abcccbba',
    'abcccbaa',
    'aabbbaaa',
    'aaabaaaa',
    'aaaaaaac',
  ],
  palette: {
    a: [182, 214, 232, 180],
    b: [166, 200, 220, 200],
    c: [210, 236, 248, 220],
  },
  repeat: 2,
};

const WOOL_WHITE_SIDE: PatternDefinition = {
  base: [
    'deeeddff',
    'eefddfee',
    'dfefedef',
    'eefddfee',
    'deeeddff',
    'eefddfee',
    'dfefedef',
    'eefddfee',
  ],
  palette: {
    d: [226, 226, 226, 255],
    e: [212, 210, 210, 255],
    f: [236, 236, 236, 255],
  },
  repeat: 2,
};

const WOOL_RED_SIDE: PatternDefinition = {
  base: [
    'hhggghhh',
    'gghhhggg',
    'hhggghhh',
    'gghhhggg',
    'hhggghhh',
    'gghhhggg',
    'hhggghhh',
    'gghhhggg',
  ],
  palette: {
    g: [178, 34, 40, 255],
    h: [198, 44, 50, 255],
  },
  repeat: 2,
};

const OBSIDIAN_SIDE: PatternDefinition = {
  base: [
    'aabbaaab',
    'abcccbba',
    'bccddccb',
    'ccdedded',
    'dedfffed',
    'edddccde',
    'cddcccdc',
    'bccbbccb',
  ],
  palette: {
    a: [28, 18, 48, 255],
    b: [36, 24, 60, 255],
    c: [46, 30, 72, 255],
    d: [56, 36, 84, 255],
    e: [68, 44, 96, 255],
    f: [92, 60, 118, 255],
  },
  repeat: 2,
};

const PRESETS: AtlasMaterialPreset[] = [
  {
    name: 'debug',
    side: DEBUG_SIDE,
    top: DEBUG_TOP,
    saturation: 0.95,
    metallic: 0.0,
    roughness: 0.7,
  },
  {
    name: 'stone',
    side: STONE_SIDE,
    saturation: 0.9,
    metallic: 0.0,
    roughness: 0.8,
  },
  {
    name: 'grass',
    side: GRASS_SIDE,
    top: GRASS_TOP,
    saturation: 1.1,
    metallic: 0.0,
    roughness: 0.9,
  },
  {
    name: 'oak_planks',
    side: OAK_PLANK_SIDE,
    top: OAK_PLANK_TOP,
    saturation: 1.05,
    metallic: 0.0,
    roughness: 0.6,
  },
  {
    name: 'oak_log',
    side: OAK_LOG_SIDE,
    top: OAK_LOG_TOP,
    saturation: 1.05,
    metallic: 0.0,
    roughness: 0.65,
  },
  {
    name: 'sand',
    side: SAND_SIDE,
    top: SAND_TOP,
    saturation: 1.0,
    metallic: 0.0,
    roughness: 0.5,
  },
  {
    name: 'brick',
    side: BRICK_SIDE,
    saturation: 1.1,
    metallic: 0.0,
    roughness: 0.55,
  },
  {
    name: 'iron',
    side: IRON_SIDE,
    saturation: 0.95,
    metallic: 0.6,
    roughness: 0.25,
  },
  {
    name: 'dirt',
    side: DIRT_SIDE,
    top: DIRT_TOP,
    saturation: 0.95,
    metallic: 0.0,
    roughness: 0.85,
  },
  {
    name: 'cobblestone',
    side: COBBLE_SIDE,
    saturation: 0.9,
    metallic: 0.0,
    roughness: 0.7,
  },
  {
    name: 'copper_block',
    side: COPPER_SIDE,
    saturation: 1.0,
    metallic: 0.7,
    roughness: 0.35,
  },
  {
    name: 'gold_block',
    side: GOLD_SIDE,
    saturation: 1.05,
    metallic: 0.85,
    roughness: 0.25,
  },
  {
    name: 'glass',
    side: GLASS_SIDE,
    saturation: 1.1,
    metallic: 0.0,
    roughness: 0.1,
  },
  {
    name: 'wool_white',
    side: WOOL_WHITE_SIDE,
    saturation: 1.0,
    metallic: 0.0,
    roughness: 0.95,
  },
  {
    name: 'wool_red',
    side: WOOL_RED_SIDE,
    saturation: 1.1,
    metallic: 0.0,
    roughness: 0.9,
  },
  {
    name: 'obsidian',
    side: OBSIDIAN_SIDE,
    saturation: 0.85,
    metallic: 0.1,
    roughness: 0.4,
  },
];

export function buildDefaultAtlasMaterials(targetTextureSize: number): BuiltAtlasMaterial[] {
  return PRESETS.map((preset) => {
    const sidePattern = tilePattern(preset.side);
    const topPattern = tilePattern(preset.top ?? preset.side);
    const sideNormalData = buildNormalTexture(sidePattern, targetTextureSize);
    const topNormalData = buildNormalTexture(topPattern, targetTextureSize);
    const material: MaterialTextureData = {
      name: preset.name,
      sideData: patternToTexture(sidePattern.rows, sidePattern.palette, targetTextureSize),
      topData: patternToTexture(topPattern.rows, topPattern.palette, targetTextureSize),
      size: targetTextureSize,
    };
    if (sideNormalData) {
      material.sideNormalData = sideNormalData;
    }
    if (topNormalData) {
      material.topNormalData = topNormalData;
    }
    return {
      material,
      params: {
        saturation: preset.saturation,
        metallic: preset.metallic,
        roughness: preset.roughness,
      },
    };
  });
}
