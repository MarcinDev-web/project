/**
 * Test Infrastructure Runner
 *
 * Orchestrates running different types of tests:
 * - Unit tests (Vitest)
 * - Integration tests (Vitest with cross-package scenarios)
 * - Performance tests (with baseline tracking)
 * - Visual regression tests (Playwright + WebGPU)
 *
 * Usage:
 *   pnpm tsx scripts/test-infrastructure.ts [type] [options]
 *
 * Types:
 *   unit          - Run unit tests
 *   integration   - Run integration tests
 *   perf          - Run performance tests
 *   visual        - Run visual regression tests
 *   all           - Run all tests
 *
 * Options:
 *   --update-baselines  - Update performance baselines
 *   --update-goldens    - Update visual golden masters
 *   --ci                - Run in CI mode (stricter thresholds)
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface TestResult {
  type: string;
  passed: boolean;
  duration: number;
  details?: string;
}

interface TestSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

const RESULTS_DIR = 'test-results';
const args = process.argv.slice(2);
const testType = args[0] || 'all';
const options = {
  updateBaselines: args.includes('--update-baselines'),
  updateGoldens: args.includes('--update-goldens'),
  ci: args.includes('--ci') || process.env.CI === 'true',
};

function ensureResultsDir(): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function runCommand(command: string, description: string): TestResult {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${description}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let passed = true;
  let details = '';

  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    passed = false;
    details = error instanceof Error ? error.message : String(error);
  }

  const duration = Date.now() - startTime;

  console.log(`\n${passed ? '✓' : '✗'} ${description} (${duration}ms)`);

  return {
    type: description,
    passed,
    duration,
    details: passed ? undefined : details,
  };
}

async function runUnitTests(): Promise<TestResult> {
  const command = options.ci
    ? 'pnpm vitest run --project unit --reporter=verbose'
    : 'pnpm vitest run --project unit';

  return runCommand(command, 'Unit Tests');
}

async function runIntegrationTests(): Promise<TestResult> {
  const command = options.ci
    ? 'pnpm vitest run --project integration --reporter=verbose'
    : 'pnpm vitest run --project integration';

  return runCommand(command, 'Integration Tests');
}

async function runPerformanceTests(): Promise<TestResult> {
  const env = options.updateBaselines ? 'UPDATE_BASELINES=true ' : '';
  const command = `${env}pnpm vitest run packages/test-utils/__tests__/performance.example.test.ts`;

  return runCommand(command, 'Performance Tests');
}

async function runVisualTests(): Promise<TestResult> {
  const env = options.updateGoldens ? 'UPDATE_GOLDENS=true ' : '';
  const command = `${env}pnpm playwright test packages/gfx-webgpu/tests/visual/ --reporter=list`;

  return runCommand(command, 'Visual Regression Tests');
}

async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(await runUnitTests());
  results.push(await runIntegrationTests());
  results.push(await runPerformanceTests());
  results.push(await runVisualTests());

  return results;
}

function generateSummary(results: TestResult[]): TestSummary {
  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

function printSummary(summary: TestSummary): void {
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${summary.timestamp}`);
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log('');

  for (const result of summary.results) {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.type} (${result.duration}ms)`);
    if (result.details) {
      console.log(`  Error: ${result.details.substring(0, 100)}...`);
    }
  }

  console.log('='.repeat(60) + '\n');
}

function saveSummary(summary: TestSummary): void {
  ensureResultsDir();
  const path = join(RESULTS_DIR, 'test-summary.json');
  writeFileSync(path, JSON.stringify(summary, null, 2));
  console.log(`Summary saved to: ${path}`);
}

async function main(): Promise<void> {
  console.log('Test Infrastructure Runner');
  console.log(`Type: ${testType}`);
  console.log(`Options: ${JSON.stringify(options)}`);

  ensureResultsDir();

  let results: TestResult[] = [];

  switch (testType) {
    case 'unit':
      results.push(await runUnitTests());
      break;
    case 'integration':
      results.push(await runIntegrationTests());
      break;
    case 'perf':
    case 'performance':
      results.push(await runPerformanceTests());
      break;
    case 'visual':
      results.push(await runVisualTests());
      break;
    case 'all':
    default:
      results = await runAllTests();
      break;
  }

  const summary = generateSummary(results);
  printSummary(summary);
  saveSummary(summary);

  // Exit with error if any tests failed
  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

