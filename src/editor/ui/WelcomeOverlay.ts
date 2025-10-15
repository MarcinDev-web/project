/**
 * WelcomeOverlay - Lightweight onboarding overlay shown on first load.
 * Provides a brief hint about controls and can be dismissed.
 */

export class WelcomeOverlay {
  private container: HTMLElement | null = null;
  private isDismissed = false;

  /** Mounts the welcome overlay to the document. */
  public mount(): void {
    if (this.container || this.isDismissed) return;

    const container = document.createElement('div');
    container.className = 'welcome-overlay';

    const panel = document.createElement('div');
    panel.className = 'welcome-overlay-panel';

    const title = document.createElement('h2');
    title.className = 'welcome-overlay-title';
    title.textContent = 'Welcome to the Editor';
    panel.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'welcome-overlay-subtitle';
    subtitle.textContent = 'Use mouse + WASD to look around. Press Esc to pause.';
    panel.appendChild(subtitle);

    const actions = document.createElement('div');
    actions.className = 'welcome-overlay-actions';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'welcome-overlay-dismiss';
    dismissBtn.textContent = 'Got it';
    dismissBtn.addEventListener('click', () => this.dismiss());
    actions.appendChild(dismissBtn);

    panel.appendChild(actions);
    container.appendChild(panel);

    // Close on ESC
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.dismiss();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, { once: true });

    document.body.appendChild(container);
    this.container = container;

    // Fade-in
    requestAnimationFrame(() => {
      this.container?.classList.add('visible');
    });
  }

  /** Dismisses and removes the overlay. */
  public dismiss(): void {
    if (!this.container) {
      this.isDismissed = true;
      return;
    }
    this.container.classList.add('dismissed');
    setTimeout(() => {
      this.container?.remove();
      this.container = null;
      this.isDismissed = true;
    }, 200);
  }

  /** Disposes overlay resources. */
  public dispose(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.isDismissed = true;
  }
}


