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

import { storageLoad, storageSave } from '../../../utils/storage';

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
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', 'welcome-title');
    container.setAttribute('aria-describedby', 'welcome-subtitle');

    // Background blur overlay
    const backdrop = document.createElement('div');
    backdrop.className = 'welcome-overlay-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    container.appendChild(backdrop);

    // Main panel with modern design
    const panel = document.createElement('div');
    panel.className = 'welcome-overlay-panel-enhanced';

    // Hero section
    const hero = document.createElement('div');
    hero.className = 'welcome-hero';
    hero.innerHTML = `
      <div class="welcome-icon">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Background glow -->
          <circle cx="40" cy="40" r="35" fill="url(#iconGlow)" opacity="0.3"/>
          
          <!-- 3D Cube faces with depth -->
          <g class="welcome-icon-cube">
            <!-- Back face (darkest) -->
            <path d="M40 20 L60 30 L60 50 L40 60 L40 40 Z" fill="url(#cubeFace1)" opacity="0.6"/>
            <!-- Left face (medium) -->
            <path d="M40 20 L20 30 L20 50 L40 60 L40 40 Z" fill="url(#cubeFace2)" opacity="0.8"/>
            <!-- Top face (lightest) -->
            <path d="M40 20 L20 30 L40 40 L60 30 Z" fill="url(#cubeFace3)"/>
            
            <!-- Edges for definition -->
            <path d="M40 20 L60 30 M40 20 L20 30 M20 30 L20 50 M60 30 L60 50 M20 50 L40 60 M60 50 L40 60 M40 40 L40 60" 
                  stroke="url(#edgeGlow)" stroke-width="1.5" stroke-linecap="round"/>
            
            <!-- Highlight sparkle -->
            <circle cx="50" cy="28" r="2" fill="white" opacity="0.8" class="welcome-icon-sparkle"/>
            <circle cx="32" cy="35" r="1.5" fill="white" opacity="0.6" class="welcome-icon-sparkle"/>
          </g>
          
          <defs>
            <linearGradient id="iconGlow" x1="0" y1="0" x2="80" y2="80">
              <stop offset="0%" stop-color="#0ea5e9"/>
              <stop offset="100%" stop-color="#0284c7"/>
            </linearGradient>
            <linearGradient id="cubeFace1" x1="40" y1="20" x2="60" y2="60">
              <stop offset="0%" stop-color="#0284c7"/>
              <stop offset="100%" stop-color="#0369a1"/>
            </linearGradient>
            <linearGradient id="cubeFace2" x1="20" y1="30" x2="40" y2="60">
              <stop offset="0%" stop-color="#0ea5e9"/>
              <stop offset="100%" stop-color="#075985"/>
            </linearGradient>
            <linearGradient id="cubeFace3" x1="20" y1="20" x2="60" y2="40">
              <stop offset="0%" stop-color="#38bdf8"/>
              <stop offset="100%" stop-color="#0ea5e9"/>
            </linearGradient>
            <linearGradient id="edgeGlow" x1="20" y1="20" x2="60" y2="60">
              <stop offset="0%" stop-color="rgba(255,255,255,0.8)"/>
              <stop offset="100%" stop-color="rgba(255,255,255,0.4)"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 id="welcome-title" class="welcome-title">Engine Initialized</h1>
      <p id="welcome-subtitle" class="welcome-subtitle">Professional 3D scene creation powered by WebGPU</p>
      <div class="welcome-hero-badges">
        <div class="welcome-hero-badge welcome-hero-badge-purple">
          <span class="badge-dot"></span>
          <span>WebGPU Accelerated</span>
        </div>
        <div class="welcome-hero-badge welcome-hero-badge-green">
          <span class="badge-dot"></span>
          <span>Servers Available</span>
        </div>
      </div>
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
    tutorialBtn.setAttribute('aria-label', 'Start interactive tutorial to learn editor basics');
    tutorialBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 2L3 7v6l7 5 7-5V7z" stroke-linejoin="round"/>
        <circle cx="10" cy="10" r="2" fill="currentColor"/>
      </svg>
      <span>Start Interactive Tutorial</span>
      <svg class="welcome-btn-arrow" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    `;
    tutorialBtn.addEventListener('click', () => this.handleStartTutorial());

    const quickStartBtn = document.createElement('button');
    quickStartBtn.className = 'welcome-btn welcome-btn-secondary';
    quickStartBtn.setAttribute('aria-label', 'Skip tutorial and start creating immediately');
    quickStartBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 5l8 5-8 5z" fill="currentColor"/>
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

    footer.appendChild(showGuideLink);
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

  /** Dismisses and removes the overlay. Automatically saves dismissal state. */
  public dismiss(): void {
    if (!this.container) {
      this.isDismissed = true;
      return;
    }

    // Automatically save that user has seen this overlay
    storageSave(STORAGE_KEY, true);

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


