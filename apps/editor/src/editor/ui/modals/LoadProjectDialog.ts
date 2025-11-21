import type { ProjectMetadata } from '../../managers/ProjectStorage';

export interface LoadProjectDialogResult {
  action: 'load' | 'delete' | 'cancel';
  projectId?: string;
}

export class LoadProjectDialog {
  private container: HTMLElement | null = null;

  public async show(
    projects: ProjectMetadata[], 
    onDelete: (projectId: string) => Promise<void>
  ): Promise<string | null> {
    return new Promise((resolve) => {
      // Create modal container
      const modal = document.createElement('div');
      this.container = modal;
      
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

      // Create dialog box
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

      // Title
      const title = document.createElement('h3');
      title.textContent = 'Load Project';
      Object.assign(title.style, {
        margin: '0 0 1rem 0',
        fontSize: '1.2rem',
        fontWeight: '600',
      } as CSSStyleDeclaration);
      dialog.appendChild(title);

      // Project List
      const list = document.createElement('div');
      Object.assign(list.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      } as CSSStyleDeclaration);

      // Empty state check
      if (projects.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No saved projects found.';
        Object.assign(empty.style, {
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
        } as CSSStyleDeclaration);
        list.appendChild(empty);
      }

      // Render projects
      projects.forEach(project => {
        const item = this.createProjectItem(project, resolve, onDelete);
        list.appendChild(item);
      });

      dialog.appendChild(list);

      // Close Button
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
      
      closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255, 255, 255, 0.18)');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'rgba(255, 255, 255, 0.12)');
      
      closeBtn.addEventListener('click', () => {
        this.dispose();
        resolve(null);
      });

      dialog.appendChild(closeBtn);
      modal.appendChild(dialog);
      document.body.appendChild(modal);

      // Event Listeners for closing
      const handleOutsideClick = (event: MouseEvent) => {
        if (event.target === modal) {
          this.dispose();
          resolve(null);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.dispose();
          resolve(null);
        }
      };

      modal.addEventListener('click', handleOutsideClick);
      window.addEventListener('keydown', handleEscape);

      // cleanup reference for dispose
      this.cleanup = () => {
        modal.removeEventListener('click', handleOutsideClick);
        window.removeEventListener('keydown', handleEscape);
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        this.container = null;
      };
    });
  }

  private createProjectItem(
    project: ProjectMetadata, 
    resolve: (id: string | null) => void,
    onDelete: (id: string) => Promise<void>
  ): HTMLElement {
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
      transition: 'background 0.2s',
    } as CSSStyleDeclaration);

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255, 255, 255, 0.12)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'rgba(255, 255, 255, 0.06)';
    });

    // Project Info
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

    // Actions
    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '0.5rem',
    } as CSSStyleDeclaration);

    // Load Button
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
    
    loadBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.dispose();
      resolve(project.id);
    });

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete Project';
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
        await onDelete(project.id);
        item.remove();
      }
    });

    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);
    
    // Click item to load
    item.addEventListener('click', () => {
      this.dispose();
      resolve(project.id);
    });

    return item;
  }

  private cleanup: () => void = () => {};

  public dispose(): void {
    this.cleanup();
  }
}

