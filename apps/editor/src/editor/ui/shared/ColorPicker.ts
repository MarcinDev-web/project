import type { RgbaColor } from '../../../utils/colors';
import { createIcon } from '../../utils/icons';
import { hexToRgba, rgbaToHex } from '../../../utils/colors';

export interface ColorPickerOptions {
  label?: string;
  value: RgbaColor;
  onChange: (next: RgbaColor) => void;
  abortSignal?: AbortSignal;
  setManagedTimeout?: (fn: () => void, delayMs: number) => number;
  dataFieldPrefix?: string; // e.g. 'appearance-base-color'
}

export function createColorPicker(options: ColorPickerOptions): HTMLElement {
  const { label = 'Base Color', value, onChange, abortSignal, setManagedTimeout, dataFieldPrefix } = options;

  const row = document.createElement('div');
  row.className = 'property-row-v2';

  const labelEl = document.createElement('label');
  labelEl.className = 'property-label-v2';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const pickerWrapper = document.createElement('div');
  pickerWrapper.className = 'color-picker-wrapper-v2';

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'color-picker-swatch-v2';

  const hexColor = rgbaToHex(value);
  const swatchInner = document.createElement('span');
  swatchInner.className = 'color-picker-swatch-inner';
  swatchInner.style.background = hexColor;
  if (dataFieldPrefix) swatchInner.setAttribute('data-field', `${dataFieldPrefix}-swatch`);
  swatch.appendChild(swatchInner);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'color-picker-input';
  colorInput.value = hexColor;
  if (dataFieldPrefix) colorInput.setAttribute('data-field', `${dataFieldPrefix}`);

  const valueWrapper = document.createElement('div');
  valueWrapper.className = 'color-value-wrapper';

  const valueDisplay = document.createElement('input');
  valueDisplay.type = 'text';
  valueDisplay.className = 'color-value-input';
  valueDisplay.value = hexColor.toUpperCase();
  valueDisplay.readOnly = true;
  if (dataFieldPrefix) valueDisplay.setAttribute('data-field', `${dataFieldPrefix}-display`);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'color-copy-btn';
  copyBtn.title = 'Copy color';
  copyBtn.appendChild(createIcon('copy', 12));
  const resetCopy = () => {
    copyBtn.innerHTML = '';
    copyBtn.appendChild(createIcon('copy', 12));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(valueDisplay.value).catch(() => {});
    copyBtn.innerHTML = '';
    copyBtn.appendChild(createIcon('check', 12));
    if (setManagedTimeout) {
      setManagedTimeout(resetCopy, 1500);
    } else {
      window.setTimeout(resetCopy, 1500);
    }
  };

  if (abortSignal) {
    copyBtn.addEventListener('click', handleCopy, { signal: abortSignal });
  } else {
    copyBtn.addEventListener('click', handleCopy);
  }

  const handleColorInput = () => {
    const parsed = hexToRgba(colorInput.value);
    swatchInner.style.background = colorInput.value;
    valueDisplay.value = colorInput.value.toUpperCase();
    onChange(parsed);
  };

  if (abortSignal) {
    swatch.addEventListener('click', () => colorInput.click(), { signal: abortSignal });
    colorInput.addEventListener('input', handleColorInput, { signal: abortSignal });
  } else {
    swatch.addEventListener('click', () => colorInput.click());
    colorInput.addEventListener('input', handleColorInput);
  }

  valueWrapper.appendChild(valueDisplay);
  valueWrapper.appendChild(copyBtn);

  pickerWrapper.appendChild(swatch);
  pickerWrapper.appendChild(colorInput);
  pickerWrapper.appendChild(valueWrapper);

  row.appendChild(pickerWrapper);
  return row;
}


