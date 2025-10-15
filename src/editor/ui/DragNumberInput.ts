/**
 * DragNumberInput
 * Enhanced number input with drag-to-edit functionality
 * 
 * Features:
 * - Click and drag to change values
 * - Shift key for faster changes
 * - Alt key for slower/finer changes
 * - Double-click to type exact value
 * - Min/Max constraints
 * - Step/precision control
 * - Visual feedback during drag
 * - Touch support
 */

export interface DragNumberInputOptions {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  unit?: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
  dataField?: string;
  abortSignal?: AbortSignal;
}

export function createDragNumberInput(options: DragNumberInputOptions): HTMLElement {
  const {
    value,
    min = -Infinity,
    max = Infinity,
    step = 1,
    precision = 2,
    label,
    unit,
    onChange,
    onCommit,
    className = '',
    dataField,
    abortSignal,
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = `drag-number-input ${className}`.trim();
  if (dataField) wrapper.setAttribute('data-field', dataField);

  if (label) {
    const labelEl = document.createElement('label');
    labelEl.className = 'drag-number-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
  }

  const controlWrapper = document.createElement('div');
  controlWrapper.className = 'drag-number-control';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'drag-number-field';
  input.value = value.toFixed(precision);
  if (dataField) input.setAttribute('data-field', `${dataField}-input`);

  if (unit) {
    const unitLabel = document.createElement('span');
    unitLabel.className = 'drag-number-unit';
    unitLabel.textContent = unit;
    controlWrapper.appendChild(input);
    controlWrapper.appendChild(unitLabel);
  } else {
    controlWrapper.appendChild(input);
  }

  wrapper.appendChild(controlWrapper);

  // State management
  let isDragging = false;
  let startX = 0;
  let startValue = value;
  let currentValue = value;

  const clamp = (val: number): number => Math.max(min, Math.min(max, val));

  const formatValue = (val: number): string => {
    const clamped = clamp(val);
    return clamped.toFixed(precision);
  };

  const updateValue = (newValue: number, commit = false) => {
    currentValue = clamp(newValue);
    input.value = formatValue(currentValue);
    onChange(currentValue);
    if (commit && onCommit) {
      onCommit(currentValue);
    }
  };

  // Drag functionality
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    if (e.detail === 2) return; // Ignore double-clicks (handled separately)

    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startValue = currentValue;

    input.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    // Add visual feedback
    wrapper.classList.add('drag-active');
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    let multiplier = step;

    // Modifiers for speed
    if (e.shiftKey) {
      multiplier *= 10; // Faster with Shift
    } else if (e.altKey) {
      multiplier *= 0.1; // Slower/finer with Alt
    }

    const delta = deltaX * multiplier;
    const newValue = startValue + delta;

    updateValue(newValue, false);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    isDragging = false;
    input.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    wrapper.classList.remove('drag-active');

    // Commit the final value
    if (onCommit) {
      onCommit(currentValue);
    }
  };

  // Touch support
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0]!;
    isDragging = true;
    startX = touch.clientX;
    startValue = currentValue;

    input.classList.add('dragging');
    wrapper.classList.add('drag-active');
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();

    const touch = e.touches[0]!;
    const deltaX = touch.clientX - startX;
    const multiplier = step;
    const delta = deltaX * multiplier;
    const newValue = startValue + delta;

    updateValue(newValue, false);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    isDragging = false;
    input.classList.remove('dragging');
    wrapper.classList.remove('drag-active');

    if (onCommit) {
      onCommit(currentValue);
    }
  };

  // Double-click to type exact value
  const handleDoubleClick = () => {
    input.select();
    input.focus();
  };

  // Keyboard input
  const handleInputChange = () => {
    const parsed = parseFloat(input.value);
    if (!isNaN(parsed)) {
      updateValue(parsed, false);
    }
  };

  const handleInputBlur = () => {
    // Reformat and commit on blur
    const parsed = parseFloat(input.value);
    if (!isNaN(parsed)) {
      updateValue(parsed, true);
    } else {
      // Revert to last valid value
      input.value = formatValue(currentValue);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = formatValue(currentValue);
      input.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      updateValue(currentValue + step * multiplier, true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      updateValue(currentValue - step * multiplier, true);
    }
  };

  // Attach event listeners
  const addListener = (target: EventTarget, event: string, handler: EventListener, options?: AddEventListenerOptions) => {
    if (abortSignal) {
      target.addEventListener(event, handler, { ...options, signal: abortSignal });
    } else {
      target.addEventListener(event, handler, options);
    }
  };

  addListener(input, 'mousedown', handleMouseDown as EventListener);
  addListener(document, 'mousemove', handleMouseMove as EventListener);
  addListener(document, 'mouseup', handleMouseUp);
  addListener(input, 'dblclick', handleDoubleClick);
  addListener(input, 'input', handleInputChange);
  addListener(input, 'blur', handleInputBlur);
  addListener(input, 'keydown', handleKeyDown as EventListener);

  // Touch events
  addListener(input, 'touchstart', handleTouchStart as EventListener, { passive: false });
  addListener(document, 'touchmove', handleTouchMove as EventListener, { passive: false });
  addListener(document, 'touchend', handleTouchEnd);

  return wrapper;
}

// CSS class names reference:
// .drag-number-input - Main wrapper
// .drag-number-label - Label element
// .drag-number-control - Control wrapper (input + unit)
// .drag-number-field - Input element
// .drag-number-unit - Unit label
// .drag-active - Added during drag
// .dragging - Added to input during drag

