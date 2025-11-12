/**
 * Thumbnail Generator - Creates enhanced SVG thumbnails for marketplace items
 * with category-based icons, expanded color schemes, and better visual variety
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface ThumbnailOptions {
  title: string;
  tags: string[];
  type?: 'build' | 'avatar';
  width?: number;
  height?: number;
  backgroundColor?: string;
  accentColor?: string;
}

// Expanded color schemes for better visual variety (20 schemes)
const DEFAULT_COLORS = [
  // Original (8)
  ['#6366f1', '#4f46e5'], // Indigo
  ['#8b5cf6', '#7c3aed'], // Purple
  ['#ec4899', '#db2777'], // Pink
  ['#f59e0b', '#d97706'], // Amber
  ['#10b981', '#059669'], // Emerald
  ['#06b6d4', '#0891b2'], // Cyan
  ['#f97316', '#ea580c'], // Orange
  ['#3b82f6', '#2563eb'], // Blue
  // New (12)
  ['#14b8a6', '#0d9488'], // Teal
  ['#84cc16', '#65a30d'], // Lime
  ['#ef4444', '#dc2626'], // Red
  ['#f472b6', '#ec4899'], // Pink bright
  ['#a78bfa', '#8b5cf6'], // Violet
  ['#fbbf24', '#f59e0b'], // Yellow
  ['#fb7185', '#f43f5e'], // Rose
  ['#34d399', '#10b981'], // Emerald bright
  ['#60a5fa', '#3b82f6'], // Sky
  ['#fb923c', '#f97316'], // Orange bright
  ['#c084fc', '#a855f7'], // Purple bright
  ['#4ade80', '#22c55e'], // Green
];

// Tag to category mapping
const TAG_TO_CATEGORY: Record<string, string> = {
  'house': 'building',
  'building': 'building',
  'castle': 'building',
  'city': 'building',
  'tower': 'building',
  'structure': 'building',
  'character': 'character',
  'npc': 'character',
  'player': 'character',
  'avatar': 'character',
  'person': 'character',
  'human': 'character',
  'car': 'vehicle',
  'plane': 'vehicle',
  'ship': 'vehicle',
  'vehicle': 'vehicle',
  'boat': 'vehicle',
  'truck': 'vehicle',
  'landscape': 'scene',
  'environment': 'scene',
  'world': 'scene',
  'terrain': 'scene',
  'nature': 'scene',
  'forest': 'scene',
  'weapon': 'item',
  'tool': 'item',
  'item': 'item',
  'object': 'item',
  'furniture': 'item',
  'prop': 'item',
};

// Category-specific color gradients
const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  'building': ['#64748b', '#334155'], // Slate gray
  'character': ['#ec4899', '#be185d'], // Pink/magenta
  'vehicle': ['#0ea5e9', '#0369a1'], // Sky blue
  'scene': ['#10b981', '#047857'], // Emerald green
  'item': ['#f59e0b', '#b45309'], // Amber/orange
  'default': ['#6366f1', '#4f46e5'], // Indigo
};

// Category icons as SVG paths
const CATEGORY_ICONS: Record<string, string> = {
  'building': `
    <!-- Building/House icon -->
    <path d="M-20,-25 L0,-40 L20,-25 L20,25 L-20,25 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <rect x="-10" y="-5" width="8" height="12" fill="rgba(255,255,255,0.2)"/>
    <rect x="2" y="-5" width="8" height="12" fill="rgba(255,255,255,0.2)"/>
    <rect x="-6" y="10" width="12" height="15" fill="rgba(255,255,255,0.25)"/>
  `,
  'character': `
    <!-- Character/Person icon -->
    <circle cx="0" cy="-15" r="8" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <path d="M-12,0 Q-12,-8 0,-8 Q12,-8 12,0 L12,20 L8,25 L8,15 L-8,15 L-8,25 L-12,20 Z" 
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  `,
  'vehicle': `
    <!-- Vehicle/Car icon -->
    <path d="M-25,-10 L-20,-18 L20,-18 L25,-10 L25,5 L20,10 L15,10 L15,5 L-15,5 L-15,10 L-20,10 L-25,5 Z" 
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <circle cx="-12" cy="8" r="5" fill="rgba(255,255,255,0.25)"/>
    <circle cx="12" cy="8" r="5" fill="rgba(255,255,255,0.25)"/>
    <rect x="-15" y="-15" width="12" height="8" fill="rgba(100,180,255,0.3)"/>
    <rect x="3" y="-15" width="12" height="8" fill="rgba(100,180,255,0.3)"/>
  `,
  'scene': `
    <!-- Scene/Landscape icon -->
    <path d="M-30,0 L-20,-15 L-10,-5 L0,-20 L10,-10 L20,-18 L30,0 L30,25 L-30,25 Z" 
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <circle cx="-15" cy="-25" r="6" fill="rgba(255,255,150,0.4)"/>
    <path d="M-35,10 L-30,5 L-25,8 L-20,5 L-15,10 Z" fill="rgba(100,200,100,0.3)"/>
  `,
  'item': `
    <!-- Item/Object icon -->
    <rect x="-15" y="-20" width="30" height="35" rx="3" 
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <circle cx="0" cy="-5" r="8" fill="rgba(255,255,255,0.25)"/>
    <rect x="-10" y="5" width="20" height="3" fill="rgba(255,255,255,0.2)"/>
    <rect x="-8" y="12" width="16" height="2" fill="rgba(255,255,255,0.2)"/>
  `,
  'default': `
    <!-- Default/Game icon -->
    <rect x="-18" y="-18" width="36" height="36" rx="4" 
          fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <circle cx="-8" cy="-8" r="3" fill="rgba(255,255,255,0.3)"/>
    <circle cx="8" cy="-8" r="3" fill="rgba(255,255,255,0.3)"/>
    <circle cx="-8" cy="8" r="3" fill="rgba(255,255,255,0.3)"/>
    <circle cx="8" cy="8" r="3" fill="rgba(255,255,255,0.3)"/>
  `,
};

/**
 * Detect category from tags
 */
function detectCategory(tags: string[]): string {
  // Check tags against category mapping
  for (const tag of tags) {
    const category = TAG_TO_CATEGORY[tag.toLowerCase()];
    if (category) {
      return category;
    }
  }
  return 'default';
}

/**
 * Generate an SVG thumbnail for a marketplace item
 */
export function generateThumbnailSVG(options: ThumbnailOptions): string {
  const { title, tags, type, width = 320, height = 180, backgroundColor, accentColor } = options;

  // Detect category from tags or type
  const category = type === 'avatar' ? 'character' : detectCategory(tags);
  
  // Calculate title hash for consistent gradient IDs (always needed)
  const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Use category-based gradient if available, otherwise use hash-based color
  let bgColor: string;
  let accent: string;
  
  if (backgroundColor && accentColor) {
    bgColor = backgroundColor;
    accent = accentColor;
  } else if (category !== 'default' && CATEGORY_GRADIENTS[category]) {
    const gradientPair = CATEGORY_GRADIENTS[category]!;
    bgColor = gradientPair[0];
    accent = gradientPair[1];
  } else {
    // Fallback to hash-based color selection for variety
    const colorPair = DEFAULT_COLORS[titleHash % DEFAULT_COLORS.length]!;
    bgColor = colorPair[0]!;
    accent = colorPair[1]!;
  }
  
  // Get category icon
  const categoryIcon = CATEGORY_ICONS[category] || CATEGORY_ICONS['default']!;

  // Split title into lines if too long
  const maxCharsPerLine = 20;
  const words = title.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Truncate if too many lines
  const displayLines = lines.slice(0, 2);

  // Create gradient ID unique for this thumbnail
  const gradientId = `grad_${titleHash}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${accent};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="2" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background with gradient -->
  <rect width="${width}" height="${height}" fill="url(#${gradientId})" rx="8"/>
  
  <!-- Decorative pattern overlay -->
  <circle cx="${width - 40}" cy="40" r="35" fill="rgba(255,255,255,0.08)"/>
  <circle cx="40" cy="${height - 40}" r="30" fill="rgba(255,255,255,0.08)"/>
  <circle cx="${width / 2}" cy="30" r="20" fill="rgba(255,255,255,0.05)"/>
  
  <!-- Category icon (large, centered upper area) -->
  <g transform="translate(${width / 2}, 55)">
    ${categoryIcon}
  </g>
  
  <!-- Title overlay at bottom with dark backdrop -->
  <rect y="${height - 60}" width="${width}" height="60" fill="rgba(0,0,0,0.6)"/>
  
  <!-- Title text -->
  <text x="${width / 2}" y="${height - 35 - (displayLines.length > 1 ? 8 : 0)}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="20" 
        font-weight="700" 
        fill="white" 
        text-anchor="middle">
    ${displayLines[0] || title}
  </text>
  ${
    displayLines.length > 1
      ? `
  <text x="${width / 2}" y="${height - 18}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="20" 
        font-weight="700" 
        fill="white" 
        text-anchor="middle">
    ${displayLines[1]}
  </text>`
      : ''
  }
  
</svg>`;
}

/**
 * Save thumbnail to disk
 */
export async function saveThumbnail(
  thumbnailDir: string,
  itemId: string,
  svg: string
): Promise<string> {
  await fs.mkdir(thumbnailDir, { recursive: true });

  const filename = `${itemId}.svg`;
  const filepath = path.join(thumbnailDir, filename);

  await fs.writeFile(filepath, svg, 'utf-8');

  return filename;
}

/**
 * Generate and save thumbnail for a marketplace item
 */
export async function generateAndSaveThumbnail(
  thumbnailDir: string,
  itemId: string,
  title: string,
  tags: string[],
  type?: 'build' | 'avatar'
): Promise<string> {
  const svg = generateThumbnailSVG({ title, tags, ...(type && { type }) });
  const filename = await saveThumbnail(thumbnailDir, itemId, svg);
  return filename;
}

