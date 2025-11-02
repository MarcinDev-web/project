/**
 * Tests for BlockEditor component
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockEditor } from '../BlockEditor';
import type { BlockDefinition } from '@engine/blocks';

const mockBlock: BlockDefinition = {
  id: 'test_block',
  name: 'Test Block',
  category: 'basic',
  material: 'plastic',
  textures: {
    top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
    bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
    sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
  },
  properties: {
    solid: true,
    transparent: false,
    emissive: 0,
    roughness: 0.5,
    metallic: 0,
  },
};

describe('BlockEditor', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should render', () => {
    render(
      <BlockEditor
        selectedBlock={mockBlock}
        onBlockChange={() => {}}
      />
    );

    expect(screen.getByText('📋 Basic Info')).toBeDefined();
    expect(screen.getByText('🎨 Textures')).toBeDefined();
    expect(screen.getByText('⚙️ Properties')).toBeDefined();
  });

  it('should display block name', () => {
    render(
      <BlockEditor
        selectedBlock={mockBlock}
        onBlockChange={() => {}}
      />
    );

    const nameInput = screen.getByPlaceholderText('Block name') as HTMLInputElement;
    expect(nameInput.value).toBe('Test Block');
  });

  it('should have save button', () => {
    render(
      <BlockEditor
        selectedBlock={mockBlock}
        onBlockChange={() => {}}
      />
    );

    expect(screen.getByText('💾 Save Block')).toBeDefined();
  });
});

