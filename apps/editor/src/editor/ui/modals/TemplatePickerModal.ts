import { listTemplates, type TemplateMetadata } from '@engine/world-templates';
import { createIcon } from '../../utils/icons';

export interface TemplatePickerResult {
  template: TemplateMetadata;
}

export interface TemplatePickerOptions {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  includeSeeds?: boolean;
}

export class TemplatePickerModal {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private resolver: ((result: TemplatePickerResult | null) => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  public pickTemplate(options: TemplatePickerOptions = {}): Promise<TemplatePickerResult | null> {
    if (this.modal) {
      return Promise.resolve(null);
    }

    const { title, subtitle, confirmLabel, includeSeeds = true } = options;
    const templates = listTemplates({ kind: 'template' });
    const seeds = includeSeeds ? listTemplates({ kind: 'seed' }) : [];

    return new Promise<TemplatePickerResult | null>((resolve) => {
      this.resolver = resolve;
      this.overlay = document.createElement('div');
      this.overlay.className = 'modal-overlay template-picker-overlay';

      this.modal = document.createElement('div');
      this.modal.className = 'modal template-picker-modal';

      const header = document.createElement('div');
      header.className = 'template-picker-header';

      const heading = document.createElement('h2');
      heading.className = 'template-picker-title';
      heading.textContent = title ?? 'Choose a Template';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-icon template-picker-close';
      closeBtn.appendChild(createIcon('close', 18));
      closeBtn.addEventListener('click', () => this.close(null));

      header.appendChild(heading);
      header.appendChild(closeBtn);
      this.modal.appendChild(header);

      if (subtitle) {
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'template-picker-subtitle';
        subtitleEl.textContent = subtitle;
        this.modal.appendChild(subtitleEl);
      }

      this.searchInput = document.createElement('input');
      this.searchInput.type = 'search';
      this.searchInput.className = 'template-picker-search';
      this.searchInput.placeholder = 'Search templates by name or tag...';
      this.modal.appendChild(this.searchInput);

      const content = document.createElement('div');
      content.className = 'template-picker-content';
      this.modal.appendChild(content);

      const sections: Array<{ title: string; items: TemplateMetadata[]; kind: TemplateMetadata['kind'] }> = [
        { title: 'Starter Templates', items: templates, kind: 'template' },
      ];
      if (seeds.length > 0) {
        sections.push({ title: 'Scene Seeds', items: seeds, kind: 'seed' });
      }

      const cards: Array<{ element: HTMLElement; meta: TemplateMetadata }> = [];

      for (const section of sections) {
        if (section.items.length === 0) continue;

        const sectionEl = document.createElement('section');
        sectionEl.className = 'template-picker-section';

        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'template-picker-section-title';
        sectionTitle.textContent = section.title;
        sectionEl.appendChild(sectionTitle);

        const grid = document.createElement('div');
        grid.className = 'template-picker-grid';
        sectionEl.appendChild(grid);

        for (const meta of section.items) {
          const card = this.createCard(meta, confirmLabel ?? 'Use Template', section.kind);
          grid.appendChild(card);
          cards.push({ element: card, meta });
        }

        content.appendChild(sectionEl);
      }

      if (templates.length === 0 && seeds.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'template-picker-empty';
        emptyState.textContent =
          'No templates are registered. Call registerTemplates(...) before opening the picker.';
        content.appendChild(emptyState);
      }

      const footer = document.createElement('div');
      footer.className = 'template-picker-footer';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this.close(null));

      footer.appendChild(cancelBtn);
      this.modal.appendChild(footer);

      this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay) {
          this.close(null);
        }
      });

      this.keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close(null);
        }
      };
      window.addEventListener('keydown', this.keyHandler);

      document.body.appendChild(this.overlay);
      this.overlay.appendChild(this.modal);

      requestAnimationFrame(() => {
        this.searchInput?.focus();
      });

      this.searchInput.addEventListener('input', () => {
        const query = this.searchInput?.value.trim().toLowerCase() ?? '';
        for (const { element, meta } of cards) {
          const haystack = `${meta.name} ${meta.description ?? ''} ${(meta.tags ?? []).join(' ')}`.toLowerCase();
          const matches = query.length === 0 || haystack.includes(query);
          element.classList.toggle('template-card-hidden', !matches);
        }
      });
    });
  }

  private createCard(meta: TemplateMetadata, confirmLabel: string, kind: TemplateMetadata['kind']): HTMLElement {
    const card = document.createElement('article');
    card.className = 'template-card';
    card.dataset.kind = kind;

    const body = document.createElement('div');
    body.className = 'template-card-body';

    const titleRow = document.createElement('div');
    titleRow.className = 'template-card-title-row';

    const nameEl = document.createElement('h4');
    nameEl.className = 'template-card-name';
    nameEl.textContent = meta.name;

    const kindBadge = document.createElement('span');
    kindBadge.className = 'template-card-kind';
    kindBadge.textContent = kind === 'seed' ? 'Seed' : 'Template';

    titleRow.appendChild(nameEl);
    titleRow.appendChild(kindBadge);
    body.appendChild(titleRow);

    if (meta.version) {
      const versionEl = document.createElement('span');
      versionEl.className = 'template-card-version';
      versionEl.textContent = `v${meta.version}`;
      body.appendChild(versionEl);
    }

    if (meta.description) {
      const desc = document.createElement('p');
      desc.className = 'template-card-description';
      desc.textContent = meta.description;
      body.appendChild(desc);
    }

    if (meta.tags && meta.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'template-card-tags';
      for (const tag of meta.tags) {
        const tagEl = document.createElement('span');
        tagEl.className = 'template-card-tag';
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      }
      body.appendChild(tags);
    }

    const actions = document.createElement('div');
    actions.className = 'template-card-actions';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn btn-primary template-card-use';
    useBtn.textContent = kind === 'seed' ? 'Use Seed' : confirmLabel;
    useBtn.addEventListener('click', () => this.close({ template: meta }));

    actions.appendChild(useBtn);

    card.appendChild(body);
    card.appendChild(actions);

    return card;
  }

  private close(result: TemplatePickerResult | null): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.modal) {
      this.modal = null;
    }

    if (this.searchInput) {
      this.searchInput = null;
    }

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    const resolve = this.resolver;
    this.resolver = null;
    resolve?.(result);
  }
}
