/**
 * InteractiveTutorial - Step-by-step interactive tutorial system
 * 
 * Features:
 * - Guided walkthrough for new users
 * - Highlights UI elements
 * - Interactive steps with validation
 * - Progress tracking
 * - Skip/Resume capability
 */

import { storageLoad, storageSave } from '../../utils/storage';
import { Logger } from '../../utils/logger';

const STORAGE_KEY = 'editor:tutorialProgress';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action?: string; // Action text for button
  highlightSelector?: string; // CSS selector to highlight
  highlightOffset?: { x: number; y: number };
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  validation?: () => boolean; // Optional: check if step is complete
  onComplete?: () => void;
}

export interface TutorialConfig {
  steps: TutorialStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

export class InteractiveTutorial {
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private currentStepIndex = 0;
  private config: TutorialConfig;
  private highlightElement: HTMLElement | null = null;
  private isActive = false;

  constructor(config: TutorialConfig) {
    this.config = config;
    // Load saved progress
    const savedProgress = storageLoad<number>(STORAGE_KEY);
    if (savedProgress !== null && typeof savedProgress === 'number') {
      this.currentStepIndex = Math.min(savedProgress, config.steps.length - 1);
    }
  }

  /** Starts or resumes the tutorial. */
  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.mount();
    this.showStep(this.currentStepIndex);
  }

  /** Mounts the tutorial UI. */
  private mount(): void {
    if (this.container) return;

    // Create overlay (dark backdrop)
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay';
    document.body.appendChild(this.overlay);

    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'tutorial-container';
    document.body.appendChild(this.container);
  }

  /** Shows a specific tutorial step. */
  private showStep(index: number): void {
    if (index < 0 || index >= this.config.steps.length) {
      this.complete();
      return;
    }

    const step = this.config.steps[index]!;
    this.currentStepIndex = index;

    // Save progress
    storageSave(STORAGE_KEY, index);

    // Clear previous highlight
    this.clearHighlight();

    // Highlight target element if specified
    if (step.highlightSelector) {
      this.highlightTarget(step.highlightSelector);
    }

    // Render step content
    this.renderStepContent(step, index);
  }

  /** Renders step content in the container. */
  private renderStepContent(step: TutorialStep, index: number): void {
    if (!this.container) return;

    const stepPanel = document.createElement('div');
    stepPanel.className = `tutorial-step tutorial-step-${step.position || 'center'}`;

    // Progress indicator
    const progress = document.createElement('div');
    progress.className = 'tutorial-progress';
    progress.innerHTML = `
      <div class="tutorial-progress-bar">
        <div class="tutorial-progress-fill" style="width: ${((index + 1) / this.config.steps.length) * 100}%"></div>
      </div>
      <div class="tutorial-progress-text">Step ${index + 1} of ${this.config.steps.length}</div>
    `;
    stepPanel.appendChild(progress);

    // Step content
    const content = document.createElement('div');
    content.className = 'tutorial-step-content';

    const title = document.createElement('h3');
    title.className = 'tutorial-step-title';
    title.textContent = step.title;
    content.appendChild(title);

    const description = document.createElement('p');
    description.className = 'tutorial-step-description';
    description.textContent = step.description;
    content.appendChild(description);

    stepPanel.appendChild(content);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'tutorial-step-actions';

    // Previous button (if not first step)
    if (index > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'tutorial-btn tutorial-btn-secondary';
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', () => this.previousStep());
      actions.appendChild(prevBtn);
    }

    // Next/Complete button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'tutorial-btn tutorial-btn-primary';
    nextBtn.textContent = step.action || (index < this.config.steps.length - 1 ? 'Next' : 'Complete');
    nextBtn.addEventListener('click', () => this.nextStep());
    actions.appendChild(nextBtn);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'tutorial-btn tutorial-btn-text';
    skipBtn.textContent = 'Skip Tutorial';
    skipBtn.addEventListener('click', () => this.skip());
    actions.appendChild(skipBtn);

    stepPanel.appendChild(actions);

    // Clear previous content and append new
    this.container.innerHTML = '';
    this.container.appendChild(stepPanel);

    // Position step panel relative to highlight
    if (step.highlightSelector && step.position !== 'center') {
      this.positionStepPanel(stepPanel, step);
    }

    // Fade-in animation
    requestAnimationFrame(() => {
      stepPanel.classList.add('visible');
    });
  }

  /** Highlights a target element. */
  private highlightTarget(selector: string): void {
    const target = document.querySelector(selector);
    if (!target) {
      Logger.warn(`Tutorial: Target element not found: ${selector}`);
      return;
    }

    // Create highlight box
    this.highlightElement = document.createElement('div');
    this.highlightElement.className = 'tutorial-highlight';

    const rect = target.getBoundingClientRect();
    this.highlightElement.style.position = 'fixed';
    this.highlightElement.style.top = `${rect.top}px`;
    this.highlightElement.style.left = `${rect.left}px`;
    this.highlightElement.style.width = `${rect.width}px`;
    this.highlightElement.style.height = `${rect.height}px`;
    this.highlightElement.style.pointerEvents = 'none';
    this.highlightElement.style.zIndex = '9998';

    document.body.appendChild(this.highlightElement);

    // Make target interactive (raise z-index)
    (target as HTMLElement).style.position = 'relative';
    (target as HTMLElement).style.zIndex = '9999';
  }

  /** Clears the current highlight. */
  private clearHighlight(): void {
    if (this.highlightElement) {
      this.highlightElement.remove();
      this.highlightElement = null;
    }
  }

  /** Positions step panel relative to highlighted element. */
  private positionStepPanel(panel: HTMLElement, step: TutorialStep): void {
    if (!step.highlightSelector) return;

    const target = document.querySelector(step.highlightSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const offset = step.highlightOffset || { x: 0, y: 0 };

    panel.style.position = 'fixed';

    switch (step.position) {
      case 'top':
        panel.style.left = `${rect.left + rect.width / 2 + offset.x}px`;
        panel.style.top = `${rect.top - 20 + offset.y}px`;
        panel.style.transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        panel.style.left = `${rect.left + rect.width / 2 + offset.x}px`;
        panel.style.top = `${rect.bottom + 20 + offset.y}px`;
        panel.style.transform = 'translateX(-50%)';
        break;
      case 'left':
        panel.style.left = `${rect.left - 20 + offset.x}px`;
        panel.style.top = `${rect.top + rect.height / 2 + offset.y}px`;
        panel.style.transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        panel.style.left = `${rect.right + 20 + offset.x}px`;
        panel.style.top = `${rect.top + rect.height / 2 + offset.y}px`;
        panel.style.transform = 'translateY(-50%)';
        break;
    }
  }

  /** Advances to the next step. */
  private nextStep(): void {
    const currentStep = this.config.steps[this.currentStepIndex];
    
    // Validate step if validation function exists
    if (currentStep?.validation && !currentStep.validation()) {
      Logger.warn('Tutorial: Step validation failed');
      return;
    }

    // Call step completion callback
    currentStep?.onComplete?.();

    // Move to next step or complete
    if (this.currentStepIndex < this.config.steps.length - 1) {
      this.showStep(this.currentStepIndex + 1);
    } else {
      this.complete();
    }
  }

  /** Goes back to the previous step. */
  private previousStep(): void {
    if (this.currentStepIndex > 0) {
      this.showStep(this.currentStepIndex - 1);
    }
  }

  /** Skips the tutorial. */
  public skip(): void {
    this.config.onSkip?.();
    this.dispose();
  }

  /** Completes the tutorial. */
  private complete(): void {
    storageSave(STORAGE_KEY, this.config.steps.length); // Mark as completed
    this.config.onComplete?.();
    this.dispose();
  }

  /** Disposes tutorial resources. */
  public dispose(): void {
    this.clearHighlight();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    this.isActive = false;
  }

  /** Resets tutorial progress. */
  public static reset(): void {
    storageSave(STORAGE_KEY, 0);
  }
}

// Pre-defined tutorial steps for the editor
export function createEditorTutorial(): TutorialConfig {
  return {
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to the 3D Scene Editor!',
        description: 'This quick tutorial will guide you through the basics. You can skip anytime.',
        action: 'Let\'s Start',
        position: 'center',
      },
      {
        id: 'camera-controls',
        title: 'Camera Controls',
        description: 'Use WASD to move, right-click and drag to rotate, and scroll to zoom in/out. Try it now!',
        action: 'Got it',
        position: 'center',
      },
      {
        id: 'toolbar',
        title: 'Main Toolbar',
        description: 'The toolbar at the top contains all main actions: add objects, save, play mode, and more.',
        highlightSelector: '.editor-toolbar-container',
        position: 'bottom',
        action: 'Next',
      },
      {
        id: 'hierarchy',
        title: 'Scene Hierarchy',
        description: 'The left panel shows all objects in your scene. Click objects to select them.',
        highlightSelector: '.editor-sidebar',
        position: 'right',
        action: 'Next',
      },
      {
        id: 'inspector',
        title: 'Properties Inspector',
        description: 'The right panel shows properties of the selected object. You can edit position, rotation, and more.',
        highlightSelector: '.editor-inspector',
        position: 'left',
        action: 'Next',
      },
      {
        id: 'play-mode',
        title: 'Test Your Scene',
        description: 'Click the Play button to test your scene in real-time. Press Escape to return to edit mode.',
        action: 'Next',
        position: 'center',
      },
      {
        id: 'complete',
        title: 'You\'re Ready!',
        description: 'You now know the basics. Start creating your 3D scene! Press ? anytime for keyboard shortcuts.',
        action: 'Start Creating',
        position: 'center',
      },
    ],
  };
}

