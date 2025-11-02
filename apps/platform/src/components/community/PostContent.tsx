import { parseLinks } from '../../utils/linkParser';
import { MarketplaceLinkPreview } from './MarketplaceLinkPreview';
import { ProjectLinkPreview } from './ProjectLinkPreview';

interface PostContentProps {
  content: string;
}

/**
 * Component that renders post content with link previews
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

  return (
    <>
      <div style={{
        color: 'var(--text-1)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
      {marketplaceIds.map((id: string) => (
        <MarketplaceLinkPreview key={`marketplace-${id}`} itemId={id} />
      ))}
      {projectTokens.map((token: string) => (
        <ProjectLinkPreview key={`project-${token}`} projectToken={token} />
      ))}
    </>
  );
}
