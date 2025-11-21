# Editor Panels Structure

To prevent "spaghetti code" and maintain a clean architecture, panels are organized by their domain.

## Directory Structure

### 📂 `core/`
Base classes and managers for the panel system.
- `EditorPanelManager.ts`
- `UIPanel.ts`

### 📂 `scene/`
Panels that inspect or modify the scene structure and properties.
- `LayersPanel.ts`
- `PropertiesPanel.ts`
- `HistoryPanel.ts`
- `BookmarksPanel.ts`
- `RenderSettingsPanel.ts`

### 📂 `gameplay/`
Panels related to gameplay logic and systems.
- `LogicPanel.ts`
- `EconomyPanel.ts`
- `NpcPanel.ts`
- `WeaponPanel.ts`
- `VegetationPanel.ts`

### 📂 `content/`
Panels for discovering or creating assets.
- `MarketplacePanel.ts`
- `TemplateGalleryPanel.ts`
- `ModelBuilderPanel.ts`

### 📂 `settings/`
Global editor configuration.
- `SettingsPanel.ts`
- `QuickActionsPanel.ts`

## Rules
1. **One Panel Per File**: Each panel should be in its own file.
2. **Strict Typing**: All panels must extend `UIPanel` or implement the panel interface.
3. **Lazy Loading**: Panels should be lazy-loaded where possible to improve startup time.
4. **Tests**: Unit tests should be co-located in `__tests__` mirroring the structure.
