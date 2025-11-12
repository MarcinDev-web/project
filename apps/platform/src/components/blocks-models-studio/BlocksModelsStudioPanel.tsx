/**
 * BlocksModelsStudioPanel - Main panel with tabs for Blocks, Models, and Micro Blocks
 */

import { useState} from 'react';
import type { BlockDefinition } from '@engine/blocks';
import { BlockEditor } from './BlockEditor';
import { ModelEditor } from './ModelEditor';
import { MicroBlockPalette } from './MicroBlockPalette';
import type { Vec3 } from '@engine/core/math';

export interface BlocksModelsStudioPanelProps {
  selectedBlock: BlockDefinition | null;
  onBlockChange: (block: BlockDefinition) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  viewportRef?: React.RefObject<HTMLCanvasElement>;
  mode?: 'blocks' | 'model-builder';
  onModeChange?: (mode: 'blocks' | 'model-builder') => void;
}

type TabType = 'blocks' | 'models' | 'micro-blocks' | 'model-builder';

/**
 * Main panel component with tabs
 */
export function BlocksModelsStudioPanel({
  selectedBlock,
  onBlockChange,
  onSave,
  hasUnsavedChanges,
  viewportRef,
  mode = 'blocks',
  onModeChange,
}: BlocksModelsStudioPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>(mode === 'model-builder' ? 'model-builder' : 'blocks');

  // Handler for starting drag from micro block palette
  const handleMicroBlockSelect = (block: BlockDefinition, scale: Vec3) => {
    // Try to start drag via viewport canvas
    if (viewportRef?.current) {
      const canvas = viewportRef.current as HTMLCanvasElement & { startBlockDrag?: (block: BlockDefinition, scale: Vec3) => void };
      if (canvas.startBlockDrag) {
        canvas.startBlockDrag(block, scale);
      }
    }
  };

  return (
    <div className="blocks-models-studio-panel">
      <div className="panel-header">
        <h2>Blocks/Models Studio</h2>
        <div className="panel-actions">
          <button
            className="save-button"
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            title={hasUnsavedChanges ? 'Save changes (Ctrl+S)' : 'No changes to save'}
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={{ 
        padding: '0.5rem 1rem', 
        background: 'rgba(102, 126, 234, 0.1)', 
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.7)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <strong>💡 Tips:</strong> Drag blocks from palette • R to rotate • Esc to cancel • Ctrl+S to save
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-button ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('blocks');
            onModeChange?.('blocks');
          }}
        >
          🧱 Blocks
        </button>
        <button
          className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
          onClick={() => setActiveTab('models')}
        >
          🎨 Models
        </button>
        <button
          className={`tab-button ${activeTab === 'micro-blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('micro-blocks')}
        >
          🔲 Micro Blocks
        </button>
        <button
          className={`tab-button ${activeTab === 'model-builder' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('model-builder');
            onModeChange?.('model-builder');
          }}
        >
          🔨 Model Builder
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'blocks' && (
          <BlockEditor
            selectedBlock={selectedBlock}
            onBlockChange={onBlockChange}
          />
        )}
        {activeTab === 'models' && (
          <ModelEditor />
        )}
        {activeTab === 'micro-blocks' && (
          <div>
            <MicroBlockPalette
              onBlockSelect={handleMicroBlockSelect}
            />
          </div>
        )}
        {activeTab === 'model-builder' && (
          <div>
            <div style={{ padding: '1rem' }}>
              <h3>Model Builder</h3>
              <p>Build models using microblocks</p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.5rem' }}>
                Coming soon: Full Model Builder integration
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

