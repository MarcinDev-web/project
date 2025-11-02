import { useState } from 'react';
import { Button } from '../shared/Button';
import { forumApi } from '../../api/forum';

interface ForumPostEditorProps {
  threadId: string;
  initialContent?: string;
  onPostCreated: () => void;
  onCancel?: () => void;
}

export function ForumPostEditor({ threadId, initialContent = '', onPostCreated, onCancel }: ForumPostEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    try {
      if (initialContent) {
        // Update existing post
        await forumApi.updatePost(threadId, content);
      } else {
        // Create new post
        await forumApi.createPost(threadId, content);
      }
      setContent('');
      onPostCreated();
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your reply... (Markdown supported)"
        style={{
          width: '100%',
          minHeight: '150px',
          padding: 'var(--spacing-3)',
          background: 'var(--bg-button)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-1)',
          fontFamily: 'inherit',
          fontSize: 'var(--text-sm)',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!content.trim() || isSubmitting}>
          {isSubmitting ? 'Posting...' : initialContent ? 'Update' : 'Post'}
        </Button>
      </div>
    </div>
  );
}
