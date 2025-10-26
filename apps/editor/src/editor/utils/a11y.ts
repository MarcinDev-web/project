export interface FocusToken {
  selector: string;
  value?: string;
}

export function createLiveRegion(doc: Document): HTMLElement {
  const live = doc.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  live.className = 'sr-only-live';
  live.style.position = 'absolute';
  live.style.width = '1px';
  live.style.height = '1px';
  live.style.overflow = 'hidden';
  live.style.clip = 'rect(1px, 1px, 1px, 1px)';
  live.style.clipPath = 'inset(50%)';
  live.style.whiteSpace = 'nowrap';
  return live;
}

export function saveFocusToken(root: HTMLElement): FocusToken | null {
  const active = root.ownerDocument.activeElement as HTMLElement | null;
  if (!active || !root.contains(active)) return null;
  const selector = computeSelector(root, active);
  if (!selector) return null;
  const token: FocusToken = { selector };
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    token.value = active.value;
  }
  return token;
}

export function restoreFocusToken(root: HTMLElement, token: FocusToken): boolean {
  const el = root.querySelector(token.selector) as HTMLElement | null;
  if (!el) return false;
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && token.value !== undefined) {
    el.value = token.value as string;
  }
  if (typeof (el as any).focus === 'function') {
    (el as any).focus();
    return true;
  }
  return false;
}

function computeSelector(root: HTMLElement, el: Element): string | null {
  if (!(el instanceof Element)) return null;
  // Prefer data-field markers, then ids, then classes+tag fallback
  const field = el.getAttribute('data-field');
  if (field) return `[data-field="${cssEscape(field)}"]`;
  if (el.id) return `#${cssEscape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).map((c) => `.${cssEscape(c)}`).join('');
  const candidate = `${tag}${classes}`;
  const matches = root.querySelectorAll(candidate);
  if (matches.length === 1) return candidate;
  const index = Array.from(el.parentElement?.children ?? []).indexOf(el as HTMLElement);
  if (index >= 0) {
    return `${candidate}:nth-child(${index + 1})`;
  }
  return candidate;
}

// Minimal CSS escape compatible for simple values
function cssEscape(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m.charCodeAt(0).toString(16)} `);
}


