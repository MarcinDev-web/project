/**
 * Performance Regression Test Framework
 *
 * Provides utilities for:
 * - Performance baseline tracking
 * - Regression detection with configurable thresholds
 * - Budget enforcement
 * - CI-friendly reporting
 */

import { expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Performance metric types
 */
export type MetricType =
  | 'time_ms'
  | 'memory_mb'
  | 'fps'
  | 'frame_time_ms'
  | 'draw_calls'
  | 'triangles'
  | 'allocations'
  | 'gc_pause_ms'
  | 'throughput';

/**
 * Single performance measurement
 */
export interface PerformanceMeasurement {
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Statistical summary of measurements
 */
export interface PerformanceStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p95: number;
  p99: number;
  samples: number;
}

/**
 * Performance baseline entry
 */
export interface PerformanceBaseline {
  name: string;
  metricType: MetricType;
  stats: PerformanceStats;
  createdAt: string;
  updatedAt: string;
  gitCommit?: string;
  environment?: string;
}

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  /** Maximum allowed value */
  max?: number;
  /** Minimum allowed value (for metrics like FPS) */
  min?: number;
  /** Maximum allowed regression from baseline (percentage) */
  maxRegressionPercent?: number;
  /** Absolute tolerance for variance */
  tolerance?: number;
}

/**
 * Performance test configuration
 */
export interface PerformanceTestConfig {
  name: string;
  metricType: MetricType;
  budget?: PerformanceBudget;
  /** Number of warmup iterations (excluded from measurements) */
  warmupIterations?: number;
  /** Number of measurement iterations */
  iterations?: number;
  /** Whether to update baseline on success */
  updateBaseline?: boolean;
  /** Custom baseline path */
  baselinePath?: string;
}

/**
 * Performance test result
 */
export interface PerformanceTestResult {
  config: PerformanceTestConfig;
  stats: PerformanceStats;
  baseline?: PerformanceBaseline;
  passed: boolean;
  regressionPercent?: number;
  violations: string[];
  measurements: number[];
}

// ============================================================================
// Statistical Utilities
// ============================================================================

/**
 * Calculate statistical summary from measurements
 */
export function calculateStats(measurements: number[]): PerformanceStats {
  if (measurements.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      p95: 0,
      p99: 0,
      samples: 0,
    };
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;

  // Median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;

  // Standard deviation
  const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Percentiles
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    mean,
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    stdDev,
    p95: sorted[Math.min(p95Index, sorted.length - 1)]!,
    p99: sorted[Math.min(p99Index, sorted.length - 1)]!,
    samples: sorted.length,
  };
}

/**
 * Calculate regression percentage between baseline and current
 */
export function calculateRegression(
  baseline: number,
  current: number,
  metricType: MetricType
): number {
  if (baseline === 0) return current === 0 ? 0 : 100;

  // For FPS and throughput, higher is better (regression = decrease)
  if (metricType === 'fps' || metricType === 'throughput') {
    return ((baseline - current) / baseline) * 100;
  }

  // For time/memory metrics, lower is better (regression = increase)
  return ((current - baseline) / baseline) * 100;
}

// ============================================================================
// Baseline Management
// ============================================================================

const DEFAULT_BASELINE_PATH = 'test-results/performance-baselines.json';

interface BaselineStore {
  version: string;
  baselines: Record<string, PerformanceBaseline>;
}

/**
 * Load baselines from file
 */
export function loadBaselines(
  path: string = DEFAULT_BASELINE_PATH
): Record<string, PerformanceBaseline> {
  try {
    if (!existsSync(path)) {
      return {};
    }
    const content = readFileSync(path, 'utf-8');
    const store: BaselineStore = JSON.parse(content);
    return store.baselines || {};
  } catch {
    return {};
  }
}

/**
 * Save baselines to file
 */
export function saveBaselines(
  baselines: Record<string, PerformanceBaseline>,
  path: string = DEFAULT_BASELINE_PATH
): void {
  const store: BaselineStore = {
    version: '1.0.0',
    baselines,
  };

  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, JSON.stringify(store, null, 2));
}

/**
 * Get or create baseline for a test
 */
export function getBaseline(
  name: string,
  path: string = DEFAULT_BASELINE_PATH
): PerformanceBaseline | undefined {
  const baselines = loadBaselines(path);
  return baselines[name];
}

/**
 * Update baseline for a test
 */
export function updateBaseline(
  name: string,
  stats: PerformanceStats,
  metricType: MetricType,
  path: string = DEFAULT_BASELINE_PATH
): void {
  const baselines = loadBaselines(path);
  const now = new Date().toISOString();

  baselines[name] = {
    name,
    metricType,
    stats,
    createdAt: baselines[name]?.createdAt || now,
    updatedAt: now,
    gitCommit: process.env.GIT_COMMIT || process.env.GITHUB_SHA,
    environment: process.env.CI ? 'ci' : 'local',
  };

  saveBaselines(baselines, path);
}

// ============================================================================
// Performance Test Runner
// ============================================================================

/**
 * Run a performance test with measurements
 */
export async function runPerformanceTest(
  config: PerformanceTestConfig,
  testFn: () => void | Promise<void>
): Promise<PerformanceTestResult> {
  const {
    name,
    metricType,
    budget,
    warmupIterations = 5,
    iterations = 50,
    updateBaseline: shouldUpdate = false,
    baselinePath = DEFAULT_BASELINE_PATH,
  } = config;

  const measurements: number[] = [];
  const violations: string[] = [];

  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await testFn();
  }

  // Measurement phase
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await testFn();
    const duration = performance.now() - start;
    measurements.push(duration);
  }

  const stats = calculateStats(measurements);
  const baseline = getBaseline(name, baselinePath);

  // Check budget violations
  let passed = true;
  let regressionPercent: number | undefined;

  if (budget) {
    if (budget.max !== undefined && stats.mean > budget.max) {
      violations.push(`Mean ${stats.mean.toFixed(2)} exceeds budget max ${budget.max}`);
      passed = false;
    }

    if (budget.min !== undefined && stats.mean < budget.min) {
      violations.push(`Mean ${stats.mean.toFixed(2)} below budget min ${budget.min}`);
      passed = false;
    }

    if (baseline && budget.maxRegressionPercent !== undefined) {
      regressionPercent = calculateRegression(baseline.stats.mean, stats.mean, metricType);

      if (regressionPercent > budget.maxRegressionPercent) {
        violations.push(
          `Regression ${regressionPercent.toFixed(2)}% exceeds threshold ${budget.maxRegressionPercent}%`
        );
        passed = false;
      }
    }
  }

  // Update baseline if requested and passed
  if (shouldUpdate && passed) {
    updateBaseline(name, stats, metricType, baselinePath);
  }

  return {
    config,
    stats,
    baseline,
    passed,
    regressionPercent,
    violations,
    measurements,
  };
}

// ============================================================================
// Performance Budget Assertions
// ============================================================================

/**
 * Assert that performance is within budget
 */
export function expectWithinBudget(result: PerformanceTestResult): void {
  if (!result.passed) {
    const message = [
      `Performance test "${result.config.name}" failed:`,
      ...result.violations.map((v) => `  - ${v}`),
      '',
      'Stats:',
      `  Mean: ${result.stats.mean.toFixed(2)}`,
      `  Median: ${result.stats.median.toFixed(2)}`,
      `  P95: ${result.stats.p95.toFixed(2)}`,
      `  P99: ${result.stats.p99.toFixed(2)}`,
    ];

    if (result.baseline) {
      message.push('', 'Baseline:', `  Mean: ${result.baseline.stats.mean.toFixed(2)}`);
    }

    throw new Error(message.join('\n'));
  }
}

/**
 * Assert no regression from baseline
 */
export function expectNoRegression(
  result: PerformanceTestResult,
  maxRegressionPercent: number = 10
): void {
  if (result.regressionPercent !== undefined && result.regressionPercent > maxRegressionPercent) {
    throw new Error(
      `Performance regression detected: ${result.regressionPercent.toFixed(2)}% ` +
        `(threshold: ${maxRegressionPercent}%)\n` +
        `Baseline: ${result.baseline?.stats.mean.toFixed(2)}\n` +
        `Current: ${result.stats.mean.toFixed(2)}`
    );
  }
}

/**
 * Assert execution time is under limit
 */
export function expectExecutionTime(result: PerformanceTestResult, maxMs: number): void {
  expect(result.stats.mean).toBeLessThan(maxMs);
  expect(result.stats.p95).toBeLessThan(maxMs * 1.5);
}

// ============================================================================
// Performance Test Helpers
// ============================================================================

/**
 * Measure function execution time
 */
export async function measureTime(fn: () => void | Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/**
 * Measure multiple iterations and return stats
 */
export async function measureIterations(
  fn: () => void | Promise<void>,
  iterations: number = 100,
  warmup: number = 10
): Promise<PerformanceStats> {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Measure
  const measurements: number[] = [];
  for (let i = 0; i < iterations; i++) {
    measurements.push(await measureTime(fn));
  }

  return calculateStats(measurements);
}

/**
 * Measure memory usage (if available)
 */
export function measureMemory(): number | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };

  if (perf.memory?.usedJSHeapSize !== undefined) {
    return perf.memory.usedJSHeapSize / (1024 * 1024); // MB
  }
  return null;
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
  const maybeGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (maybeGc) {
    maybeGc();
  }
}

// ============================================================================
// Render Performance Utilities
// ============================================================================

/**
 * Frame time measurement for render loops
 */
export interface FrameTimeMeasurement {
  frameTime: number;
  fps: number;
  frameIndex: number;
  timestamp: number;
}

/**
 * Create a frame time tracker for render performance
 */
export function createFrameTimeTracker(): {
  record: (deltaMs: number) => void;
  getStats: () => PerformanceStats;
  getFps: () => PerformanceStats;
  reset: () => void;
  measurements: FrameTimeMeasurement[];
} {
  const measurements: FrameTimeMeasurement[] = [];
  let frameIndex = 0;

  return {
    record: (deltaMs: number) => {
      measurements.push({
        frameTime: deltaMs,
        fps: 1000 / deltaMs,
        frameIndex: frameIndex++,
        timestamp: Date.now(),
      });
    },
    getStats: () => calculateStats(measurements.map((m) => m.frameTime)),
    getFps: () => calculateStats(measurements.map((m) => m.fps)),
    reset: () => {
      measurements.length = 0;
      frameIndex = 0;
    },
    measurements,
  };
}

/**
 * Run frames and collect performance data
 */
export async function measureRenderFrames(
  renderFn: (deltaMs: number) => void | Promise<void>,
  frameCount: number = 100,
  targetFps: number = 60
): Promise<{ frameTime: PerformanceStats; fps: PerformanceStats }> {
  const tracker = createFrameTimeTracker();
  const targetFrameTime = 1000 / targetFps;

  for (let i = 0; i < frameCount; i++) {
    const start = performance.now();
    await renderFn(targetFrameTime);
    const deltaMs = performance.now() - start;
    tracker.record(deltaMs);
  }

  return {
    frameTime: tracker.getStats(),
    fps: tracker.getFps(),
  };
}

// ============================================================================
// CI Report Generation
// ============================================================================

/**
 * Performance report format for CI
 */
export interface PerformanceReport {
  timestamp: string;
  environment: string;
  gitCommit?: string;
  results: PerformanceTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    regressions: number;
  };
}

/**
 * Generate CI-friendly performance report
 */
export function generatePerformanceReport(results: PerformanceTestResult[]): PerformanceReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const regressions = results.filter(
    (r) => r.regressionPercent !== undefined && r.regressionPercent > 0
  ).length;

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.CI ? 'ci' : 'local',
    gitCommit: process.env.GIT_COMMIT || process.env.GITHUB_SHA,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      regressions,
    },
  };
}

/**
 * Save performance report to file
 */
export function savePerformanceReport(
  report: PerformanceReport,
  path: string = 'test-results/performance-report.json'
): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(report, null, 2));
}

/**
 * Print performance report to console (CI-friendly)
 */
export function printPerformanceReport(report: PerformanceReport): void {
  console.log('\n=== Performance Test Report ===');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Environment: ${report.environment}`);
  if (report.gitCommit) {
    console.log(`Commit: ${report.gitCommit}`);
  }
  console.log('');

  console.log('Summary:');
  console.log(`  Total: ${report.summary.total}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log(`  Regressions: ${report.summary.regressions}`);
  console.log('');

  for (const result of report.results) {
    const status = result.passed ? '✓' : '✗';
    const regression =
      result.regressionPercent !== undefined
        ? ` (${result.regressionPercent.toFixed(1)}% change)`
        : '';

    console.log(`${status} ${result.config.name}${regression}`);
    console.log(`    Mean: ${result.stats.mean.toFixed(2)}ms`);
    console.log(`    P95: ${result.stats.p95.toFixed(2)}ms`);

    if (result.violations.length > 0) {
      result.violations.forEach((v) => console.log(`    ⚠ ${v}`));
    }
  }

  console.log('\n================================\n');
}

// ============================================================================
// Common Performance Budgets
// ============================================================================

/**
 * Pre-defined performance budgets for common scenarios
 */
export const performanceBudgets = {
  /** Frame time budget for 60fps */
  frame60fps: {
    max: 16.67,
    maxRegressionPercent: 10,
  } as PerformanceBudget,

  /** Frame time budget for 30fps */
  frame30fps: {
    max: 33.33,
    maxRegressionPercent: 15,
  } as PerformanceBudget,

  /** Startup time budget (ms) */
  startup: {
    max: 3000,
    maxRegressionPercent: 20,
  } as PerformanceBudget,

  /** Entity creation (1000 entities) */
  entityCreation1k: {
    max: 100,
    maxRegressionPercent: 15,
  } as PerformanceBudget,

  /** Physics step (ms) */
  physicsStep: {
    max: 8,
    maxRegressionPercent: 10,
  } as PerformanceBudget,

  /** Serialization (large scene) */
  serialization: {
    max: 500,
    maxRegressionPercent: 20,
  } as PerformanceBudget,

  /** Memory budget (MB) */
  memory100mb: {
    max: 100,
    maxRegressionPercent: 25,
  } as PerformanceBudget,
};
