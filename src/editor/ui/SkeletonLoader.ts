/**
 * Skeleton Loader
 * Loading placeholders to prevent layout shift
 * 
 * Features:
 * - Various shapes and sizes
 * - Animated shimmer effect
 * - Customizable dimensions
 * - Prevents content layout shift
 */

export type SkeletonShape = 'text' | 'rectangle' | 'circle' | 'card' | 'input';

export interface SkeletonOptions {
  shape?: SkeletonShape;
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

/**
 * Create a skeleton loader element
 */
export function createSkeleton(options: SkeletonOptions = {}): HTMLElement {
  const {
    shape = 'text',
    width,
    height,
    count = 1,
    className = '',
  } = options;

  const container = document.createElement('div');
  container.className = `skeleton-container ${className}`.trim();

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${shape}`;

    // Apply custom dimensions
    if (width) {
      skeleton.style.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height) {
      skeleton.style.height = typeof height === 'number' ? `${height}px` : height;
    }

    container.appendChild(skeleton);
  }

  return container;
}

/**
 * Create a skeleton for text lines
 */
export function createTextSkeleton(lines = 3, lastLineWidth = '80%'): HTMLElement {
  const container = document.createElement('div');
  container.className = 'skeleton-text-block';

  for (let i = 0; i < lines; i++) {
    const line = document.createElement('div');
    line.className = 'skeleton skeleton-text';
    
    if (i === lines - 1) {
      line.style.width = lastLineWidth;
    }

    container.appendChild(line);
  }

  return container;
}

/**
 * Create a skeleton for a property row in the inspector
 */
export function createPropertyRowSkeleton(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'skeleton-property-row';

  // Label skeleton
  const label = document.createElement('div');
  label.className = 'skeleton skeleton-text';
  label.style.width = '80px';
  label.style.height = '14px';

  // Input skeleton
  const input = document.createElement('div');
  input.className = 'skeleton skeleton-input';

  row.appendChild(label);
  row.appendChild(input);

  return row;
}

/**
 * Create a skeleton for a vector input (3 inputs)
 */
export function createVectorInputSkeleton(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'skeleton-vector-input';

  // Label
  const label = document.createElement('div');
  label.className = 'skeleton skeleton-text';
  label.style.width = '80px';
  label.style.height = '14px';
  label.style.marginBottom = '8px';

  container.appendChild(label);

  // Three input skeletons
  const inputs = document.createElement('div');
  inputs.className = 'skeleton-vector-inputs';
  inputs.style.display = 'grid';
  inputs.style.gridTemplateColumns = 'repeat(3, 1fr)';
  inputs.style.gap = '10px';

  for (let i = 0; i < 3; i++) {
    const input = document.createElement('div');
    input.className = 'skeleton skeleton-input';
    inputs.appendChild(input);
  }

  container.appendChild(inputs);

  return container;
}

/**
 * Create a skeleton for the entity card
 */
export function createEntityCardSkeleton(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'skeleton-entity-card';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '12px';
  header.style.marginBottom = '12px';

  // Icon
  const icon = document.createElement('div');
  icon.className = 'skeleton skeleton-circle';
  icon.style.width = '48px';
  icon.style.height = '48px';

  // Name
  const name = document.createElement('div');
  name.className = 'skeleton skeleton-rectangle';
  name.style.flex = '1';
  name.style.height = '24px';

  header.appendChild(icon);
  header.appendChild(name);
  card.appendChild(header);

  // Badges
  const badges = document.createElement('div');
  badges.style.display = 'flex';
  badges.style.gap = '8px';

  for (let i = 0; i < 2; i++) {
    const badge = document.createElement('div');
    badge.className = 'skeleton skeleton-rectangle';
    badge.style.width = '80px';
    badge.style.height = '24px';
    badge.style.borderRadius = '12px';
    badges.appendChild(badge);
  }

  card.appendChild(badges);

  return card;
}

/**
 * Create a skeleton for a property section
 */
export function createPropertySectionSkeleton(rows = 3): HTMLElement {
  const section = document.createElement('div');
  section.className = 'skeleton-property-section';

  // Section header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '12px';
  header.style.marginBottom = '16px';

  const icon = document.createElement('div');
  icon.className = 'skeleton skeleton-circle';
  icon.style.width = '20px';
  icon.style.height = '20px';

  const title = document.createElement('div');
  title.className = 'skeleton skeleton-rectangle';
  title.style.width = '120px';
  title.style.height = '18px';

  header.appendChild(icon);
  header.appendChild(title);
  section.appendChild(header);

  // Property rows
  for (let i = 0; i < rows; i++) {
    section.appendChild(createPropertyRowSkeleton());
  }

  return section;
}

/**
 * Replace an element with a skeleton while loading
 */
export function showSkeletonWhileLoading(
  element: HTMLElement,
  skeletonFactory: () => HTMLElement,
  loadingPromise: Promise<void>
): void {
  const parent = element.parentElement;
  if (!parent) return;

  const skeleton = skeletonFactory();
  parent.replaceChild(skeleton, element);

  loadingPromise.finally(() => {
    if (skeleton.parentElement === parent) {
      parent.replaceChild(element, skeleton);
    }
  });
}

