/**
 * AssetUploadPanel - Upload custom assets (GLTF/GLB)
 * 
 * Features:
 * - Drag & Drop support
 * - File validation (extension, size)
 * - Thumbnail generation (placeholder for now)
 * - Local storage (IndexedDB) via LocalAssetManager (to be implemented)
 */

import { Logger } from '../../../utils/logger';

export interface AssetUploadPanelOptions {
  onImport?: (file: File) => Promise<void> | void;
}

export class AssetUploadPanel {
  public readonly element: HTMLElement;
  private dropZone: HTMLElement;
  private fileInput: HTMLInputElement;
  private previewContainer: HTMLElement;
  private readonly onImport?: (file: File) => Promise<void> | void;

  constructor(options?: AssetUploadPanelOptions) {
    this.element = document.createElement('div');
    this.element.className = 'asset-upload-panel';
    this.onImport = options?.onImport;
    
    this.createHeader();
    this.createDropZone();
    this.createPreviewContainer();
  }

  private createHeader(): void {
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = 'Upload Assets';
    header.appendChild(title);
    
    this.element.appendChild(header);
  }

  private createDropZone(): void {
    this.dropZone = document.createElement('div');
    this.dropZone.className = 'asset-drop-zone';
    this.dropZone.innerHTML = `
      <div class="drop-zone-icon">📁</div>
      <div class="drop-zone-text">Drag & Drop GLTF/GLB here</div>
      <div class="drop-zone-subtext">or click to browse</div>
    `;

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.gltf,.glb';
    this.fileInput.style.display = 'none';
    this.element.appendChild(this.fileInput);

    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Drag events
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      if (e.dataTransfer?.files) {
        this.handleFiles(e.dataTransfer.files);
      }
    });

    this.element.appendChild(this.dropZone);
  }

  private createPreviewContainer(): void {
    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'asset-preview-list';
    this.element.appendChild(this.previewContainer);
  }

  private handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(input.files);
    }
  }

  private handleFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (this.validateFile(file)) {
        this.processFile(file);
      }
    }
  }

  private validateFile(file: File): boolean {
    const validExtensions = ['.gltf', '.glb'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      alert(`Invalid file type: ${file.name}. Only GLTF and GLB are supported.`);
      return false;
    }

    // Max size 50MB
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large: ${file.name}. Max size is 50MB.`);
      return false;
    }

    return true;
  }

  private async processFile(file: File): Promise<void> {
    // Create preview item
    const item = document.createElement('div');
    item.className = 'asset-preview-item';
    item.innerHTML = `
      <div class="asset-icon">📦</div>
      <div class="asset-info">
        <div class="asset-name">${file.name}</div>
        <div class="asset-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
      </div>
      <div class="asset-status">Uploading...</div>
    `;
    this.previewContainer.prepend(item);

    try {
      // Simulate upload/processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update status
      const status = item.querySelector('.asset-status') as HTMLElement;
      status.textContent = 'Ready';
      status.classList.add('status-success');

      // Add "Import" button
      const importBtn = document.createElement('button');
      importBtn.className = 'asset-action-btn';
      importBtn.textContent = 'Import to Scene';
      importBtn.onclick = async () => {
        if (this.onImport) {
          status.textContent = 'Importing...';
          try {
            await this.onImport(file);
            status.textContent = 'Imported';
            status.classList.remove('status-error');
            status.classList.add('status-success');
          } catch (err) {
            status.textContent = 'Error';
            status.classList.add('status-error');
            Logger.error(`Failed to import file ${file.name}:`, err as Error);
          }
        } else {
          alert(`Importing ${file.name}...`);
        }
      };
      item.appendChild(importBtn);

      Logger.info(`File processed: ${file.name}`);
    } catch (error) {
      const status = item.querySelector('.asset-status') as HTMLElement;
      status.textContent = 'Error';
      status.classList.add('status-error');
      Logger.error(`Failed to process file ${file.name}:`, error as Error);
    }
  }
}

