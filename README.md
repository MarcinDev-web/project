# UGC 3D Platform

**Modular WebGPU/TypeScript game engine** for UGC platforms with professional scene editor.

> **🤖 For AI Assistants (Claude 4.5 Sonnet, GPT-5):** Start with **[AI_CONTEXT.md](AI_CONTEXT.md)** for comprehensive context, patterns, and conventions. Also see **[CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md)** for design patterns used throughout the project.

## 🎯 Overview

A production-grade 3D engine built from the ground up with modern web technologies, featuring a complete modular architecture, comprehensive testing, and a professional editor.

## 🏗️ Architecture

This project follows a **modular monorepo architecture** with clear separation between engine packages and applications.

```
ugc-3d-platform/
├── packages/           # Engine modules (@engine/*)
│   ├── core/          # Foundation (math, ECS, event, job, utils)
│   ├── world/         # ECS runtime (entities, components, systems)
│   ├── gfx-webgpu/    # WebGPU renderer
│   ├── script/        # UGC scripting (LogicCubes)
│   ├── input/         # Input management
│   ├── camera/        # Camera systems
│   ├── stdlib/        # Standard library (animation, audio, character)
│   ├── editor-utils/  # Editor tools (history, snap) [NEW Oct 2025]
│   └── test-utils/    # Test utilities (mocks, fixtures, assertions)
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

### @engine/test-utils
**Test utilities** - Reusable testing tools
- Mock implementations (Canvas, WebGPU, etc.)
- Entity fixtures for tests
- Custom assertions (Vec3, AABB, etc.)
- Async test helpers (waitFor, etc.)
- Snapshot testing utilities

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

### @engine/editor-utils
**Editor utilities** - Reusable tools for building editors (NEW - Oct 2025)
- History manager (undo/redo system)
- Snap system (grid snapping)
- Entity path helpers

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

The project has comprehensive test automation with CI/CD, pre-commit hooks, coverage tracking, and reusable test utilities.

### Quick Start

```bash
# Setup test environment (first time)
.\scripts\setup-tests.ps1  # Windows
# or
pnpm install && pnpm prepare  # Linux/Mac

# Watch mode (recommended for development)
pnpm test:watch

# Run only changed tests (fast!)
pnpm test:changed

# Full coverage report
pnpm test:coverage
open coverage/index.html
```

### Test Automation Features

✅ **CI/CD Pipeline** - GitHub Actions with test sharding (4 parallel jobs)  
✅ **Pre-commit Hooks** - Automatic linting & testing before commit  
✅ **Coverage Tracking** - Codecov integration with PR comments (60% threshold)  
✅ **Test Utilities** - Reusable mocks, fixtures, assertions (`@engine/test-utils`)  
✅ **Snapshot Testing** - Serialization stability verification  
✅ **VSCode Integration** - Debug configs, tasks, test explorer  

### Available Commands

```bash
# Development
pnpm test:watch         # Watch mode with instant feedback (1-3s)
pnpm test:changed       # Only changed files (2-5s)
pnpm test:unit:fast     # Quick run without coverage (~8s)
pnpm test:ui            # Visual test runner

# Coverage
pnpm test:coverage      # Full coverage report
pnpm test:unit:coverage # Unit tests only

# CI/Debugging
pnpm test:ci            # Optimized for CI
pnpm test:affected      # Bail on first failure
pnpm test              # All tests (unit + integration)
```

### Using Test Utilities

```typescript
import { 
  createMockCanvas,
  entityFixtures,
  expectVec3ToBeCloseTo,
  waitFor 
} from '@engine/test-utils';

test('example', async () => {
  const canvas = createMockCanvas(800, 600);
  const entity = entityFixtures.withTransform();
  
  await waitFor(() => entity.isReady, 5000);
  expectVec3ToBeCloseTo(entity.position, [1, 2, 3]);
});
```

### Documentation

- **Quick Start**: [QUICK_START_TESTING.md](QUICK_START_TESTING.md)
- **Full Guide**: [docs/TESTING_AUTOMATION.md](docs/TESTING_AUTOMATION.md)
- **Commands Cheatsheet**: [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md)
- **Test Utils API**: [packages/test-utils/README.md](packages/test-utils/README.md)
- **Philosophy**: [docs/TESTING.md](docs/TESTING.md)

## 📦 Package Organization

**Monorepo Structure:**
- **packages/** (@engine/*) - Shared, reusable code
- **apps/** - Applications (editor, playground)

**Key Rules:**
- ✅ Reusable logic → `packages/`
- ✅ App UI/UX → `apps/`
- ✅ Always import: `@engine/package-name`
- ❌ Never duplicate package code in apps

**See:** [PACKAGE_GUIDELINES.md](docs/PACKAGE_GUIDELINES.md) for decision tree and examples.

**Recent:** Oct 2025 refactoring eliminated 6 major duplicates (-1823 lines), created `@engine/editor-utils` package, and achieved 100% import consistency.

## 📖 Documentation

### 🤖 For AI Assistants

📖 **[AI_FILES_INDEX.md](AI_FILES_INDEX.md)** - **Which file should I read? Start here!**

- **[AI_CONTEXT.md](AI_CONTEXT.md)** - **START HERE** - Comprehensive guide for AI coding assistants (Claude, GPT)
- **[CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md)** - Design patterns, idioms, and conventions
- **[AI_PROMPTS.md](AI_PROMPTS.md)** - Example prompts and workflows for AI-assisted development
- **[QUICK_START_AI.md](QUICK_START_AI.md)** - ⚡ 2-minute quick reference
- **[.cursorrules](.cursorrules)** - Cursor IDE rules (auto-loaded)
- **[AI_DOCUMENTATION_CHANGELOG.md](AI_DOCUMENTATION_CHANGELOG.md)** - Documentation changes and improvements

### For Developers

Detailed documentation available in the `docs/` directory:

- [**docs/guidelines/TEAM_ONBOARDING.md**](docs/guidelines/TEAM_ONBOARDING.md) - **New developers start here**
- [**docs/guidelines/PACKAGE_GUIDELINES.md**](docs/guidelines/PACKAGE_GUIDELINES.md) - **Where code belongs (Must Read)**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/guidelines/CODE_REVIEW_CHECKLIST.md](docs/guidelines/CODE_REVIEW_CHECKLIST.md) - PR review checklist
- [docs/TESTING.md](docs/TESTING.md) - Testing philosophy and guidelines
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) - Performance guidelines
- [docs/refactoring/REFACTORING_COMPLETE.md](docs/refactoring/REFACTORING_COMPLETE.md) - Recent refactoring (Oct 2025)
- [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md) - Testing commands reference

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup test environment (first time)
.\scripts\setup-tests.ps1  # Windows
# or
pnpm install && pnpm prepare  # Linux/Mac

# Development
pnpm dev

# Testing
pnpm test:watch  # Watch mode (recommended)
pnpm test:changed  # Only changed files
pnpm test:coverage  # With coverage report
```

## Testing

**Quick Start**: [QUICK_START_TESTING.md](QUICK_START_TESTING.md)

**Full Guide**: [docs/TESTING_AUTOMATION.md](docs/TESTING_AUTOMATION.md)

**Commands**: [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md)

### Test Automation Features

✅ **CI/CD Pipeline** - GitHub Actions with test sharding  
✅ **Pre-commit Hooks** - Automatic linting & testing  
✅ **Coverage Tracking** - Codecov integration with PR comments  
✅ **Test Utilities** - Reusable mocks, fixtures, assertions (@engine/test-utils)  
✅ **Snapshot Testing** - Serialization stability  
✅ **VSCode Integration** - Debug configs, tasks, test explorer  

## Documentation

- [Testing Automation](docs/TESTING_AUTOMATION.md) - Full testing guide
- [Architecture](docs/ARCHITECTURE.md) - System architecture
- [Testing Philosophy](docs/TESTING.md) - Testing principles
- [Quick Fix Guide](docs/QUICK_FIX_GUIDE.md) - Common issues

## Development

```bash
# Watch mode with live test feedback
pnpm test:watch  # Terminal 1
pnpm dev         # Terminal 2

# Before commit (automatic via pre-commit hook)
pnpm test:changed

# Coverage report
pnpm test:coverage
open coverage/index.html
```

## CI/CD

- **Automatic testing** on every PR/push
- **Test sharding** (4 parallel jobs) for faster CI
- **Coverage reports** with PR comments
- **Build artifacts** preserved for 7 days

See [TEST_AUTOMATION_IMPROVEMENTS.md](TEST_AUTOMATION_IMPROVEMENTS.md) for details.

README.md) - **Critical: Code duplication issues**

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
