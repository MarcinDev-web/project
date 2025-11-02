/**
 * Thumbnail Generator - Creates SVG thumbnails for marketplace games
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface ThumbnailOptions {
  title: string;
  tags: string[];
  width?: number;
  height?: number;
  backgroundColor?: string;
  accentColor?: string;
}

const DEFAULT_COLORS = [
  ['#6366f1', '#4f46e5'], // Indigo
  ['#8b5cf6', '#7c3aed'], // Purple
  ['#ec4899', '#db2777'], // Pink
  ['#f59e0b', '#d97706'], // Amber
  ['#10b981', '#059669'], // Emerald
  ['#06b6d4', '#0891b2'], // Cyan
  ['#f97316', '#ea580c'], // Orange
  ['#3b82f6', '#2563eb'], // Blue
];

/**
 * Generate an SVG thumbnail for a game
 */
export function generateThumbnailSVG(options: ThumbnailOptions): string {
  const {
    title,
    tags,
    width = 320,
    height = 180,
    backgroundColor,
    accentColor,
  } = options;

  // Select colors based on title hash for consistency
  const titleHash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorPair = DEFAULT_COLORS[titleHash % DEFAULT_COLORS.length]!;
  const bgColor = backgroundColor || colorPair[0]!;
  const accent = accentColor || colorPair[1]!;

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

  // Get first 2-3 tags for display
  const displayTags = tags.slice(0, 3);

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
  
  <!-- Decorative circles -->
  <circle cx="${width - 40}" cy="40" r="30" fill="rgba(255,255,255,0.1)"/>
  <circle cx="40" cy="${height - 40}" r="25" fill="rgba(255,255,255,0.1)"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="${height / 2 - (displayLines.length > 1 ? 15 : 0)}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="24" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        filter="url(#shadow)">
    ${displayLines[0] || title}
  </text>
  ${displayLines.length > 1 ? `
  <text x="${width / 2}" y="${height / 2 + 20}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="24" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        filter="url(#shadow)">
    ${displayLines[1]}
  </text>` : ''}
  
  <!-- Tags at bottom -->
  ${displayTags.length > 0 ? `
  <g transform="translate(${width / 2 - (displayTags.length * 50)}, ${height - 40})">
    ${displayTags.map((tag, i) => `
    <rect x="${i * 60}" y="0" width="50" height="20" rx="10" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <text x="${i * 60 + 25}" y="14" font-family="system-ui" font-size="10" fill="white" text-anchor="middle">${tag.substring(0, 6)}</text>
    `).join('')}
  </g>` : ''}
  
  <!-- Platform badge -->
  <rect x="10" y="10" width="60" height="24" rx="12" fill="rgba(0,0,0,0.3)"/>
  <text x="40" y="26" font-family="system-ui" font-size="11" font-weight="600" fill="white" text-anchor="middle">GAME</text>
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
  tags: string[]
): Promise<string> {
  const svg = generateThumbnailSVG({ title, tags });
  const filename = await saveThumbnail(thumbnailDir, itemId, svg);
  return filename;
}
