/**
 * HTML overlay for the intro scene
 * Displays FORGE WORLD branding with animations
 */

export interface IntroOverlayOptions {
  duration: number;
}

/**
 * Creates and manages the HTML overlay for the intro
 */
export class IntroOverlay {
  private container: HTMLDivElement | null = null;
  private animationStartTime = 0;
  private animationFrameId: number | null = null;
  private letters: HTMLElement[] = [];
  private letterRevealCount = 0;
  private logoWrapper: HTMLElement | null = null;
  private logoSweepActivated = false;
  private currentPhase = 'logo';
  private statusMessage: string | null = null;
  private readonly phaseTaglines: Record<string, string> = {
    logo: 'Summoning the Forge',
    reveal: 'Igniting the World',
    hero: 'Unleash Your Creativity',
    finale: 'Enter Forge World',
  };
  private readonly phaseStatuses: Record<string, string> = {
    logo: 'Calibrating Identity...',
    reveal: 'Synchronizing Worlds...',
    hero: 'Charging Render Pipelines...',
    finale: 'Systems Ready. Launch!',
  };
  private statusAnimationTimeout: number | null = null;
  private lastProgress = 0;

  constructor(private readonly options: IntroOverlayOptions) {}

  /**
   * Create and show the overlay
   */
  public show(): void {
    if (this.container) return;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'intro-overlay';
    this.container.innerHTML = `
      <div class="cinematic-bars cinematic-bars--top" aria-hidden="true"></div>
      <div class="cinematic-bars cinematic-bars--bottom" aria-hidden="true"></div>
      <div class="intro-content">
        <div class="film-grain" aria-hidden="true"></div>
        <div class="intro-logo">
          <div class="logo-wrapper" role="presentation">
            <h1 class="logo-text" aria-label="FORGE WORLD">
              <span class="logo-word logo-word--forge">
                <span class="logo-letter" data-letter="F" style="--letter-index:0">F</span>
                <span class="logo-letter" data-letter="O" style="--letter-index:1">O</span>
                <span class="logo-letter" data-letter="R" style="--letter-index:2">R</span>
                <span class="logo-letter" data-letter="G" style="--letter-index:3">G</span>
                <span class="logo-letter" data-letter="E" style="--letter-index:4">E</span>
              </span>
              <span class="logo-word logo-word--world">
                <span class="logo-letter" data-letter="W" style="--letter-index:5">W</span>
                <span class="logo-letter" data-letter="O" style="--letter-index:6">O</span>
                <span class="logo-letter" data-letter="R" style="--letter-index:7">R</span>
                <span class="logo-letter" data-letter="L" style="--letter-index:8">L</span>
                <span class="logo-letter" data-letter="D" style="--letter-index:9">D</span>
              </span>
            </h1>
            <span class="logo-sweep" aria-hidden="true"></span>
          </div>
          <p class="logo-subtitle">UGC 3D PLATFORM</p>
        </div>
        
        <div class="intro-tagline">
          <p>Shape Your Universe</p>
        </div>
        
        <div class="intro-loading">
          <div class="loading-bar">
            <div class="loading-progress"></div>
          </div>
          <p class="loading-text">Calibrating Identity...</p>
        </div>
      </div>
    `;

    // Add styles
    this.injectStyles();

    // Add to DOM
    this.container.setAttribute('data-phase', this.currentPhase);
    document.body.appendChild(this.container);

    this.cacheElements();
    this.clearTimers();
    this.setPhase('logo');
    // Start animation
    this.animationStartTime = performance.now();
    this.animate();
  }

  /**
   * Hide and remove the overlay
   */
  public hide(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.clearTimers();
    this.statusMessage = null;
    this.letters = [];
    this.logoWrapper = null;
    this.logoSweepActivated = false;

    if (this.container) {
      // Fade out
      this.container.style.opacity = '0';
      
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
      }, 500);
    }
  }

  /**
   * Animate overlay elements
   */
  private animate = (): void => {
    if (!this.container) return;

    const elapsed = (performance.now() - this.animationStartTime) / 1000;
    const progress = Math.min(elapsed / this.options.duration, 1);
    this.lastProgress = progress;

    this.container.style.setProperty('--intro-progress', progress.toFixed(3));

    this.revealLetters(progress);

    if (this.logoWrapper && !this.logoSweepActivated && progress >= 0.6) {
      this.logoSweepActivated = true;
      this.logoWrapper.classList.add('logo-wrapper--active');
    }

    const loadingBar = this.container.querySelector('.loading-progress') as HTMLElement | null;
    if (loadingBar) {
      loadingBar.style.width = `${Math.max(progress, 0.02) * 100}%`;
    }

    this.updateStatusMessage(progress);

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  };

  private cacheElements(): void {
    if (!this.container) return;
    this.letters = Array.from(this.container.querySelectorAll<HTMLElement>('.logo-letter'));
    this.letters.forEach((letter, index) => {
      letter.classList.remove('visible');
      letter.style.setProperty('--letter-index', letter.style.getPropertyValue('--letter-index') || `${index}`);
    });
    this.letterRevealCount = 0;
    this.logoWrapper = this.container.querySelector('.logo-wrapper');
    if (this.logoWrapper) {
      this.logoWrapper.classList.remove('logo-wrapper--active');
    }
    this.logoSweepActivated = false;
  }

  private clearTimers(): void {
    if (this.statusAnimationTimeout !== null) {
      clearTimeout(this.statusAnimationTimeout);
      this.statusAnimationTimeout = null;
    }
  }

  public setPhase(phase: string): void {
    this.currentPhase = phase;
    if (this.container) {
      this.container.setAttribute('data-phase', phase);
    }

    const tagline = this.phaseTaglines[phase] ?? this.phaseTaglines.logo;
    this.updateTagline(tagline);

    this.statusMessage = this.phaseStatuses[phase] ?? null;
    this.clearTimers();
    if (this.statusMessage) {
      this.statusAnimationTimeout = window.setTimeout(() => {
        this.statusMessage = null;
      }, 2000);
    }

    this.updateStatusMessage(this.lastProgress);
  }

  private updateTagline(text: string): void {
    if (!this.container) return;
    const taglineElement = this.container.querySelector('.intro-tagline p') as HTMLElement | null;
    if (!taglineElement || taglineElement.textContent === text) return;
    taglineElement.textContent = text;
    taglineElement.classList.add('tagline-swap');
    taglineElement.addEventListener('animationend', () => {
      taglineElement.classList.remove('tagline-swap');
    }, { once: true });
  }

  private getProgressMessage(progress: number): string {
    if (progress < 0.2) return 'Initializing WebGPU...';
    if (progress < 0.45) return 'Linking Engine Modules...';
    if (progress < 0.7) return 'Charging Forge Reactors...';
    if (progress < 0.9) return 'Stabilizing World Grid...';
    return 'Forged and Ready!';
  }

  private updateStatusMessage(progress: number): void {
    if (!this.container) return;
    const loadingText = this.container.querySelector('.loading-text') as HTMLElement | null;
    if (!loadingText) return;
    const message = this.statusMessage ?? this.getProgressMessage(progress);
    if (loadingText.textContent === message) return;
    loadingText.textContent = message;
    loadingText.classList.add('status-swap');
    loadingText.addEventListener('animationend', () => {
      loadingText.classList.remove('status-swap');
    }, { once: true });
  }

  private revealLetters(progress: number): void {
    if (this.letters.length === 0) return;
    const total = this.letters.length;
    const revealTarget = Math.min(total, Math.floor((total + 4) * progress));
    if (revealTarget <= this.letterRevealCount) return;
    for (let i = this.letterRevealCount; i < revealTarget; i++) {
      const letter = this.letters[i];
      if (letter) {
        letter.classList.add('visible');
      }
    }
    this.letterRevealCount = revealTarget;
  }

  /**
   * Inject CSS styles for the overlay
   */
  private injectStyles(): void {
    if (document.getElementById('intro-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'intro-overlay-styles';
    style.textContent = `
      #intro-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: radial-gradient(110% 110% at 50% 40%, #141a2a 0%, #0b101f 55%, #05070d 100%);
        animation: intro-bg-shift 8s ease-in-out infinite alternate;
        color: #fff;
        opacity: 1;
        transition: opacity 0.6s ease;
      }

      #intro-overlay::before {
        content: '';
        position: absolute;
        inset: -20%;
        background:
          radial-gradient(circle at 50% 30%, rgba(96, 165, 250, 0.12), rgba(96, 165, 250, 0) 55%),
          radial-gradient(circle at 20% 80%, rgba(167, 139, 250, 0.1), rgba(167, 139, 250, 0) 40%);
        filter: blur(40px);
        opacity: 0.7;
        pointer-events: none;
        transition: opacity 1s ease;
      }

      .cinematic-bars {
        position: absolute;
        left: 0;
        width: 100%;
        height: clamp(60px, 10vh, 120px);
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 100%);
        pointer-events: none;
        z-index: 2;
        transform: translateY(-30%);
        transition: opacity 0.6s ease;
      }

      .cinematic-bars--bottom {
        top: auto;
        bottom: 0;
        transform: translateY(30%) rotate(180deg);
      }

      .intro-content {
        position: relative;
        text-align: center;
        padding: clamp(2.5rem, 4vw, 3.8rem) clamp(2rem, 5vw, 4.2rem);
        max-width: min(720px, 88%);
        border-radius: 2.4rem;
        backdrop-filter: blur(18px);
        background: linear-gradient(140deg, rgba(12, 17, 28, 0.72) 0%, rgba(22, 31, 48, 0.45) 100%);
        border: 1px solid rgba(118, 150, 255, 0.25);
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
        overflow: hidden;
        z-index: 3;
      }

      .film-grain {
        position: absolute;
        inset: -45%;
        background-image:
          linear-gradient(0deg, rgba(255, 255, 255, 0.02) 0%, rgba(0, 0, 0, 0.02) 100%),
          linear-gradient(90deg, rgba(255, 255, 255, 0.015) 0%, rgba(0, 0, 0, 0.015) 100%);
        background-size: 160px 160px, 180px 180px;
        opacity: 0.18;
        mix-blend-mode: screen;
        animation: film-grain 1.2s steps(4) infinite;
        pointer-events: none;
      }

      .intro-logo {
        position: relative;
        margin-bottom: clamp(2rem, 4vw, 3rem);
      }

      .logo-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: clamp(1.2rem, 3vw, 2rem) clamp(1.6rem, 4vw, 2.8rem);
        border-radius: 1.8rem;
        background: linear-gradient(135deg, rgba(18, 27, 44, 0.8) 0%, rgba(39, 51, 78, 0.45) 100%);
        border: 1px solid rgba(110, 138, 255, 0.35);
        box-shadow: 0 24px 70px rgba(5, 8, 14, 0.6);
        transition: transform 1.2s cubic-bezier(0.19, 1, 0.22, 1), box-shadow 1.2s ease;
      }

      .logo-text {
        margin: 0;
        display: flex;
        align-items: center;
        gap: clamp(1.2rem, 2.5vw, 2rem);
        font-size: clamp(3.2rem, 8vw, 5.6rem);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        line-height: 1;
        position: relative;
        z-index: 1;
      }

      .logo-word {
        display: flex;
        gap: clamp(0.05em, 0.1em, 0.12em);
      }

      .logo-letter {
        display: inline-block;
        opacity: 0;
        transform: translateY(45px) scale(0.9);
        transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        transition-delay: calc(var(--letter-index, 0) * 0.05s);
        will-change: transform, opacity;
      }

      .logo-letter.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .logo-word--forge .logo-letter {
        background: linear-gradient(120deg, #74b3ff 0%, #3b82f6 50%, #1d4ed8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .logo-word--world .logo-letter {
        background: linear-gradient(120deg, #c4b5fd 0%, #8b5cf6 45%, #6d28d9 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .logo-sweep {
        position: absolute;
        inset: -30% -40%;
        background: linear-gradient(100deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 45%, rgba(255, 255, 255, 0) 80%);
        transform: translateX(-120%) rotate(12deg);
        opacity: 0;
        pointer-events: none;
      }

      .logo-wrapper--active .logo-sweep {
        opacity: 1;
        animation: logo-sweep 4s ease-in-out infinite;
      }

      .logo-subtitle {
        margin-top: 1.2rem;
        font-size: 0.85rem;
        letter-spacing: 0.4em;
        color: rgba(180, 195, 255, 0.65);
        text-transform: uppercase;
        opacity: 0;
        animation: subtitle-fade 1s ease forwards 1s;
      }

      .intro-tagline p {
        margin: 0 0 clamp(2rem, 4vw, 3rem);
        font-size: clamp(1.1rem, 2vw, 1.5rem);
        font-weight: 300;
        letter-spacing: 0.22em;
        color: rgba(223, 230, 255, 0.75);
        text-transform: uppercase;
        transition: color 0.6s ease, letter-spacing 0.6s ease;
      }

      .intro-tagline p.tagline-swap {
        animation: tagline-swap 0.6s ease;
      }

      .intro-loading {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
      }

      .loading-bar {
        width: min(420px, 100%);
        height: 5px;
        background: rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        overflow: hidden;
        box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.35);
      }

      .loading-progress {
        width: 12%;
        height: 100%;
        background: linear-gradient(90deg, rgba(96, 165, 250, 0.2) 0%, rgba(167, 139, 250, 0.85) 60%, rgba(96, 165, 250, 0.9) 100%);
        border-radius: inherit;
        transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        box-shadow: 0 0 18px rgba(135, 160, 255, 0.45);
      }

      .loading-text {
        font-size: 0.9rem;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(210, 220, 255, 0.7);
        margin: 0;
      }

      .loading-text.status-swap {
        animation: status-swap 0.6s ease;
      }

      #intro-overlay[data-phase="logo"] .logo-wrapper {
        transform: scale(0.94);
      }

      #intro-overlay[data-phase="reveal"] .logo-wrapper {
        transform: scale(1.0);
      }

      #intro-overlay[data-phase="hero"] .logo-wrapper {
        transform: scale(1.05);
        box-shadow: 0 26px 90px rgba(26, 31, 53, 0.65);
      }

      #intro-overlay[data-phase="finale"] .logo-wrapper {
        transform: scale(1.1);
        box-shadow: 0 36px 120px rgba(50, 89, 255, 0.45);
      }

      #intro-overlay[data-phase="reveal"] .logo-word--forge .logo-letter.visible,
      #intro-overlay[data-phase="hero"] .logo-word--world .logo-letter.visible,
      #intro-overlay[data-phase="finale"] .logo-letter.visible {
        filter: drop-shadow(0 0 16px rgba(135, 160, 255, 0.6));
      }

      #intro-overlay[data-phase="finale"]::before {
        opacity: 1;
      }

      #intro-overlay[data-phase="finale"] .cinematic-bars {
        opacity: 0.4;
      }

      #intro-overlay[data-phase="hero"] .intro-tagline p,
      #intro-overlay[data-phase="finale"] .intro-tagline p {
        color: rgba(255, 255, 255, 0.9);
        letter-spacing: 0.28em;
      }

      @keyframes intro-bg-shift {
        0% { filter: hue-rotate(0deg); }
        50% { filter: hue-rotate(-6deg); }
        100% { filter: hue-rotate(4deg); }
      }

      @keyframes film-grain {
        0% { transform: translate3d(0, 0, 0); }
        25% { transform: translate3d(-12px, 8px, 0); }
        50% { transform: translate3d(9px, -6px, 0); }
        75% { transform: translate3d(6px, 10px, 0); }
        100% { transform: translate3d(0, 0, 0); }
      }

      @keyframes logo-sweep {
        0% { transform: translateX(-130%) rotate(12deg); opacity: 0; }
        20% { opacity: 1; }
        50% { transform: translateX(130%) rotate(12deg); opacity: 0.7; }
        100% { transform: translateX(200%) rotate(12deg); opacity: 0; }
      }

      @keyframes tagline-swap {
        0% { opacity: 0; transform: translateY(10px); }
        40% { opacity: 1; transform: translateY(-4px); }
        100% { opacity: 1; transform: translateY(0); }
      }

      @keyframes status-swap {
        0% { opacity: 0; transform: translateY(6px); }
        50% { opacity: 1; transform: translateY(-2px); }
        100% { opacity: 1; transform: translateY(0); }
      }

      @keyframes subtitle-fade {
        0% { opacity: 0; letter-spacing: 0.6em; }
        100% { opacity: 0.6; letter-spacing: 0.4em; }
      }

      @media (max-width: 768px) {
        .intro-content {
          padding: 2rem 1.5rem;
          border-radius: 1.6rem;
        }

        .logo-text {
          font-size: clamp(2.6rem, 12vw, 3.4rem);
          letter-spacing: 0.1em;
          gap: 1rem;
        }

        .logo-wrapper {
          padding: 1rem 1.6rem;
        }

        .cinematic-bars {
          height: clamp(40px, 8vh, 80px);
        }

        .intro-loading {
          gap: 0.75rem;
        }

        .loading-text {
          font-size: 0.78rem;
          letter-spacing: 0.18em;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

