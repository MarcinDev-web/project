# DOM Test Environment - Konfiguracja i Użycie

> **Status:** ✅ Pełna konfiguracja środowiska DOM dla testów edytora

## 🎯 Przegląd

Środowisko testowe edytora jest w pełni skonfigurowane z obsługą DOM, Canvas API, WebGPU i wszystkich niezbędnych polyfills dla testów UI i integracyjnych.

## 📦 Zainstalowane Zależności

```json
{
  "jsdom": "^27.0.0",           // Implementacja DOM dla Node.js
  "fake-indexeddb": "^6.2.2",   // Mock IndexedDB
  "vitest": "^2.1.3"            // Test runner z obsługą jsdom
}
```

## ⚙️ Konfiguracja

### 1. Vitest Workspace (`vitest.workspace.ts`)

```typescript
{
  test: {
    environment: 'node',  // Domyślnie node (szybsze)
    environmentMatchGlobs: [
      // Automatycznie używa jsdom dla testów edytora
      ['**/apps/editor/**/*.test.ts', 'jsdom'],
      ['**/editor/**/*.test.ts', 'jsdom'],
      ['**/*UI*.test.ts', 'jsdom'],
      ['**/*Dom*.test.ts', 'jsdom'],
      ['**/*Browser*.test.ts', 'jsdom'],
    ],
  }
}
```

### 2. Setup File (`apps/editor/src/test/setup.ts`)

Automatycznie ładowany przed testami edytora, zawiera:

#### Polyfills dla przeglądarki:
- ✅ **ResizeObserver** - obserwacja zmian rozmiaru elementów
- ✅ **HTMLCanvasElement.getContext()** - obsługa Canvas (w tym WebGPU)
- ✅ **HTMLCanvasElement.getBoundingClientRect()** - wymiary canvas
- ✅ **clientWidth/clientHeight** - właściwości canvas
- ✅ **requestAnimationFrame/cancelAnimationFrame** - timing animacji
- ✅ **devicePixelRatio** - gęstość pikseli

#### Polyfills dla WebGPU:
- ✅ **navigator.gpu** - WebGPU API
- ✅ **GPUBufferUsage** - flagi buforów
- ✅ **GPUTextureUsage** - flagi tekstur
- ✅ **GPUMapMode** - tryby mapowania
- ✅ **GPUShaderStage** - etapy shaderów

#### Lazy Loading:
```typescript
import { initBrowserPolyfills, initWebGPUPolyfills } from '../test/setup';

// W teście (jeśli potrzebne)
initBrowserPolyfills();  // Auto-loaded dla testów edytora
initWebGPUPolyfills();   // Dla testów WebGPU
```

## 📝 Przykłady Użycia

### Test DOM - Podstawy

```typescript
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('should create DOM elements', () => {
    const div = document.createElement('div');
    div.className = 'my-component';
    div.textContent = 'Hello';
    
    document.body.appendChild(div);
    
    expect(document.querySelector('.my-component')).toBeTruthy();
    expect(div.textContent).toBe('Hello');
  });
});
```

### Test Canvas

```typescript
it('should create canvas with dimensions', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  
  expect(canvas.width).toBe(1920);
  expect(canvas.height).toBe(1080);
  expect(canvas.clientWidth).toBe(1920);
  
  const rect = canvas.getBoundingClientRect();
  expect(rect.width).toBe(1920);
  expect(rect.height).toBe(1080);
});
```

### Test Event Handling

```typescript
it('should handle DOM events', () => {
  const button = document.createElement('button');
  const handler = vi.fn();
  
  button.addEventListener('click', handler);
  document.body.appendChild(button);
  
  button.click();
  
  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'click',
      target: button
    })
  );
});
```

### Test Custom Events

```typescript
it('should dispatch custom events', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  
  element.addEventListener('custom-event', handler);
  
  const event = new CustomEvent('custom-event', {
    detail: { message: 'test' }
  });
  element.dispatchEvent(event);
  
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'custom-event',
      detail: { message: 'test' }
    })
  );
});
```

### Test Form Elements

```typescript
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
```

### Test WebGPU Context

```typescript
it('should get WebGPU context', () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgpu');
  
  expect(context).toBeTruthy();
  expect(context).toHaveProperty('canvas', canvas);
  expect(context).toHaveProperty('configure');
  expect(context).toHaveProperty('getCurrentTexture');
});
```

### Test ResizeObserver

```typescript
it('should observe element resize', () => {
  const element = document.createElement('div');
  const callback = vi.fn();
  const observer = new ResizeObserver(callback);
  
  observer.observe(element);
  observer.unobserve(element);
  observer.disconnect();
  
  expect(observer).toBeTruthy();
});
```

### Test Animation Frame

```typescript
it('should handle requestAnimationFrame', () => {
  const callback = vi.fn();
  
  const id = requestAnimationFrame(callback);
  
  expect(id).toBeTypeOf('number');
  
  cancelAnimationFrame(id);
});
```

## 🧹 Cleanup Pattern

**ZAWSZE** czyść DOM po testach:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
  });
  
  afterEach(() => {
    // Cleanup
    document.body.innerHTML = '';
  });
  
  it('should work', () => {
    // Test code
  });
});
```

## 🎨 Scenariusze Edytora

### Test Editor Panel

```typescript
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
```

### Test Properties Panel

```typescript
it('should update property inputs', () => {
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
```

### Test Gizmo Toolbar

```typescript
it('should handle gizmo mode switching', () => {
  const toolbar = document.createElement('div');
  toolbar.innerHTML = `
    <button data-mode="translate" class="gizmo-btn active">Move</button>
    <button data-mode="rotate" class="gizmo-btn">Rotate</button>
    <button data-mode="scale" class="gizmo-btn">Scale</button>
  `;
  
  document.body.appendChild(toolbar);
  
  const rotateBtn = toolbar.querySelector('[data-mode="rotate"]') as HTMLButtonElement;
  rotateBtn.click();
  
  // Simulate mode change
  toolbar.querySelectorAll('.gizmo-btn').forEach(btn => 
    btn.classList.remove('active')
  );
  rotateBtn.classList.add('active');
  
  expect(rotateBtn.classList.contains('active')).toBe(true);
});
```

## 🚀 Uruchamianie Testów

```bash
# Wszystkie testy edytora (automatycznie używają jsdom)
pnpm --filter @apps/editor test

# Watch mode
pnpm test:watch

# Konkretny plik
pnpm --filter @apps/editor test DOMEnvironment.test.ts

# Tylko zmienione
pnpm test:changed

# Szybkie testy (bez coverage)
pnpm test:unit:fast
```

## 📊 Dostępne API

### Document & Window
- ✅ `document.createElement()`
- ✅ `document.querySelector()` / `querySelectorAll()`
- ✅ `document.getElementById()`
- ✅ `document.body`
- ✅ `window.addEventListener()`
- ✅ `window.dispatchEvent()`

### Elements
- ✅ `element.appendChild()`
- ✅ `element.removeChild()`
- ✅ `element.remove()`
- ✅ `element.classList`
- ✅ `element.setAttribute()` / `getAttribute()`
- ✅ `element.addEventListener()`
- ✅ `element.dispatchEvent()`

### Events
- ✅ `new Event()`
- ✅ `new CustomEvent()`
- ✅ `new MouseEvent()`
- ✅ `new KeyboardEvent()`

### Canvas
- ✅ `canvas.width` / `canvas.height`
- ✅ `canvas.clientWidth` / `canvas.clientHeight`
- ✅ `canvas.getContext('2d')` / `'webgpu'`
- ✅ `canvas.getBoundingClientRect()`

### Forms
- ✅ `<input>` (text, number, checkbox, radio)
- ✅ `<select>` + `<option>`
- ✅ `<button>`
- ✅ `<textarea>`

### Other
- ✅ `ResizeObserver`
- ✅ `requestAnimationFrame()` / `cancelAnimationFrame()`
- ✅ `devicePixelRatio`
- ✅ `navigator.gpu` (mocked)

## ⚠️ Ograniczenia

### Nie dostępne w jsdom:
- ❌ Faktyczny rendering (Canvas 2D/WebGL/WebGPU)
- ❌ Layout calculations (wszystko zwraca 0)
- ❌ CSS computations
- ❌ Prawdziwe WebGPU API (tylko mocks)

### Workaround:
```typescript
// Dla layout-sensitive kodu, używaj mocków:
it('should handle canvas resize', () => {
  const canvas = document.createElement('canvas');
  
  // Symuluj resize
  canvas.width = 1920;
  canvas.height = 1080;
  
  // Test używa canvas.width/height, nie layout
  expect(canvas.width).toBe(1920);
});
```

## 🔍 Debugging

### Sprawdź HTML strukturę:
```typescript
it('debug DOM', () => {
  document.body.innerHTML = '<div class="test">Content</div>';
  
  console.log(document.body.innerHTML);
  // Output: <div class="test">Content</div>
});
```

### Sprawdź event listeners:
```typescript
it('debug events', () => {
  const element = document.createElement('button');
  const handler = vi.fn();
  
  element.addEventListener('click', handler);
  element.click();
  
  console.log('Handler called:', handler.mock.calls);
});
```

## 📚 Przykładowy Test (Kompletny)

Zobacz `apps/editor/src/test/__tests__/DOMEnvironment.test.ts` dla:
- ✅ 26 przykładowych testów
- ✅ Wszystkie wzorce użycia
- ✅ Best practices
- ✅ Cleanup patterns

## 🎓 Best Practices

1. **Zawsze czyść DOM** w `beforeEach/afterEach`
2. **Używaj vi.fn()** do mockowania event handlers
3. **Testuj behavior**, nie implementation
4. **Cleanup event listeners** po testach
5. **Używaj semantic selectors** (classes/IDs)
6. **Mock external dependencies** (WebGPU, network)
7. **Preferuj integracyjne testy DOM** nad unit

## 🔗 Linki

- [Vitest Testing API](https://vitest.dev/api/)
- [jsdom Documentation](https://github.com/jsdom/jsdom)
- [DOM Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Status:** ✅ Gotowe do użycia  
**Ostatnia aktualizacja:** 2025-10-26  
**Testy demonstracyjne:** 26/26 przeszło ✓

