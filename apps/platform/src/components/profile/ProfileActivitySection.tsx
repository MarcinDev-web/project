import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import type { UserForumActivity } from '../../api/profiles';

interface ProfileActivitySectionProps {
  activity: UserForumActivity | null;
  loading?: boolean;
  userId: string;
}

/**
 * ProfileActivitySection - wyświetla ostatnią aktywność użytkownika na forum
 * 
 * Pokazuje:
 * - Ostatnie wątki założone przez użytkownika
 * - Ostatnie posty napisane przez użytkownika
 */
export const ProfileActivitySection = memo(function ProfileActivitySection({
  activity,
  loading = false,
  userId,
}: ProfileActivitySectionProps) {
  if (loading) {
    return (
      <Card hoverable={false}>
        <h2 style={{ 
          marginTop: 0,
          marginBottom: 'var(--spacing-4)',
          color: 'var(--text-1)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-semibold)',
        }}>
          Aktywność na forum
        </h2>
        <div>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ 
              marginBottom: 'var(--spacing-4)',
              paddingBottom: 'var(--spacing-4)',
              borderBottom: i < 2 ? '1px solid var(--border-default)' : 'none',
            }}>
              <div style={{ 
                height: '20px', 
                background: 'var(--bg-button)', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--spacing-2)',
                width: '60%',
              }} />
              <div style={{ 
                height: '16px', 
                background: 'var(--bg-button)', 
                borderRadius: 'var(--radius-sm)',
                width: '100%',
              }} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Don't render if activity is null (not loaded yet or error)
  if (!activity) {
    return null;
  }

  if (activity.recentThreads?.length === 0 && activity.recentPosts?.length === 0) {
    return (
      <Card hoverable={false}>
        <h2 style={{ 
          marginTop: 0,
          marginBottom: 'var(--spacing-4)',
          color: 'var(--text-1)',
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--font-semibold)',
        }}>
          Aktywność na forum
        </h2>
        <p style={{ 
          color: 'var(--text-2)',
          textAlign: 'center',
          padding: 'var(--spacing-8)',
          margin: 0,
        }}>
          Brak aktywności na forum
        </p>
      </Card>
    );
  }

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

  return (
    <Card hoverable={false}>
      <h2 style={{ 
        marginTop: 0,
        marginBottom: 'var(--spacing-4)',
        color: 'var(--text-1)',
        fontSize: 'var(--text-xl)',
        fontWeight: 'var(--font-semibold)',
      }}>
        Aktywność na forum
      </h2>

      {activity.recentThreads.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <h3 style={{ 
            marginTop: 0,
            marginBottom: 'var(--spacing-3)',
            color: 'var(--text-1)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
          }}>
            Ostatnie wątki
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {activity.recentThreads.slice(0, 5).map((thread) => (
              <Link
                key={thread.id}
                to={`/forum/threads/${thread.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  padding: 'var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--bg-button-primary)';
                  e.currentTarget.style.background = 'var(--bg-button)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.background = 'transparent';
                }}
                >
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--spacing-2)',
                    marginBottom: 'var(--spacing-2)',
                  }}>
                    <h4 style={{ 
                      margin: 0,
                      color: 'var(--text-1)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                    }}>
                      {thread.title}
                    </h4>
                    <span style={{ 
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(thread.lastPostAt)}
                    </span>
                  </div>
                  <div style={{ 
                    display: 'flex',
                    gap: 'var(--spacing-3)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-2)',
                  }}>
                    {thread.categoryName && (
                      <span>{thread.categoryName}</span>
                    )}
                    <span>{thread.postCount} {thread.postCount === 1 ? 'odpowiedź' : 'odpowiedzi'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {activity.recentPosts.length > 0 && (
        <div>
          <h3 style={{ 
            marginTop: activity.recentThreads.length > 0 ? 'var(--spacing-6)' : 0,
            marginBottom: 'var(--spacing-3)',
            color: 'var(--text-1)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
          }}>
            Ostatnie posty
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {activity.recentPosts.slice(0, 5).map((post) => (
              <Link
                key={post.id}
                to={`/forum/threads/${post.threadId}#post-${post.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  padding: 'var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--bg-button-primary)';
                  e.currentTarget.style.background = 'var(--bg-button)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.background = 'transparent';
                }}
                >
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 'var(--spacing-2)',
                    marginBottom: 'var(--spacing-2)',
                  }}>
                    <h4 style={{ 
                      margin: 0,
                      color: 'var(--text-1)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                    }}>
                      {post.threadTitle}
                    </h4>
                    <span style={{ 
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                  <p style={{ 
                    margin: 0,
                    color: 'var(--text-2)',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.5,
                  }}>
                    {truncateContent(post.content, 150)}
                  </p>
                  {post.score !== undefined && (
                    <div style={{ 
                      marginTop: 'var(--spacing-2)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                    }}>
                      {post.score > 0 ? '+' : ''}{post.score} {post.score === 1 ? 'punkt' : 'punktów'}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 'var(--spacing-4)', textAlign: 'center' }}>
        <Link to={`/community-hub?tab=community&author=${userId}`}>
          <button style={{
            padding: 'var(--spacing-2) var(--spacing-4)',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--bg-button-primary)';
            e.currentTarget.style.background = 'var(--bg-button)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.background = 'transparent';
          }}
          >
            Zobacz wszystkie posty →
          </button>
        </Link>
      </div>
    </Card>
  );
});
