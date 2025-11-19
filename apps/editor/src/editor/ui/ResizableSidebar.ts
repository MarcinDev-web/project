/**
 * ResizableSidebar - Makes sidebar panels resizable with drag handle
 * 
 * Features:
 * - Drag handle for resizing
 * - Snap points at common widths
 * - Persist width to localStorage
 * - Min/max width constraints
 * - Smooth animations
 */

import { storageSave, storageLoad } from '../../utils/storage';

export interface ResizableSidebarConfig {
  element: HTMLElement;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  snapPoints?: number[];
  storageKey?: string;
  onResize?: (width: number) => void;
  side?: 'left' | 'right';
}

export class ResizableSidebar {
  private readonly element: HTMLElement;
  private readonly handle: HTMLElement;
  private readonly minWidth: number;
  private readonly maxWidth: number;
  private readonly defaultWidth: number;
  private readonly snapPoints: number[];
  private readonly snapThreshold = 20; // Pixels within which to snap
  private readonly storageKey: string;
  private readonly side: 'left' | 'right';
  private currentWidth: number;
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  // Store bound listeners for cleanup
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseUp: () => void;

  constructor(private readonly config: ResizableSidebarConfig) {
    this.element = config.element;
    this.minWidth = config.minWidth ?? 200;
    this.maxWidth = config.maxWidth ?? 600;
    this.defaultWidth = config.defaultWidth ?? 320;
    this.snapPoints = config.snapPoints ?? [280, 320, 400, 500];
    this.storageKey = config.storageKey ?? 'sidebar-width';
    this.side = config.side ?? 'left';

    // Load saved width or use default
    const savedWidth = storageLoad<number>(this.storageKey);
    this.currentWidth = savedWidth ?? this.defaultWidth;

    // Initialize bound listeners
    this.handleMouseMove = (e: MouseEvent) => {
      if (this.isResizing) {
        this.resize(e);
      }
    };

    this.handleMouseUp = () => {
      if (this.isResizing) {
        this.endResize();
      }
    };

    // Create resize handle
    this.handle = this.createHandle();
    
    // Append or prepend based on side
    if (this.side === 'right') {
      this.element.prepend(this.handle);
    } else {
      this.element.appendChild(this.handle);
    }

    // Apply initial width
    this.applyWidth(this.currentWidth);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Creates the resize handle element
   */
  private createHandle(): HTMLElement {
    const handle = document.createElement('div');
    handle.className = `sidebar-resize-handle ${this.side === 'right' ? 'sidebar-resize-handle-left' : ''}`;
    handle.title = 'Drag to resize';

    // Visual indicator
    const indicator = document.createElement('div');
    indicator.className = 'sidebar-resize-indicator';
    handle.appendChild(indicator);

    return handle;
  }

  /**
   * Sets up event listeners for resizing
   */
  private setupEventListeners(): void {
    // Start resize
    this.handle.addEventListener('mousedown', (e) => {
      this.startResize(e);
    });

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Double-click to reset to default
    this.handle.addEventListener('dblclick', () => {
      this.setWidth(this.defaultWidth);
    });
  }

  /**
   * Starts the resize operation
   */
  private startResize(e: MouseEvent): void {
    this.isResizing = true;
    this.startX = e.clientX;
    this.startWidth = this.currentWidth;

    this.element.classList.add('resizing');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  /**
   * Performs resize during mouse move
   */
  private resize(e: MouseEvent): void {
    const delta = e.clientX - this.startX;
    
    // Invert delta for right sidebar (dragging left increases width)
    const effectiveDelta = this.side === 'right' ? -delta : delta;
    
    let newWidth = this.startWidth + effectiveDelta;

    // Apply constraints
    newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));

    // Check for snap points
    for (const snapPoint of this.snapPoints) {
      if (Math.abs(newWidth - snapPoint) < this.snapThreshold) {
        newWidth = snapPoint;
        break;
      }
    }

    this.applyWidth(newWidth);
  }

  /**
   * Ends the resize operation
   */
  private endResize(): void {
    this.isResizing = false;
    this.element.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save width
    this.saveWidth();

    // Notify callback
    this.config.onResize?.(this.currentWidth);
  }

  /**
   * Applies a width to the element
   */
  private applyWidth(width: number): void {
    this.currentWidth = width;
    this.element.style.width = `${width}px`;
  }

  /**
   * Sets the width programmatically
   */
  setWidth(width: number): void {
    const constrainedWidth = Math.max(
      this.minWidth,
      Math.min(this.maxWidth, width)
    );
    this.applyWidth(constrainedWidth);
    this.saveWidth();
    this.config.onResize?.(this.currentWidth);
  }

  /**
   * Gets the current width
   */
  getWidth(): number {
    return this.currentWidth;
  }

  /**
   * Saves width to localStorage
   */
  private saveWidth(): void {
    storageSave(this.storageKey, this.currentWidth);
  }

  /**
   * Disposes the component
   */
  dispose(): void {
    this.handle.remove();
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }
}
