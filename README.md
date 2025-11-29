# Play Engine

**Production-grade WebGPU/TypeScript game engine with modular architecture**

---

## 🎯 Overview

Play Engine is a modern, open-source 3D game engine built from the ground up with WebGPU and TypeScript. It features a complete modular monorepo architecture, comprehensive testing, and a professional 3D scene editor - all running directly in your browser.

**Key Features:**
- ⚡ WebGPU-powered rendering with PBR materials and shadows
- 🏗️ ECS architecture with physics simulation
- 🎮 Professional 3D scene editor
- 🧩 Visual scripting with LogicCubes
- 🌐 Multiplayer networking support
- 📦 Modular package architecture

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (with npm)
- **pnpm** 8+ (`npm install -g pnpm`)
- **WebGPU-compatible browser** (Chrome/Edge 113+, Firefox Nightly, Safari Technology Preview)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run editor in development mode
pnpm dev
```

### Development Commands

```bash
pnpm dev              # Run editor with hot reload
pnpm test:watch       # Run tests in watch mode (recommended)
pnpm test:changed     # Run only changed tests (fast)
pnpm test:coverage    # Generate coverage report
pnpm lint             # Run linter
```

---

## 📦 Project Structure

```
play-engine/
├── packages/          # Engine packages (@engine/*)
│   ├── core/         # Foundation (math, ECS, events)
│   ├── world/        # ECS runtime, physics
│   ├── gfx-webgpu/   # WebGPU renderer
│   ├── script/       # Visual scripting (LogicCubes)
│   ├── stdlib/       # Standard library (animation, audio, character)
│   ├── input/        # Input management
│   ├── camera/       # Camera systems
│   ├── editor-utils/ # Editor utilities (history, snap)
│   ├── test-utils/   # Test utilities (mocks, fixtures)
│   ├── animation/    # Animation system
│   ├── avatar/       # Avatar and character system
│   ├── blocks/       # Block building system
│   ├── brand/        # Branding assets
│   ├── economy/      # Economy and virtual currency system
│   ├── gateway/      # API gateway and rate limiting
│   ├── microblocks/  # Microblock voxel system
│   ├── net/          # Client-side networking
│   ├── net-protocol/ # Network protocol definitions
│   ├── net-server/   # Server-side networking engine
│   ├── voxel/        # Voxel rendering and management
│   ├── wasm-collision/ # WASM collision detection
│   ├── world-server/ # Server-side world management
│   └── world-templates/ # World template system
├── apps/              # Applications
│   ├── editor/        # 3D scene editor
│   ├── player/        # Game player client
│   ├── platform/      # Platform web UI
│   ├── net-server/    # Network/API server
│   └── collab-server/ # Real-time collaboration server
└── docs/              # Documentation
```

---

## 📚 Core Packages

### @engine/core
**Foundation layer** - Core utilities, math, ECS types, event system
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

### @engine/script
**Visual scripting** - LogicCubes drag-and-drop system
- 40+ built-in cube types
- Triggers, actions, conditions, and logic gates
- Runtime execution with coroutines

### @engine/net
**Multiplayer networking** - Real-time synchronization (client-side)
- WebSocket-based networking
- Entity synchronization
- Zone and session management

### @engine/avatar
**Avatar system** - Character customization and management
- Avatar builder with body parts
- Character rigging and animation
- Customization system

### @engine/animation
**Animation system** - Advanced animation runtime
- Skeletal animation with skinning
- Animation blending and transitions
- GLTF animation support

### @engine/economy
**Virtual economy** - Currency and transactions
- Virtual currency system
- Marketplace integration
- Transaction management

### @engine/voxel
**Voxel system** - Voxel rendering and world generation
- Chunk-based voxel rendering
- Block placement and modification
- Terrain generation

### @engine/microblocks
**Microblocks** - Fine-grained voxel building
- Sub-block precision building
- Advanced placement tools

### @engine/blocks
**Block system** - Block definitions and model generation
- Block library and palettes
- Procedural model generation

### @engine/world-templates
**World templates** - Pre-built world configurations
- Template system for common scenarios
- Serialization and loading

### @engine/net-server
**Server networking** - Server-side networking engine
- Session management
- World synchronization
- Zone management

### @engine/world-server
**Server world** - Server-side world simulation
- Headless physics simulation
- Server-side entity management

### @engine/net-protocol
**Network protocol** - Shared protocol definitions
- Message types and serialization
- Protocol versioning

### @engine/gateway
**API Gateway** - Rate limiting and API management
- Token-based authentication
- Rate limiting
- Service registry

### @engine/brand
**Branding** - Project branding assets
- Logo and visual identity
- Brand colors and typography

---

## 🧪 Testing

The project includes comprehensive test automation:

```bash
# Watch mode (recommended)
pnpm test:watch

# Run only changed files
pnpm test:changed

# Full coverage report
pnpm test:coverage

# Quick unit tests
pnpm test:unit:fast
```

**Features:**
- ✅ CI/CD pipeline with GitHub Actions
- ✅ Pre-commit hooks for linting & testing
- ✅ Coverage tracking (60%+ threshold)
- ✅ Reusable test utilities (`@engine/test-utils`)
- ✅ Snapshot testing

**Documentation:**
- [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md) - Command reference
- [docs/TESTING.md](docs/testing/TESTING.md) - Testing philosophy
- [docs/TESTING_AUTOMATION.md](docs/testing/TESTING_AUTOMATION.md) - Full guide

---

## 🎮 Applications

### @apps/editor
**3D Scene Editor** - Professional editor for building 3D worlds
- Visual scene editing
- Block placement system
- LogicCubes visual scripting
- Animation timeline
- Play mode testing

### @apps/player
**Game Player** - Client application for playing games
- Multiplayer support
- Real-time synchronization
- Input handling and controls
- Save system and checkpoints
- Performance monitoring

### @apps/platform
**Platform Web UI** - Web interface for the platform
- User dashboard
- Game browser and launcher
- Studio and project management
- Marketplace
- Social features (friends, chat)

### @apps/net-server
**Network & API Server** - Backend server for the platform
- RESTful API
- Authentication and authorization
- Database management (Prisma)
- WebSocket support
- Asset storage

### @apps/collab-server
**Collaboration Server** - Real-time collaboration for multiplayer
- WebRTC signaling
- Room management
- Real-time state synchronization

---

## 📖 Documentation

### For AI Assistants

📖 **[AI_FILES_INDEX.md](AI_FILES_INDEX.md)** - Start here to find the right documentation

- **[AI_CONTEXT.md](AI_CONTEXT.md)** - Complete project context (15 min read)
- **[CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md)** - Design patterns and conventions
- **[QUICK_START_AI.md](QUICK_START_AI.md)** - Quick reference (2 min read)
- **[.cursorrules](.cursorrules)** - Cursor IDE rules (auto-loaded)

### For Developers

- **[docs/guidelines/TEAM_ONBOARDING.md](docs/guidelines/TEAM_ONBOARDING.md)** - New developers start here
- **[docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md)** - Where code belongs
- **[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)** - System architecture
- **[docs/testing/TESTING.md](docs/testing/TESTING.md)** - Testing philosophy
- **[docs/performance/PERFORMANCE.md](docs/performance/PERFORMANCE.md)** - Performance guidelines

---

## 🛠️ Technology Stack

- **WebGPU** - Modern GPU API
- **TypeScript** 5.9 (strict mode)
- **pnpm** - Fast package manager
- **Vite** - Build tool
- **Vitest** - Unit testing
- **gl-matrix** - 3D math library
- **@gltf-transform** - GLTF processing

---

## 📋 Development Guidelines

### Import Policy

```typescript
// ✅ ALWAYS use @engine/* aliases
import { Vec3 } from '@engine/core';
import { Scene } from '@engine/world';

// ❌ NEVER use relative paths for packages
import { Vec3 } from '../../../packages/core/src/...';
```

### Code Style

- **TypeScript strict mode** - No `any` without justification comment
- **Functional patterns** - Prefer composition over inheritance
- **async/await** over raw Promises
- **Small functions** (<50 lines ideally)
- **Performance-first** - Question every allocation in hot paths

### Package Boundaries

- ✅ Reusable logic → `packages/`
- ✅ App UI/UX → `apps/`
- ✅ Lower-level → Higher-level (core → world → gfx-webgpu)
- ❌ No circular dependencies
- ❌ No package code duplication in apps

See **[docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md)** for decision tree.

---

## 🔧 Building WASM

The project uses Rust-compiled WebAssembly for high-performance collision detection.

### Prerequisites

1. **Install Rust**: [rustup.rs](https://rustup.rs/)
2. **Install wasm-pack**: [wasm-pack installer](https://rustwasm.github.io/wasm-pack/installer/)
3. **Add wasm32 target**: `rustup target add wasm32-unknown-unknown`

### Building

```bash
# Build WASM from root
pnpm build:wasm

# Or build from package
cd packages/wasm-collision
pnpm build:wasm && pnpm build:ts
```

**Note:** Pre-built WASM is included in `packages/wasm-collision/pkg/` so development can continue without Rust if needed.

---

## 🤝 Contributing

This project follows professional development practices:

1. **Code in English**, comments in Polish or English
2. **Test behavior**, not implementation
3. **Performance mindset** - question every allocation
4. **TypeScript strict mode** - no `any` without justification
5. **Always cleanup** - dispose() methods, remove listeners

**Want to contribute?**
- 🐛 Report bugs or suggest features
- 💻 Submit pull requests
- 📖 Improve documentation
- 🎨 Design assets and UI improvements

---

## 📝 License

ISC

---

## 🎮 Why Play Engine?

- **⚡ Built for performance** - WebGPU-powered, browser-native
- **🏗️ Ready to scale** - From prototypes to production-ready games
- **🌐 No barriers** - Create anywhere, share instantly, play everywhere

---

**Built with ❤️**

