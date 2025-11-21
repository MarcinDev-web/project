/**
 * VirtualList - Virtual scrolling implementation for large lists
 * 
 * Renders only visible items for performance with large datasets (1000+ items)
 * Maintains smooth scrolling and keyboard navigation
 */

export interface VirtualListItem {
  id: string;
  height: number;
  render: () => HTMLElement;
}

export interface VirtualListConfig {
  container: HTMLElement;
  items: VirtualListItem[];
  overscan?: number; // Number of items to render outside viewport
  onVisibleRangeChange?: (start: number, end: number) => void;
}

export class VirtualList {
  private readonly container: HTMLElement;
  private readonly scrollContainer: HTMLElement;
  private readonly contentContainer: HTMLElement;
  private items: VirtualListItem[] = [];
  private overscan: number;
  private visibleStart = 0;
  private visibleEnd = 0;
  private renderedElements = new Map<string, HTMLElement>();
  private itemOffsets: number[] = [];
  private totalHeight = 0;

  constructor(config: VirtualListConfig) {
    this.container = config.container;
    this.items = config.items;
    this.overscan = config.overscan ?? 5;

    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'virtual-list-scroll';
    this.scrollContainer.style.overflow = 'auto';
    this.scrollContainer.style.height = '100%';
    this.scrollContainer.style.position = 'relative';

    // Create content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'virtual-list-content';
    this.contentContainer.style.position = 'relative';
    this.contentContainer.style.willChange = 'transform';

    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);

    // Calculate item offsets
    this.calculateOffsets();

    // Handle scroll
    this.scrollContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // Initial render
    this.handleScroll();
  }

  /**
   * Calculates cumulative offsets for all items
   */
  private calculateOffsets(): void {
    this.itemOffsets = [];
    let offset = 0;
    
    for (const item of this.items) {
      this.itemOffsets.push(offset);
      offset += item.height;
    }
    
    this.totalHeight = offset;
    this.scrollContainer.style.height = `${this.totalHeight}px`;
  }

  /**
   * Handles scroll event and updates visible items
   */
  private handleScroll(): void {
    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // Find visible range using binary search
    const start = this.findItemIndexAtOffset(scrollTop);
    const end = this.findItemIndexAtOffset(scrollTop + viewportHeight);

    // Apply overscan
    const overscanStart = Math.max(0, start - this.overscan);
    const overscanEnd = Math.min(this.items.length - 1, end + this.overscan);

    // Only update if range changed
    if (overscanStart !== this.visibleStart || overscanEnd !== this.visibleEnd) {
      this.visibleStart = overscanStart;
      this.visibleEnd = overscanEnd;
      this.renderVisibleItems();
    }
  }

  /**
   * Finds item index at a specific scroll offset using binary search
   */
  private findItemIndexAtOffset(offset: number): number {
    let left = 0;
    let right = this.items.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midOffset = this.itemOffsets[mid];
      const nextOffset = mid < this.items.length - 1 
        ? this.itemOffsets[mid + 1] 
        : this.totalHeight;

      // Type guard: ensure offsets are defined
      if (midOffset === undefined || nextOffset === undefined) {
        return Math.max(0, Math.min(this.items.length - 1, left));
      }

      if (offset >= midOffset && offset < nextOffset) {
        return mid;
      } else if (offset < midOffset) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return Math.max(0, Math.min(this.items.length - 1, left));
  }

  /**
   * Renders only visible items
   */
  private renderVisibleItems(): void {
    // Remove items that are no longer visible
    const visibleIds = new Set<string>();
    for (let i = this.visibleStart; i <= this.visibleEnd; i++) {
      const item = this.items[i];
      if (item) {
        visibleIds.add(item.id);
      }
    }

    this.renderedElements.forEach((element, id) => {
      if (!visibleIds.has(id)) {
        element.remove();
        this.renderedElements.delete(id);
      }
    });

    // Render new visible items
    for (let i = this.visibleStart; i <= this.visibleEnd; i++) {
      const item = this.items[i];
      if (!item) continue;

      if (!this.renderedElements.has(item.id)) {
        const element = item.render();
        element.style.position = 'absolute';
        element.style.top = `${this.itemOffsets[i]}px`;
        element.style.left = '0';
        element.style.right = '0';
        element.dataset.virtualIndex = String(i);
        element.dataset.virtualId = item.id;

        this.contentContainer.appendChild(element);
        this.renderedElements.set(item.id, element);
      }
    }
  }

  /**
   * Updates the list with new items
   */
  update(items: VirtualListItem[]): void {
    this.items = items;
    this.renderedElements.clear();
    this.contentContainer.innerHTML = '';
    this.calculateOffsets();
    this.handleScroll();
  }

  /**
   * Scrolls to a specific item
   */
  scrollToItem(index: number): void {
    if (index >= 0 && index < this.items.length) {
      const offset = this.itemOffsets[index];
      if (offset !== undefined) {
        this.scrollContainer.scrollTop = offset;
      }
    }
  }

  /**
   * Scrolls to a specific item by ID
   */
  scrollToId(id: string): void {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.scrollToItem(index);
    }
  }

  /**
   * Gets current scroll position
   */
  getScrollTop(): number {
    return this.scrollContainer.scrollTop;
  }

  /**
   * Sets scroll position
   */
  setScrollTop(value: number): void {
    this.scrollContainer.scrollTop = value;
  }

  /**
   * Disposes the virtual list
   */
  dispose(): void {
    this.renderedElements.clear();
    this.scrollContainer.remove();
  }
}

