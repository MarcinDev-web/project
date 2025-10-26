# UGC 3D Platform

**Modular WebGPU/TypeScript game engine** for UGC platforms with professional scene editor.

## 🎯 Overview

A production-grade 3D engine built from the ground up with modern web technologies, featuring a complete modular architecture, comprehensive testing, and a professional editor.

## 🏗️ Architecture

This project follows a **modular monorepo architecture** with clear separation between engine packages and applications.

```
ugc-3d-platform/
├── packages/           # Engine modules (@engine/*)
│   ├── core/          # Foundation (math, ECS, event, job)
│   ├── world/         # ECS runtime (entities, components, systems)
│   ├── gfx-webgpu/    # WebGPU renderer
│   ├── assets/        # Asset loading & streaming
│   ├── script/        # UGC scripting (LogicCubes)
│   ├── input/         # Input management
│   ├── camera/        # Camera systems
│   └── stdlib/        # Standard library (animation, audio, character)
├── apps/              # Applications
│   ├── editor/        # Professional 3D scene editor
│   └── playground/    # Demo/sandbox (future)
└── docs/              # Documentation
```

## 📦 Engine Packages

### @engine/core
**Foundation layer** - Core utilities, math, ECS types, event system, job scheduler
- High-performance 3D math (Vec3, Mat4, Quat, AABB, Ray)
- ECS base types and interfaces
- Event bus for pub/sub messaging
- Job system for async task scheduling

### @engine/world
**ECS runtime** - Entity-component-system, scene graph, physics
- Complete ECS implementation
- Scene management and serialization
- Physics simulation (collision detection, rigid bodies, joints)
- Components: Transform, Mesh, Material, Light, Camera, Physics, etc.

### @engine/gfx-webgpu
**WebGPU renderer** - Modern GPU-accelerated graphics
- Forward+ rendering pipeline
- PBR materials with texture support
- Shadow mapping (cascaded + point light shadows)
- Post-processing effects (bloom, tone mapping)
- Texture atlas system (100x bind call reduction)

### @engine/assets
**Asset management** - Loading, caching, and streaming
- GLTF/GLB model loading
- Texture management
- Asset registry and library system
- Recent assets tracking

### @engine/script
**UGC scripting** - Visual scripting with LogicCubes
- LogicCube system (triggers, actions, conditions, data, gates)
- Behavior system
- Coroutine scheduler
- Logic connections and variable storage

### @engine/input
**Input management** - Keyboard, mouse, gamepad
- Input context system
- Character input handling
- Configurable bindings

### @engine/camera
**Camera systems** - Orbit, FPS, and director
- Orbit camera for editor
- FPS camera for play mode
- Camera director for mode switching

### @engine/stdlib
**Standard library** - Common gameplay systems
- Animation system with state machines
- Audio system
- Character controller
- Player session management

## 🎨 Applications

### Editor (@apps/editor)
Professional 3D scene editor with:
- ✨ Modern glassmorphic UI with smooth animations
- 🏗️ Block placement system (Minecraft-style)
- 🎯 Snap-to-grid with visual 3D grid
- 🎮 Play mode with FPS controls
- 📝 Undo/redo history
- 🔧 Logic cubes visual scripting
- 🎬 Animation editor
- 💡 Lighting and environment settings
- 📦 Asset browser and management

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (with npm)
- **pnpm** 8+ (install with `npm install -g pnpm`)
- **WebGPU-compatible browser**:
  - Chrome/Edge 113+
  - Firefox Nightly with WebGPU enabled
  - Safari Technology Preview

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

```bash
# Run editor in dev mode (with hot reload)
pnpm dev

# Or explicitly
pnpm dev:editor

# Build editor for production
pnpm build:editor

# Run all tests
pnpm test

# Run linter
pnpm lint
```

### Working with Packages

```bash
# Build a specific package
cd packages/core
pnpm build

# Run tests for a specific package
cd packages/world
pnpm test

# Watch mode for development
cd packages/gfx-webgpu
pnpm dev
```

## 🧪 Testing

The project has comprehensive test coverage:

```bash
# Run all tests
pnpm test

# Run tests in specific packages
pnpm --filter @engine/core test
pnpm --filter @engine/assets test

# Run editor tests
pnpm --filter @apps/editor test
```

## 📖 Documentation

Detailed documentation available in the `docs/` directory:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) - Migration to modular architecture
- [MODULE_SPECIFICATIONS.md](docs/MODULE_SPECIFICATIONS.md) - Package specifications
- [TESTING.md](docs/TESTING.md) - Testing philosophy and guidelines
- [PERFORMANCE_PHILOSOPHY.md](docs/PERFORMANCE_PHILOSOPHY.md) - Performance guidelines
- [**🔴 EDITOR-PACKAGES ANALYSIS**](docs/editor-analysis/README.md) - **Critical: Code duplication issues**

## 🎯 Key Features

### WebGPU Rendering
- Modern GPU API with high performance
- PBR materials and lighting
- Shadow mapping and post-processing
- Texture atlas optimization

### ECS Architecture
- Clean entity-component-system design
- Efficient spatial queries
- Physics integration
- Serialization support

### Visual Scripting
- LogicCubes drag-and-drop system
- 40+ built-in cube types
- Triggers, actions, conditions, and logic gates
- Runtime execution with coroutines

### Professional Editor
- Modern UI with glassmorphism design
- Block placement with snap-to-grid
- Full play mode with character controller
- History system (undo/redo)
- Asset management

## 🛠️ Technology Stack

- **WebGPU** - Modern GPU API
- **TypeScript** - Type-safe development
- **pnpm** - Fast, efficient package manager
- **Vite** - Next-generation build tool
- **Vitest** - Fast unit testing
- **gl-matrix** - High-performance 3D math
- **@gltf-transform** - GLTF processing

## 🔮 Roadmap

- [ ] **@engine/voxel** - Voxel/microblock system
- [ ] **@engine/net** - Multiplayer networking
- [ ] **apps/playground** - Demo application
- [ ] Advanced terrain system
- [ ] Procedural generation tools
- [ ] Mobile support

## 🤝 Contributing

This project follows professional development practices:

1. **Code in English**, comments in Polish (or English)
2. **Test behavior**, not implementation
3. **Performance mindset** - question every allocation
4. **TypeScript strict mode** - no `any` without justification
5. **Functional components** and modern patterns

## 📝 License

ISC

## 🎓 Learning Resources

Check the `examples/` directory for sample projects and tutorials demonstrating:
- Basic engine usage
- LogicCubes scripting
- Custom component creation
- Renderer integration

---

**Built with ❤️ using modern web technologies**

*Migration to modular architecture completed: Phases 0-8 ✅*
