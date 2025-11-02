/**
 * Tests for PartSelector component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartSelector } from '../PartSelector';
import { DEFAULT_AVATAR_PART_LIBRARY } from '@engine/avatar';

describe('PartSelector', () => {
  it('should render available parts for a slot', () => {
    const handleChange = vi.fn();
    
    render(
      <PartSelector
        slot="HeadSlot"
        currentMesh="head_default"
        onMeshChange={handleChange}
      />
    );

    // Should show at least one option (head_default should be available)
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('should call onMeshChange when selection changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    
    render(
      <PartSelector
        slot="HeadSlot"
        currentMesh="head_default"
        onMeshChange={handleChange}
      />
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'face_overlay_default');
    
    expect(handleChange).toHaveBeenCalledWith('face_overlay_default');
  });

  it('should show fallback when no parts available', () => {
    const emptyLibrary = {};
    const handleChange = vi.fn();
    
    render(
      <PartSelector
        slot="HeadSlot"
        currentMesh="head_default"
        onMeshChange={handleChange}
        partLibrary={emptyLibrary}
      />
    );

    // Should show message about no parts available
    expect(screen.getByText(/No parts available/i)).toBeInTheDocument();
  });

  it('should display part count in label', () => {
    const handleChange = vi.fn();
    
    render(
      <PartSelector
        slot="HeadSlot"
        currentMesh="head_default"
        onMeshChange={handleChange}
        partLibrary={DEFAULT_AVATAR_PART_LIBRARY}
      />
    );

    // Should show count of available parts
    const label = screen.getByText(/available/i);
    expect(label).toBeInTheDocument();
  });
});

