/**
 * Performance Regression Test Examples
 *
 * Demonstrates performance testing patterns including:
 * - Baseline tracking
 * - Budget enforcement
 * - Regression detection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  runPerformanceTest,
  calculateStats,
  calculateRegression,
  measureTime,
  measureIterations,
  createFrameTimeTracker,
  measureRenderFrames,
  expectWithinBudget,
  expectNoRegression,
  expectExecutionTime,
  performanceBudgets,
  generatePerformanceReport,
  printPerformanceReport,
  type PerformanceTestConfig,
  type PerformanceTestResult,
} from '../src/performance';

describe('Performance Test Framework', () => {
  describe('Statistical Calculations', () => {
    it('should calculate stats correctly', () => {
      const measurements = [10, 20, 30, 40, 50];
      const stats = calculateStats(measurements);

      expect(stats.mean).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.samples).toBe(5);
    });

    it('should handle empty measurements', () => {
      const stats = calculateStats([]);

      expect(stats.mean).toBe(0);
      expect(stats.samples).toBe(0);
    });

    it('should calculate percentiles', () => {
      const measurements = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = calculateStats(measurements);

      expect(stats.p95).toBeCloseTo(95, 0);
      expect(stats.p99).toBeCloseTo(99, 0);
    });

    it('should calculate standard deviation', () => {
      const measurements = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = calculateStats(measurements);

      // Standard deviation of [2,4,4,4,5,5,7,9] is 2
      expect(stats.stdDev).toBeCloseTo(2, 0);
    });
  });

  describe('Regression Calculation', () => {
    it('should detect regression for time metrics (higher is worse)', () => {
      const regression = calculateRegression(100, 120, 'time_ms');
      expect(regression).toBe(20); // 20% regression
    });

    it('should detect improvement for time metrics', () => {
      const regression = calculateRegression(100, 80, 'time_ms');
      expect(regression).toBe(-20); // 20% improvement
    });

    it('should detect regression for FPS (lower is worse)', () => {
      const regression = calculateRegression(60, 50, 'fps');
      expect(regression).toBeCloseTo(16.67, 1); // ~16.7% regression
    });

    it('should handle zero baseline', () => {
      expect(calculateRegression(0, 0, 'time_ms')).toBe(0);
      expect(calculateRegression(0, 100, 'time_ms')).toBe(100);
    });
  });

  describe('Time Measurement', () => {
    it('should measure function execution time', async () => {
      const time = await measureTime(() => {
        // Simulate work
        let sum = 0;
        for (let i = 0; i < 10000; i++) sum += i;
        return sum;
      });

      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(100); // Should be fast
    });

    it('should measure async function time', async () => {
      const time = await measureTime(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(time).toBeGreaterThanOrEqual(10);
      expect(time).toBeLessThan(50);
    });

    it('should measure iterations with warmup', async () => {
      let callCount = 0;
      const stats = await measureIterations(
        () => {
          callCount++;
          let sum = 0;
          for (let i = 0; i < 1000; i++) sum += i;
        },
        50,  // iterations
        10   // warmup
      );

      expect(callCount).toBe(60); // warmup + iterations
      expect(stats.samples).toBe(50);
      expect(stats.mean).toBeGreaterThan(0);
    });
  });

  describe('Frame Time Tracking', () => {
    it('should track frame times', () => {
      const tracker = createFrameTimeTracker();

      tracker.record(16.67);
      tracker.record(17.5);
      tracker.record(16.0);

      expect(tracker.measurements).toHaveLength(3);

      const stats = tracker.getStats();
      expect(stats.samples).toBe(3);
      expect(stats.mean).toBeCloseTo(16.72, 1);
    });

    it('should calculate FPS from frame times', () => {
      const tracker = createFrameTimeTracker();

      // 60 FPS = 16.67ms per frame
      tracker.record(16.67);
      tracker.record(16.67);
      tracker.record(16.67);

      const fps = tracker.getFps();
      expect(fps.mean).toBeCloseTo(60, 0);
    });

    it('should reset tracker', () => {
      const tracker = createFrameTimeTracker();

      tracker.record(16);
      tracker.record(17);
      tracker.reset();

      expect(tracker.measurements).toHaveLength(0);
    });
  });

  describe('Performance Test Runner', () => {
    it('should run performance test and pass within budget', async () => {
      const config: PerformanceTestConfig = {
        name: 'test-fast-operation',
        metricType: 'time_ms',
        budget: {
          max: 10,
          maxRegressionPercent: 50,
        },
        warmupIterations: 2,
        iterations: 10,
      };

      const result = await runPerformanceTest(config, () => {
        // Fast operation
        Math.random();
      });

      expect(result.passed).toBe(true);
      expect(result.stats.mean).toBeLessThan(10);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when budget exceeded', async () => {
      const config: PerformanceTestConfig = {
        name: 'test-slow-operation',
        metricType: 'time_ms',
        budget: {
          max: 0.001, // Impossible budget
        },
        warmupIterations: 1,
        iterations: 5,
      };

      const result = await runPerformanceTest(config, () => {
        // Some work
        for (let i = 0; i < 100; i++) Math.random();
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should enforce minimum budget (for FPS)', async () => {
      const config: PerformanceTestConfig = {
        name: 'test-fps-minimum',
        metricType: 'fps',
        budget: {
          min: 1000, // Impossible minimum
        },
        warmupIterations: 1,
        iterations: 3,
      };

      const result = await runPerformanceTest(config, () => {
        // Simulate frame render (~16ms)
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('Assertions', () => {
    it('expectWithinBudget should pass for good results', async () => {
      const result: PerformanceTestResult = {
        config: { name: 'test', metricType: 'time_ms' },
        stats: { mean: 5, median: 5, min: 4, max: 6, stdDev: 1, p95: 5.5, p99: 6, samples: 10 },
        passed: true,
        violations: [],
        measurements: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      };

      expect(() => expectWithinBudget(result)).not.toThrow();
    });

    it('expectWithinBudget should throw for failed results', () => {
      const result: PerformanceTestResult = {
        config: { name: 'test', metricType: 'time_ms' },
        stats: { mean: 50, median: 50, min: 40, max: 60, stdDev: 5, p95: 55, p99: 60, samples: 10 },
        passed: false,
        violations: ['Mean 50 exceeds budget max 10'],
        measurements: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
      };

      expect(() => expectWithinBudget(result)).toThrow(/Performance test.*failed/);
    });

    it('expectNoRegression should pass with acceptable regression', () => {
      const result: PerformanceTestResult = {
        config: { name: 'test', metricType: 'time_ms' },
        stats: { mean: 10, median: 10, min: 9, max: 11, stdDev: 1, p95: 10.5, p99: 11, samples: 10 },
        passed: true,
        regressionPercent: 5, // 5% regression
        violations: [],
        measurements: [],
      };

      expect(() => expectNoRegression(result, 10)).not.toThrow();
    });

    it('expectNoRegression should throw for excessive regression', () => {
      const result: PerformanceTestResult = {
        config: { name: 'test', metricType: 'time_ms' },
        stats: { mean: 10, median: 10, min: 9, max: 11, stdDev: 1, p95: 10.5, p99: 11, samples: 10 },
        baseline: {
          name: 'test',
          metricType: 'time_ms',
          stats: { mean: 5, median: 5, min: 4, max: 6, stdDev: 1, p95: 5.5, p99: 6, samples: 10 },
          createdAt: '',
          updatedAt: '',
        },
        passed: false,
        regressionPercent: 100, // 100% regression
        violations: [],
        measurements: [],
      };

      expect(() => expectNoRegression(result, 10)).toThrow(/regression detected.*100/i);
    });
  });

  describe('Pre-defined Budgets', () => {
    it('should have 60fps budget', () => {
      expect(performanceBudgets.frame60fps.max).toBe(16.67);
    });

    it('should have 30fps budget', () => {
      expect(performanceBudgets.frame30fps.max).toBe(33.33);
    });

    it('should have entity creation budget', () => {
      expect(performanceBudgets.entityCreation1k.max).toBe(100);
    });
  });

  describe('Report Generation', () => {
    it('should generate performance report', () => {
      const results: PerformanceTestResult[] = [
        {
          config: { name: 'test1', metricType: 'time_ms' },
          stats: { mean: 10, median: 10, min: 9, max: 11, stdDev: 1, p95: 10.5, p99: 11, samples: 10 },
          passed: true,
          violations: [],
          measurements: [],
        },
        {
          config: { name: 'test2', metricType: 'time_ms' },
          stats: { mean: 50, median: 50, min: 45, max: 55, stdDev: 5, p95: 53, p99: 55, samples: 10 },
          passed: false,
          regressionPercent: 25,
          violations: ['Exceeded budget'],
          measurements: [],
        },
      ];

      const report = generatePerformanceReport(results);

      expect(report.summary.total).toBe(2);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.regressions).toBe(1);
      expect(report.timestamp).toBeDefined();
    });
  });
});

describe('Real World Performance Examples', () => {
  const results: PerformanceTestResult[] = [];

  afterAll(() => {
    // Generate and print report
    if (results.length > 0) {
      const report = generatePerformanceReport(results);
      printPerformanceReport(report);
    }
  });

  it('should benchmark array operations', async () => {
    const result = await runPerformanceTest(
      {
        name: 'array-map-10k',
        metricType: 'time_ms',
        budget: performanceBudgets.entityCreation1k,
        warmupIterations: 5,
        iterations: 20,
      },
      () => {
        const arr = Array.from({ length: 10000 }, (_, i) => i);
        arr.map((x) => x * 2);
      }
    );

    results.push(result);
    expect(result.passed).toBe(true);
  });

  it('should benchmark object creation', async () => {
    const result = await runPerformanceTest(
      {
        name: 'object-creation-1k',
        metricType: 'time_ms',
        budget: { max: 50, maxRegressionPercent: 20 },
        warmupIterations: 3,
        iterations: 15,
      },
      () => {
        const objects = [];
        for (let i = 0; i < 1000; i++) {
          objects.push({
            id: i,
            name: `Entity${i}`,
            position: { x: Math.random(), y: Math.random(), z: Math.random() },
            components: new Map(),
          });
        }
      }
    );

    results.push(result);
    expect(result.passed).toBe(true);
  });

  it('should benchmark JSON serialization', async () => {
    const testData = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item${i}`,
      nested: {
        values: Array.from({ length: 10 }, (_, j) => ({ index: j, value: Math.random() })),
      },
    }));

    const result = await runPerformanceTest(
      {
        name: 'json-serialize-100-objects',
        metricType: 'time_ms',
        budget: { max: 20, maxRegressionPercent: 25 },
        warmupIterations: 5,
        iterations: 30,
      },
      () => {
        JSON.stringify(testData);
      }
    );

    results.push(result);
    expect(result.passed).toBe(true);
  });

  it('should measure render frame simulation', async () => {
    const renderStats = await measureRenderFrames(
      async () => {
        // Simulate render work
        await new Promise((r) => setTimeout(r, 1));
        const arr = Array.from({ length: 1000 }, () => Math.random());
        arr.sort();
      },
      20,  // frames
      60   // target FPS
    );

    expect(renderStats.frameTime.samples).toBe(20);
    expect(renderStats.fps.mean).toBeGreaterThan(0);
  });
});

