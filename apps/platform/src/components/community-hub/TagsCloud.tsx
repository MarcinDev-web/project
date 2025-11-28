import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Tag {
  id: string;
  name: string;
  count: number;
  trending: boolean;
  color?: string;
}

interface TagsCloudProps {
  maxTags?: number;
  onTagClick?: (tag: string) => void;
}

// Mock data - replace with API call
const mockTags: Tag[] = [
  { id: '1', name: 'showcase', count: 1234, trending: true, color: '#ffaa00' },
  { id: '2', name: 'help', count: 892, trending: false, color: '#00ff88' },
  { id: '3', name: 'tutorial', count: 756, trending: true, color: '#00b4ff' },
  { id: '4', name: 'bug-report', count: 432, trending: false, color: '#ff3366' },
  { id: '5', name: 'feature-request', count: 387, trending: false, color: '#b026ff' },
  { id: '6', name: 'game-dev', count: 654, trending: true, color: '#00f0ff' },
  { id: '7', name: 'art', count: 521, trending: false, color: '#ff6b00' },
  { id: '8', name: 'music', count: 298, trending: false, color: '#ffd700' },
  { id: '9', name: 'scripting', count: 445, trending: true, color: '#39ff14' },
  { id: '10', name: 'multiplayer', count: 367, trending: false, color: '#ff00e5' },
  { id: '11', name: 'building', count: 823, trending: true, color: '#00e5ff' },
  { id: '12', name: 'events', count: 234, trending: true, color: '#ef4444' },
];

export function TagsCloud({ maxTags = 12, onTagClick }: TagsCloudProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      // Sort by count and take top tags
      const sorted = [...mockTags].sort((a, b) => b.count - a.count).slice(0, maxTags);
      setTags(sorted);
      setLoading(false);
    }, 200);
  }, [maxTags]);

  const getTagSize = (count: number): 'sm' | 'md' | 'lg' | 'xl' => {
    const maxCount = Math.max(...tags.map(t => t.count));
    const ratio = count / maxCount;
    if (ratio > 0.75) return 'xl';
    if (ratio > 0.5) return 'lg';
    if (ratio > 0.25) return 'md';
    return 'sm';
  };

  const handleTagClick = (tagName: string) => {
    setSelectedTag(selectedTag === tagName ? null : tagName);
    onTagClick?.(tagName);
  };

  return (
    <div className="forum-gaming-panel forum-tags-cloud">
      <div className="forum-gaming-panel__header">
        <span className="forum-gaming-panel__icon">🏷️</span>
        <h3 className="forum-gaming-panel__title">Hot Tags</h3>
      </div>

      <div className="forum-gaming-panel__content">
        {loading ? (
          <div className="forum-tags-cloud__loading">
            {[...Array(8)].map((_, i) => (
              <span key={i} className="forum-tags-cloud__skeleton" />
            ))}
          </div>
        ) : (
          <div className="forum-tags-cloud__tags">
            {tags.map((tag, index) => {
              const size = getTagSize(tag.count);
              const isSelected = selectedTag === tag.name;
              
              return (
                <Link
                  key={tag.id}
                  to={`/community/search?tag=${encodeURIComponent(tag.name)}`}
                  className={`forum-tags-cloud__tag forum-tags-cloud__tag--${size} ${isSelected ? 'forum-tags-cloud__tag--selected' : ''} ${tag.trending ? 'forum-tags-cloud__tag--trending' : ''}`}
                  style={{ 
                    '--tag-color': tag.color || 'var(--forum-neon-cyan)',
                    '--item-index': index,
                  } as React.CSSProperties}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTagClick(tag.name);
                  }}
                >
                  <span className="forum-tags-cloud__tag-hash">#</span>
                  <span className="forum-tags-cloud__tag-name">{tag.name}</span>
                  <span className="forum-tags-cloud__tag-count">{formatCount(tag.count)}</span>
                  {tag.trending && (
                    <span className="forum-tags-cloud__tag-trending">🔥</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="forum-gaming-panel__footer">
        <Link to="/community/tags" className="forum-gaming-panel__link">
          Browse All Tags →
        </Link>
      </div>
    </div>
  );
}

function formatCount(num: number): string {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

