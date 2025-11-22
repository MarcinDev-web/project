import { Entity } from '@engine/world';
import { Scene } from '@engine/world';
import { applyTo, type TemplateMetadata } from '@engine/world-templates';
import type { EditorState } from '../core/state';
import { ProjectStorage, type ProjectData, type ProjectMetadata } from './ProjectStorage';
import { Logger } from '../../utils/logger';
import { ShareClient } from '@engine/net';
import { NewProjectDialog, type NewProjectConfig } from '../ui/modals/NewProjectDialog';
import { SaveProjectDialog, type ValidationResult } from '../ui/modals/SaveProjectDialog';
import { LoadProjectDialog } from '../ui/modals/LoadProjectDialog';
import { MarketplaceApiClient } from '../../utils/marketplaceApi';
import {
  createDefaultGameProjectConfig,
  type GameProjectConfig,
} from '@shared/types/project';

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
  private projectConfig: GameProjectConfig = createDefaultGameProjectConfig();
  private autoSaveInterval: number | null = null;
  private newProjectDialog: NewProjectDialog | null = null;
  private saveProjectDialog: SaveProjectDialog | null = null;
  private loadProjectDialog: LoadProjectDialog | null = null;

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
    if (!this.confirmDiscardChanges()) return;

    // Show new project configuration dialog
    if (typeof document !== 'undefined') {
      this.newProjectDialog ??= new NewProjectDialog();
      const result = await this.newProjectDialog.show({
        defaultName: 'My Project',
        defaultSaveImmediately: false,
      });

      if (!result) {
        // User cancelled - don't create project
        return;
      }

      const { config } = result;

      this.setInitialProjectConfig(config.name, config.description);
      this.applyConfigOverrides(config.configOverrides);

      // Reset scene
      this.resetScene();

      // Apply template if selected
      if (config.template) {
        try {
          await applyTo(this.options.scene, config.template.id, { clear: true });
          this.options.scene.name = config.name;
        } catch (error) {
          Logger.error('Failed to apply template:', error);
          // Fallback to empty template
          await applyTo(this.options.scene, 'template:empty', { clear: true });
          this.options.scene.name = config.name;
          this.finalizeNewProject(`Template failed, created project "${config.name}"`);
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert('Failed to load selected template. Created an empty project instead.');
          }
        }
      } else {
        // Create empty project (use Empty template which has lights/floor)
        await applyTo(this.options.scene, 'template:empty', { clear: true });
        this.options.scene.name = config.name;
      }

      // Save immediately if requested
      if (config.saveImmediately) {
        const id = this.normalizeProjectId(config.name);
        this.currentProjectId = id;
        await this.performSave(id, config.name);
        this.options.showStatusMessage(`Created and saved: ${config.name}`, 1500);
      } else {
        this.finalizeNewProject(`Created: ${config.name}`);
      }

      return;
    }

    // Fallback for non-browser environments (tests)
    this.setInitialProjectConfig('New Project');
    this.resetScene();
    // Best effort to apply empty template in tests, ignore errors if registry not ready
    try {
      await applyTo(this.options.scene, 'template:empty', { clear: true });
    } catch {
      // Ignore in tests
    }
    this.finalizeNewProject('New project created');
  }

  public async newProjectFromTemplate(template: TemplateMetadata): Promise<void> {
    if (!this.confirmDiscardChanges()) return;

    this.setInitialProjectConfig(template.name, template.description);
    this.resetScene();
    try {
      await applyTo(this.options.scene, template.id, { clear: true });
      this.options.scene.name = template.name;
      this.finalizeNewProject(`Created from "${template.name}"`);
    } catch (error) {
      Logger.error('Failed to apply template:', error);
      await applyTo(this.options.scene, 'template:empty', { clear: true });
      this.finalizeNewProject('Template failed, created empty project');
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Failed to load selected template. Created an empty project instead.');
      }
    }
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

    // Fallback/Guard for headless environments
    if (typeof document === 'undefined') return;

    if (!(await this.ensureStorageReady())) {
      this.options.showStatusMessage('Unable to save project: storage unavailable.', 2000);
      return;
    }

    this.saveProjectDialog ??= new SaveProjectDialog();
    
    const currentName = this.projectConfig.info.name || 'My Project';
    const currentDescription = this.projectConfig.info.description || '';

    const result = await this.saveProjectDialog.show({
      defaultName: currentName,
      defaultDescription: currentDescription,
      validator: async (name: string): Promise<ValidationResult> => {
        const id = this.normalizeProjectId(name);
        
        // If the ID matches the current project, it's not a conflict (it's a save)
        // However, Save As usually creates a copy if the name is different.
        // If the name is the same, it's effectively just a Save.
        if (id === this.currentProjectId) {
          return null;
        }

        const exists = await this.projectStorage.hasProject(id);
        if (exists) {
          return {
            warning: 'Project already exists. Overwrite?',
            canOverwrite: true
          };
        }
        
        return null;
      }
    });

    if (!result) return;

    const { name, description } = result;
    const id = this.normalizeProjectId(name);

    this.currentProjectId = id;
    this.projectConfig.info.name = name;
    if (description) {
      this.projectConfig.info.description = description;
    }

    await this.performSave(id, name);
  }

  public async showLoadDialog(): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to load.', 1500);
      return;
    }

    // Fallback for headless environments
    if (typeof document === 'undefined') return;

    if (!(await this.ensureStorageReady())) {
      this.options.showStatusMessage('Unable to load projects: storage unavailable.', 2000);
      alert('Project storage is unavailable.');
      return;
    }

    try {
      const projects = await this.projectStorage.listProjects();
      
      this.loadProjectDialog ??= new LoadProjectDialog();
      
      const selectedProjectId = await this.loadProjectDialog.show(
        projects,
        async (id) => {
          if (!(await this.ensureStorageReady())) {
            this.options.showStatusMessage('Unable to delete project: storage unavailable.', 2000);
            return;
          }
          await this.projectStorage.deleteProject(id);
        }
      );

      if (selectedProjectId) {
        await this.loadProject(selectedProjectId);
      }
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
    const backupConfig = this.projectConfig;

    try {
      const project = await this.projectStorage.loadProject(id);
      if (!project) {
        alert('Project not found.');
        return;
      }

      const newScene = Scene.fromJSON(project.scene);
      this.resetSceneRootEntities(newScene.rootEntities);
      this.projectConfig = this.normalizeProjectConfig(project.config, project.metadata);

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
        this.projectConfig = backupConfig;
      } catch (rollbackError) {
        Logger.error('Rollback failed:', rollbackError);
      }
      alert('Failed to load project.');
    }
  }

  /**
   * Import a build from marketplace
   */
  public async importMarketplaceBuild(itemId: string): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to import build.', 1500);
      return;
    }

    if (this.unsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Import build?');
      if (!confirmed) return;
    }

    // Backup current scene for rollback
    const backup = this.options.scene.toJSON();
    const backupConfig = this.projectConfig;

    try {
      this.options.showStatusMessage('Downloading build from marketplace...', 0);

      const marketplaceClient = new MarketplaceApiClient({
        baseUrl: '/api',
        getAuthToken: () => localStorage.getItem('forge_token') || null,
      });

      // Get item details
      const item = await marketplaceClient.getItem(itemId);
      
      if (item.type !== 'build') {
        throw new Error('Item is not a build');
      }

      // Download the build file
      let fileUrl: string;
      if (item.price && item.price.amount > 0) {
        // Paid item - need to purchase first
        const purchaseResult = await marketplaceClient.purchaseItem(itemId);
        fileUrl = purchaseResult.fileUrl;
      } else {
        // Free item
        const downloadResult = await marketplaceClient.downloadFreeItem(itemId);
        fileUrl = downloadResult.fileUrl;
      }

      // Fetch the project file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download build file: ${response.status}`);
      }

      const projectData = await response.json() as ProjectData;

      // Load the scene
      const newScene = Scene.fromJSON(projectData.scene);
      this.resetSceneRootEntities(newScene.rootEntities);
      this.projectConfig = this.normalizeProjectConfig(projectData.config, {
        name: projectData.metadata.name,
        description: projectData.metadata.description,
      });

      // Clear current project (imported builds are not saved automatically)
      this.currentProjectId = null;
      this.unsavedChanges = true;
      this.options.onSaveStatusChange('Unsaved');
      this.options.updateSceneBuffers();
      this.options.showStatusMessage(`Imported: ${item.title}`, 2000);
    } catch (error) {
      Logger.error('Import failed:', error);
      // Attempt rollback to previous scene state
      try {
        const restored = Scene.fromJSON(backup);
        this.resetSceneRootEntities(restored.rootEntities);
        this.options.updateSceneBuffers();
        this.projectConfig = backupConfig;
      } catch (rollbackError) {
        Logger.error('Rollback failed:', rollbackError);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to import build: ${errorMessage}`);
      this.options.showStatusMessage('Import failed!', 2000);
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
      const existing = await this.projectStorage.loadProject(id);

      const metadata: ProjectMetadata = {
        id,
        name: name || this.projectConfig.info.name || existing?.metadata.name || id,
        createdAt: existing?.metadata.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        ...(existing?.metadata.thumbnail ? { thumbnail: existing.metadata.thumbnail } : {}),
      };

      const description = this.projectConfig.info.description ?? existing?.metadata.description;
      if (description) {
        metadata.description = description;
      }

      const normalizedConfig = this.syncConfigWithMetadata(metadata);

      const projectData: ProjectData = { metadata, scene: sceneData, config: normalizedConfig };
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
        name: this.projectConfig.info.name || existing.metadata.name,
        ...(this.projectConfig.info.description
          ? { description: this.projectConfig.info.description }
          : {}),
        updatedAt: Date.now(),
      };

      const normalizedConfig = this.syncConfigWithMetadata(metadata);
      const projectData: ProjectData = { metadata, scene: sceneData, config: normalizedConfig };
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

  private setInitialProjectConfig(name: string, description?: string): void {
    this.projectConfig = createDefaultGameProjectConfig(name, description);
  }

  private normalizeProjectConfig(
    config: GameProjectConfig | undefined,
    metadata: Pick<ProjectMetadata, 'name'> & { description?: string | undefined }
  ): GameProjectConfig {
    const base = config ?? createDefaultGameProjectConfig(metadata.name, metadata.description);
    const description = metadata.description ?? base.info.description;

    return {
      ...base,
      info: {
        ...base.info,
        name: metadata.name,
        ...(description ? { description } : {}),
      },
    };
  }

  private syncConfigWithMetadata(metadata: ProjectMetadata): GameProjectConfig {
    this.projectConfig = this.normalizeProjectConfig(this.projectConfig, metadata);
    return this.projectConfig;
  }

  private applyConfigOverrides(overrides: NewProjectConfig['configOverrides']): void {
    if (!overrides) return;
    const updated = { ...this.projectConfig };

    if (overrides.visibility) {
      updated.info.visibility = overrides.visibility;
    }
    if (overrides.genre) {
      updated.info.genre = overrides.genre;
    }
    if (typeof overrides.maxPlayers === 'number') {
      updated.gameplay.maxPlayers = Math.max(1, Math.min(64, Math.round(overrides.maxPlayers)));
    }
    if (typeof overrides.allowJoinInProgress === 'boolean') {
      updated.gameplay.allowJoinInProgress = overrides.allowJoinInProgress;
    }
    if (typeof overrides.respawnEnabled === 'boolean') {
      updated.gameplay.respawnEnabled = overrides.respawnEnabled;
    }
    if (overrides.cameraFov !== undefined) {
      updated.camera.fov = Math.max(40, Math.min(120, overrides.cameraFov));
    }
    if (overrides.spawnPosition && overrides.spawnPosition.length === 3) {
      updated.world.spawn.position = [...overrides.spawnPosition] as [number, number, number];
    }
    if (overrides.spawnYaw !== undefined) {
      const yawRad = (overrides.spawnYaw * Math.PI) / 180;
      const half = yawRad / 2;
      const s = Math.sin(half);
      const c = Math.cos(half);
      updated.world.spawn.rotation = [0, s, 0, c];
    }

    this.projectConfig = updated;
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

  private confirmDiscardChanges(): boolean {
    if (!this.unsavedChanges) return true;
    return window.confirm('You have unsaved changes. Start a new project?');
  }

  private resetScene(): void {
    const rootEntities = [...this.options.scene.rootEntities];
    for (const entity of rootEntities) {
      this.options.scene.removeEntity(entity);
    }
  }

  private finalizeNewProject(statusMessage: string): void {
    this.currentProjectId = null;
    this.unsavedChanges = false;
    this.options.onSaveStatusChange('');
    this.options.updateSceneBuffers();
    this.options.showStatusMessage(statusMessage, 1500);
  }

  /**
   * Share the current project and generate a shareable link.
   * Shows a dialog with the link that can be copied.
   */
  public async shareProject(): Promise<void> {
    if (this.options.state.editorMode.value === 'play') {
      this.options.showStatusMessage('Stop play mode to share.', 1500);
      return;
    }

    if (!this.currentProjectId) {
      this.options.showStatusMessage('Save project before sharing.', 2000);
      return;
    }

    try {
      this.options.showStatusMessage('Sharing project...', 1000);

      // Load current project data
      if (!(await this.ensureStorageReady())) {
        this.options.showStatusMessage('Unable to share: storage unavailable.', 2000);
        return;
      }

      const project = await this.projectStorage.loadProject(this.currentProjectId);
      if (!project) {
        this.options.showStatusMessage('Project not found.', 2000);
        return;
      }

      // Share via ShareClient
      const shareClient = new ShareClient('');
      const shareLink = await shareClient.shareProject(this.currentProjectId, project);

      // Show dialog with share link
      this.showShareDialog(shareLink.url, shareLink.token);

      this.options.showStatusMessage('Project shared!', 1500);
    } catch (error) {
      Logger.error('Share failed:', error);
      this.options.showStatusMessage('Failed to share project.', 2000);
    }
  }

  /**
   * Shows a dialog with the share link and copy button.
   */
  private showShareDialog(url: string, _token: string): void {
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
      padding: '2rem',
      maxWidth: '600px',
      width: '90%',
      color: '#f5f5f5',
      fontFamily: 'Inter, system-ui, sans-serif',
    } as CSSStyleDeclaration);

    const title = document.createElement('h3');
    title.textContent = 'Project Shared!';
    Object.assign(title.style, {
      margin: '0 0 1.5rem 0',
      fontSize: '1.5rem',
      fontWeight: '600',
    } as CSSStyleDeclaration);
    dialog.appendChild(title);

    const label = document.createElement('label');
    label.textContent = 'Share Link:';
    Object.assign(label.style, {
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.7)',
    } as CSSStyleDeclaration);
    dialog.appendChild(label);

    const inputContainer = document.createElement('div');
    Object.assign(inputContainer.style, {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
    } as CSSStyleDeclaration);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = url;
    input.readOnly = true;
    Object.assign(input.style, {
      flex: '1',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#f5f5f5',
      fontSize: '0.9rem',
      fontFamily: 'monospace',
    } as CSSStyleDeclaration);
    inputContainer.appendChild(input);

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    Object.assign(copyButton.style, {
      padding: '0.75rem 1.5rem',
      background: 'rgba(59, 130, 246, 0.8)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '0.9rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as CSSStyleDeclaration);
    copyButton.onmouseover = () => {
      copyButton.style.background = 'rgba(59, 130, 246, 1)';
    };
    copyButton.onmouseout = () => {
      copyButton.style.background = 'rgba(59, 130, 246, 0.8)';
    };
    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      } catch (error) {
        // Fallback: select text
        input.select();
        document.execCommand('copy');
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      }
    };
    inputContainer.appendChild(copyButton);
    dialog.appendChild(inputContainer);

    const info = document.createElement('p');
    info.textContent = 'Anyone with this link can view your project.';
    Object.assign(info.style, {
      margin: '0 0 1.5rem 0',
      fontSize: '0.85rem',
      color: 'rgba(255, 255, 255, 0.5)',
    } as CSSStyleDeclaration);
    dialog.appendChild(info);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    Object.assign(closeButton.style, {
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#f5f5f5',
      fontSize: '0.9rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as CSSStyleDeclaration);
    closeButton.onmouseover = () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    closeButton.onmouseout = () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.05)';
    };
    closeButton.onclick = () => {
      document.body.removeChild(modal);
    };
    dialog.appendChild(closeButton);

    modal.appendChild(dialog);

    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        window.removeEventListener('keydown', escapeHandler);
      }
    };
    window.addEventListener('keydown', escapeHandler);

    document.body.appendChild(modal);
  }
}
