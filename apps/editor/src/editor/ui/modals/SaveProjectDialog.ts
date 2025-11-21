
export interface SaveProjectDialogResult {
  name: string;
  description: string;
}

export type ValidationResult = 
  | null 
  | string 
  | { error: string } 
  | { warning: string; canOverwrite: boolean };

export interface SaveProjectDialogOptions {
  defaultName?: string;
  defaultDescription?: string;
  validator?: (name: string) => Promise<ValidationResult>;
}

export class SaveProjectDialog {
  private container: HTMLElement | null = null;
  private resolve: ((value: SaveProjectDialogResult | null) => void) | null = null;
  private isOverwriteState = false;
  private lastValidatedName = '';

  public async show(options: SaveProjectDialogOptions = {}): Promise<SaveProjectDialogResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.render(options);
    });
  }

  private render(options: SaveProjectDialogOptions): void {
    // Remove existing if any
    if (this.container) {
      document.body.removeChild(this.container);
      this.container = null;
    }

    this.isOverwriteState = false;
    this.lastValidatedName = '';

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
      fontFamily: 'Inter, system-ui, sans-serif',
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
      color: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    } as CSSStyleDeclaration);

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Save Project';
    Object.assign(title.style, {
      margin: '0',
      fontSize: '1.2rem',
      fontWeight: '600',
    } as CSSStyleDeclaration);
    dialog.appendChild(title);

    // Name Input
    const nameGroup = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Project Name';
    Object.assign(nameLabel.style, {
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.7)',
    } as CSSStyleDeclaration);
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = options.defaultName || 'My Project';
    Object.assign(nameInput.style, {
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#f5f5f5',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s',
    } as CSSStyleDeclaration);

    nameInput.onfocus = () => {
      nameInput.style.borderColor = 'rgba(59, 130, 246, 0.5)';
    };
    nameInput.onblur = () => {
      nameInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    };

    const errorMsg = document.createElement('div');
    Object.assign(errorMsg.style, {
      color: '#ef4444',
      fontSize: '0.85rem',
      marginTop: '0.25rem',
      height: '1.2em', // maintain height
      opacity: '0',
      transition: 'opacity 0.2s',
    } as CSSStyleDeclaration);

    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    nameGroup.appendChild(errorMsg);
    dialog.appendChild(nameGroup);

    // Description Input
    const descGroup = document.createElement('div');
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Description (optional)';
    Object.assign(descLabel.style, {
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.7)',
    } as CSSStyleDeclaration);

    const descInput = document.createElement('textarea');
    descInput.value = options.defaultDescription || '';
    descInput.rows = 3;
    Object.assign(descInput.style, {
      width: '100%',
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#f5f5f5',
      fontSize: '0.9rem',
      fontFamily: 'inherit',
      resize: 'vertical',
      outline: 'none',
      transition: 'border-color 0.2s',
    } as CSSStyleDeclaration);

    descInput.onfocus = () => {
      descInput.style.borderColor = 'rgba(59, 130, 246, 0.5)';
    };
    descInput.onblur = () => {
      descInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    };

    descGroup.appendChild(descLabel);
    descGroup.appendChild(descInput);
    dialog.appendChild(descGroup);

    // Actions
    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      marginTop: '1rem',
    } as CSSStyleDeclaration);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '0.5rem 1rem',
      background: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      color: '#f5f5f5',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as CSSStyleDeclaration);
    
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'transparent';
    };
    cancelBtn.onclick = () => this.close(null);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Project';
    Object.assign(saveBtn.style, {
      padding: '0.5rem 1.5rem',
      background: 'rgba(59, 130, 246, 0.9)',
      border: 'none',
      borderRadius: '6px',
      color: 'white',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
    } as CSSStyleDeclaration);

    saveBtn.onmouseenter = () => {
      saveBtn.style.background = '#3b82f6';
      saveBtn.style.transform = 'translateY(-1px)';
    };
    saveBtn.onmouseleave = () => {
      saveBtn.style.background = 'rgba(59, 130, 246, 0.9)';
      saveBtn.style.transform = 'translateY(0)';
    };

    const validateAndSave = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        errorMsg.textContent = 'Project name is required';
        errorMsg.style.opacity = '1';
        errorMsg.style.color = '#ef4444';
        nameInput.style.borderColor = '#ef4444';
        return;
      }

      // If we are in overwrite state and the name hasn't changed, proceed
      if (this.isOverwriteState && name === this.lastValidatedName) {
        this.close({
          name,
          description: descInput.value.trim(),
        });
        return;
      }

      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.7';
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Checking...';

      if (options.validator) {
        const result = await options.validator(name);
        
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.textContent = originalText;

        if (result) {
          if (typeof result === 'string') {
             // Legacy string support
             errorMsg.textContent = result;
             errorMsg.style.opacity = '1';
             errorMsg.style.color = '#ef4444';
             nameInput.style.borderColor = '#ef4444';
             this.isOverwriteState = false;
             return;
          }

          if ('error' in result) {
            errorMsg.textContent = result.error;
            errorMsg.style.opacity = '1';
            errorMsg.style.color = '#ef4444';
            nameInput.style.borderColor = '#ef4444';
            this.isOverwriteState = false;
            return;
          }

          if ('warning' in result && result.canOverwrite) {
             errorMsg.textContent = result.warning;
             errorMsg.style.opacity = '1';
             errorMsg.style.color = '#f59e0b'; // Warning color
             nameInput.style.borderColor = '#f59e0b';
             saveBtn.textContent = 'Overwrite';
             saveBtn.style.background = '#f59e0b';
             this.isOverwriteState = true;
             this.lastValidatedName = name;
             return;
          }
        }
      }

      this.close({
        name,
        description: descInput.value.trim(),
      });
    };

    saveBtn.onclick = validateAndSave;

    nameInput.oninput = () => {
      errorMsg.style.opacity = '0';
      nameInput.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      
      // Reset overwrite state if name changes
      if (this.isOverwriteState) {
        this.isOverwriteState = false;
        saveBtn.textContent = 'Save Project';
        saveBtn.style.background = 'rgba(59, 130, 246, 0.9)';
        nameInput.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    dialog.appendChild(actions);
    modal.appendChild(dialog);

    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) {
        this.close(null);
      }
    };

    // Keyboard support
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close(null);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // If focus is on textarea, allow enter for new line (unless meta/ctrl pressed)
        if (document.activeElement === descInput) {
           return;
        }
        e.preventDefault();
        void validateAndSave();
      }
    };
    
    modal.addEventListener('keydown', handleKeydown);
    
    // Store cleanup for removeEventListener
    (modal as any)._cleanup = () => {
      modal.removeEventListener('keydown', handleKeydown);
    };

    document.body.appendChild(modal);
    nameInput.focus();
  }

  private close(result: SaveProjectDialogResult | null): void {
    if (this.container) {
      if ((this.container as any)._cleanup) {
        (this.container as any)._cleanup();
      }
      document.body.removeChild(this.container);
      this.container = null;
    }
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
  }
}

