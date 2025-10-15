import type { Vec3 } from '../../math';
import { createIcon } from '../utils/icons';

export interface VectorInputOptions {
  label: string;
  values: Vec3;
  onCommit: (next: Vec3) => void;
  onReset?: () => void;
  group?: string; // data-field prefix, e.g. "position" -> position-x
  abortSignal?: AbortSignal;
  debounceMs?: number;
  setManagedTimeout?: (fn: () => void, delayMs: number) => number;
  enableDrag?: boolean; // Enable drag-to-edit functionality
  step?: number; // Step size for drag-to-edit (default: 0.1)
}

export function createVectorInput(options: VectorInputOptions): HTMLElement {
  const {
    label,
    values,
    onCommit,
    onReset,
    group,
    abortSignal,
    debounceMs = 120,
    setManagedTimeout,
    enableDrag = true,
    step = 0.1,
  } = options;

  const row = document.createElement('div');
  row.className = 'property-row-v2';

  const labelRow = document.createElement('div');
  labelRow.className = 'property-label-row';

  const labelEl = document.createElement('label');
  labelEl.className = 'property-label-v2';
  labelEl.textContent = label;

  if (onReset) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'property-reset-btn';
    resetBtn.title = 'Reset to default';
    resetBtn.appendChild(createIcon('rotate-ccw', 12));
    if (abortSignal) {
      resetBtn.addEventListener('click', onReset, { signal: abortSignal });
    } else {
      resetBtn.addEventListener('click', onReset);
    }
    labelRow.appendChild(labelEl);
    labelRow.appendChild(resetBtn);
  } else {
    labelRow.appendChild(labelEl);
  }

  row.appendChild(labelRow);

  const vectorGrid = document.createElement('div');
  vectorGrid.className = 'property-vector-v2';

  const axes: Array<{ axis: 'X' | 'Y' | 'Z'; index: number; className: string }> = [
    { axis: 'X', index: 0, className: 'property-axis-x' },
    { axis: 'Y', index: 1, className: 'property-axis-y' },
    { axis: 'Z', index: 2, className: 'property-axis-z' },
  ];

  const timers = new WeakMap<EventTarget, number>();

  const addDebouncedInput = (el: HTMLInputElement, handler: () => void) => {
    const listener = () => {
      const existing = timers.get(el);
      if (existing !== undefined) {
        window.clearTimeout(existing);
      }
      const id = setManagedTimeout
        ? setManagedTimeout(handler, debounceMs)
        : window.setTimeout(handler, debounceMs);
      timers.set(el, id);
    };
    if (abortSignal) {
      el.addEventListener('input', listener, { signal: abortSignal });
    } else {
      el.addEventListener('input', listener);
    }
  };

  axes.forEach(({ axis, index, className }) => {
    const control = document.createElement('div');
    control.className = `property-vector-control ${className}`;

    const axisLabel = document.createElement('span');
    axisLabel.className = 'property-axis-label-v2';
    axisLabel.textContent = axis;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'property-number-input';
    input.step = '0.1';
    const value = values[index] ?? 0;
    input.value = Number.isFinite(value) ? value.toFixed(2) : '0.00';
    if (group) {
      input.setAttribute('data-field', `${group}-${axis.toLowerCase()}`);
    }

    const updateValue = () => {
      const parsed = Number.parseFloat(input.value);
      if (!Number.isFinite(parsed)) return;
      const next = [...values] as Vec3;
      next[index] = parsed;
      onCommit(next);
    };

    if (abortSignal) {
      input.addEventListener('change', updateValue, { signal: abortSignal });
    } else {
      input.addEventListener('change', updateValue);
    }
    addDebouncedInput(input, updateValue);

    // Add drag-to-edit functionality if enabled
    if (enableDrag) {
      let isDragging = false;
      let startX = 0;
      let startValue = 0;

      const handleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0 || e.detail === 2) return; // Only left click, ignore double-click
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startValue = Number.parseFloat(input.value) || 0;
        input.classList.add('dragging');
        control.classList.add('drag-active');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        let multiplier = step;
        if (e.shiftKey) multiplier *= 10;
        else if (e.altKey) multiplier *= 0.1;
        
        const newValue = startValue + (deltaX * multiplier);
        input.value = Number.isFinite(newValue) ? newValue.toFixed(2) : '0.00';
        
        const next = [...values] as Vec3;
        next[index] = newValue;
        onCommit(next);
      };

      const handleMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        input.classList.remove('dragging');
        control.classList.remove('drag-active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      if (abortSignal) {
        input.addEventListener('mousedown', handleMouseDown, { signal: abortSignal });
        document.addEventListener('mousemove', handleMouseMove, { signal: abortSignal });
        document.addEventListener('mouseup', handleMouseUp, { signal: abortSignal });
      } else {
        input.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    }

    control.appendChild(axisLabel);
    control.appendChild(input);
    vectorGrid.appendChild(control);
  });

  row.appendChild(vectorGrid);
  return row;
}


