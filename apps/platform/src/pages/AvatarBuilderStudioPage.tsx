/**
 * AvatarBuilderStudioPage - Main page for Avatar Builder Studio
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from '../components/layout/Layout';
import { AvatarBuilderViewport } from '../components/avatar-builder/AvatarBuilderViewport';
import { AvatarCustomizationPanel } from '../components/avatar-builder/AvatarCustomizationPanel';
import { profilesApi } from '../api/profiles';
import { DEFAULT_AVATAR_LOADOUT, type AvatarLoadout } from '@engine/avatar';
import { AvatarLoadoutMigrator } from '../components/avatar-builder/AvatarLoadoutMigrator';
import type { AvatarBuilderCore } from '../components/avatar-builder/AvatarBuilderCore';
import { useDebounce } from '../hooks/useDebounce';
import { useLoadoutHistory } from '../hooks/useLoadoutHistory';

/**
 * Main Avatar Builder Studio page
 */
export function AvatarBuilderStudioPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loadout, setLoadout] = useState<AvatarLoadout>(DEFAULT_AVATAR_LOADOUT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [builderCore, setBuilderCore] = useState<AvatarBuilderCore | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Loadout history for undo/redo
  const {
    pushToHistory,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  } = useLoadoutHistory(loadout);
  
  // Debounce loadout for validation (300ms delay)
  const debouncedLoadout = useDebounce(loadout, 300);

  // Load saved loadout on mount
  useEffect(() => {
    const loadSavedLoadout = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const savedLoadout = await profilesApi.loadAvatarLoadout(user.id);
        if (savedLoadout) {
          // Migrate loadout to current version if needed
          const migrationResult = AvatarLoadoutMigrator.migrate(savedLoadout);
          if (migrationResult.migrated) {
            console.log(
              `[AvatarBuilder] Migrated loadout from v${migrationResult.fromVersion} to v${migrationResult.toVersion}`
            );
            // Optionally save migrated loadout back to server
            // await profilesApi.saveAvatarLoadout(user.id, migrationResult.loadout);
          }
          const finalLoadout = migrationResult.loadout;
          setLoadout(finalLoadout);
          // Reset history after state update
          setTimeout(() => resetHistory(finalLoadout), 0);
        } else {
          // Explicitly use default loadout when no saved loadout exists (404)
          setLoadout(DEFAULT_AVATAR_LOADOUT);
          setTimeout(() => resetHistory(DEFAULT_AVATAR_LOADOUT), 0);
        }
      } catch (error) {
        // When loading fails (network error, server error, etc.), use base avatar
        console.error('Failed to load saved avatar loadout:', error);
        setLoadout(DEFAULT_AVATAR_LOADOUT);
        setTimeout(() => resetHistory(DEFAULT_AVATAR_LOADOUT), 0);
        
        // Only show error toast for non-404 errors (404 means no saved loadout, which is fine)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('404') && !errorMessage.includes('not found')) {
          showToast('Failed to load saved avatar. Using base avatar.', 'warning');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedLoadout();
  }, [user?.id, showToast, resetHistory]);

  // Validate loadout when builderCore is ready (debounced)
  useEffect(() => {
    if (builderCore) {
      const validation = builderCore.validateLoadout(debouncedLoadout);
      setValidationErrors(validation.valid ? [] : [...validation.errors]);
    }
  }, [builderCore, debouncedLoadout]);

  const handleLoadoutChange = useCallback((newLoadout: AvatarLoadout) => {
    setLoadout(newLoadout);
    // Push to history for undo/redo
    pushToHistory(newLoadout);
    // Validation is handled by debounced effect above
  }, [pushToHistory]);
  
  const handleUndo = useCallback(() => {
    const previousLoadout = undo();
    if (previousLoadout) {
      setLoadout(previousLoadout);
    }
  }, [undo]);
  
  const handleRedo = useCallback(() => {
    const nextLoadout = redo();
    if (nextLoadout) {
      setLoadout(nextLoadout);
    }
  }, [redo]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showToast('You must be logged in to save', 'error');
      return;
    }

    // Validate before saving
    if (builderCore) {
      const validation = builderCore.validateLoadout(loadout);
      if (!validation.valid) {
        setValidationErrors([...validation.errors]);
        showToast('Cannot save: Avatar loadout has validation errors. Please fix them before saving.', 'warning');
        return;
      }
    }

    setIsSaving(true);
    try {
      await profilesApi.saveAvatarLoadout(user.id, loadout);
      showToast('Avatar saved successfully!', 'success');
      // Clear validation errors on successful save
      setValidationErrors([]);
    } catch (error) {
      console.error('Failed to save avatar loadout:', error);
      showToast('Failed to save avatar', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, loadout, showToast, builderCore]);

  const handleReset = useCallback(() => {
    setLoadout(DEFAULT_AVATAR_LOADOUT);
    resetHistory(DEFAULT_AVATAR_LOADOUT);
    // Clear validation errors on reset
    setValidationErrors([]);
  }, [resetHistory]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          handleUndo();
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        if (canRedo) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, canRedo, handleUndo, handleRedo]);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <div>Loading avatar builder...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="avatar-builder-page">
        <div className="avatar-builder-container">
          <div className="avatar-builder-sidebar">
            <AvatarCustomizationPanel
              loadout={loadout}
              onLoadoutChange={handleLoadoutChange}
              onReset={handleReset}
              onSave={handleSave}
              isSaving={isSaving}
              builderCore={builderCore}
              validationErrors={validationErrors}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
          <div className="avatar-builder-viewport">
            <AvatarBuilderViewport
              initialLoadout={loadout}
              onLoadoutChange={handleLoadoutChange}
              onCoreReady={setBuilderCore}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

