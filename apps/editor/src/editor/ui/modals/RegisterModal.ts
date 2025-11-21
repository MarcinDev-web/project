/**
 * RegisterModal - Displays registration form in a modal
 *
 * Features:
 * - Email/password registration
 * - Password confirmation
 * - Error handling
 * - Close on Escape or overlay click
 * - Modern design matching KeyboardShortcutsModal
 */

import { createIcon } from '../../utils/icons';

export interface RegisterModalOptions {
  onRegister?: (email: string, username: string, password: string) => Promise<void> | void;
  onClose?: () => void;
}

export class RegisterModal {
  private modal: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private options: RegisterModalOptions;

  constructor(options: RegisterModalOptions = {}) {
    this.options = options;
  }

  /**
   * Shows the register modal
   */
  show(): void {
    if (this.modal) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay register-modal-overlay';
    
    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'modal register-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'register-modal-header';

    const title = document.createElement('h2');
    title.textContent = 'Register';
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
    form.className = 'register-form';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    // Email input
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    emailLabel.setAttribute('for', 'register-email');
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'register-email';
    emailInput.className = 'input';
    emailInput.required = true;
    emailInput.placeholder = 'Enter your email';
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);

    // Username input
    const usernameGroup = document.createElement('div');
    usernameGroup.className = 'form-group';
    const usernameLabel = document.createElement('label');
    usernameLabel.textContent = 'Username';
    usernameLabel.setAttribute('for', 'register-username');
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.id = 'register-username';
    usernameInput.className = 'input';
    usernameInput.required = true;
    usernameInput.minLength = 3;
    usernameInput.maxLength = 20;
    usernameInput.pattern = '[a-zA-Z0-9_]+';
    usernameInput.title = 'Username can only contain letters, numbers, and underscores';
    usernameInput.placeholder = 'Enter your username';
    const usernameHint = document.createElement('small');
    usernameHint.textContent = '3-20 characters, letters, numbers, and underscores only';
    usernameHint.style.display = 'block';
    usernameHint.style.marginTop = 'var(--spacing-1)';
    usernameHint.style.fontSize = 'var(--text-sm)';
    usernameHint.style.color = 'var(--color-text-secondary)';
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameInput);
    usernameGroup.appendChild(usernameHint);

    // Password input
    const passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'Password';
    passwordLabel.setAttribute('for', 'register-password');
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'register-password';
    passwordInput.className = 'input';
    passwordInput.required = true;
    passwordInput.placeholder = 'Enter your password';
    passwordInput.minLength = 6;
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordInput);

    // Password confirmation input
    const confirmPasswordGroup = document.createElement('div');
    confirmPasswordGroup.className = 'form-group';
    const confirmPasswordLabel = document.createElement('label');
    confirmPasswordLabel.textContent = 'Confirm Password';
    confirmPasswordLabel.setAttribute('for', 'register-confirm-password');
    const confirmPasswordInput = document.createElement('input');
    confirmPasswordInput.type = 'password';
    confirmPasswordInput.id = 'register-confirm-password';
    confirmPasswordInput.className = 'input';
    confirmPasswordInput.required = true;
    confirmPasswordInput.placeholder = 'Confirm your password';
    confirmPasswordGroup.appendChild(confirmPasswordLabel);
    confirmPasswordGroup.appendChild(confirmPasswordInput);

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
    submitBtn.textContent = 'Register';
    submitBtn.style.width = '100%';
    submitBtn.style.marginTop = 'var(--spacing-4)';

    form.appendChild(emailGroup);
    form.appendChild(usernameGroup);
    form.appendChild(passwordGroup);
    form.appendChild(confirmPasswordGroup);
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
    (this.modal as any).usernameInput = usernameInput;
    (this.modal as any).passwordInput = passwordInput;
    (this.modal as any).confirmPasswordInput = confirmPasswordInput;
    (this.modal as any).errorMsg = errorMsg;
    (this.modal as any).submitBtn = submitBtn;
  }

  /**
   * Handles form submission
   */
  private async handleSubmit(): Promise<void> {
    if (!this.modal) return;

    const emailInput = (this.modal as any).emailInput as HTMLInputElement;
    const usernameInput = (this.modal as any).usernameInput as HTMLInputElement;
    const passwordInput = (this.modal as any).passwordInput as HTMLInputElement;
    const confirmPasswordInput = (this.modal as any).confirmPasswordInput as HTMLInputElement;
    const errorMsg = (this.modal as any).errorMsg as HTMLElement;
    const submitBtn = (this.modal as any).submitBtn as HTMLButtonElement;

    const email = emailInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!email || !username || !password || !confirmPassword) {
      errorMsg.textContent = 'Please fill in all fields';
      errorMsg.style.display = 'block';
      return;
    }

    // Validate username
    if (username.length < 3 || username.length > 20) {
      errorMsg.textContent = 'Username must be between 3 and 20 characters long';
      errorMsg.style.display = 'block';
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errorMsg.textContent = 'Username can only contain letters, numbers, and underscores';
      errorMsg.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorMsg.textContent = 'Password must be at least 6 characters';
      errorMsg.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      errorMsg.textContent = 'Passwords do not match';
      errorMsg.style.display = 'block';
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
    errorMsg.style.display = 'none';

    try {
      if (this.options.onRegister) {
        await this.options.onRegister(email, username, password);
      }
      // Close modal on success
      this.hide();
    } catch (error) {
      // Show error message
      errorMsg.textContent = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
    }
  }

  /**
   * Hides the register modal
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

