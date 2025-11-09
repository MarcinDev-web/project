import { parseLinks } from '../../utils/linkParser';
import { MarketplaceLinkPreview } from './MarketplaceLinkPreview';
import { ProjectLinkPreview } from './ProjectLinkPreview';

interface PostContentProps {
  content: string;
}

/**
 * Simple markdown renderer
 */
function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Line breaks
    .replace(/\n/gim, '<br />');
}

/**
 * Component that renders post content with markdown and link previews
 */
export function PostContent({ content }: PostContentProps) {
  const links = parseLinks(content);
  
  // Extract unique IDs
  const marketplaceIds = Array.from(new Set(
    links.filter(l => l.type === 'marketplace').map(l => l.id)
  ));
  const projectTokens = Array.from(new Set(
    links.filter(l => l.type === 'project').map(l => l.id)
  ));

  const htmlContent = renderMarkdown(content);

  return (
    <>
      <div
        style={{
          color: 'var(--text-1)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: 'var(--forum-body)',
          lineHeight: 'var(--forum-line-relaxed)',
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {marketplaceIds.map((id: string) => (
        <MarketplaceLinkPreview key={`marketplace-${id}`} itemId={id} />
      ))}
      {projectTokens.map((token: string) => (
        <ProjectLinkPreview key={`project-${token}`} projectToken={token} />
      ))}
    </>
  );
}
