import { Entity } from '@engine/world';
import { EnvironmentComponent } from '@engine/world/components/EnvironmentComponent';
import { Scene } from '@engine/world';
import type { EditorState } from '../core/state';
import { ProjectStorage, type ProjectData, type ProjectMetadata } from './ProjectStorage';
import { Logger } from '../../utils/logger';

export type ProjectSaveStatus = 'Saved' | 'Unsaved' | 'Saving...' | '';

export interface ProjectManagerOptions {
  scene: Scene;
  state: EditorState;
  updateSceneBuffers: () => void;
  showStatusMessage: (message: string, duration?: number) => void;
  onSaveStatusChange: (status: ProjectSaveStatus) => void;
}

export class ProjectManager {
  private readonly projectStorage = new ProjectStorage();
  private readonly storageReady: Promise<void>;
  private storageInitError: unknown = null;
  private currentProjectId: string | null = null;
  private unsavedChanges = false;
  private autoSaveInterval: number | null = null;

  constructor(private readonly options: ProjectManagerOptions) {
    this.storageReady = this.projectStorage.initialize().catch((error) => {
      this.storageInitError = error;
      Logger.error('Project storage initialization failed:', error);
      return Promise.reject(error);
    });
  }

  public initialize(): void {
    if (this.autoSaveInterval !== null) return;
    this.autoSaveInterval = window.setInterval(() => {
      if (this.unsavedChanges && this.currentProjectId) {
        void this.autoSave();
      }
    }, 30000);
  }

  public dispose(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  public markUnsaved(): void {
    this.unsavedChanges = true;
    this.options.onSaveStatusChange('Unsaved');
  }

  public async newProject(): Promise<void> {
    if (this.unsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Start a new project?');
      if (!confirmed) return;
    }

    const rootEntities = [...this.options.scene.rootEntities];
    for (const entity of rootEntities) {
      this.options.scene.removeEntity(entity);
    }

    this.currentProjectId = null;
    this.unsavedChanges = false;
    this.options.onSaveStatusChange('');
    try {
      const env = new Entity('Environment');
      env.addComponent(new EnvironmentComponent());
      this.options.scene.addEntity(env);
    } catch {
      // Ignore if unavailable in test environment
    }
    this.options.updateSceneBuffers();
    this.options.showStatusMessage('New project created', 1500);
  }

  public async saveProject(): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to save.', 1500);
      return;
    }

    if (!this.currentProjectId) {
      await this.saveProjectAs();
      return;
    }

    await this.performSave(this.currentProjectId);
  }

  public async saveProjectAs(): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to save.', 1500);
      return;
    }

    const name = window.prompt('Project name:', this.currentProjectId || 'My Project');
    if (!name || name.trim() === '') return;

    const trimmedName = name.trim();
    if (!(await this.ensureStorageReady())) {
      this.options.showStatusMessage('Unable to save project: storage unavailable.', 2000);
      return;
    }

    const id = this.normalizeProjectId(trimmedName);
    if (
      id !== this.currentProjectId &&
      (await this.projectStorage.hasProject(id)) &&
      !window.confirm(`Project "${trimmedName}" already exists. Overwrite?`)
    ) {
      return;
    }

    this.currentProjectId = id;
    await this.performSave(id, trimmedName);
  }

  public async showLoadDialog(): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to load.', 1500);
      return;
    }

    if (!(await this.ensureStorageReady())) {
      this.options.showStatusMessage('Unable to load projects: storage unavailable.', 2000);
      alert('Project storage is unavailable.');
      return;
    }

    try {
      const projects = await this.projectStorage.listProjects();
      if (projects.length === 0) {
        alert('No saved projects found.');
        return;
      }

      const modal = document.createElement('div');
      Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000',
      } as CSSStyleDeclaration);

      const dialog = document.createElement('div');
      Object.assign(dialog.style, {
        background: 'rgba(7, 11, 20, 0.95)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '70vh',
        overflowY: 'auto',
        color: '#f5f5f5',
        fontFamily: 'Inter, system-ui, sans-serif',
      } as CSSStyleDeclaration);

      const title = document.createElement('h3');
      title.textContent = 'Load Project';
      Object.assign(title.style, {
        margin: '0 0 1rem 0',
        fontSize: '1.2rem',
        fontWeight: '600',
      } as CSSStyleDeclaration);
      dialog.appendChild(title);

      const list = document.createElement('div');
      Object.assign(list.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      } as CSSStyleDeclaration);

      for (const project of projects) {
        const item = document.createElement('div');
        Object.assign(item.style, {
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        } as CSSStyleDeclaration);

        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(255, 255, 255, 0.12)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'rgba(255, 255, 255, 0.06)';
        });

        const info = document.createElement('div');
        const nameEl = document.createElement('div');
        nameEl.textContent = project.name;
        Object.assign(nameEl.style, {
          fontWeight: '500',
          marginBottom: '0.25rem',
        } as CSSStyleDeclaration);

        const dateEl = document.createElement('div');
        dateEl.textContent = new Date(project.updatedAt).toLocaleString();
        Object.assign(dateEl.style, {
          fontSize: '0.85rem',
          color: 'rgba(255, 255, 255, 0.6)',
        } as CSSStyleDeclaration);

        info.appendChild(nameEl);
        info.appendChild(dateEl);

        const actions = document.createElement('div');
        Object.assign(actions.style, {
          display: 'flex',
          gap: '0.5rem',
        } as CSSStyleDeclaration);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.type = 'button';
        Object.assign(loadBtn.style, {
          padding: '0.35rem 0.75rem',
          background: 'rgba(39, 201, 63, 0.2)',
          border: '1px solid rgba(39, 201, 63, 0.4)',
          borderRadius: '6px',
          color: '#f5f5f5',
          cursor: 'pointer',
        } as CSSStyleDeclaration);
        loadBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          document.body.removeChild(modal);
          await this.loadProject(project.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️';
        deleteBtn.type = 'button';
        Object.assign(deleteBtn.style, {
          padding: '0.35rem 0.5rem',
          background: 'rgba(255, 95, 86, 0.2)',
          border: '1px solid rgba(255, 95, 86, 0.4)',
          borderRadius: '6px',
          cursor: 'pointer',
        } as CSSStyleDeclaration);
        deleteBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          const confirmed = window.confirm(`Delete project "${project.name}"?`);
          if (confirmed) {
            if (!(await this.ensureStorageReady())) {
              this.options.showStatusMessage('Unable to delete project: storage unavailable.', 2000);
              return;
            }
            await this.projectStorage.deleteProject(project.id);
            item.remove();
          }
        });

        actions.appendChild(loadBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      }

      dialog.appendChild(list);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.type = 'button';
      Object.assign(closeBtn.style, {
        marginTop: '1rem',
        padding: '0.5rem 1rem',
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '8px',
        color: '#f5f5f5',
        cursor: 'pointer',
        width: '100%',
      } as CSSStyleDeclaration);
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });

      dialog.appendChild(closeBtn);
      modal.appendChild(dialog);
      document.body.appendChild(modal);

      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          document.body.removeChild(modal);
        }
      });
    } catch (error) {
      Logger.error('Load dialog failed:', error);
      alert('Failed to load projects.');
    }
  }

  public async loadProject(id: string): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to load.', 1500);
      return;
    }

    if (this.unsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Load project?');
      if (!confirmed) return;
    }

    if (!(await this.ensureStorageReady())) {
      this.options.showStatusMessage('Unable to load project: storage unavailable.', 2000);
      return;
    }

    // Backup current scene for rollback
    const backup = this.options.scene.toJSON();

    try {
      const project = await this.projectStorage.loadProject(id);
      if (!project) {
        alert('Project not found.');
        return;
      }

      const newScene = Scene.fromJSON(project.scene);
      this.resetSceneRootEntities(newScene.rootEntities);

      this.currentProjectId = id;
      this.unsavedChanges = false;
      this.options.onSaveStatusChange('Saved');
      this.options.updateSceneBuffers();
      this.options.showStatusMessage(`Loaded: ${project.metadata.name}`, 1500);
    } catch (error) {
      Logger.error('Load failed:', error);
      // Attempt rollback to previous scene state
      try {
        const restored = Scene.fromJSON(backup);
        this.resetSceneRootEntities(restored.rootEntities);
        this.options.updateSceneBuffers();
      } catch (rollbackError) {
        Logger.error('Rollback failed:', rollbackError);
      }
      alert('Failed to load project.');
    }
  }

  private async performSave(id: string, name?: string): Promise<void> {
    if (!(await this.ensureStorageReady())) {
      this.options.onSaveStatusChange('Unsaved');
      this.options.showStatusMessage('Unable to save project: storage unavailable.', 2000);
      return;
    }

    this.options.onSaveStatusChange('Saving...');

    try {
      const sceneData = this.options.scene.toJSON();
      const metadata: ProjectMetadata = {
        id,
        name: name || id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const existing = await this.projectStorage.loadProject(id);
      if (existing) {
        metadata.createdAt = existing.metadata.createdAt;
      }

      const projectData: ProjectData = { metadata, scene: sceneData };
      await this.projectStorage.saveProject(projectData);

      this.unsavedChanges = false;
      this.options.onSaveStatusChange('Saved');
      this.options.showStatusMessage(`Saved: ${metadata.name}`, 1500);
    } catch (error) {
      Logger.error('Save failed:', error);
      this.options.onSaveStatusChange('Unsaved');
      this.options.showStatusMessage('Save failed!', 2000);
    }
  }

  private async autoSave(): Promise<void> {
    if (!this.currentProjectId) return;

    if (!(await this.ensureStorageReady())) return;

    try {
      const sceneData = this.options.scene.toJSON();
      const existing = await this.projectStorage.loadProject(this.currentProjectId);
      if (!existing) return;

      const metadata: ProjectMetadata = {
        ...existing.metadata,
        updatedAt: Date.now(),
      };

      const projectData: ProjectData = { metadata, scene: sceneData };
      await this.projectStorage.saveProject(projectData);

      this.unsavedChanges = false;
      this.options.onSaveStatusChange('Saved');
    } catch (error) {
      Logger.warn('Auto-save failed:', error);
    }
  }

  private async ensureStorageReady(): Promise<boolean> {
    if (this.storageInitError) {
      return false;
    }

    try {
      await this.storageReady;
      return true;
    } catch (error) {
      if (!this.storageInitError) {
        this.storageInitError = error;
      }
      Logger.error('Project storage unavailable:', error);
      return false;
    }
  }

  private normalizeProjectId(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private resetSceneRootEntities(entities: Iterable<Entity>): void {
    const existing = [...this.options.scene.rootEntities];
    for (const entity of existing) {
      this.options.scene.removeEntity(entity);
    }

    for (const entity of entities) {
      this.options.scene.addEntity(entity);
    }
  }
}
