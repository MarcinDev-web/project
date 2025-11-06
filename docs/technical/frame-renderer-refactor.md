# FrameRenderer Refactor Notes

This refactor breaks the monolithic render loop into focused collaborators:

- `FrameTargetManager` owns HDR/MSAA/SSAO render-target lifecycles and deferred texture cleanup.
- `PostProcessPipeline` encapsulates normal/SSAO/Bloom/Tonemap/FXAA sequencing with depth resolve.
- `CustomGeometryRenderer` batches per-entity mesh overrides without fighting the static bundle path.
- `InstanceBufferUtils` centralises instancing uploads and buffer-pool reuse.

## Smoke Checklist

Run these manual checks in a WebGPU-capable build to validate the new structure:

1. Toggle each feature flag (`HDR`, `Bloom`, `SSAO`, `FXAA`, `ForwardPlus`, `ScreenLOD`, `ComputePrepass`, `Shadows`) individually and verify the frame renders without warnings.
2. Resize the canvas repeatedly (fullscreen <-> windowed) and confirm depth/normal/SSAO targets stay in sync without console garbage-collection warnings.
3. Spawn at least one custom-geometry entity and ensure transparency sorting still matches expectations (check overlay pass too).
4. Capture GPU timings and confirm timestamps populate for frame/compute/bloom/tonemap segments via `onGpuTimings`.
5. Disable shadows and verify the `onShadowMetrics` callback stops firing while the rest of the frame continues.

Document outcomes in the project journal so regressions are traceable.
