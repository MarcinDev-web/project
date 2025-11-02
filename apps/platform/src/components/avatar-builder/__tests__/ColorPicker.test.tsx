/**
 * Tests for ColorPicker component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RgbaColor } from '@engine/world';
import { ColorPicker } from '../ColorPicker';

describe('ColorPicker', () => {
  it('should render color pickers for part color slots', () => {
    const handleChange = vi.fn();
    const primaryColor: RgbaColor = [1, 0.5, 0, 1];
    
    render(
      <ColorPicker
        slot="HeadSlot"
        colors={{ primary: primaryColor }}
        onColorChange={handleChange}
        currentMeshId="head_default"
      />
    );

    // Should show color input for primary slot
    const colorInput = screen.getByLabelText(/primary/i);
    expect(colorInput).toBeInTheDocument();
  });

  it('should call onColorChange when color changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const primaryColor: RgbaColor = [1, 0.5, 0, 1];
    
    render(
      <ColorPicker
        slot="HeadSlot"
        colors={{ primary: primaryColor }}
        onColorChange={handleChange}
        currentMeshId="head_default"
      />
    );

    const colorInput = screen.getByLabelText(/primary/i) as HTMLInputElement;
    await user.clear(colorInput);
    await user.type(colorInput, '#ff0000');
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('should display current color values', () => {
    const handleChange = vi.fn();
    const primaryColor: RgbaColor = [1, 0, 0, 1]; // Red
    const colors = { primary: primaryColor };
    
    render(
      <ColorPicker
        slot="HeadSlot"
        colors={colors}
        onColorChange={handleChange}
        currentMeshId="head_default"
      />
    );

    const colorInput = screen.getByLabelText(/primary/i) as HTMLInputElement;
    expect(colorInput.value).toBe('#ff0000'); // Red in hex
  });

  it('should use fallback color slots when part not found', () => {
    const handleChange = vi.fn();
    
    render(
      <ColorPicker
        slot="HeadSlot"
        colors={{}}
        onColorChange={handleChange}
        currentMeshId="nonexistent_part"
      />
    );

    // Should fallback to 'primary' color slot
    const colorInput = screen.getByLabelText(/primary/i);
    expect(colorInput).toBeInTheDocument();
  });
});

