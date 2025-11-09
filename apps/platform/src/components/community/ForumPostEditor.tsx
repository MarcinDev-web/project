import { useState } from 'react';
import { Button } from '../shared/Button';
import { RichTextEditor } from './RichTextEditor';
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
    <RichTextEditor
      value={content}
      onChange={setContent}
      placeholder="Write your reply... (Markdown supported)"
      minHeight={150}
      autoSaveKey={threadId}
      onSave={handleSubmit}
      onCancel={onCancel}
    />
  );
}
