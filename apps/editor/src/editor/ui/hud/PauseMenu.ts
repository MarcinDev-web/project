import './pause-menu.css';

interface PauseMenuOptions {
  onResume: () => void;
  onExitToEdit: () => void;
  onSettings?: () => void;
}

export class PauseMenu {
  private container: HTMLElement | null = null;
  private readonly options: PauseMenuOptions;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: PauseMenuOptions) {
    this.options = options;
  }

  show(): void {
    if (this.container) {
      this.container.classList.add('visible');
      return;
    }

    const root = document.createElement('div');
    root.className = 'pause-menu-overlay';

    const panel = document.createElement('div');
    panel.className = 'pause-menu-panel';

    const title = document.createElement('h2');
    title.textContent = 'Paused';
    panel.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Game is paused. Select an option to continue.';
    panel.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'pause-menu-actions';

    const resume = this.createButton('Resume', () => this.options.onResume());
    resume.classList.add('primary');
    list.appendChild(resume);

    const settings = this.createButton('Settings', () => this.options.onSettings?.());
    settings.disabled = !this.options.onSettings;
    list.appendChild(settings);

    const exit = this.createButton('Exit to Edit', () => this.options.onExitToEdit());
    list.appendChild(exit);

    panel.appendChild(list);
    root.appendChild(panel);

    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.options.onResume();
      } else if (event.key === 'Enter') {
        this.options.onResume();
      }
    };
    document.addEventListener('keydown', this.keyHandler);

    this.container = root;
    document.body.appendChild(root);
    requestAnimationFrame(() => root.classList.add('visible'));
  }

  hide(): void {
    if (!this.container) return;
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    this.container.classList.remove('visible');
    this.container.classList.add('dismissed');
    const node = this.container;
    setTimeout(() => {
      node.remove();
    }, 150);
    this.container = null;
  }

  private createButton(label: string, handler: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'pause-menu-button';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => handler());
    return button;
  }
}
