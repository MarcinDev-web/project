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

    const tagline = this.phaseTaglines[phase] ?? this.phaseTaglines.logo ?? 'Unleash Your Creativity';
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
        background: 
          radial-gradient(circle at 30% 40%, rgba(0, 100, 255, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 70% 60%, rgba(200, 50, 255, 0.12) 0%, transparent 50%),
          linear-gradient(180deg, #0a0e1a 0%, #050810 50%, #020306 100%);
        animation: intro-bg-shift 10s ease-in-out infinite alternate;
        color: #fff;
        opacity: 1;
        transition: opacity 0.6s ease;
      }

      #intro-overlay::before {
        content: '';
        position: absolute;
        inset: -20%;
        background:
          radial-gradient(circle at 50% 30%, rgba(0, 150, 255, 0.2), rgba(0, 150, 255, 0) 60%),
          radial-gradient(circle at 20% 80%, rgba(200, 50, 255, 0.15), rgba(200, 50, 255, 0) 50%),
          radial-gradient(circle at 80% 20%, rgba(0, 200, 255, 0.1), rgba(0, 200, 255, 0) 40%);
        filter: blur(60px);
        opacity: 0.8;
        pointer-events: none;
        transition: opacity 1s ease;
        animation: glow-pulse 4s ease-in-out infinite;
      }
      
      #intro-overlay::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          rgba(0, 150, 255, 0.03) 0px,
          transparent 2px,
          transparent 4px,
          rgba(200, 50, 255, 0.02) 6px
        );
        pointer-events: none;
        animation: scanlines 8s linear infinite;
        opacity: 0.6;
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
        max-width: min(760px, 90%);
        border-radius: 2.4rem;
        backdrop-filter: blur(24px) saturate(180%);
        background: 
          linear-gradient(135deg, rgba(0, 100, 255, 0.08) 0%, rgba(150, 50, 255, 0.08) 100%),
          linear-gradient(180deg, rgba(10, 15, 25, 0.85) 0%, rgba(15, 20, 35, 0.75) 100%);
        border: 2px solid transparent;
        background-clip: padding-box;
        box-shadow: 
          0 40px 120px rgba(0, 0, 0, 0.6),
          0 0 80px rgba(0, 150, 255, 0.15),
          inset 0 0 60px rgba(0, 150, 255, 0.05);
        overflow: hidden;
        z-index: 3;
      }
      
      .intro-content::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        padding: 2px;
        background: linear-gradient(135deg, 
          rgba(0, 150, 255, 0.6) 0%, 
          rgba(200, 50, 255, 0.6) 50%,
          rgba(0, 200, 255, 0.6) 100%);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        z-index: -1;
        animation: border-glow 3s ease-in-out infinite;
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
        background: 
          linear-gradient(135deg, rgba(0, 80, 200, 0.15) 0%, rgba(100, 30, 180, 0.15) 100%),
          linear-gradient(180deg, rgba(5, 10, 20, 0.9) 0%, rgba(15, 20, 40, 0.85) 100%);
        border: 1px solid rgba(0, 150, 255, 0.4);
        box-shadow: 
          0 30px 90px rgba(0, 0, 0, 0.7),
          0 0 60px rgba(0, 150, 255, 0.2),
          inset 0 0 40px rgba(0, 150, 255, 0.08);
        transition: transform 1.2s cubic-bezier(0.19, 1, 0.22, 1), 
                    box-shadow 1.2s ease,
                    border-color 1s ease;
      }

      .logo-text {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: clamp(0.8rem, 2vw, 1.6rem);
        font-size: clamp(2.4rem, 7vw, 5rem);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        line-height: 1.2;
        position: relative;
        z-index: 1;
      }

      .logo-word {
        display: flex;
        gap: clamp(0.05em, 0.08em, 0.1em);
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
        background: linear-gradient(135deg, #00d4ff 0%, #0096ff 35%, #0066ff 70%, #0044cc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 0 20px rgba(0, 150, 255, 0.7)) 
                drop-shadow(0 0 40px rgba(0, 150, 255, 0.4));
        animation: forge-glow 3s ease-in-out infinite;
      }

      .logo-word--world .logo-letter {
        background: linear-gradient(135deg, #e879f9 0%, #c026d3 35%, #9333ea 70%, #7c3aed 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 0 20px rgba(192, 38, 211, 0.7)) 
                drop-shadow(0 0 40px rgba(192, 38, 211, 0.4));
        animation: world-glow 3s ease-in-out infinite 0.2s;
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
        color: rgba(150, 200, 255, 0.75);
        text-transform: uppercase;
        text-shadow: 
          0 0 15px rgba(0, 150, 255, 0.4),
          0 0 30px rgba(0, 100, 200, 0.2);
        opacity: 0;
        animation: subtitle-fade 1s ease forwards 1s;
      }

      .intro-tagline p {
        margin: 0 0 clamp(2rem, 4vw, 3rem);
        font-size: clamp(1.1rem, 2vw, 1.5rem);
        font-weight: 400;
        letter-spacing: 0.25em;
        color: rgba(200, 220, 255, 0.85);
        text-transform: uppercase;
        text-shadow: 
          0 0 20px rgba(0, 150, 255, 0.5),
          0 0 40px rgba(150, 50, 255, 0.3);
        transition: color 0.6s ease, letter-spacing 0.6s ease, text-shadow 0.6s ease;
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
        height: 6px;
        background: rgba(20, 30, 50, 0.8);
        border-radius: 999px;
        overflow: hidden;
        box-shadow: 
          inset 0 0 20px rgba(0, 0, 0, 0.6),
          0 0 10px rgba(0, 100, 255, 0.2);
        border: 1px solid rgba(0, 150, 255, 0.3);
      }

      .loading-progress {
        width: 12%;
        height: 100%;
        background: linear-gradient(90deg, 
          rgba(0, 180, 255, 0.6) 0%, 
          rgba(0, 150, 255, 1) 30%,
          rgba(150, 50, 255, 1) 70%, 
          rgba(200, 50, 255, 0.9) 100%);
        border-radius: inherit;
        transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        box-shadow: 
          0 0 25px rgba(0, 150, 255, 0.8),
          0 0 50px rgba(150, 50, 255, 0.5),
          inset 0 0 15px rgba(255, 255, 255, 0.4);
        position: relative;
        overflow: hidden;
      }
      
      .loading-progress::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, 
          transparent 0%, 
          rgba(255, 255, 255, 0.6) 50%, 
          transparent 100%);
        transform: translateX(-100%);
        animation: loading-shimmer 2s ease-in-out infinite;
      }

      .loading-text {
        font-size: 0.9rem;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(180, 210, 255, 0.8);
        text-shadow: 
          0 0 10px rgba(0, 150, 255, 0.3),
          0 0 20px rgba(100, 150, 255, 0.2);
        margin: 0;
      }

      .loading-text.status-swap {
        animation: status-swap 0.6s ease;
      }

      #intro-overlay[data-phase="logo"] .logo-wrapper {
        transform: scale(0.94);
        border-color: rgba(0, 120, 255, 0.3);
      }

      #intro-overlay[data-phase="reveal"] .logo-wrapper {
        transform: scale(1.0);
        border-color: rgba(0, 150, 255, 0.5);
        box-shadow: 
          0 30px 90px rgba(0, 0, 0, 0.7),
          0 0 70px rgba(0, 150, 255, 0.3),
          inset 0 0 40px rgba(0, 150, 255, 0.1);
      }

      #intro-overlay[data-phase="hero"] .logo-wrapper {
        transform: scale(1.05);
        border-color: rgba(150, 50, 255, 0.6);
        box-shadow: 
          0 35px 110px rgba(0, 0, 0, 0.75),
          0 0 90px rgba(150, 50, 255, 0.4),
          0 0 120px rgba(0, 150, 255, 0.3),
          inset 0 0 50px rgba(150, 50, 255, 0.12);
      }

      #intro-overlay[data-phase="finale"] .logo-wrapper {
        transform: scale(1.1);
        border-color: rgba(200, 80, 255, 0.8);
        box-shadow: 
          0 40px 140px rgba(0, 0, 0, 0.8),
          0 0 120px rgba(200, 50, 255, 0.6),
          0 0 180px rgba(0, 150, 255, 0.4),
          inset 0 0 60px rgba(200, 50, 255, 0.15);
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

      #intro-overlay[data-phase="hero"] .intro-tagline p {
        color: rgba(255, 255, 255, 0.95);
        letter-spacing: 0.28em;
        text-shadow: 
          0 0 25px rgba(150, 50, 255, 0.7),
          0 0 50px rgba(0, 150, 255, 0.4);
      }
      
      #intro-overlay[data-phase="finale"] .intro-tagline p {
        color: rgba(255, 255, 255, 1);
        letter-spacing: 0.32em;
        text-shadow: 
          0 0 30px rgba(200, 50, 255, 0.9),
          0 0 60px rgba(0, 150, 255, 0.6),
          0 0 90px rgba(150, 100, 255, 0.4);
      }

      @keyframes intro-bg-shift {
        0% { filter: hue-rotate(0deg) brightness(1); }
        50% { filter: hue-rotate(-8deg) brightness(1.05); }
        100% { filter: hue-rotate(6deg) brightness(0.98); }
      }

      @keyframes glow-pulse {
        0%, 100% { 
          opacity: 0.8; 
          transform: scale(1);
        }
        50% { 
          opacity: 1; 
          transform: scale(1.05);
        }
      }

      @keyframes scanlines {
        0% { transform: translateY(0); }
        100% { transform: translateY(10px); }
      }

      @keyframes loading-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }

      @keyframes border-glow {
        0%, 100% { 
          opacity: 0.6;
          filter: hue-rotate(0deg);
        }
        50% { 
          opacity: 1;
          filter: hue-rotate(30deg);
        }
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
        0% { 
          opacity: 0; 
          letter-spacing: 0.6em; 
          text-shadow: 0 0 5px rgba(0, 150, 255, 0.2);
        }
        100% { 
          opacity: 1; 
          letter-spacing: 0.4em;
          text-shadow: 
            0 0 15px rgba(0, 150, 255, 0.4),
            0 0 30px rgba(0, 100, 200, 0.2);
        }
      }

      @keyframes forge-glow {
        0%, 100% { 
          filter: drop-shadow(0 0 20px rgba(0, 150, 255, 0.7)) 
                  drop-shadow(0 0 40px rgba(0, 150, 255, 0.4)); 
        }
        50% { 
          filter: drop-shadow(0 0 30px rgba(0, 200, 255, 1)) 
                  drop-shadow(0 0 60px rgba(0, 150, 255, 0.6)); 
        }
      }

      @keyframes world-glow {
        0%, 100% { 
          filter: drop-shadow(0 0 20px rgba(192, 38, 211, 0.7)) 
                  drop-shadow(0 0 40px rgba(192, 38, 211, 0.4)); 
        }
        50% { 
          filter: drop-shadow(0 0 30px rgba(232, 121, 249, 1)) 
                  drop-shadow(0 0 60px rgba(192, 38, 211, 0.6)); 
        }
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

