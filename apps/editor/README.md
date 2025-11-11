# Editor

**Professional 3D Scene Editor** - WebGPU-powered editor for UGC platform.

## Funkcje

- ✨ Modern UI/UX (glassmorphism, animations)
- 🎨 Asset browser & management
- 🏗️ Scene hierarchy & properties
- 🎮 Play mode state machine
- 📦 Block placement & building
- 🔧 Logic cubes (visual scripting)
- 🌍 Environment settings
- 💡 Lighting & shadows
- 🎬 Animation editor

## Technologie

- **Vanilla TypeScript** - Pure TS bez frameworku UI
- **@preact/signals-core** - Reactive state management
- **Custom CSS** - Modern glassmorphic styling
- **WebGPU** - 3D rendering
- **Vite** - Build tool i dev server

## Dependencies

- `@engine/core`
- `@engine/world`
- `@engine/gfx-webgpu`
- `@engine/assets`
- `@engine/script`
- `@engine/input`
- `@engine/camera`
- `@engine/stdlib`

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build
```

## Status

🚧 **W budowie** - Docelowa lokalizacja editora po migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

## Architecture Notes

### Headless Systems

Some systems in `editor/systems/` are **headless** - they operate without UI integration:

- **CheckpointSystem** - Manages checkpoint activation/respawn during play mode
- **SpawnPointSystem** - Finds spawn locations for player initialization

These systems are used internally by play mode logic (`EditorModeManager`, `PlayIntroState`) but are not exposed to editor UI panels. They're runtime systems, not editor UI components.

**UI Boundary:** Systems in `editor/systems/` are for runtime logic. UI components belong in `editor/ui/` and `editor/panels/`.

