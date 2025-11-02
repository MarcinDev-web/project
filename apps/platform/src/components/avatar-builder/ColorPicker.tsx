/**
 * ColorPicker - Component for selecting colors for avatar parts
 */

import { DEFAULT_AVATAR_PART_LIBRARY, type AvatarSlot, type AvatarPartLibrary } from '@engine/avatar';
import type { RgbaColor } from '@engine/world';

export interface ColorPickerProps {
  slot: AvatarSlot;
  colors?: Record<string, RgbaColor>;
  onColorChange: (colorSlot: string, color: RgbaColor) => void;
  partLibrary?: AvatarPartLibrary;
  currentMeshId?: string;
}

/**
 * Color picker component for avatar customization
 * Uses color slots from the part definition in the library
 */
export function ColorPicker({ 
  slot, 
  colors, 
  onColorChange,
  partLibrary = DEFAULT_AVATAR_PART_LIBRARY,
  currentMeshId 
}: ColorPickerProps) {
  // Get color slots from the part definition
  const getColorSlots = (): string[] => {
    // First try to get from the current mesh part
    if (currentMeshId) {
      const part = partLibrary[currentMeshId];
      if (part && part.colorSlots && part.colorSlots.length > 0) {
        return [...part.colorSlots];
      }
    }
    
    // Fallback: find any part for this slot and use its color slots
    for (const part of Object.values(partLibrary)) {
      if (part.slot === slot) {
        if (part.colorSlots && part.colorSlots.length > 0) {
          return [...part.colorSlots];
        }
      }
    }
    
    // Default fallback
    return ['primary'];
  };

  const colorSlots = getColorSlots();

  const handleColorInput = (colorSlot: string, value: string) => {
    // Convert hex to RGBA
    const hex = value.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const color: RgbaColor = [r, g, b, 1];
    onColorChange(colorSlot, color);
  };

  const rgbaToHex = (rgba: RgbaColor): string => {
    const r = Math.round(rgba[0] * 255)
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(rgba[1] * 255)
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(rgba[2] * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  return (
    <div className="color-picker">
      <h3>Colors</h3>
      {colorSlots.map((colorSlot) => {
        const color = colors?.[colorSlot] ?? [1, 1, 1, 1];
        const hexValue = rgbaToHex(color);

        return (
          <div key={colorSlot} className="color-picker-item">
            <label>
              {colorSlot.charAt(0).toUpperCase() + colorSlot.slice(1)}
            </label>
            <div className="color-picker-controls">
              <input
                type="color"
                value={hexValue}
                onChange={(e) => handleColorInput(colorSlot, e.target.value)}
                className="color-picker-input"
              />
              <input
                type="text"
                value={hexValue}
                onChange={(e) => handleColorInput(colorSlot, e.target.value)}
                className="color-picker-hex"
                pattern="#[0-9A-Fa-f]{6}"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

