interface ThreadBadgesProps {
  isPinned: boolean;
  isLocked: boolean;
  tags: string[];
}

export function ThreadBadges({ isPinned, isLocked, tags }: ThreadBadgesProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
      {isPinned && (
        <span style={{
          fontSize: 'var(--text-xs)',
          background: 'var(--bg-button-primary)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 'var(--font-medium)',
        }}>
          PINNED
        </span>
      )}
      {isLocked && (
        <span style={{
          fontSize: 'var(--text-xs)',
          background: 'var(--bg-button)',
          color: 'var(--text-2)',
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 'var(--font-medium)',
        }}>
          LOCKED
        </span>
      )}
      {tags.length > 0 && (
        <>
          {tags.map(tag => (
            <span
              key={tag}
              style={{
                fontSize: 'var(--text-xs)',
                background: 'var(--bg-button)',
                color: 'var(--text-2)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {tag}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
