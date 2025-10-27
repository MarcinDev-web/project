import type { Scene } from '@engine/world';
import { listTemplates, applyTo, type TemplateMetadata } from '@engine/world-templates';

export interface TemplateGalleryPanelConfig {
  scene: Scene;
  updateSceneBuffers: () => void;
}

export class TemplateGalleryPanel {
  public readonly element: HTMLElement;
  private readonly config: TemplateGalleryPanelConfig;

  constructor(config: TemplateGalleryPanelConfig) {
    this.config = config;
    this.element = document.createElement('div');
    this.element.className = 'panel template-gallery-panel';
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const items = listTemplates();
    this.element.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'template-gallery-list';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';

    for (const meta of items) {
      container.appendChild(this.renderItem(meta));
    }

    this.element.appendChild(container);
  }

  private renderItem(meta: TemplateMetadata): HTMLElement {
    const row = document.createElement('div');
    row.className = 'template-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '2px';

    const title = document.createElement('div');
    title.textContent = `${meta.name} (${meta.kind})`;
    title.style.fontWeight = '600';
    const desc = document.createElement('div');
    desc.textContent = meta.description ?? '';
    desc.style.opacity = '0.8';
    left.appendChild(title);
    left.appendChild(desc);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', async () => {
      await applyTo(this.config.scene, meta.id);
      this.config.updateSceneBuffers();
    });

    const replaceBtn = document.createElement('button');
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', async () => {
      await applyTo(this.config.scene, meta.id, { clear: true });
      this.config.updateSceneBuffers();
    });

    right.appendChild(applyBtn);
    right.appendChild(replaceBtn);

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }
}


