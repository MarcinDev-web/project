/**
 * Tooltip System
 * Elegant, accessible tooltips for interactive elements
 * 
 * Features:
 * - Automatic positioning (top, bottom, left, right)
 * - Smart collision detection
 * - Keyboard shortcut hints
 * - Delay before showing
 * - Smooth animations
 * - Touch-friendly (tap to show)
 * - Accessible (ARIA labels)
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TooltipOptions {
  content: string;
  placement?: TooltipPlacement;
  delay?: number;
  shortcut?: string;
  maxWidth?: number;
  theme?: 'dark' | 'light';
}

let tooltipElement: HTMLElement | null = null;
let currentTarget: HTMLElement | null = null;
let showTimeout: number | null = null;
let hideTimeout: number | null = null;

/**
 * Initialize the tooltip system
 */
export function initTooltipSystem(): void {
  if (tooltipElement) return;

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'tooltip';
  tooltipElement.setAttribute('role', 'tooltip');
  tooltipElement.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltipElement);
}

/**
 * Add tooltip to an element
 */
export function addTooltip(element: HTMLElement, options: TooltipOptions | string): void {
  const opts: TooltipOptions = typeof options === 'string' 
    ? { content: options }
    : options;

  const {
    content,
    placement = 'auto',
    delay = 500,
    shortcut,
    maxWidth = 200,
    theme = 'dark',
  } = opts;

  // Store tooltip data
  element.dataset.tooltip = content;
  element.dataset.tooltipPlacement = placement;
  element.dataset.tooltipDelay = delay.toString();
  element.dataset.tooltipTheme = theme;
  if (shortcut) element.dataset.tooltipShortcut = shortcut;
  if (maxWidth) element.dataset.tooltipMaxWidth = maxWidth.toString();

  // ARIA
  element.setAttribute('aria-describedby', 'tooltip');

  // Event listeners
  element.addEventListener('mouseenter', handleMouseEnter);
  element.addEventListener('mouseleave', handleMouseLeave);
  element.addEventListener('focus', handleFocus);
  element.addEventListener('blur', handleBlur);

  // Touch support
  element.addEventListener('touchstart', handleTouchStart, { passive: true });
}

/**
 * Remove tooltip from an element
 */
export function removeTooltip(element: HTMLElement): void {
  delete element.dataset.tooltip;
  delete element.dataset.tooltipPlacement;
  delete element.dataset.tooltipDelay;
  delete element.dataset.tooltipTheme;
  delete element.dataset.tooltipShortcut;
  delete element.dataset.tooltipMaxWidth;
  element.removeAttribute('aria-describedby');

  element.removeEventListener('mouseenter', handleMouseEnter);
  element.removeEventListener('mouseleave', handleMouseLeave);
  element.removeEventListener('focus', handleFocus);
  element.removeEventListener('blur', handleBlur);
  element.removeEventListener('touchstart', handleTouchStart);
}

/**
 * Show tooltip for an element
 */
function showTooltip(element: HTMLElement): void {
  if (!tooltipElement) initTooltipSystem();
  if (!tooltipElement) return;

  const content = element.dataset.tooltip;
  if (!content) return;

  currentTarget = element;

  // Clear any pending hide timeout
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Build tooltip content
  const shortcut = element.dataset.tooltipShortcut;
  const theme = element.dataset.tooltipTheme || 'dark';
  const maxWidth = element.dataset.tooltipMaxWidth || '200';

  tooltipElement.innerHTML = '';
  tooltipElement.className = `tooltip tooltip-${theme}`;
  tooltipElement.style.maxWidth = `${maxWidth}px`;

  const contentEl = document.createElement('span');
  contentEl.className = 'tooltip-content';
  contentEl.textContent = content;
  tooltipElement.appendChild(contentEl);

  if (shortcut) {
    const shortcutEl = document.createElement('kbd');
    shortcutEl.className = 'tooltip-shortcut';
    shortcutEl.textContent = shortcut;
    tooltipElement.appendChild(shortcutEl);
  }

  // Position tooltip
  positionTooltip(element);

  // Show with animation
  tooltipElement.classList.add('tooltip-visible');
  tooltipElement.setAttribute('aria-hidden', 'false');
}

/**
 * Hide tooltip
 */
function hideTooltip(): void {
  if (!tooltipElement) return;

  tooltipElement.classList.remove('tooltip-visible');
  tooltipElement.setAttribute('aria-hidden', 'true');
  currentTarget = null;

  // Clean up after animation
  hideTimeout = window.setTimeout(() => {
    if (tooltipElement) {
      tooltipElement.style.transform = '';
    }
  }, 200);
}

/**
 * Position tooltip relative to target element
 */
function positionTooltip(target: HTMLElement): void {
  if (!tooltipElement) return;

  const placement = target.dataset.tooltipPlacement || 'auto';
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const gap = 8; // Space between target and tooltip

  let top = 0;
  let left = 0;
  let actualPlacement = placement;

  // Determine best placement if auto
  if (placement === 'auto') {
    const spaceTop = rect.top;
    const spaceBottom = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    const spaces = [
      { placement: 'top' as const, space: spaceTop },
      { placement: 'bottom' as const, space: spaceBottom },
      { placement: 'left' as const, space: spaceLeft },
      { placement: 'right' as const, space: spaceRight },
    ];

    actualPlacement = spaces.sort((a, b) => b.space - a.space)[0]!.placement;
  }

  // Calculate position based on placement
  switch (actualPlacement) {
    case 'top':
      top = rect.top - tooltipRect.height - gap;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
      tooltipElement.dataset.placement = 'top';
      break;

    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + (rect.width - tooltipRect.width) / 2;
      tooltipElement.dataset.placement = 'bottom';
      break;

    case 'left':
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.left - tooltipRect.width - gap;
      tooltipElement.dataset.placement = 'left';
      break;

    case 'right':
      top = rect.top + (rect.height - tooltipRect.height) / 2;
      left = rect.right + gap;
      tooltipElement.dataset.placement = 'right';
      break;
  }

  // Ensure tooltip stays within viewport
  const padding = 8;
  top = Math.max(padding, Math.min(window.innerHeight - tooltipRect.height - padding, top));
  left = Math.max(padding, Math.min(window.innerWidth - tooltipRect.width - padding, left));

  tooltipElement.style.transform = `translate(${left}px, ${top}px)`;
}

/**
 * Event handlers
 */
function handleMouseEnter(event: Event): void {
  const element = event.currentTarget as HTMLElement;
  const delay = parseInt(element.dataset.tooltipDelay || '500', 10);

  if (showTimeout !== null) {
    window.clearTimeout(showTimeout);
  }

  showTimeout = window.setTimeout(() => {
    showTooltip(element);
  }, delay);
}

function handleMouseLeave(): void {
  if (showTimeout !== null) {
    window.clearTimeout(showTimeout);
    showTimeout = null;
  }

  hideTooltip();
}

function handleFocus(event: Event): void {
  const element = event.currentTarget as HTMLElement;
  // Show immediately on keyboard focus
  showTooltip(element);
}

function handleBlur(): void {
  hideTooltip();
}

function handleTouchStart(event: Event): void {
  const element = event.currentTarget as HTMLElement;
  
  // Toggle tooltip on touch
  if (currentTarget === element) {
    hideTooltip();
  } else {
    showTooltip(element);

    // Auto-hide after 3 seconds
    if (hideTimeout !== null) {
      window.clearTimeout(hideTimeout);
    }
    hideTimeout = window.setTimeout(() => {
      hideTooltip();
    }, 3000);
  }
}

/**
 * Cleanup
 */
export function destroyTooltipSystem(): void {
  if (showTimeout !== null) {
    window.clearTimeout(showTimeout);
    showTimeout = null;
  }
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  if (tooltipElement) {
    tooltipElement.remove();
    tooltipElement = null;
  }
  currentTarget = null;
}

