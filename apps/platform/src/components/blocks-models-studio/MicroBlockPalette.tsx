/**
 * MicroBlockPalette - Palette of micro blocks for drag & drop (KoGaMa-style)
 */

import { useState } from 'react';
import type { BlockDefinition } from '@engine/blocks';
import { BLOCK_LIBRARY } from '@engine/blocks';

export interface MicroBlockPaletteProps {
  onBlockSelect: (block: BlockDefinition, scale: [number, number, number]) => void;
}

/**
 * Micro block sizes (KoGaMa-style)
 */
const MICRO_BLOCK_SIZES: Array<[number, number, number]> = [
  [1, 1, 1],        // Full block
  [0.5, 0.5, 0.5],  // Half block
  [0.25, 0.25, 0.25], // Quarter block
];

/**
 * Micro block palette component
 */
export function MicroBlockPalette({ onBlockSelect }: MicroBlockPaletteProps) {
  const [selectedSize, setSelectedSize] = useState<[number, number, number]>([1, 1, 1]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  const allBlocks = Object.values(BLOCK_LIBRARY);

  const handleBlockClick = (block: BlockDefinition) => {
    setSelectedBlock(block.id);
    onBlockSelect(block, selectedSize);
  };

  const handleBlockDragStart = (block: BlockDefinition, event: React.DragEvent) => {
    event.dataTransfer.setData('application/json', JSON.stringify({
      blockId: block.id,
      scale: selectedSize,
    }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="micro-block-palette">
      <div className="palette-section">
        <h3>🔲 Block Size</h3>
        <div className="size-selector">
          {MICRO_BLOCK_SIZES.map((size, index) => {
            const sizeLabel = size[0] === 1 ? 'Full' : size[0] === 0.5 ? 'Half' : 'Quarter';
            return (
              <button
                key={index}
                className={`size-button ${selectedSize === size ? 'active' : ''}`}
                onClick={() => setSelectedSize(size)}
                title={`${sizeLabel} block (${size[0]}×${size[1]}×${size[2]})`}
              >
                {sizeLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="palette-section">
        <h3>🧱 Blocks</h3>
        <div className="block-grid">
          {allBlocks.map((block) => (
            <div
              key={block.id}
              className={`block-item ${selectedBlock === block.id ? 'selected' : ''}`}
              onClick={() => handleBlockClick(block)}
              draggable
              onDragStart={(e) => handleBlockDragStart(block, e)}
              title={`${block.name} - Drag to viewport to place`}
            >
              <div
                className="block-preview"
                style={{
                  backgroundColor: `rgba(${Math.round(block.textures.top.color[0] * 255)}, ${Math.round(block.textures.top.color[1] * 255)}, ${Math.round(block.textures.top.color[2] * 255)}, ${block.textures.top.color[3]})`,
                }}
              />
              <div className="block-name">{block.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="palette-hint">
        <p><strong>💡 How to use:</strong></p>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
          <li>Click block to select it</li>
          <li>Drag block to viewport to start placement</li>
          <li>Move mouse to position, press <strong>R</strong> to rotate</li>
          <li>Click to place, <strong>Esc</strong> to cancel</li>
          <li>Choose block size: Full (1×1×1), Half (0.5×0.5×0.5), or Quarter (0.25×0.25×0.25)</li>
        </ul>
      </div>
    </div>
  );
}

