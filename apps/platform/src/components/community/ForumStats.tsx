import { Card } from '../shared/Card';

export interface ForumStatsProps {
  totalThreads: number;
  totalPosts: number;
  activeUsers: number;
  onlineNow: number;
}

/**
 * Forum Stats Widget
 * 
 * Displays forum statistics in a sidebar widget
 */
export function ForumStats({ totalThreads, totalPosts, activeUsers, onlineNow }: ForumStatsProps) {
  return (
    <Card>
      <h3 style={{ margin: '0 0 var(--spacing-3) 0', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
        📊 Statistics
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Total Threads</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-1)' }}>
            {totalThreads.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Total Posts</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-1)' }}>
            {totalPosts.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Active Users</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--text-1)' }}>
            {activeUsers.toLocaleString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--color-success)' }}>🟢</span> Online Now
          </span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-success)' }}>
            {onlineNow.toLocaleString()}
          </span>
        </div>
      </div>
    </Card>
  );
}

