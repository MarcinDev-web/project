/**
 * Toast Notification System
 * Non-intrusive notifications for user feedback
 * 
 * Features:
 * - Success, error, warning, info variants
 * - Auto-dismiss with configurable duration
 * - Manual dismiss button
 * - Action buttons
 * - Stacking multiple toasts
 * - Smooth animations
 * - Accessible (ARIA live regions)
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number; // milliseconds, 0 = no auto-dismiss
  dismissible?: boolean;
  action?: ToastAction;
  icon?: string; // Icon name or HTML
}

interface Toast {
  id: string;
  element: HTMLElement;
  timeout?: number;
}

let toastContainer: HTMLElement | null = null;
let toasts: Toast[] = [];
let toastIdCounter = 0;

/**
 * Initialize the toast system
 */
function initToastSystem(): void {
  if (toastContainer) return;

  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 */
export function showToast(message: string, options: ToastOptions = {}): string {
  initToastSystem();

  const {
    variant = 'info',
    duration = 4000,
    dismissible = true,
    action,
    icon,
  } = options;

  const id = `toast-${toastIdCounter++}`;
  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('data-toast-id', id);

  // Icon
  if (icon || variant) {
    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    
    if (icon) {
      iconEl.innerHTML = icon;
    } else {
      // Default icons for variants
      const defaultIcons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ⓘ',
      };
      iconEl.textContent = defaultIcons[variant];
    }
    
    toast.appendChild(iconEl);
  }

  // Content
  const content = document.createElement('div');
  content.className = 'toast-content';

  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  content.appendChild(messageEl);

  // Action button
  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = action.label;
    actionBtn.addEventListener('click', () => {
      action.onClick();
      dismissToast(id);
    });
    content.appendChild(actionBtn);
  }

  toast.appendChild(content);

  // Dismiss button
  if (dismissible) {
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'toast-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.innerHTML = '×';
    dismissBtn.addEventListener('click', () => dismissToast(id));
    toast.appendChild(dismissBtn);
  }

  // Add to container
  toastContainer!.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('toast-visible'), 10);

  // Auto-dismiss
  let timeoutId: number | undefined;
  if (duration > 0) {
    timeoutId = window.setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  // Track toast
  toasts.push({ id, element: toast, timeout: timeoutId });

  return id;
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id: string): void {
  const toastIndex = toasts.findIndex(t => t.id === id);
  if (toastIndex === -1) return;

  const toast = toasts[toastIndex]!;

  // Clear timeout
  if (toast.timeout) {
    window.clearTimeout(toast.timeout);
  }

  // Animate out
  toast.element.classList.add('toast-exit');
  toast.element.classList.remove('toast-visible');

  // Remove from DOM after animation
  setTimeout(() => {
    toast.element.remove();
  }, 300);

  // Remove from tracking
  toasts.splice(toastIndex, 1);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  const currentToasts = [...toasts];
  currentToasts.forEach(toast => dismissToast(toast.id));
}

/**
 * Convenience methods for different variants
 */
export function showSuccessToast(message: string, options?: Omit<ToastOptions, 'variant'>): string {
  return showToast(message, { ...options, variant: 'success' });
}

export function showErrorToast(message: string, options?: Omit<ToastOptions, 'variant'>): string {
  return showToast(message, { ...options, variant: 'error' });
}

export function showWarningToast(message: string, options?: Omit<ToastOptions, 'variant'>): string {
  return showToast(message, { ...options, variant: 'warning' });
}

export function showInfoToast(message: string, options?: Omit<ToastOptions, 'variant'>): string {
  return showToast(message, { ...options, variant: 'info' });
}

/**
 * Show a loading toast (doesn't auto-dismiss)
 */
export function showLoadingToast(message: string): string {
  return showToast(message, {
    variant: 'info',
    duration: 0,
    dismissible: false,
    icon: '<div class="loading-spinner"></div>',
  });
}

/**
 * Update an existing toast
 */
export function updateToast(id: string, message: string, options?: Partial<ToastOptions>): void {
  const toast = toasts.find(t => t.id === id);
  if (!toast) return;

  const messageEl = toast.element.querySelector('.toast-message');
  if (messageEl) {
    messageEl.textContent = message;
  }

  if (options?.variant) {
    toast.element.className = `toast toast-${options.variant} toast-visible`;
  }
}

/**
 * Cleanup
 */
export function destroyToastSystem(): void {
  dismissAllToasts();
  if (toastContainer) {
    toastContainer.remove();
    toastContainer = null;
  }
  toasts = [];
}

