interface ThreadBadgesProps {
  isPinned: boolean;
  isLocked: boolean;
  tags: string[];
  isSolved?: boolean;
  isHot?: boolean;
}

export function ThreadBadges({ isPinned, isLocked, tags, isSolved = false, isHot = false }: ThreadBadgesProps) {
  return (
    <div className="forum-thread-badges">
      {isPinned && (
        <span className="forum-thread-badge forum-thread-badge--pinned">
          📌 Pinned
        </span>
      )}
      {isLocked && (
        <span className="forum-thread-badge forum-thread-badge--locked">
          🔒 Locked
        </span>
      )}
      {isSolved && (
        <span className="forum-thread-badge forum-thread-badge--solved">
          ✓ Solved
        </span>
      )}
      {isHot && (
        <span className="forum-thread-badge forum-thread-badge--hot">
          🔥 Hot
        </span>
      )}
      {tags.length > 0 && (
        <>
          {tags.slice(0, 3).map(tag => (
            <span key={tag} className="forum-thread-badge">
              {tag}
            </span>
          ))}
        </>
      )}
    </div>
  );
}
