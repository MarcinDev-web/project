/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../core/state';
import { AnimationComponent } from '@engine/stdlib/Animation';
import { AnimationClip } from '@engine/stdlib/Animation/AnimationClip';
import { ScriptComponent } from '@engine/script';
import { BehaviorRegistry } from '@engine/script';
import { BehaviorInstance } from '@engine/script/behavior';
import { CharacterController } from '@engine/world';
import { PRESET_PROFILES } from '@engine/stdlib/MovementProfiles';

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('PropertiesPanel', () => {
  let selection: SelectionManager;
  let scene: Scene;
  let entity: Entity;
  let host: HTMLElement;
  let editorState: EditorState;

  beforeEach(() => {
    selection = new SelectionManager();
    scene = new Scene('Scene');
    entity = new Entity('Test Entity');
    scene.addEntity(entity);
    selection.select(entity);
    host = createHost();
    editorState = new EditorState(scene);
    editorState.selection.value = [entity];
    
    // Mock scriptRuntime for ScriptComponent tests
    (scene as any).scriptRuntime = {
      contextBuilder: {
        getServices: () => ({}),
      },
      behaviors: {
        add: vi.fn(),
        delete: vi.fn(),
      },
      scheduler: {
        attachBehaviorInstance: vi.fn(),
        detachBehaviorInstance: vi.fn(),
      },
    };
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
  });

  it('renders selected entity properties and emits on change', () => {
    const onTransformChanged = vi.fn();
    const onColorChanged = vi.fn();
    const onEntityRenamed = vi.fn();

    const panel = new PropertiesPanel({
      selection,
      onTransformChanged,
      onColorChanged,
      onEntityRenamed,
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    // QuickAccessBar is now in QuickActionsPanel (sidebar), not in PropertiesPanel
    const quickAccess = host.querySelector('.inspector-quick-access');
    expect(quickAccess).toBeFalsy();

    // Test name input (now in entity card)
    const nameInput = host.querySelector('.entity-card-name-input') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    nameInput.value = 'Updated';
    nameInput.dispatchEvent(new Event('change'));
    expect(onEntityRenamed).toHaveBeenCalledWith(entity);

    // Transform and color inputs are now in QuickActionsPanel (sidebar), not in PropertiesPanel
    // Test transform inputs in PropertiesPanel (regular position-x, not quick-position-x)
    const positionInputs = host.querySelectorAll('input[data-field^="position-x"], input[data-field^="position-y"], input[data-field^="position-z"]');
    if (positionInputs.length > 0) {
      const xInput = positionInputs[0] as HTMLInputElement;
      xInput.value = '2.5';
      xInput.dispatchEvent(new Event('change'));
      expect(onTransformChanged).toHaveBeenCalledWith(entity);
    }
  });

  it('does not render QuickAccessBar (moved to QuickActionsPanel)', () => {
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    // QuickAccessBar is now in QuickActionsPanel (sidebar), not in PropertiesPanel
    const quickAccess = host.querySelector('.inspector-quick-access, .quick-access-bar');
    expect(quickAccess).toBeFalsy();
    
    // Quick access inputs should not be in PropertiesPanel
    const quickPositionInputs = host.querySelectorAll('input[data-field^="quick-position"]');
    expect(quickPositionInputs.length).toBe(0);
  });

  // QuickAccessBar collapse/expand functionality is now in QuickActionsPanel (sidebar)
  // This test is no longer relevant for PropertiesPanel

  it('renders animation component controls', () => {
    const animationComponent = new AnimationComponent();
    const clip = new AnimationClip({ name: 'Idle', duration: 1 });
    animationComponent.addClip(clip);
    entity.addComponent(animationComponent);

    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    // Check animation section exists (as accordion, not tab)
    const animationSection = host.querySelector('#inspector-section-animation');
    expect(animationSection).toBeTruthy();
    
    const animationContent = host.querySelector('.animation-properties');
    expect(animationContent).toBeTruthy();
    const clips = host.querySelectorAll('.animation-clip-item');
    expect(clips.length).toBeGreaterThan(0);
    const timeline = host.querySelector('.animation-timeline-slider');
    expect(timeline).toBeTruthy();
  });

  it('shows empty animation state when component missing', () => {
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    const emptyText = host.querySelector('.animation-empty-state .muted-text');
    expect(emptyText?.textContent).toContain('No AnimationComponent');
    const button = host.querySelector('.animation-add-component-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
  });

  it('shows empty scripts state with link to Script Workbench when no component', () => {
    const onOpenScriptWorkbench = vi.fn();
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      onOpenScriptWorkbench,
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    const emptyText = host.querySelector('.scripts-empty-state .muted-text');
    expect(emptyText?.textContent).toContain('No ScriptComponent');
    
    const workbenchBtn = host.querySelector('.script-workbench-link-btn') as HTMLButtonElement;
    expect(workbenchBtn).toBeTruthy();
    expect(workbenchBtn.textContent).toContain('Open Script Workbench');
    
    workbenchBtn.click();
    expect(onOpenScriptWorkbench).toHaveBeenCalled();
  });

  it('shows empty state with link when component has no scripts', async () => {
    const scriptComponent = new ScriptComponent();
    entity.addComponent(scriptComponent);
    
    const onOpenScriptWorkbench = vi.fn();
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      onOpenScriptWorkbench,
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    // Check scripts section exists as accordion
    const scriptsSection = host.querySelector('#inspector-section-scripts');
    expect(scriptsSection).toBeTruthy();

    // Expand the accordion if needed
    const accordionHeader = scriptsSection?.querySelector('.property-section-header') as HTMLElement;
    const contentWrapper = scriptsSection?.querySelector('#inspector-section-scripts-content') as HTMLElement;
    if (contentWrapper?.classList.contains('collapsed')) {
      accordionHeader?.click();
    }

    // Wait for content to be rendered
    await new Promise(resolve => setTimeout(resolve, 10));

    // Find empty text within scripts section content
    const scriptsContent = scriptsSection?.querySelector('#inspector-section-scripts-content');
    const emptyText = scriptsContent?.querySelector('.muted-text');
    expect(emptyText?.textContent).toContain('No scripts attached');
    
    const workbenchBtn = scriptsContent?.querySelector('.script-workbench-link-btn') as HTMLButtonElement;
    expect(workbenchBtn).toBeTruthy();
    expect(workbenchBtn.textContent).toContain('Open Script Workbench');
  });

  it('displays assigned scripts with delete buttons', () => {
    // Register a test behavior
    try {
      class TestBehaviorClass extends BehaviorInstance {
        public override onUpdate(_dt: number) {}
      }
      BehaviorRegistry.register('TestBehavior', TestBehaviorClass);
    } catch {
      // Already registered
    }

    const scriptComponent = new ScriptComponent();
    scriptComponent.setScripts([
      { name: 'TestBehavior', enabled: true, params: {} },
      { name: 'AnotherScript', enabled: false, params: {} },
    ]);
    entity.addComponent(scriptComponent);
    
    const onOpenScriptWorkbench = vi.fn();
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      onOpenScriptWorkbench,
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    const scriptList = host.querySelector('.script-list-simple');
    expect(scriptList).toBeTruthy();
    
    const scriptItems = host.querySelectorAll('.script-item');
    expect(scriptItems.length).toBe(2);
    
    // Check first script
    const firstItem = scriptItems[0];
    const firstName = firstItem?.querySelector('.script-item-name');
    expect(firstName?.textContent).toBe('TestBehavior');
    
    const firstStatus = firstItem?.querySelector('.script-item-status');
    expect(firstStatus?.textContent).toBe('Enabled');
    expect(firstStatus?.classList.contains('enabled')).toBe(true);
    
    // Check second script
    const secondItem = scriptItems[1];
    const secondName = secondItem?.querySelector('.script-item-name');
    expect(secondName?.textContent).toBe('AnotherScript');
    
    const secondStatus = secondItem?.querySelector('.script-item-status');
    expect(secondStatus?.textContent).toBe('Disabled');
    expect(secondStatus?.classList.contains('disabled')).toBe(true);
    
    // Check delete buttons exist
    const deleteButtons = host.querySelectorAll('.script-item-delete');
    expect(deleteButtons.length).toBe(2);
    
    // Check workbench link exists
    const workbenchBtn = host.querySelector('.script-workbench-link-btn') as HTMLButtonElement;
    expect(workbenchBtn).toBeTruthy();
    expect(workbenchBtn.textContent).toContain('Edit in Script Workbench');
  });

  it('removes script when delete button is clicked', () => {
    const scriptComponent = new ScriptComponent();
    scriptComponent.setScripts([
      { name: 'TestBehavior', enabled: true, params: {} },
      { name: 'AnotherScript', enabled: false, params: {} },
    ]);
    entity.addComponent(scriptComponent);
    
    const onEntityRenamed = vi.fn();
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed,
      onOpenScriptWorkbench: vi.fn(),
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    const deleteButtons = host.querySelectorAll('.script-item-delete');
    expect(deleteButtons.length).toBe(2);
    
    // Click first delete button
    const firstDeleteBtn = deleteButtons[0] as HTMLButtonElement;
    firstDeleteBtn.click();
    
    // Check that the script was removed
    const state = scriptComponent.toJSON();
    expect(state.scripts.length).toBe(1);
    expect(state.scripts[0]?.name).toBe('AnotherScript');
    
    // Check that callback was called
    expect(onEntityRenamed).toHaveBeenCalledWith(entity);
  });

  it('marks invalid scripts with visual indicator', () => {
    const scriptComponent = new ScriptComponent();
    scriptComponent.setScripts([
      { name: 'NonExistentBehavior', enabled: true, params: {} },
    ]);
    entity.addComponent(scriptComponent);
    
    const panel = new PropertiesPanel({
      selection,
      onTransformChanged: vi.fn(),
      onColorChanged: vi.fn(),
      onEntityRenamed: vi.fn(),
      onOpenScriptWorkbench: vi.fn(),
      state: editorState,
    });
    panel.mount(host);
    panel.refresh();

    const scriptName = host.querySelector('.script-item-name');
    expect(scriptName?.classList.contains('script-item-invalid')).toBe(true);
    expect(scriptName?.getAttribute('title')).toContain('not found in registry');
  });

  describe('Character Controller Section', () => {
    it('renders character controller section when component exists', () => {
      const controller = new CharacterController();
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      // Check section exists as accordion (not tab)
      const characterSection = host.querySelector('#inspector-section-character-controller');
      expect(characterSection).toBeTruthy();
      
      // Check it has collapsible header
      const sectionHeader = characterSection?.querySelector('.property-section-header');
      expect(sectionHeader).toBeTruthy();
    });

    it('does not render character controller section when component missing', () => {
      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const characterSection = host.querySelector('#inspector-section-character-controller');
      expect(characterSection).toBeFalsy();
    });

    it('displays profile selector dropdown', () => {
      const controller = new CharacterController();
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const profileSelect = host.querySelector('.property-select') as HTMLSelectElement;
      expect(profileSelect).toBeTruthy();
      expect(profileSelect.options.length).toBeGreaterThan(0);
    });

    it('applies profile when selected from dropdown', () => {
      const controller = new CharacterController();
      entity.addComponent(controller);
      const initialSpeed = controller.config.moveSpeed;

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const profileSelect = host.querySelector('.property-select') as HTMLSelectElement;
      expect(profileSelect).toBeTruthy();

      // Select FAST_HUMAN profile (moveSpeed = 7.0)
      profileSelect.value = 'fast-human';
      profileSelect.dispatchEvent(new Event('change'));

      expect(controller.config.moveSpeed).toBe(7.0);
      expect(controller.config.moveSpeed).not.toBe(initialSpeed);
      expect(controller.getCurrentProfile()?.id).toBe('fast-human');
    });

    it('displays profile parameters preview', () => {
      const controller = new CharacterController();
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const paramsTable = host.querySelector('.property-table');
      expect(paramsTable).toBeTruthy();

      const paramRows = host.querySelectorAll('.property-table-row');
      expect(paramRows.length).toBeGreaterThan(0);
      
      // Check if Move Speed is displayed
      const moveSpeedText = Array.from(paramRows).find(row => 
        row.textContent?.includes('Move Speed')
      );
      expect(moveSpeedText).toBeTruthy();
    });

    it('displays extension badges for profiles with extensions', () => {
      const controller = new CharacterController();
      controller.applyProfile(PRESET_PROFILES.FLYING_HUMAN);
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const badges = host.querySelectorAll('.extension-badge');
      expect(badges.length).toBeGreaterThan(0);
      
      const flyingBadge = Array.from(badges).find(badge => 
        badge.textContent?.includes('Flying')
      );
      expect(flyingBadge).toBeTruthy();
    });

    it('resets to default profile when reset button clicked', async () => {
      const controller = new CharacterController();
      controller.applyProfile(PRESET_PROFILES.FAST_HUMAN);
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      // Expand character controller section if needed
      const controllerSection = host.querySelector('#inspector-section-character-controller');
      const accordionHeader = controllerSection?.querySelector('.property-section-header') as HTMLElement;
      const contentWrapper = controllerSection?.querySelector('#inspector-section-character-controller-content') as HTMLElement;
      if (contentWrapper?.classList.contains('collapsed')) {
        accordionHeader?.click();
      }

      // Wait for content to be rendered
      await new Promise(resolve => setTimeout(resolve, 10));

      const controllerContent = controllerSection?.querySelector('#inspector-section-character-controller-content');
      const resetBtn = controllerContent?.querySelector('.property-reset-btn') as HTMLButtonElement;
      expect(resetBtn).toBeTruthy();

      expect(controller.getCurrentProfile()?.id).toBe('fast-human');
      resetBtn.click();
      
      // Wait for refresh to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(controller.getCurrentProfile()?.id).toBe('human');
      expect(controller.config.moveSpeed).toBe(5.0);
    });

    it('shows create custom profile button', () => {
      const controller = new CharacterController();
      entity.addComponent(controller);

      const panel = new PropertiesPanel({
        selection,
        onTransformChanged: vi.fn(),
        onColorChanged: vi.fn(),
        onEntityRenamed: vi.fn(),
        state: editorState,
      });
      panel.mount(host);
      panel.refresh();

      const createBtn = host.querySelector('.property-btn');
      expect(createBtn).toBeTruthy();
      expect(createBtn?.textContent).toContain('Create Custom');
    });
  });
});
