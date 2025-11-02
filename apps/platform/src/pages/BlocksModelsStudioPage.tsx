/**
 * BlocksModelsStudioPage - Main page for Blocks/Models Studio
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/layout/Layout';
import { BlocksModelsStudioViewport } from '../components/blocks-models-studio/BlocksModelsStudioViewport';
import { BlocksModelsStudioPanel } from '../components/blocks-models-studio/BlocksModelsStudioPanel';
import type { BlockDefinition } from '@engine/blocks';
import type { Vec3 } from '@engine/core/math';

/**
 * Main Blocks/Models Studio page
 */
export function BlocksModelsStudioPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [selectedBlock, setSelectedBlock] = useState<BlockDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const viewportCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load saved blocks on mount
  useEffect(() => {
    const loadSavedBlocks = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // TODO: Load saved blocks from API or localStorage
        // For now, just mark as loaded
      } catch (error) {
        console.error('Failed to load saved blocks:', error);
        showToast('Failed to load saved blocks', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedBlocks();
  }, [user?.id, showToast]);

  const handleBlockChange = useCallback((block: BlockDefinition) => {
    setSelectedBlock(block);
    setHasUnsavedChanges(true);
  }, []);

  const handleBlockPlaced = useCallback((block: BlockDefinition, position: Vec3, scale: Vec3) => {
    setHasUnsavedChanges(true);
    showToast(`Block "${block.name}" placed at (${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)})`, 'success');
  }, [showToast]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showToast('You must be logged in to save', 'error');
      return;
    }

    try {
      // Save custom blocks to localStorage
      // TODO: In future, save to API
      const customBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
      localStorage.setItem(`user_${user.id}_customBlocks`, JSON.stringify(customBlocks));
      setHasUnsavedChanges(false);
      showToast('Blocks saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save blocks:', error);
      showToast('Failed to save blocks', 'error');
    }
  }, [user?.id, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, handleSave]);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <div>Loading Blocks/Models Studio...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="blocks-models-studio-page">
        <div className="blocks-models-studio-container">
          <div className="blocks-models-studio-sidebar">
            <BlocksModelsStudioPanel
              selectedBlock={selectedBlock}
              onBlockChange={handleBlockChange}
              onSave={handleSave}
              hasUnsavedChanges={hasUnsavedChanges}
              viewportRef={viewportCanvasRef}
            />
          </div>
          <div className="blocks-models-studio-viewport">
            <BlocksModelsStudioViewport
              selectedBlock={selectedBlock}
              onBlockChange={handleBlockChange}
              onBlockPlaced={handleBlockPlaced}
              ref={viewportCanvasRef}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

