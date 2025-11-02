import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Reaction } from '../../api/forum';

interface ForumReactionsProps {
  reactions: Reaction[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  disabled?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😄', '🎉', '🔥', '💡', '👏', '🙌'];

export function ForumReactions({ reactions, onAddReaction, onRemoveReaction, disabled }: ForumReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { user } = useAuth();

  // Group reactions by emoji
  const reactionsByEmoji = new Map<string, Reaction[]>();
  for (const reaction of reactions) {
    const existing = reactionsByEmoji.get(reaction.emoji) || [];
    existing.push(reaction);
    reactionsByEmoji.set(reaction.emoji, existing);
  }

  // Check if user has reacted with specific emoji
  const hasUserReacted = (emoji: string): boolean => {
    if (!user) return false;
    return reactionsByEmoji.get(emoji)?.some(r => r.userId === user.id) || false;
  };

  const handleEmojiClick = (emoji: string) => {
    if (disabled || !user) return;
    
    if (hasUserReacted(emoji)) {
      onRemoveReaction(emoji);
    } else {
      onAddReaction(emoji);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
      {/* Display existing reactions */}
      {Array.from(reactionsByEmoji.entries()).map(([emoji, emojiReactions]) => {
        const userReacted = hasUserReacted(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            disabled={disabled || !user}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-1)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              background: userReacted ? 'var(--bg-button-primary)' : 'var(--bg-button)',
              border: userReacted ? '1px solid var(--bg-button-primary)' : '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: disabled || !user ? 'default' : 'pointer',
              fontSize: 'var(--text-sm)',
              color: userReacted ? 'white' : 'var(--text-1)',
              transition: 'all var(--transition-base)',
            }}
          >
            <span>{emoji}</span>
            <span style={{ fontSize: 'var(--text-xs)' }}>{emojiReactions.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      {user && !disabled && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            style={{
              padding: 'var(--spacing-1) var(--spacing-2)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-2)',
            }}
          >
            + Add
          </button>

          {showPicker && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998,
                }}
                onClick={() => setShowPicker(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 'var(--spacing-2)',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-2)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 'var(--spacing-2)',
                  zIndex: 999,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleEmojiClick(emoji);
                      setShowPicker(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.5em',
                      padding: 'var(--spacing-1)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background var(--transition-base)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-button)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
