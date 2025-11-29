/**
 * BrandWatermark - Play Engine branding overlay
 * 
 * Displays branding watermark in the editor (top-left corner):
 * - "PLAY ENGINE · DEV BUILD" in dev mode
 * - "PLAY ENGINE · XXX FPS" when FPS tracking is enabled
 * 
 * This ensures every screenshot, video, and demo carries the Play Engine identity.
 */

import { WATERMARKS } from '@engine/brand';

export interface BrandWatermarkConfig {
  /** Container element to attach watermark to */
  container: HTMLElement;
  
  /** Show FPS counter instead of "DEV BUILD" text */
  showFPS?: boolean;
  
  /** Custom position (defaults to top-left) */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class BrandWatermark {
  private element: HTMLDivElement;
  private config: Required<BrandWatermarkConfig>;
  private fps: number = 0;
  private frameCount: number = 0;
  private lastFPSUpdate: number = performance.now();

  constructor(config: BrandWatermarkConfig) {
    this.config = {
      ...config,
      showFPS: config.showFPS ?? false,
      position: config.position ?? 'top-left',
    };

    this.element = this.createWatermarkElement();
    this.config.container.appendChild(this.element);
    
    this.updateText();
  }

  private createWatermarkElement(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute;
      z-index: 10000;
      user-select: none;
      pointer-events: none;
      transition: opacity 0.2s;
      opacity: 0.7;
    `;

    // Apply watermark style
    const watermarkStyle = this.config.showFPS 
      ? WATERMARKS.FPS_COUNTER.style 
      : WATERMARKS.EDITOR.style;
    
    Object.assign(div.style, {
      color: watermarkStyle.color,
      fontSize: watermarkStyle.fontSize,
      fontFamily: watermarkStyle.fontFamily,
      padding: watermarkStyle.padding,
      background: watermarkStyle.background,
      borderRadius: watermarkStyle.borderRadius,
    });

    // Position
    this.applyPosition(div, this.config.position);

    // Hover effect (slightly more visible)
    div.addEventListener('mouseenter', () => {
      div.style.opacity = '1';
    });
    
    div.addEventListener('mouseleave', () => {
      div.style.opacity = '0.7';
    });

    return div;
  }

  private applyPosition(element: HTMLElement, position: string): void {
    switch (position) {
      case 'top-left':
        element.style.top = '0';
        element.style.left = '0';
        break;
      case 'top-right':
        element.style.top = '0';
        element.style.right = '0';
        break;
      case 'bottom-left':
        element.style.bottom = '0';
        element.style.left = '0';
        break;
      case 'bottom-right':
        element.style.bottom = '0';
        element.style.right = '0';
        break;
    }
  }

  private updateText(): void {
    if (this.config.showFPS) {
      this.element.textContent = WATERMARKS.FPS_COUNTER.format(this.fps);
    } else {
      this.element.textContent = WATERMARKS.EDITOR.text;
    }
  }

  /**
   * Call this in your render loop to track FPS
   */
  updateFPS(): void {
    if (!this.config.showFPS) return;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFPSUpdate;

    // Update FPS every 500ms
    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFPSUpdate = now;
      this.updateText();
    }
  }

  /**
   * Enable/disable FPS counter
   */
  setShowFPS(show: boolean): void {
    this.config.showFPS = show;
    this.updateText();
  }

  /**
   * Show/hide watermark
   */
  setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }

  /**
   * Remove watermark from DOM
   */
  dispose(): void {
    this.element.remove();
  }
}

