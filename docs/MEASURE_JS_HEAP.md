### JS Heap Baseline and Allocation Sampling

This guide shows how to capture a CPU-side (JS heap) baseline and perform allocation sampling.

Scope: JS heap only (no GPU/VRAM). For VRAM, see `packages/gfx-webgpu/src/core/GPUMemoryTracker.ts` docs.

---

#### 1) Quick Node baseline (headless)

Run a typical scene in Node and record heap after GC.

Requirements: Node 18+ with `--expose-gc`.

Commands:

```bash
pnpm run measure:heap
# or with explicit params
pnpm run measure:heap -- --duration=60 --entities=1000 --interval=10
```

What it does:
- Builds a `Scene` with N entities from `@engine/world`, runs a light 60s simulation.
- Forces GC at checkpoints and prints `heapUsed` deltas.

Record these numbers:
- Baseline (before)
- After create (post-GC)
- Checkpoints (post-GC)
- Final (post-GC) and Delta vs baseline

---

#### 2) Chrome DevTools Allocation Sampling (recommended)

1. Start the editor: `pnpm dev:editor`
2. Open the app in Chrome and load a representative scene.
3. DevTools → Performance → enable "Memory" and "Allocation sampling".
4. Record for 60 seconds during typical usage.
5. Stop and:
   - Inspect Top-down and by Constructor
   - Save screenshot or export profile
6. Run GC (trash icon) and confirm heap stabilizes (no steady growth for 5 minutes).

Capture:
- Peak heap, steady-state heap after GC
- Top allocators (constructors), especially per-frame churn

---

#### 3) Store results

Create a short note in `docs/PERFORMANCE_OPTIMIZATIONS.md` with:
- Date, commit hash
- Scenario summary
- Numbers from Node baseline and Chrome profile
- Top offenders (constructors) to target next

---

Troubleshooting:
- If `global.gc` is missing, ensure you used `--expose-gc`.
- If imports fail in the Node script, run `pnpm -r build` to ensure packages are built.


