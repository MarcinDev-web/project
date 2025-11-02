/**
 * Demonstracja możliwości środowiska DOM dla testów edytora
 * 
 * Ten test pokazuje wszystkie dostępne API w środowisku testowym:
 * - DOM manipulation
 * - Canvas API
 * - ResizeObserver
 * - RequestAnimationFrame
 * - Event handling
 */

/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initBrowserPolyfills } from '../setup';

describe('DOM Environment Test Suite', () => {
  beforeEach(() => {
    // Polyfills są automatycznie inicjalizowane dla testów edytora
    initBrowserPolyfills();
    
    // Cleanup DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Basic DOM API', () => {
    it('should create and manipulate DOM elements', () => {
      const div = document.createElement('div');
      div.className = 'test-element';
      div.textContent = 'Hello, World!';
      div.setAttribute('data-test', 'value');
      
      document.body.appendChild(div);
      
      expect(document.querySelector('.test-element')).toBeTruthy();
      expect(div.textContent).toBe('Hello, World!');
      expect(div.getAttribute('data-test')).toBe('value');
    });

    it('should query DOM elements', () => {
      document.body.innerHTML = `
        <div class="container">
          <button id="btn1" class="action-btn">Button 1</button>
          <button id="btn2" class="action-btn">Button 2</button>
          <input type="text" class="text-input" value="test" />
        </div>
      `;
      
      expect(document.querySelector('.container')).toBeTruthy();
      expect(document.querySelectorAll('.action-btn')).toHaveLength(2);
      expect(document.getElementById('btn1')).toBeTruthy();
      
      const input = document.querySelector('.text-input') as HTMLInputElement;
      expect(input.value).toBe('test');
    });

    it('should handle DOM events', () => {
      const button = document.createElement('button');
      const clickHandler = vi.fn();
      
      button.addEventListener('click', clickHandler);
      document.body.appendChild(button);
      
      button.click();
      
      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'click',
          target: button,
        })
      );
    });

    it('should handle custom events', () => {
      const element = document.createElement('div');
      const customHandler = vi.fn();
      
      element.addEventListener('custom-event', customHandler);
      
      const event = new CustomEvent('custom-event', {
        detail: { data: 'test payload' }
      });
      element.dispatchEvent(event);
      
      expect(customHandler).toHaveBeenCalledTimes(1);
      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom-event',
          detail: { data: 'test payload' }
        })
      );
    });
  });

  describe('Canvas API', () => {
    it('should create canvas element with dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
      expect(canvas.clientWidth).toBe(1920);
      expect(canvas.clientHeight).toBe(1080);
    });

    it('should get canvas bounding rect', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      
      const rect = canvas.getBoundingClientRect();
      
      expect(rect.width).toBe(800);
      expect(rect.height).toBe(600);
      expect(rect.left).toBe(0);
      expect(rect.top).toBe(0);
    });

    it('should get canvas context (mocked)', () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgpu');
      
      expect(context).toBeTruthy();
      expect(context).toHaveProperty('canvas', canvas);
      expect(context).toHaveProperty('configure');
      expect(context).toHaveProperty('getCurrentTexture');
    });

    it('should handle canvas in document', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvas.id = 'render-canvas';
      
      document.body.appendChild(canvas);
      
      const found = document.getElementById('render-canvas') as HTMLCanvasElement;
      expect(found).toBeTruthy();
      expect(found.width).toBe(640);
      expect(found.height).toBe(480);
    });
  });

  describe('ResizeObserver API', () => {
    it('should create ResizeObserver', () => {
      const callback = vi.fn();
      const observer = new ResizeObserver(callback);
      
      expect(observer).toBeTruthy();
      expect(observer.observe).toBeTypeOf('function');
      expect(observer.unobserve).toBeTypeOf('function');
      expect(observer.disconnect).toBeTypeOf('function');
    });

    it('should observe and unobserve elements', () => {
      const element = document.createElement('div');
      const callback = vi.fn();
      const observer = new ResizeObserver(callback);
      
      // Should not throw
      expect(() => {
        observer.observe(element);
        observer.unobserve(element);
        observer.disconnect();
      }).not.toThrow();
    });
  });

  describe('Animation API', () => {
    it('should handle requestAnimationFrame', () => {
      const callback = vi.fn();
      
      const id = requestAnimationFrame(callback);
      
      expect(id).toBeTypeOf('number');
      expect(typeof cancelAnimationFrame).toBe('function');
    });

    it('should cancel animation frame', () => {
      const callback = vi.fn();
      
      const id = requestAnimationFrame(callback);
      cancelAnimationFrame(id);
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Window and Document API', () => {
    it('should have window object', () => {
      expect(window).toBeDefined();
      expect(window.document).toBe(document);
    });

    it('should have document object', () => {
      expect(document).toBeDefined();
      expect(document.body).toBeTruthy();
      expect(document.createElement).toBeTypeOf('function');
    });

    it('should have devicePixelRatio', () => {
      expect(globalThis.devicePixelRatio).toBeDefined();
      expect(typeof globalThis.devicePixelRatio).toBe('number');
      expect(globalThis.devicePixelRatio).toBeGreaterThan(0);
    });

    it('should handle window events', () => {
      const resizeHandler = vi.fn();
      
      window.addEventListener('resize', resizeHandler);
      
      const event = new Event('resize');
      window.dispatchEvent(event);
      
      expect(resizeHandler).toHaveBeenCalledTimes(1);
      
      window.removeEventListener('resize', resizeHandler);
    });
  });

  describe('Form Elements', () => {
    it('should handle input elements', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'initial';
      
      const changeHandler = vi.fn();
      input.addEventListener('input', changeHandler);
      
      input.value = 'changed';
      input.dispatchEvent(new Event('input'));
      
      expect(input.value).toBe('changed');
      expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle checkbox elements', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      
      expect(checkbox.checked).toBe(false);
      
      checkbox.checked = true;
      expect(checkbox.checked).toBe(true);
    });

    it('should handle select elements', () => {
      const select = document.createElement('select');
      select.innerHTML = `
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      `;
      
      expect(select.options).toHaveLength(3);
      
      select.value = '2';
      expect(select.value).toBe('2');
    });

    it('should handle button elements', () => {
      const button = document.createElement('button');
      button.textContent = 'Click Me';
      button.disabled = false;
      
      const clickHandler = vi.fn();
      button.addEventListener('click', clickHandler);
      
      button.click();
      
      expect(clickHandler).toHaveBeenCalledTimes(1);
      
      button.disabled = true;
      expect(button.disabled).toBe(true);
    });
  });

  describe('Editor-specific scenarios', () => {
    it('should create editor panel structure', () => {
      const editorContainer = document.createElement('div');
      editorContainer.className = 'editor-container';
      
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      
      const viewport = document.createElement('div');
      viewport.className = 'viewport';
      
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      
      viewport.appendChild(canvas);
      editorContainer.appendChild(toolbar);
      editorContainer.appendChild(viewport);
      document.body.appendChild(editorContainer);
      
      expect(document.querySelector('.editor-container')).toBeTruthy();
      expect(document.querySelector('.toolbar')).toBeTruthy();
      expect(document.querySelector('.viewport canvas')).toBeTruthy();
    });

    it('should handle property panel updates', () => {
      const panel = document.createElement('div');
      panel.className = 'properties-panel';
      panel.innerHTML = `
        <div class="property">
          <label>Position X</label>
          <input type="number" class="prop-x" value="0" />
        </div>
        <div class="property">
          <label>Position Y</label>
          <input type="number" class="prop-y" value="0" />
        </div>
      `;
      
      document.body.appendChild(panel);
      
      const inputX = panel.querySelector('.prop-x') as HTMLInputElement;
      const inputY = panel.querySelector('.prop-y') as HTMLInputElement;
      
      inputX.value = '10';
      inputY.value = '20';
      
      expect(inputX.value).toBe('10');
      expect(inputY.value).toBe('20');
    });

    it('should handle gizmo button interactions', () => {
      const gizmoToolbar = document.createElement('div');
      gizmoToolbar.className = 'gizmo-toolbar';
      gizmoToolbar.innerHTML = `
        <button data-mode="translate" class="gizmo-btn active">Move</button>
        <button data-mode="rotate" class="gizmo-btn">Rotate</button>
        <button data-mode="scale" class="gizmo-btn">Scale</button>
      `;
      
      document.body.appendChild(gizmoToolbar);
      
      const buttons = gizmoToolbar.querySelectorAll('.gizmo-btn');
      expect(buttons).toHaveLength(3);
      
      const rotateBtn = gizmoToolbar.querySelector('[data-mode="rotate"]') as HTMLButtonElement;
      rotateBtn.click();
      
      // Simulate mode change
      buttons.forEach(btn => btn.classList.remove('active'));
      rotateBtn.classList.add('active');
      
      expect(rotateBtn.classList.contains('active')).toBe(true);
    });
  });

  describe('Cleanup and Memory', () => {
    it('should cleanup event listeners', () => {
      const element = document.createElement('div');
      const handler = vi.fn();
      
      element.addEventListener('click', handler);
      element.click();
      
      expect(handler).toHaveBeenCalledTimes(1);
      
      element.removeEventListener('click', handler);
      element.click();
      
      // Should still be 1 (not 2)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove elements from DOM', () => {
      const div = document.createElement('div');
      div.id = 'to-be-removed';
      
      document.body.appendChild(div);
      expect(document.getElementById('to-be-removed')).toBeTruthy();
      
      div.remove();
      expect(document.getElementById('to-be-removed')).toBeFalsy();
    });

    it('should clear innerHTML for cleanup', () => {
      const container = document.createElement('div');
      container.innerHTML = '<div>Child 1</div><div>Child 2</div>';
      
      expect(container.children).toHaveLength(2);
      
      container.innerHTML = '';
      expect(container.children).toHaveLength(0);
    });
  });
});

