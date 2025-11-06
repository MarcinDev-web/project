/**
 * Configuration for 3D grid visualization in the editor.
 * Inspired by Minecraft's building grid system.
 */

/**
 * Grid configuration interface
 */
export interface GridConfig {
  /** Whether the grid is visible */
  visible: boolean;

  /** Size of a single grid cell in world units */
  cellSize: number;

  /** Number of cells extending from center in each direction */
  extent: number;

  /** Which planes to render the grid on */
  planes: {
    /** Horizontal plane (XZ) */
    horizontal: boolean;
    /** Vertical planes (XY, YZ) */
    vertical: boolean;
  };

  /** Grid line colors */
  colors: {
    /** Major grid lines (every N cells) */
    majorLine: string;
    /** Minor grid lines (regular cells) */
    minorLine: string;
    /** Origin point (0,0,0) highlight */
    origin: string;
  };

  /** Interval for major lines (every N cells) */
  majorLineInterval: number;

  /** Line widths */
  lineWidth: {
    /** Width of major lines in pixels */
    major: number;
    /** Width of minor lines in pixels */
    minor: number;
  };
}

/**
 * Default grid configuration
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  visible: false,
  cellSize: 1.0,
  extent: 20,
  planes: {
    horizontal: true,
    vertical: false,
  },
  colors: {
    majorLine: '#555555',
    minorLine: '#333333',
    origin: '#ff0000',
  },
  majorLineInterval: 5,
  lineWidth: {
    major: 2,
    minor: 1,
  },
};

/**
 * Validates grid configuration
 */
export function validateGridConfig(config: Partial<GridConfig>): string[] {
  const errors: string[] = [];

  if (config.cellSize !== undefined && config.cellSize <= 0) {
    errors.push('cellSize must be greater than 0');
  }

  if (config.extent !== undefined && config.extent <= 0) {
    errors.push('extent must be greater than 0');
  }

  if (config.majorLineInterval !== undefined && config.majorLineInterval <= 0) {
    errors.push('majorLineInterval must be greater than 0');
  }

  if (config.lineWidth?.major !== undefined && config.lineWidth.major <= 0) {
    errors.push('lineWidth.major must be greater than 0');
  }

  if (config.lineWidth?.minor !== undefined && config.lineWidth.minor <= 0) {
    errors.push('lineWidth.minor must be greater than 0');
  }

  return errors;
}
