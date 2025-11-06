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
import type { AvatarBuilderCore } from '../components/avatar-builder/AvatarBuilderCore';

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
          setLoadout(savedLoadout);
        } else {
          // Explicitly use default loadout when no saved loadout exists (404)
          setLoadout(DEFAULT_AVATAR_LOADOUT);
        }
      } catch (error) {
        // When loading fails (network error, server error, etc.), use base avatar
        console.error('Failed to load saved avatar loadout:', error);
        setLoadout(DEFAULT_AVATAR_LOADOUT);
        
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
  }, [user?.id, showToast]);

  const handleLoadoutChange = useCallback((newLoadout: AvatarLoadout) => {
    setLoadout(newLoadout);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showToast('You must be logged in to save', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await profilesApi.saveAvatarLoadout(user.id, loadout);
      showToast('Avatar saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save avatar loadout:', error);
      showToast('Failed to save avatar', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, loadout, showToast]);

  const handleReset = useCallback(() => {
    setLoadout(DEFAULT_AVATAR_LOADOUT);
  }, []);

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

