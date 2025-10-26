/**
 * NotificationSystem - Modern notification system with toast, modal, and input dialogs
 * 
 * Features:
 * - Toast notifications for info/success/warning/error
 * - Modal confirm dialogs
 * - Input prompt dialogs
 * - Auto-dismiss for toasts
 * - Accessible and keyboard friendly
 */

import { createIcon } from '../utils/icons';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
  type?: ToastType;
  duration?: number; // milliseconds, 0 for no auto-dismiss
  icon?: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // red confirm button for destructive actions
}

interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

class NotificationSystemClass {
  private toastContainer: HTMLElement | null = null;
  private modalContainer: HTMLElement | null = null;
  private activeToasts: Set<HTMLElement> = new Set();

  /**
   * Initializes the notification system
   */
  private init(): void {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'notification-toast-container';
      this.toastContainer.setAttribute('aria-live', 'polite');
      this.toastContainer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.toastContainer);
    }
  }

  /**
   * Shows a toast notification
   */
  toast(message: string, options: ToastOptions = {}): void {
    this.init();

    const {
      type = 'info',
      duration = 3000,
      icon,
    } = options;

    const toast = document.createElement('div');
    toast.className = `notification-toast notification-toast-${type}`;
    toast.setAttribute('role', 'status');

    // Icon
    if (icon || type) {
      const iconName = icon || this.getDefaultIcon(type);
      const iconEl = createIcon(iconName as any, 20);
      iconEl.className = 'notification-toast-icon';
      toast.appendChild(iconEl);
    }

    // Message
    const messageEl = document.createElement('span');
    messageEl.className = 'notification-toast-message';
    messageEl.textContent = message;
    toast.appendChild(messageEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'notification-toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.appendChild(createIcon('close', 16));
    closeBtn.addEventListener('click', () => this.dismissToast(toast));
    toast.appendChild(closeBtn);

    this.toastContainer!.appendChild(toast);
    this.activeToasts.add(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('notification-toast-visible');
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        this.dismissToast(toast);
      }, duration);
    }
  }

  /**
   * Shows an info toast
   */
  info(message: string, duration?: number): void {
    this.toast(message, { type: 'info', duration });
  }

  /**
   * Shows a success toast
   */
  success(message: string, duration?: number): void {
    this.toast(message, { type: 'success', duration });
  }

  /**
   * Shows a warning toast
   */
  warning(message: string, duration?: number): void {
    this.toast(message, { type: 'warning', duration });
  }

  /**
   * Shows an error toast
   */
  error(message: string, duration?: number): void {
    this.toast(message, { type: 'error', duration });
  }

  /**
   * Dismisses a toast
   */
  private dismissToast(toast: HTMLElement): void {
    if (!this.activeToasts.has(toast)) return;

    toast.classList.remove('notification-toast-visible');
    this.activeToasts.delete(toast);

    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  /**
   * Shows a confirmation dialog
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const {
        title = 'Confirm',
        message,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        danger = false,
      } = options;

      this.createModal(title, (modal, content) => {
        // Message
        const messageEl = document.createElement('p');
        messageEl.className = 'notification-modal-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'notification-modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener('click', () => {
          this.closeModal(modal);
          resolve(false);
        });
        actions.appendChild(cancelBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener('click', () => {
          this.closeModal(modal);
          resolve(true);
        });
        actions.appendChild(confirmBtn);

        content.appendChild(actions);

        // Focus confirm button by default
        setTimeout(() => confirmBtn.focus(), 100);
      });
    });
  }

  /**
   * Shows an input prompt dialog
   */
  async prompt(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const {
        title = 'Input',
        message,
        defaultValue = '',
        placeholder = '',
        confirmText = 'OK',
        cancelText = 'Cancel',
      } = options;

      this.createModal(title, (modal, content) => {
        // Message
        const messageEl = document.createElement('p');
        messageEl.className = 'notification-modal-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);

        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'input notification-modal-input';
        input.value = defaultValue;
        input.placeholder = placeholder;
        content.appendChild(input);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'notification-modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener('click', () => {
          this.closeModal(modal);
          resolve(null);
        });
        actions.appendChild(cancelBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener('click', () => {
          const value = input.value.trim();
          this.closeModal(modal);
          resolve(value || null);
        });
        actions.appendChild(confirmBtn);

        content.appendChild(actions);

        // Focus input and select text
        setTimeout(() => {
          input.focus();
          input.select();
        }, 100);

        // Submit on Enter
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            confirmBtn.click();
          } else if (e.key === 'Escape') {
            cancelBtn.click();
          }
        });
      });
    });
  }

  /**
   * Creates a modal dialog
   */
  private createModal(
    title: string,
    builder: (modal: HTMLElement, content: HTMLElement) => void
  ): void {
    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'notification-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeModal(overlay);
      }
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'notification-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');

    // Header
    const header = document.createElement('div');
    header.className = 'notification-modal-header';

    const titleEl = document.createElement('h3');
    titleEl.id = 'modal-title';
    titleEl.className = 'notification-modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'notification-modal-close';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.appendChild(createIcon('close', 20));
    closeBtn.addEventListener('click', () => this.closeModal(overlay));
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'notification-modal-content';
    modal.appendChild(content);

    // Build content with callback
    builder(overlay, content);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('notification-modal-visible');
    });

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeModal(overlay);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Store handler for cleanup
    (overlay as any)._escapeHandler = escapeHandler;
  }

  /**
   * Closes a modal
   */
  private closeModal(overlay: HTMLElement): void {
    overlay.classList.remove('notification-modal-visible');

    // Cleanup escape handler
    const escapeHandler = (overlay as any)._escapeHandler;
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
    }

    setTimeout(() => {
      overlay.remove();
    }, 300);
  }

  /**
   * Gets the default icon for a toast type
   */
  private getDefaultIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'alert-triangle';
      case 'error':
        return 'x-circle';
      case 'info':
      default:
        return 'info';
    }
  }

  /**
   * Clears all active toasts
   */
  clearAll(): void {
    this.activeToasts.forEach((toast) => this.dismissToast(toast));
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.clearAll();
    if (this.toastContainer) {
      this.toastContainer.remove();
      this.toastContainer = null;
    }
  }
}

// Export singleton instance
export const NotificationSystem = new NotificationSystemClass();

