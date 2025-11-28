import { Link } from 'react-router-dom';
import type { ForumCategory } from '../../api/forum';

interface ForumCategoryCardProps {
  category: ForumCategory;
  hasRecentActivity?: boolean;
}

export function ForumCategoryCard({ category, hasRecentActivity = false }: ForumCategoryCardProps) {
  const categoryColor = category.color || 'var(--forum-cat-general)';
  
  return (
    <Link
      to={`/community/category/${category.id}`}
      className={`forum-gaming-card ${hasRecentActivity ? 'forum-gaming-card--active' : ''}`}
      style={{ '--category-color': categoryColor } as React.CSSProperties}
      aria-label={`Category: ${category.name}`}
    >
      {/* Glow border effect */}
      <div className="forum-gaming-card__glow" />
      
      {/* Activity indicator */}
      {hasRecentActivity && (
        <div className="forum-gaming-card__activity">
          <span className="forum-gaming-card__activity-dot" />
        </div>
      )}
      
      {/* Card content */}
      <div className="forum-gaming-card__inner">
        {/* Icon with gradient background */}
        <div className="forum-gaming-card__icon-wrapper">
          <span className="forum-gaming-card__icon">
            {category.icon || '💬'}
          </span>
        </div>
        
        {/* Text content */}
        <div className="forum-gaming-card__content">
          <h3 className="forum-gaming-card__title">
            {category.name}
          </h3>
          <p className="forum-gaming-card__description">
            {category.description}
          </p>
        </div>
        
        {/* Stats bar */}
        <div className="forum-gaming-card__stats">
          <div className="forum-gaming-card__stat">
            <span className="forum-gaming-card__stat-icon">📝</span>
            <span className="forum-gaming-card__stat-value">{formatNumber(category.threadCount)}</span>
            <span className="forum-gaming-card__stat-label">threads</span>
          </div>
          <div className="forum-gaming-card__stat">
            <span className="forum-gaming-card__stat-icon">💬</span>
            <span className="forum-gaming-card__stat-value">{formatNumber(category.postCount)}</span>
            <span className="forum-gaming-card__stat-label">posts</span>
          </div>
        </div>
        
        {/* Hover arrow */}
        <div className="forum-gaming-card__arrow">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path 
              d="M7 4L13 10L7 16" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

