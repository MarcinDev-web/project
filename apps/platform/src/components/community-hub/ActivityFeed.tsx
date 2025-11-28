import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface ActivityItem {
  id: string;
  type: 'thread' | 'post' | 'reaction' | 'vote';
  title: string;
  author: string;
  authorAvatar?: string;
  targetUrl: string;
  timestamp: number;
  categoryName?: string;
  categoryColor?: string;
}

interface ActivityFeedProps {
  maxItems?: number;
}

export function ActivityFeed({ maxItems = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLive, setIsLive] = useState(false);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    let newActivity: ActivityItem | null = null;

    switch (message.type) {
      case 'forum:thread:new': {
        const { thread } = message as any;
        newActivity = {
          id: `thread-${thread.id}-${Date.now()}`,
          type: 'thread',
          title: thread.title,
          author: thread.authorName || 'Unknown',
          authorAvatar: thread.authorAvatar,
          targetUrl: `/community/thread/${thread.id}`,
          timestamp: Date.now(),
          categoryName: thread.categoryName,
          categoryColor: thread.categoryColor,
        };
        break;
      }
      case 'forum:post:new': {
        const { post, threadId } = message as any;
        newActivity = {
          id: `post-${post.id}-${Date.now()}`,
          type: 'post',
          title: post.threadTitle || 'New Reply',
          author: post.authorName || 'Unknown',
          authorAvatar: post.authorAvatar,
          targetUrl: `/community/thread/${threadId}`,
          timestamp: Date.now(),
        };
        break;
      }
      case 'forum:reaction:new': {
        const { threadId, postId, reaction } = message as any;
        newActivity = {
          id: `reaction-${threadId || postId}-${Date.now()}`,
          type: 'reaction',
          title: `${reaction?.emoji || '👍'} reaction`,
          author: reaction?.userName || 'Someone',
          targetUrl: threadId ? `/community/thread/${threadId}` : '#',
          timestamp: Date.now(),
        };
        break;
      }
    }

    if (newActivity) {
      setActivities(prev => [newActivity!, ...prev].slice(0, maxItems));
      setIsLive(true);
    }
  }, [maxItems]);

  const { connected } = useWebSocket(handleMessage, true);

  useEffect(() => {
    setIsLive(connected);
  }, [connected]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'thread': return '📝';
      case 'post': return '💬';
      case 'reaction': return '⭐';
      case 'vote': return '🔥';
      default: return '📌';
    }
  };

  const getActivityLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'thread': return 'created a thread';
      case 'post': return 'replied to';
      case 'reaction': return 'reacted to';
      case 'vote': return 'voted on';
      default: return 'activity in';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="forum-gaming-panel forum-activity-feed">
      <div className="forum-gaming-panel__header">
        <span className="forum-gaming-panel__icon">⚡</span>
        <h3 className="forum-gaming-panel__title">Live Activity</h3>
        <div className={`forum-activity-feed__status ${isLive ? 'forum-activity-feed__status--live' : ''}`}>
          <span className="forum-activity-feed__status-dot" />
          <span className="forum-activity-feed__status-text">{isLive ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
      
      <div className="forum-gaming-panel__content forum-activity-feed__list">
        {activities.length === 0 ? (
          <div className="forum-activity-feed__empty">
            <span className="forum-activity-feed__empty-icon">📡</span>
            <p>Waiting for activity...</p>
          </div>
        ) : (
          activities.map((activity, index) => (
            <Link
              key={activity.id}
              to={activity.targetUrl}
              className="forum-activity-feed__item"
              style={{ '--item-delay': `${index * 0.05}s` } as React.CSSProperties}
            >
              <div className="forum-activity-feed__item-icon">
                {getActivityIcon(activity.type)}
              </div>
              <div className="forum-activity-feed__item-content">
                <div className="forum-activity-feed__item-header">
                  <span className="forum-activity-feed__item-author">{activity.author}</span>
                  <span className="forum-activity-feed__item-action">{getActivityLabel(activity.type)}</span>
                </div>
                <p className="forum-activity-feed__item-title">{activity.title}</p>
                <span className="forum-activity-feed__item-time">{formatTimeAgo(activity.timestamp)}</span>
              </div>
              {activity.type === 'thread' && (
                <span className="forum-activity-feed__item-badge forum-activity-feed__item-badge--new">NEW</span>
              )}
            </Link>
          ))
        )}
      </div>
      
      {activities.length > 0 && (
        <div className="forum-gaming-panel__footer">
          <Link to="/community" className="forum-gaming-panel__link">
            View All Activity →
          </Link>
        </div>
      )}
    </div>
  );
}

