# Editor UI Components

To handle the complexity of the editor UI, components are grouped by their role and scope.

## Directory Structure

### 📂 `shared/`
Generic, reusable UI components that are not specific to a single feature.
- *Inputs*: `ColorPicker.ts`, `VectorInput.ts`, `DragNumberInput.ts`
- *Feedback*: `Toast.ts`, `Tooltip.ts`, `SkeletonLoader.ts`
- *Lists*: `VirtualList.ts`

### 📂 `layout/`
High-level layout components that structure the editor screen.
- `EditorUILayout.ts`
- `EditorToolbar.ts`
- `SidebarTabs.ts`
- `ResizableSidebar.ts`
- `FloatingToolbar.ts`
- `BrandWatermark.ts`

### 📂 `modals/`
Self-contained dialogs and modals.
- `SaveProjectDialog.ts`, `LoadProjectDialog.ts`
- `LoginModal.ts`, `RegisterModal.ts`
- `TemplatePickerModal.ts`
- `KeyboardShortcutsModal.ts`
- ...

### 📂 `features/`
Complex UI widgets specific to editor features.
- `AssetPalette.ts`
- `ScriptWorkbench.ts`
- `MovementProfileSelector.ts`
- `UnifiedBuildPanel.ts`
- `CustomProfileEditor.ts`

### 📂 `hud/`
Overlays and heads-up display elements.
- `WeaponHUD.ts`
- `PauseMenu.ts`
- `BuildStats.ts`
- `LoadingOverlay.ts`

### 📂 `onboarding/`
Tutorials and welcome screens.
- `InteractiveTutorial.ts`
- `QuickStartGuide.ts`
- `WelcomeOverlay.ts`

### 📂 `system/`
UI Managers and top-level controllers.
- `AdaptiveUIManager.ts`
- `PlacementCoordinator.ts`

## Rules
1. **Atomic Design**: Prefer small, reusable components in `shared/`.
2. **No Business Logic**: UI components should primarily handle display and user input. Complex logic belongs in Managers or Systems.
3. **Styling**: CSS should be co-located or imported from `src/styles/`.
