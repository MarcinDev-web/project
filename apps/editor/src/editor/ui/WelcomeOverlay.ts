/**
 * WelcomeOverlay - Enhanced onboarding experience for new users.
 * 
 * Features:
 * - Beautiful first impression with modern design
 * - Choice between Quick Start and Interactive Tutorial
 * - Persistent state (don't show again)
 * - Smooth animations and transitions
 * - Quick tips for immediate productivity
 */

import { storageLoad, storageSave } from '../../utils/storage';

const STORAGE_KEY = 'editor:welcomeDismissed';

export interface WelcomeOverlayConfig {
  onStartTutorial?: () => void;
  onQuickStart?: () => void;
  onShowQuickGuide?: () => void;
}

export class WelcomeOverlay {
  private container: HTMLElement | null = null;
  private isDismissed = false;
  private config: WelcomeOverlayConfig;

  constructor(config: WelcomeOverlayConfig = {}) {
    this.config = config;
    // Check if user has dismissed before
    const dismissed = storageLoad<boolean>(STORAGE_KEY);
    if (dismissed === true) {
      this.isDismissed = true;
    }
  }

  /** Mounts the enhanced welcome overlay. */
  public mount(): void {
    if (this.container || this.isDismissed) return;

    const container = document.createElement('div');
    container.className = 'welcome-overlay-enhanced';

    // Background blur overlay
    const backdrop = document.createElement('div');
    backdrop.className = 'welcome-overlay-backdrop';
    container.appendChild(backdrop);

    // Main panel with modern design
    const panel = document.createElement('div');
    panel.className = 'welcome-overlay-panel-enhanced';

    // Hero section
    const hero = document.createElement('div');
    hero.className = 'welcome-hero';
    hero.innerHTML = `
      <div class="welcome-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="8" width="48" height="48" rx="12" fill="url(#gradient1)" opacity="0.2"/>
          <path d="M32 16L20 28h8v12h8V28h8z" fill="url(#gradient2)"/>
          <defs>
            <linearGradient id="gradient1" x1="8" y1="8" x2="56" y2="56">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
            <linearGradient id="gradient2" x1="20" y1="16" x2="44" y2="40">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 class="welcome-title">Welcome to 3D Scene Editor</h1>
      <p class="welcome-subtitle">Professional 3D scene creation powered by WebGPU</p>
    `;
    panel.appendChild(hero);

    // Features section
    const features = document.createElement('div');
    features.className = 'welcome-features';
    features.innerHTML = `
      <div class="welcome-feature">
        <div class="welcome-feature-icon">🎨</div>
        <div class="welcome-feature-text">
          <strong>Real-time 3D Editor</strong>
          <span>Create and edit scenes in real-time</span>
        </div>
      </div>
      <div class="welcome-feature">
        <div class="welcome-feature-icon">🎮</div>
        <div class="welcome-feature-text">
          <strong>Play Mode Testing</strong>
          <span>Test your creations instantly</span>
        </div>
      </div>
      <div class="welcome-feature">
        <div class="welcome-feature-icon">⚡</div>
        <div class="welcome-feature-text">
          <strong>High Performance</strong>
          <span>Built with WebGPU for speed</span>
        </div>
      </div>
    `;
    panel.appendChild(features);

    // Quick tips section
    const tips = document.createElement('div');
    tips.className = 'welcome-tips';
    tips.innerHTML = `
      <div class="welcome-tips-title">Quick Controls</div>
      <div class="welcome-tips-grid">
        <div class="welcome-tip-item">
          <kbd>WASD</kbd>
          <span>Move camera</span>
        </div>
        <div class="welcome-tip-item">
          <kbd>Right Click</kbd>
          <span>Rotate view</span>
        </div>
        <div class="welcome-tip-item">
          <kbd>Scroll</kbd>
          <span>Zoom in/out</span>
        </div>
        <div class="welcome-tip-item">
          <kbd>F</kbd>
          <span>Focus selection</span>
        </div>
      </div>
    `;
    panel.appendChild(tips);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'welcome-actions-enhanced';

    const tutorialBtn = document.createElement('button');
    tutorialBtn.className = 'welcome-btn welcome-btn-primary';
    tutorialBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2L3 7v6l7 5 7-5V7z"/>
      </svg>
      <span>Start Interactive Tutorial</span>
    `;
    tutorialBtn.addEventListener('click', () => this.handleStartTutorial());

    const quickStartBtn = document.createElement('button');
    quickStartBtn.className = 'welcome-btn welcome-btn-secondary';
    quickStartBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 5v10l7-5z"/>
      </svg>
      <span>Quick Start</span>
    `;
    quickStartBtn.addEventListener('click', () => this.handleQuickStart());

    actions.appendChild(tutorialBtn);
    actions.appendChild(quickStartBtn);
    panel.appendChild(actions);

    // Footer options
    const footer = document.createElement('div');
    footer.className = 'welcome-footer';

    const showGuideLink = document.createElement('button');
    showGuideLink.className = 'welcome-link';
    showGuideLink.textContent = 'Show Quick Guide';
    showGuideLink.addEventListener('click', () => this.handleShowQuickGuide());

    const dontShowAgain = document.createElement('label');
    dontShowAgain.className = 'welcome-checkbox-label';
    dontShowAgain.innerHTML = `
      <input type="checkbox" id="welcome-dont-show" class="welcome-checkbox">
      <span>Don't show this again</span>
    `;

    footer.appendChild(showGuideLink);
    footer.appendChild(dontShowAgain);
    panel.appendChild(footer);

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

    // Fade-in animation
    requestAnimationFrame(() => {
      this.container?.classList.add('visible');
    });
  }

  /** Handles Start Tutorial action. */
  private handleStartTutorial(): void {
    this.config.onStartTutorial?.();
    this.dismiss();
  }

  /** Handles Quick Start action. */
  private handleQuickStart(): void {
    this.config.onQuickStart?.();
    this.dismiss();
  }

  /** Handles Show Quick Guide action. */
  private handleShowQuickGuide(): void {
    this.config.onShowQuickGuide?.();
    this.dismiss();
  }

  /** Dismisses and removes the overlay. */
  public dismiss(): void {
    if (!this.container) {
      this.isDismissed = true;
      return;
    }

    // Check if "don't show again" is checked
    const checkbox = this.container.querySelector('#welcome-dont-show') as HTMLInputElement;
    if (checkbox?.checked) {
      storageSave(STORAGE_KEY, true);
    }

    this.container.classList.add('dismissed');
    setTimeout(() => {
      this.container?.remove();
      this.container = null;
      this.isDismissed = true;
    }, 300);
  }

  /** Forces the overlay to show again (resets dismissal state). */
  public forceShow(): void {
    storageSave(STORAGE_KEY, false);
    this.isDismissed = false;
    this.mount();
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


