import type { PublicUser } from '@engine/net';

/**
 * Configuration for PlayModeInviteDialog.
 */
export interface PlayModeInviteDialogConfig {
  /** User who sent the Play Mode request. */
  fromUser: PublicUser;
  /** Callback when user accepts the request. */
  onAccept: () => void;
  /** Callback when user rejects the request. */
  onReject: () => void;
  /** Auto-dismiss timeout in milliseconds (default: 30000). */
  timeout?: number;
}

/**
 * Dialog component for Play Mode invitations.
 * Displays a modal dialog asking the user to accept or reject a Play Mode request.
 */
export class PlayModeInviteDialog {
  private container: HTMLElement | null = null;
  private readonly config: PlayModeInviteDialogConfig;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(config: PlayModeInviteDialogConfig) {
    this.config = config;
  }

  /**
   * Show the Play Mode invite dialog.
   */
  show(): void {
    if (this.container) {
      // Already shown, do nothing
      return;
    }

    const root = document.createElement('div');
    root.className = 'play-mode-invite-overlay';
    root.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    `;

    const panel = document.createElement('div');
    panel.className = 'play-mode-invite-panel';
    panel.style.cssText = `
      background: rgba(30, 30, 30, 0.95);
      border: 1px solid #444;
      border-radius: 12px;
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Play Mode Invitation';
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 20px;
      font-weight: 600;
      color: #fff;
    `;
    panel.appendChild(title);

    // Message
    const message = document.createElement('p');
    message.innerHTML = `<strong>${this.config.fromUser.email}</strong> wants to start Play Mode.`;
    message.style.cssText = `
      margin: 0 0 24px 0;
      font-size: 14px;
      color: #ccc;
      line-height: 1.5;
    `;
    panel.appendChild(message);

    // Buttons container
    const buttons = document.createElement('div');
    buttons.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Reject';
    rejectBtn.style.cssText = `
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 1px solid #555;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    rejectBtn.addEventListener('mouseenter', () => {
      rejectBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    rejectBtn.addEventListener('mouseleave', () => {
      rejectBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    rejectBtn.addEventListener('click', () => {
      this.config.onReject();
      this.hide();
    });
    buttons.appendChild(rejectBtn);

    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept';
    acceptBtn.style.cssText = `
      padding: 10px 20px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    acceptBtn.addEventListener('mouseenter', () => {
      acceptBtn.style.background = '#3a8eef';
    });
    acceptBtn.addEventListener('mouseleave', () => {
      acceptBtn.style.background = '#4a9eff';
    });
    acceptBtn.addEventListener('click', () => {
      this.config.onAccept();
      this.hide();
    });
    buttons.appendChild(acceptBtn);

    panel.appendChild(buttons);
    root.appendChild(panel);

    // Keyboard handler
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.config.onReject();
        this.hide();
      } else if (event.key === 'Enter') {
        this.config.onAccept();
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keyHandler);

    // Auto-dismiss timeout
    const timeout = this.config.timeout ?? 30000;
    this.timeoutId = setTimeout(() => {
      this.config.onReject(); // Auto-reject on timeout
      this.hide();
    }, timeout);

    this.container = root;
    document.body.appendChild(root);

    // Fade in
    requestAnimationFrame(() => {
      if (root) {
        root.style.opacity = '1';
      }
    });
  }

  /**
   * Hide the Play Mode invite dialog.
   */
  hide(): void {
    if (!this.container) return;

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Remove keyboard handler
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    // Fade out and remove
    this.container.style.opacity = '0';
    const node = this.container;
    setTimeout(() => {
      node.remove();
    }, 200);
    this.container = null;
  }

  /**
   * Dispose the dialog (cleanup).
   */
  dispose(): void {
    this.hide();
  }
}

