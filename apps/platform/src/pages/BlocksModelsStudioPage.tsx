/**
 * BlocksModelsStudioPage - Main page for Blocks/Models Studio
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/layout/Layout';
import { BlocksModelsStudioViewport } from '../components/blocks-models-studio/BlocksModelsStudioViewport';
import { BlocksModelsStudioPanel } from '../components/blocks-models-studio/BlocksModelsStudioPanel';
import { BlocksModelsStudioCore } from '../components/blocks-models-studio/BlocksModelsStudioCore';
import { studioApi, type SavedBlock } from '../api/studio';
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
  const coreRef = useRef<BlocksModelsStudioCore | null>(null);

  // Note: Loading is now handled in onCoreReady callback

  const handleBlockChange = useCallback((block: BlockDefinition) => {
    setSelectedBlock(block);
    setHasUnsavedChanges(true);
  }, []);

  const handleBlockPlaced = useCallback((block: BlockDefinition, position: Vec3, scale: Vec3) => {
    setHasUnsavedChanges(true);
    showToast(`Block "${block.name}" placed at (${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)}) with scale (${scale[0].toFixed(1)}, ${scale[1].toFixed(1)}, ${scale[2].toFixed(1)})`, 'success');
  }, [showToast]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showToast('You must be logged in to save', 'error');
      return;
    }

    if (!coreRef.current) {
      showToast('Studio not initialized', 'error');
      return;
    }

    try {
      // Get all blocks from scene
      const allBlocks = coreRef.current.getAllBlocks();
      
      const blocksToSave = allBlocks.map((block) => ({
        blockDefinition: block.blockDefinition,
        position: block.position,
        rotation: block.rotation,
        scale: block.scale,
      }));

      // Try to save to API first
      try {
        await studioApi.saveBlocks({ blocks: blocksToSave });
        showToast('Blocks saved successfully to cloud!', 'success');
      } catch (apiError) {
        // Fallback to localStorage if API fails
        console.warn('Failed to save blocks to API, using localStorage:', apiError);
        const localStorageKey = `user_${user.id}_customBlocks`;
        localStorage.setItem(localStorageKey, JSON.stringify(blocksToSave));
        showToast('Blocks saved to local storage', 'success');
      }

      setHasUnsavedChanges(false);
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
              onCoreReady={(core) => {
                coreRef.current = core;
                // Trigger load after core is ready
                if (user?.id) {
                  // Load blocks when core is ready
                  const loadSavedBlocks = async () => {
                    try {
                      let savedBlocks: SavedBlock[] = [];

                      // Try to load from API first
                      try {
                        const response = await studioApi.getSavedBlocks();
                        savedBlocks = response.blocks;
                      } catch (apiError) {
                        // Fallback to localStorage if API fails
                        console.warn('Failed to load blocks from API, trying localStorage:', apiError);
                        const localStorageKey = `user_${user.id}_customBlocks`;
                        const stored = localStorage.getItem(localStorageKey);
                        if (stored) {
                          try {
                            const parsed = JSON.parse(stored);
                            // Convert localStorage format to SavedBlock format if needed
                            if (Array.isArray(parsed)) {
                              savedBlocks = parsed.map((block: any, index: number) => ({
                                id: block.id || `block_${index}`,
                                blockDefinition: block.blockDefinition || block,
                                position: block.position || [0, 0, 0],
                                rotation: block.rotation || [0, 0, 0, 1],
                                scale: block.scale || [1, 1, 1],
                                createdAt: block.createdAt || Date.now(),
                                updatedAt: block.updatedAt || Date.now(),
                              }));
                            }
                          } catch (parseError) {
                            console.error('Failed to parse localStorage blocks:', parseError);
                          }
                        }
                      }

                      // Load blocks into scene
                      if (savedBlocks.length > 0) {
                        core.loadBlocks(
                          savedBlocks.map((block) => ({
                            blockDefinition: block.blockDefinition,
                            position: block.position,
                            rotation: block.rotation,
                            scale: block.scale,
                          }))
                        );
                      }
                      setIsLoading(false);
                    } catch (error) {
                      console.error('Failed to load saved blocks:', error);
                      showToast('Failed to load saved blocks', 'error');
                      setIsLoading(false);
                    }
                  };
                  loadSavedBlocks();
                } else {
                  setIsLoading(false);
                }
              }}
              ref={viewportCanvasRef}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

