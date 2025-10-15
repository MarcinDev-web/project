import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetBrowserV2 as AssetBrowser } from './AssetBrowser';
import { Scene } from '../../scene/Scene';
import { assetRegistry } from './AssetRegistry';
import { initializeAssetLibrary } from './AssetLibrary';

function createContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('AssetBrowser', () => {
  let scene: Scene;
  let container: HTMLElement;

  beforeEach(async () => {
    scene = new Scene('Test Scene');
    container = createContainer();
    
    // Initialize AssetRegistry with built-in assets
    assetRegistry.clear();
    await initializeAssetLibrary(assetRegistry);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    assetRegistry.clear();
  });

  it('mounts grid of asset cards and spawns entity on click', () => {
    const onSpawn = vi.fn();
    const browser = new AssetBrowser(scene, onSpawn);
    browser.mount(container);

    const cards = container.querySelectorAll('.asset-grid .asset-card, .asset-list .asset-card');
    expect(cards.length).toBeGreaterThan(0);

    const firstCard = cards[0]! as HTMLElement;
    firstCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSpawn).toHaveBeenCalledTimes(1);
  });

  it('filters by category, quick filter, and searches by name', () => {
    const onSpawn = vi.fn();
    const browser = new AssetBrowser(scene, onSpawn);
    browser.mount(container);

    const categoryButtons = container.querySelectorAll('.category-list .category-item button');
    expect(categoryButtons.length).toBeGreaterThan(0);
    const furnitureButton = Array.from(categoryButtons).find((btn) => btn.textContent === 'Furniture');
    expect(furnitureButton).toBeTruthy();

    furnitureButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    let cards = container.querySelectorAll('.asset-grid .asset-card, .asset-list .asset-card');
    expect(cards.length).toBeGreaterThan(0);

    cards.forEach((card) => {
      const meta = card.querySelector('.asset-card-meta');
      if (meta) {
        expect(meta.textContent).toContain('Furniture');
      }
    });

    const quickFilter = container.querySelector('.quick-filter-chip[data-filter="placeable"]') as HTMLButtonElement;
    expect(quickFilter).toBeTruthy();
    quickFilter.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    cards = container.querySelectorAll('.asset-grid .asset-card, .asset-list .asset-card');
    expect(cards.length).toBeGreaterThan(0);

    const search = container.querySelector('.asset-browser-search .search-input') as HTMLInputElement;
    expect(search).toBeTruthy();

    const cardsBeforeSearch = cards.length;
    search.value = 'Table';
    search.dispatchEvent(new Event('input'));

    cards = container.querySelectorAll('.asset-grid .asset-card, .asset-list .asset-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(cardsBeforeSearch);

    const hasTableReference = Array.from(cards).some((card) => {
      const name = card.querySelector('.asset-card-name');
      return name && name.textContent && name.textContent.toLowerCase().includes('table');
    });

    expect(hasTableReference).toBe(true);
  });

  it('exposes accessible ARIA state for quick filters and categories', () => {
    const onSpawn = vi.fn();
    const browser = new AssetBrowser(scene, onSpawn);
    browser.mount(container);

    // Quick filter ARIA toggles
    const featuredChip = container.querySelector('.quick-filter-chip[data-filter="featured"]') as HTMLButtonElement;
    expect(featuredChip).toBeTruthy();
    expect(featuredChip.getAttribute('aria-pressed')).toBe('false');
    featuredChip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(featuredChip.getAttribute('aria-pressed')).toBe('true');
    expect(featuredChip.getAttribute('aria-label')).toContain('(On)');
    const stateEl = featuredChip.querySelector('.chip-state') as HTMLElement;
    expect(stateEl.textContent).toBe('On');

    // Category list exposes selection state
    const categoryButtons = Array.from(container.querySelectorAll('.category-list .category-item button')) as HTMLButtonElement[];
    const furnitureBtn = categoryButtons.find((b) => b.textContent === 'Furniture')!;
    furnitureBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(furnitureBtn.getAttribute('aria-selected')).toBe('true');
    const activeCategoryItem = furnitureBtn.closest('.category-item') as HTMLElement;
    expect(activeCategoryItem.classList.contains('active')).toBe(true);

    // Subcategory list renders and exposes selection state
    const subcategoryButtons = Array.from(container.querySelectorAll('.subcategory-list .subcategory-item button')) as HTMLButtonElement[];
    // Ensure expected subcategory exists for Furniture mapping
    const tablesBtn = subcategoryButtons.find((b) => b.textContent === 'Tables')!;
    tablesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(tablesBtn.getAttribute('aria-selected')).toBe('true');
    const activeSubcategoryItem = tablesBtn.closest('.subcategory-item') as HTMLElement;
    expect(activeSubcategoryItem.classList.contains('active')).toBe(true);
  });

  it('has labeled radiogroup for view toggle and updates aria-checked', () => {
    const onSpawn = vi.fn();
    const browser = new AssetBrowser(scene, onSpawn);
    browser.mount(container);

    const group = container.querySelector('.view-mode-toggle') as HTMLElement;
    expect(group).toBeTruthy();
    expect(group.getAttribute('role')).toBe('radiogroup');

    const gridRadio = container.querySelector('[data-mode="grid"]') as HTMLElement;
    const listRadio = container.querySelector('[data-mode="list"]') as HTMLElement;
    expect(gridRadio.getAttribute('role')).toBe('radio');
    expect(listRadio.getAttribute('role')).toBe('radio');

    // Switch to list view
    (listRadio as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(listRadio.getAttribute('aria-checked')).toBe('true');
    expect(gridRadio.getAttribute('aria-checked')).toBe('false');
  });

  it('shows search suggestions from history and supports keyboard selection', () => {
    const onSpawn = vi.fn();
    const browser = new AssetBrowser(scene, onSpawn);
    browser.mount(container);

    const input = container.querySelector('.asset-browser-search .search-input') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Commit two searches to seed history
    input.value = 'Table';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    input.value = 'Chair';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Clear current text and focus to reveal suggestions
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    const listbox = container.querySelector('.asset-browser-search-suggestions') as HTMLUListElement;
    expect(listbox).toBeTruthy();
    expect(listbox.hidden).toBe(false);
    const options = Array.from(listbox.querySelectorAll('[role="option"]')) as HTMLElement[];
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Arrow navigation should move selection
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // First option selected by default; down moves to next
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // Press enter to commit the currently selected suggestion
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // After commit, suggestions should hide and input should equal the committed value
    expect(listbox.hidden).toBe(true);
    // Input should be set to one of the history values
    expect(['Chair', 'Table']).toContain(input.value);
  });
});
