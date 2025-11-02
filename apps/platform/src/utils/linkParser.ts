/**
 * Link parser utility for detecting marketplace and project links in forum posts
 */

export interface ParsedLink {
  type: 'marketplace' | 'project';
  id: string;
  original: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detect marketplace and project links in text
 * Patterns:
 * - /marketplace/:id
 * - marketplace/:id
 * - /projects/:token
 * - projects/:token
 * - Full URLs containing marketplace or projects
 */
export function parseLinks(text: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  // Marketplace patterns
  const marketplacePatterns = [
    /\/marketplace\/([a-zA-Z0-9_]+)/g,  // /marketplace/item_123
    /marketplace\/([a-zA-Z0-9_]+)/g,    // marketplace/item_123 (without leading slash)
    /\/marketplace\/(item_[a-zA-Z0-9_]+)/g, // Explicit item_ prefix
  ];

  // Project patterns
  const projectPatterns = [
    /\/projects\/([a-zA-Z0-9_-]+)/g,    // /projects/token123
    /projects\/([a-zA-Z0-9_-]+)/g,      // projects/token123 (without leading slash)
  ];

  // Marketplace links
  for (const pattern of marketplacePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = match[1]!;
      const original = match[0]!;
      const startIndex = match.index;
      const endIndex = startIndex + original.length;

      // Avoid duplicates
      if (!links.some(l => l.startIndex === startIndex && l.endIndex === endIndex)) {
        links.push({
          type: 'marketplace',
          id,
          original,
          startIndex,
          endIndex,
        });
      }
    }
  }

  // Project links
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const token = match[1]!;
      const original = match[0]!;
      const startIndex = match.index;
      const endIndex = startIndex + original.length;

      // Avoid duplicates
      if (!links.some(l => l.startIndex === startIndex && l.endIndex === endIndex)) {
        links.push({
          type: 'project',
          id: token,
          original,
          startIndex,
          endIndex,
        });
      }
    }
  }

  // Sort by position in text
  return links.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Extract unique IDs from parsed links
 */
export function extractLinkIds(links: ParsedLink[]): { marketplaceIds: string[]; projectTokens: string[] } {
  const marketplaceIds = Array.from(new Set(
    links.filter(l => l.type === 'marketplace').map(l => l.id)
  ));
  const projectTokens = Array.from(new Set(
    links.filter(l => l.type === 'project').map(l => l.id)
  ));
  return { marketplaceIds, projectTokens };
}
