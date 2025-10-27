import type { LoadingProgress } from '../core/LoadingProgress';

export class LoadingOverlay {
  private container: HTMLElement;
  private titleEl: HTMLElement;
  private barEl: HTMLElement;
  private barFillEl: HTMLElement;
  private messageEl: HTMLElement;
  private errorEl: HTMLElement;
  private cancelBtn: HTMLButtonElement;
  private onCancel: (() => void) | null = null;

  constructor(doc: Document = document) {
    // Root container
    const container = doc.createElement('div');
    container.className = 'editor-loading-overlay';
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.display = 'none';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = 'rgba(0,0,0,0.5)';
    container.style.backdropFilter = 'blur(2px)';
    container.style.zIndex = '9999';

    const panel = doc.createElement('div');
    panel.style.minWidth = 'min(520px, 90vw)';
    panel.style.maxWidth = '90vw';
    panel.style.borderRadius = '10px';
    panel.style.padding = '20px 24px';
    panel.style.background = '#121212';
    panel.style.boxShadow = '0 10px 40px rgba(0,0,0,0.35)';
    panel.style.color = '#e5e5e5';

    const title = doc.createElement('div');
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '12px';
    title.textContent = 'Loading...';

    const bar = doc.createElement('div');
    bar.style.position = 'relative';
    bar.style.height = '10px';
    bar.style.borderRadius = '6px';
    bar.style.background = '#2a2a2a';
    bar.style.overflow = 'hidden';

    const fill = doc.createElement('div');
    fill.style.height = '100%';
    fill.style.width = '0%';
    fill.style.transition = 'width 120ms linear';
    fill.style.background = 'linear-gradient(90deg, #4f46e5, #7c3aed)';

    const message = doc.createElement('div');
    message.style.marginTop = '10px';
    message.style.fontSize = '12px';
    message.style.opacity = '0.9';
    message.textContent = '';

    const error = doc.createElement('div');
    const cancel = doc.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.marginTop = '16px';
    cancel.style.padding = '8px 12px';
    cancel.style.borderRadius = '6px';
    cancel.style.border = '1px solid #3a3a3a';
    cancel.style.background = '#1f1f1f';
    cancel.style.color = '#e5e5e5';
    cancel.style.cursor = 'pointer';
    cancel.onclick = () => {
      try { this.onCancel?.(); } catch { /* ignore */ }
    };
    error.style.marginTop = '12px';
    error.style.fontSize = '12px';
    error.style.color = '#ff6b6b';
    error.style.display = 'none';

    bar.appendChild(fill);
    panel.appendChild(title);
    panel.appendChild(bar);
    panel.appendChild(message);
    panel.appendChild(error);
    panel.appendChild(cancel);
    container.appendChild(panel);
    doc.body.appendChild(container);

    this.container = container;
    this.titleEl = title;
    this.barEl = bar;
    this.barFillEl = fill;
    this.messageEl = message;
    this.errorEl = error;
    this.cancelBtn = cancel as HTMLButtonElement;
  }

  show(title: string, onCancel?: () => void): void {
    this.titleEl.textContent = title;
    this.onCancel = onCancel ?? null;
    this.cancelBtn.style.display = onCancel ? 'inline-block' : 'none';
    this.errorEl.style.display = 'none';
    this.messageEl.textContent = '';
    this.barFillEl.style.width = '0%';
    this.container.style.display = 'flex';
  }

  updateProgress(progress: LoadingProgress): void {
    const pct = Math.max(0, Math.min(100, Math.round(progress.percentage)));
    this.barFillEl.style.width = `${pct}%`;
    const step = progress.step ?? 'Loading';
    const msg = progress.message ?? '';
    this.messageEl.textContent = msg ? `${step}: ${msg}` : step;
  }

  showError(error: string, _canRetry: boolean): void {
    this.errorEl.textContent = `Error: ${error}`;
    this.errorEl.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}


