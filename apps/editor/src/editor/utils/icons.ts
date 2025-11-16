/**
 * Icon System - Professional SVG Icons
 *
 * Minimal, consistent icon set for the editor.
 * Icons are generated as SVG strings for flexibility.
 */

export type IconName =
  | 'move'
  | 'rotate'
  | 'scale'
  | 'undo'
  | 'redo'
  | 'save'
  | 'load'
  | 'new'
  | 'play'
  | 'stop'
  | 'grid'
  | 'snap'
  | 'search'
  | 'close'
  | 'check'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'paste'
  | 'folder'
  | 'file'
  | 'settings'
  | 'help'
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'eye'
  | 'eye-off'
  | 'user'
  | 'users'
  | 'lock'
  | 'unlock'
  | 'link'
  | 'unlink'
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'sun'
  | 'camera'
  | 'box'
  | 'circle'
  | 'square'
  | 'layers'
  | 'sliders'
  | 'package'
  | 'hash'
  | 'rotate-ccw'
  | 'palette'
  | 'star'
  | 'star-filled'
  | 'mouse-pointer'
  | 'sparkle'
  | 'shield-check'
  | 'list'
  | 'map-pin'
  | 'flag'
  | 'play-circle'
  | 'target';

/**
 * Creates an SVG icon element.
 * @param name - Icon name
 * @param size - Icon size in pixels (default: 16)
 * @param className - Optional CSS class
 * @returns SVG element
 */
export function createIcon(name: IconName, size = 16, className?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (className) {
    svg.setAttribute('class', className);
  }

  const path = getIconPath(name);
  if (Array.isArray(path)) {
    path.forEach((p) => {
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', p);
      svg.appendChild(pathEl);
    });
  } else {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    svg.appendChild(pathEl);
  }

  return svg;
}

/**
 * Creates an icon as an HTML string.
 * @param name - Icon name
 * @param size - Icon size
 * @returns HTML string
 */
export function iconHTML(name: IconName, size = 16): string {
  const path = getIconPath(name);
  const paths = Array.isArray(path) ? path : [path];

  const pathElements = paths.map((p) => `<path d="${p}"/>`).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathElements}</svg>`;
}

/**
 * Icon path data (SVG paths).
 */
function getIconPath(name: IconName): string | string[] {
  const icons: Record<IconName, string | string[]> = {
    move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
    rotate: 'M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2',
    scale: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5M12 5v12',
    undo: 'M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
    redo: 'M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
    load: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    new: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-6 M9 15h6',
    play: 'M5 3l14 9-14 9V3z',
    stop: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    grid: 'M3 3v7h7V3H3zM14 3v7h7V3h-7zM14 14v7h7v-7h-7zM3 14v7h7v-7H3z',
    snap: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    close: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    trash:
      'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    paste:
      'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M10 2h4a2 2 0 0 1 2 2v2H8V4a2 2 0 0 1 2-2z',
    folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    file: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7',
    settings:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
    help: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z',
    cube: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
    sphere: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M2 12h20',
    cylinder: 'M21 8a9 9 0 1 1-18 0M21 8v8a9 9 0 1 1-18 0V8',
    'chevron-down': 'M6 9l6 6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    'chevron-up': 'M18 15l-6-6-6 6',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'eye-off': [
      'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
      'M1 1l22 22',
    ],
    user: [
      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
      'M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    ],
    users: [
      'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2',
      'M7 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
      'M23 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 1 1 0 7.75',
    ],
    lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
    unlock:
      'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 9.9-1',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    unlink: [
      'M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71',
      'M12.15 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71',
      'M3 3l18 18',
    ],
    info: 'M12 16v-4M12 8h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z',
    warning:
      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4M12 17h.01',
    error:
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M15 9l-6 6M9 9l6 6',
    success: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    camera:
      'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    circle: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
    square: 'M4 4h16v16H4z',
    layers: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5M2 12l10 5 10-5',
    sliders:
      'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    package:
      'M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
    hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
    'rotate-ccw':
      'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
    palette:
      'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.21-.64-1.67-.08-.09-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zM5.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    star: 'M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01z',
    'star-filled': 'M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01z',
    'mouse-pointer': 'M3 2l7 19 2-8 8-2L3 2z',
    sparkle: [
      'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z',
      'M5 18l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
      'M19 18l.5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5L19 18z',
    ],
    'shield-check': [
      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      'M9 12l2 2 4-4',
    ],
    list: [
      'M8 6h13M8 12h13M8 18h13',
      'M3 6h.01M3 12h.01M3 18h.01',
    ],
    'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
    'play-circle': [
      'M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z',
      'M10 8l6 4-6 4V8z',
    ],
    target: [
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
      'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
      'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    ],
  };

  return icons[name] || '';
}

/**
 * Helper to create an icon button element.
 */
export function createIconButton(
  icon: IconName,
  options: {
    title?: string;
    onClick?: () => void;
    className?: string;
    size?: number;
    disabled?: boolean;
  } = {}
): HTMLButtonElement {
  const { title, onClick, className = '', size = 16, disabled = false } = options;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn btn-icon ${className}`.trim();
  button.disabled = disabled;

  if (title) {
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  const iconEl = createIcon(icon, size);
  button.appendChild(iconEl);

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Helper to create a button with icon and text.
 */
export function createButtonWithIcon(
  icon: IconName,
  label: string,
  options: {
    onClick?: () => void;
    className?: string;
    variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost';
    disabled?: boolean;
  } = {}
): HTMLButtonElement {
  const { onClick, className = '', variant = 'default', disabled = false } = options;

  const button = document.createElement('button');
  button.type = 'button';

  const classes = ['btn'];
  if (variant !== 'default') {
    classes.push(`btn-${variant}`);
  }
  if (className) {
    classes.push(className);
  }

  button.className = classes.join(' ');
  button.disabled = disabled;

  const iconEl = createIcon(icon, 16);
  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  button.appendChild(iconEl);
  button.appendChild(labelEl);

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Creates a status indicator with icon and text.
 */
export function createStatusIndicator(
  type: 'success' | 'warning' | 'error' | 'info',
  message: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = `badge badge-${type}`;

  const iconMap: Record<string, IconName> = {
    success: 'check',
    warning: 'warning',
    error: 'error',
    info: 'info',
  };

  const icon = createIcon(iconMap[type] || 'info', 12);
  const text = document.createElement('span');
  text.textContent = message;

  container.appendChild(icon);
  container.appendChild(text);

  return container;
}
