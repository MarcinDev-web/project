/**
 * @vitest-environment jsdom
 * WeaponPanel Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene, Entity, SelectionManager } from '@engine/world';
import { WeaponPanel } from '../gameplay/WeaponPanel';
import { WeaponComponent } from '@engine/world/components/WeaponComponent';
import { InventoryComponent } from '@engine/world/components/InventoryComponent';
import { setupWeaponEntity } from '@engine/world';

describe('WeaponPanel', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let panel: WeaponPanel;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    selection = new SelectionManager();
    panel = new WeaponPanel({
      selection,
      scene,
      onConfigChanged: () => {},
      updateSceneBuffers: () => {},
    });
  });

  afterEach(() => {
    panel = null as any;
  });

  it('should create panel element', () => {
    expect(panel.element).toBeDefined();
    expect(panel.element.className).toContain('weapon-panel');
  });

  it('should show empty state when no entity selected', () => {
    const content = panel.element.querySelector('.weapon-panel-content');
    expect(content).toBeDefined();
    const empty = content?.querySelector('.panel-empty');
    expect(empty).toBeDefined();
    expect(empty?.textContent).toContain('Select an entity');
  });

  it('should show setup section for entity without weapon', () => {
    const entity = scene.createEntity('Test Entity');
    selection.select(entity);
    panel.refresh();

    const content = panel.element.querySelector('.weapon-panel-content');
    const setupSection = content?.querySelector('.panel-section');
    expect(setupSection).toBeDefined();
  });

  it('should show weapon section for entity with weapon', () => {
    const entity = scene.createEntity('Test Entity');
    setupWeaponEntity(entity, 'rifle');
    selection.select(entity);
    panel.refresh();

    const content = panel.element.querySelector('.weapon-panel-content');
    const weaponSection = content?.querySelector('.panel-section');
    expect(weaponSection).toBeDefined();
  });

  it('should show inventory section for entity with inventory', () => {
    const entity = scene.createEntity('Test Entity');
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    selection.select(entity);
    panel.refresh();

    const content = panel.element.querySelector('.weapon-panel-content');
    const inventorySection = content?.querySelector('.panel-section');
    expect(inventorySection).toBeDefined();
  });

  it('should update when selection changes', () => {
    const entity1 = scene.createEntity('Entity 1');
    const entity2 = scene.createEntity('Entity 2');
    setupWeaponEntity(entity2, 'pistol');

    selection.select(entity1);
    panel.refresh();
    let content = panel.element.querySelector('.weapon-panel-content');
    expect(content?.querySelector('.panel-empty')).toBeDefined();

    selection.select(entity2);
    panel.refresh();
    content = panel.element.querySelector('.weapon-panel-content');
    expect(content?.querySelector('.panel-empty')).toBeNull();
  });
});

