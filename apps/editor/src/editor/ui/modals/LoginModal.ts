/**
 * LoginModal - Displays login form in a modal
 *
 * Features:
 * - Email/password login
 * - Error handling
 * - Close on Escape or overlay click
 * - Modern design matching KeyboardShortcutsModal
 */

import { createIcon } from '../../utils/icons';

export interface LoginModalOptions {
  onLogin?: (email: string, password: string) => Promise<void> | void;
  onClose?: () => void;
}

export class LoginModal {
  private modal: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private options: LoginModalOptions;

  constructor(options: LoginModalOptions = {}) {
    this.options = options;
  }

  /**
   * Shows the login modal
   */
  show(): void {
    if (this.modal) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay login-modal-overlay';
    
    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal login-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'login-modal-header';

    const title = document.createElement('h2');
    title.textContent = 'Login';
    title.style.margin = '0';
    title.style.fontSize = 'var(--text-2xl)';
    title.style.fontWeight = 'var(--font-bold)';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-icon';
    closeBtn.appendChild(createIcon('close', 20));
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Form
    const form = document.createElement('form');
    form.className = 'login-form';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    // Email input
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    emailLabel.setAttribute('for', 'login-email');
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'login-email';
    emailInput.className = 'input';
    emailInput.required = true;
    emailInput.placeholder = 'Enter your email';
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    // Password input
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'Password';
    passwordLabel.setAttribute('for', 'login-password');
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'login-password';
    passwordInput.className = 'input';
    passwordInput.required = true;
    passwordInput.placeholder = 'Enter your password';
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordInput);

    // Error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.style.display = 'none';
    errorMsg.style.color = 'var(--color-error)';
    errorMsg.style.marginTop = 'var(--spacing-2)';

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Login';
    submitBtn.style.width = '100%';
    submitBtn.style.marginTop = 'var(--spacing-4)';

    form.appendChild(emailGroup);
    form.appendChild(passwordGroup);
    form.appendChild(errorMsg);
    form.appendChild(submitBtn);

    // Assemble modal
    this.modal.appendChild(header);
    this.modal.appendChild(form);
    this.overlay.appendChild(this.modal);

    // Add to DOM
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus email input
    emailInput.focus();

    // Store references for form handling
    (this.modal as any).emailInput = emailInput;
    (this.modal as any).passwordInput = passwordInput;
    (this.modal as any).errorMsg = errorMsg;
    (this.modal as any).submitBtn = submitBtn;
  }

  /**
   * Handles form submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.modal) return;

    const emailInput = (this.modal as any).emailInput as HTMLInputElement;
    const passwordInput = (this.modal as any).passwordInput as HTMLInputElement;
    const errorMsg = (this.modal as any).errorMsg as HTMLElement;
    const submitBtn = (this.modal as any).submitBtn as HTMLButtonElement;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorMsg.textContent = 'Please fill in all fields';
      errorMsg.style.display = 'block';
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    errorMsg.style.display = 'none';

    try {
      if (this.options.onLogin) {
        await this.options.onLogin(email, password);
      }
      // Close modal on success
      this.hide();
    } catch (error) {
      // Show error message
      errorMsg.textContent = error instanceof Error ? error.message : 'Login failed. Please try again.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  }

  /**
   * Hides the login modal
   */
  hide(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.modal = null;
    this.overlay = null;
    if (this.options.onClose) {
      this.options.onClose();
    }
  }
}

