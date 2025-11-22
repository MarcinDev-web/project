# Benchmarking Guide

Guide for measuring and analyzing performance in Forge Engine.

## Tools

### 1. Scripts

The project includes several scripts for performance analysis:

- `pnpm measure:heap`: Measure JS heap memory usage in a headless environment.
- `pnpm verify:cost`: Analyze bundle size and impact.
- `scripts/benchmark/`: Directory containing specific benchmark scenarios.

### 2. Runtime Profiling

Use the browser's Performance tab to profile running applications.
- **Record**: Capture a trace during gameplay.
- **Analyze**: Look for long tasks in the main thread.
- **User Timing**: The engine emits `performance.mark` events for key systems.

## How to Benchmark

### CPU Performance

1. Run `pnpm start` to launch the editor/player.
2. Open DevTools > Performance.
3. Record a 10-second clip of gameplay.
4. Check "Frame Time" graph. Target is < 16ms (60fps).

### Memory Usage

1. Run `pnpm measure:heap` to get a baseline.
2. In browser, use Memory tab > Take Heap Snapshot.
3. Look for detached DOM elements or leaking event listeners.

### GPU Performance

1. Use WebGPU debug tools (e.g., PIX on Windows, Xcode on macOS).
2. Monitor `GPUDevice.queue.submit` times.
3. Check number of draw calls (batching is critical).

## Reporting Results

When sharing benchmark results, include:
- Hardware specs (CPU, GPU, RAM).
- Browser version.
- Steps to reproduce the scenario.
- Before/After metrics (if optimizing).

