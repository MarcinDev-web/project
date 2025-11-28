import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { UserForumActivity } from '../../api/profiles';

interface ProfileActivityFeedProps {
  activity: UserForumActivity | null;
  loading?: boolean;
  userId: string;
}

/**
 * ProfileActivityFeed - Forum activity feed with modern styling
 */
export const ProfileActivityFeed = memo(function ProfileActivityFeed({
  activity,
  loading = false,
  userId,
}: ProfileActivityFeedProps) {
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'przed chwilą';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays < 7) return `${diffDays} dni temu`;
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  const truncateContent = (content: string, maxLength: number): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  if (loading) {
    return (
      <div className="profile-section">
        <div className="profile-section__header">
          <h3 className="profile-section__title">
            <span className="profile-section__title-icon">💬</span>
            Aktywność na forum
          </h3>
        </div>
        <div className="profile-section__content">
          <div className="profile-activity-feed">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="profile-skeleton" style={{ height: '80px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Don't render if activity is null
  if (!activity) {
    return null;
  }

  const hasActivity = (activity.recentThreads?.length ?? 0) > 0 || (activity.recentPosts?.length ?? 0) > 0;

  return (
    <div className="profile-section">
      <div className="profile-section__header">
        <h3 className="profile-section__title">
          <span className="profile-section__title-icon">💬</span>
          Aktywność na forum
        </h3>
        {hasActivity && (
          <Link to={`/community-hub?tab=community&author=${userId}`} className="profile-link-btn">
            Zobacz wszystko →
          </Link>
        )}
      </div>
      
      <div className="profile-section__content">
        {!hasActivity ? (
          <div className="profile-empty-state" style={{ padding: 'var(--spacing-8)' }}>
            <div className="profile-empty-state__illustration">
              <div className="profile-empty-state__icon">🗣️</div>
            </div>
            <h3 className="profile-empty-state__title">Brak aktywności na forum</h3>
            <p className="profile-empty-state__description">
              Ten użytkownik nie opublikował jeszcze żadnych postów ani wątków
            </p>
            <Link to="/community-hub" className="profile-link-btn profile-link-btn--primary profile-empty-state__action">
              Przeglądaj forum →
            </Link>
          </div>
        ) : (
          <div className="profile-activity-feed">
            {/* Recent Threads */}
            {activity.recentThreads.slice(0, 3).map((thread) => (
              <Link
                key={`thread-${thread.id}`}
                to={`/forum/threads/${thread.id}`}
                className="profile-activity-item profile-activity-item--thread"
              >
                <div className="profile-activity-item__icon">📌</div>
                <div className="profile-activity-item__content">
                  <h4 className="profile-activity-item__title">{thread.title}</h4>
                  <p className="profile-activity-item__subtitle">
                    {thread.categoryName && <span>{thread.categoryName} · </span>}
                    {thread.postCount} {thread.postCount === 1 ? 'odpowiedź' : 'odpowiedzi'}
                  </p>
                </div>
                <span className="profile-activity-item__time">{formatDate(thread.lastPostAt)}</span>
              </Link>
            ))}
            
            {/* Recent Posts */}
            {activity.recentPosts.slice(0, 3).map((post) => (
              <Link
                key={`post-${post.id}`}
                to={`/forum/threads/${post.threadId}#post-${post.id}`}
                className="profile-activity-item profile-activity-item--post"
              >
                <div className="profile-activity-item__icon">💬</div>
                <div className="profile-activity-item__content">
                  <h4 className="profile-activity-item__title">{post.threadTitle}</h4>
                  <p className="profile-activity-item__subtitle">
                    {truncateContent(post.content, 100)}
                  </p>
                </div>
                <span className="profile-activity-item__time">{formatDate(post.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

