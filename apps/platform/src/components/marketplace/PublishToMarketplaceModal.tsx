import { useState, useEffect } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { studioApi, type StudioProject, type AvatarPreset } from '../../api/studio';
import { marketplaceApi } from '../../api/marketplace';
import { useToast } from '../../contexts/ToastContext';
import './PublishToMarketplaceModal.css';
import type { GameProjectConfig } from '@shared/types/project';

interface PublishToMarketplaceModalProps {
  type: 'build' | 'avatar';
  onClose: () => void;
  onPublished?: () => void;
}

export function PublishToMarketplaceModal({ type, onClose, onPublished }: PublishToMarketplaceModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [avatars, setAvatars] = useState<AvatarPreset[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<GameProjectConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type === 'build') {
      void loadProjects();
    } else if (type === 'avatar') {
      void loadAvatars();
    } else {
      setLoadingProjects(false);
    }
  }, [type]);

  useEffect(() => {
    // Auto-fill title when project is selected
    if (selectedProjectId && type === 'build') {
      const project = projects.find((p) => p.id === selectedProjectId);
      if (project) {
        setTitle(project.name);
        const config = project.projectData?.config ?? null;
        setSelectedConfig(config);

        const resolvedDescription =
          project.description || config?.info.description || '';
        setDescription(resolvedDescription);

        const tags = [...(project.tags ?? [])];
        if (config?.info.genre && !tags.includes(config.info.genre)) {
          tags.push(config.info.genre);
        }
        setTagsInput(tags.join(', '));
      }
    } else if (selectedAvatarId && type === 'avatar') {
      const avatar = avatars.find((a) => a.id === selectedAvatarId);
      if (avatar) {
        setTitle(avatar.name);
        setDescription(avatar.description || '');
        setTagsInput(avatar.tags?.join(', ') || '');
      }
      setSelectedConfig(null);
    } else {
      setSelectedConfig(null);
    }
  }, [selectedProjectId, selectedAvatarId, projects, avatars, type]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await studioApi.getProjects();
      // Filter out already published projects
      const unpublishedProjects = response.projects.filter((p) => !p.isPublished);
      setProjects(unpublishedProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('Nie udało się załadować projektów', 'error');
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadAvatars = async () => {
    try {
      setLoadingProjects(true);
      const response = await studioApi.getAvatarPresets();
      // Filter out already published avatars
      const unpublishedAvatars = response.presets.filter((a) => !a.isPublished);
      setAvatars(unpublishedAvatars);
    } catch (error) {
      console.error('Failed to load avatars:', error);
      showToast('Nie udało się załadować avatar presets', 'error');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Tytuł jest wymagany');
      return;
    }

    if (type === 'build' && !selectedProjectId) {
      setError('Wybierz projekt do publikacji');
      return;
    }

    if (type === 'avatar' && !selectedAvatarId) {
      setError('Wybierz avatar do publikacji');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (type === 'build') {
        // Publish build from studio project
        await studioApi.publishProject(selectedProjectId, {
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0),
        });
        showToast('Build opublikowany w marketplace!', 'success');
      } else if (type === 'avatar') {
        // Publish avatar preset
        await studioApi.publishAvatarPreset(selectedAvatarId, {
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0),
        });
        showToast('Avatar opublikowany w marketplace!', 'success');
      }

      onPublished?.();
      onClose();
    } catch (err) {
      console.error('Failed to publish:', err);
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się opublikować';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="publish-to-marketplace-overlay" onClick={onClose}>
      <Card className="publish-to-marketplace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="publish-modal-header">
          <h2 className="publish-modal-title">
            Opublikuj {type === 'build' ? 'Build' : 'Avatar'} w Marketplace
          </h2>
          <button
            className="publish-modal-close"
            onClick={onClose}
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {type === 'build' && (
            <div className="publish-modal-field">
              <label htmlFor="publish-project" className="publish-modal-label">
                Wybierz projekt <span className="required">*</span>
              </label>
              {loadingProjects ? (
                <div className="publish-modal-loading">Ładowanie projektów...</div>
              ) : projects.length === 0 ? (
                <div className="publish-modal-empty">
                  <p>Brak projektów do publikacji.</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginTop: 'var(--spacing-2)' }}>
                    Stwórz projekt w <a href="/studio" style={{ color: 'var(--color-accent-400)' }}>Studio</a> aby móc go opublikować.
                  </p>
                </div>
              ) : (
                <select
                  id="publish-project"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="publish-modal-select"
                  required
                  disabled={loading}
                >
                  <option value="">-- Wybierz projekt --</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {type === 'build' && selectedConfig && (
            <div className="publish-modal-config-preview">
              <h4>Konfiguracja gry</h4>
              <ul>
                <li>
                  <strong>Widoczność:</strong> {selectedConfig.info.visibility}
                </li>
                <li>
                  <strong>Gatunek:</strong> {selectedConfig.info.genre}
                </li>
                <li>
                  <strong>Max graczy:</strong> {selectedConfig.gameplay.maxPlayers}
                  {selectedConfig.gameplay.allowJoinInProgress ? ' (join in progress: on)' : ''}
                </li>
                <li>
                  <strong>Respawn:</strong> {selectedConfig.gameplay.respawnEnabled ? 'włączony' : 'wyłączony'}
                </li>
                <li>
                  <strong>Spawn:</strong>{' '}
                  {selectedConfig.world.spawn.position.map((v) => v.toFixed(2)).join(', ')}
                </li>
                <li>
                  <strong>FOV kamery:</strong> {selectedConfig.camera.fov}°
                </li>
              </ul>
            </div>
          )}

          {type === 'avatar' && (
            <div className="publish-modal-field">
              <label htmlFor="publish-avatar" className="publish-modal-label">
                Wybierz avatar <span className="required">*</span>
              </label>
              {loadingProjects ? (
                <div className="publish-modal-loading">Ładowanie avatar presets...</div>
              ) : avatars.length === 0 ? (
                <div className="publish-modal-empty">
                  <p>Brak avatar presets do publikacji.</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginTop: 'var(--spacing-2)' }}>
                    Stwórz avatar preset w <a href="/avatar-builder" style={{ color: 'var(--color-accent-400)' }}>Avatar Builder</a> aby móc go opublikować.
                  </p>
                </div>
              ) : (
                <select
                  id="publish-avatar"
                  value={selectedAvatarId}
                  onChange={(e) => setSelectedAvatarId(e.target.value)}
                  className="publish-modal-select"
                  required
                  disabled={loading}
                >
                  <option value="">-- Wybierz avatar --</option>
                  {avatars.map((avatar) => (
                    <option key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="publish-modal-field">
            <label htmlFor="publish-title" className="publish-modal-label">
              Tytuł <span className="required">*</span>
            </label>
            <input
              id="publish-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nazwa twojego projektu"
              maxLength={200}
              required
              className="publish-modal-input"
              disabled={loading || (type === 'build' && !selectedProjectId) || (type === 'avatar' && !selectedAvatarId)}
            />
            <span className="publish-modal-hint">{title.length}/200 znaków</span>
          </div>

          <div className="publish-modal-field">
            <label htmlFor="publish-description" className="publish-modal-label">
              Opis
            </label>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opisz swój projekt (opcjonalnie)"
              rows={4}
              maxLength={1000}
              className="publish-modal-textarea"
              disabled={loading || (type === 'build' && !selectedProjectId) || (type === 'avatar' && !selectedAvatarId)}
            />
            <span className="publish-modal-hint">{description.length}/1000 znaków</span>
          </div>

          <div className="publish-modal-field">
            <label htmlFor="publish-tags" className="publish-modal-label">
              Tagi
            </label>
            <input
              id="publish-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="building, castle, medieval (oddzielone przecinkami)"
              className="publish-modal-input"
              disabled={loading || (type === 'build' && !selectedProjectId) || (type === 'avatar' && !selectedAvatarId)}
            />
            <span className="publish-modal-hint">
              Oddziel tagi przecinkami. Pomagają użytkownikom znaleźć twój projekt.
            </span>
          </div>

          {error && (
            <div className="publish-modal-error">
              {error}
            </div>
          )}

          <div className="publish-modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !title.trim() || (type === 'build' && !selectedProjectId) || (type === 'avatar' && !selectedAvatarId)}
            >
              {loading ? 'Publikowanie...' : 'Opublikuj'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

