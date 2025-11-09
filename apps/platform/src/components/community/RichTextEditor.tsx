import { useState, useRef, useEffect } from 'react';
import { Button } from '../shared/Button';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  showPreview?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  autoSaveKey?: string; // localStorage key for auto-save
}

/**
 * Rich Text Editor Component
 * 
 * Markdown-enabled editor with toolbar and preview toggle
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write your post... (Markdown supported)',
  minHeight = 150,
  showPreview: initialShowPreview = false,
  onSave,
  onCancel,
  autoSaveKey,
}: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(initialShowPreview);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save draft
  useEffect(() => {
    if (autoSaveKey && value) {
      localStorage.setItem(`forum-draft-${autoSaveKey}`, value);
    }
  }, [value, autoSaveKey]);

  // Load draft on mount
  useEffect(() => {
    if (autoSaveKey && !value) {
      const draft = localStorage.getItem(`forum-draft-${autoSaveKey}`);
      if (draft) {
        onChange(draft);
      }
    }
  }, [autoSaveKey, value, onChange]);

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const formatBold = () => insertText('**', '**');
  const formatItalic = () => insertText('*', '*');
  const formatCode = () => insertText('`', '`');
  const formatCodeBlock = () => insertText('```\n', '\n```');
  const formatLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    if (selectedText) {
      insertText('[', `](url)`);
    } else {
      insertText('[link text](url)', '');
    }
  };
  const formatHeading = (level: 1 | 2 | 3) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', start);
    const line = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const hashes = '#'.repeat(level);
    
    if (line.startsWith('#')) {
      // Remove existing heading
      const newLine = line.replace(/^#+\s*/, '');
      const newText = value.substring(0, lineStart) + newLine + value.substring(lineEnd === -1 ? value.length : lineEnd);
      onChange(newText);
    } else {
      // Add heading
      const newText = value.substring(0, lineStart) + hashes + ' ' + line + value.substring(lineEnd === -1 ? value.length : lineEnd);
      onChange(newText);
    }
  };

  const renderPreview = () => {
    // Simple markdown rendering (basic implementation)
    // For production, consider using react-markdown library
    let html = value
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Line breaks
      .replace(/\n/gim, '<br />');

    return { __html: html };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-1)',
          padding: 'var(--spacing-2)',
          background: 'var(--forum-bg-input)',
          border: '1px solid var(--forum-border-default)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={formatBold}
          title="Bold"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          B
        </button>
        <button
          type="button"
          onClick={formatItalic}
          title="Italic"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontStyle: 'italic',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => formatHeading(1)}
          title="Heading 1"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => formatHeading(2)}
          title="Heading 2"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          H2
        </button>
        <button
          type="button"
          onClick={formatCode}
          title="Inline Code"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontFamily: 'monospace',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {'</>'}
        </button>
        <button
          type="button"
          onClick={formatCodeBlock}
          title="Code Block"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {'{}'}
        </button>
        <button
          type="button"
          onClick={formatLink}
          title="Link"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--forum-bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          🔗
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          title="Toggle Preview"
          style={{
            padding: 'var(--spacing-1) var(--spacing-2)',
            background: showPreview ? 'var(--bg-button-primary)' : 'transparent',
            border: 'none',
            color: showPreview ? 'white' : 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          👁️ Preview
        </button>
      </div>

      {/* Editor/Preview */}
      {showPreview ? (
        <div
          style={{
            minHeight: `${minHeight}px`,
            padding: 'var(--spacing-3)',
            background: 'var(--forum-bg-input)',
            border: '1px solid var(--forum-border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-1)',
            fontSize: 'var(--forum-body)',
            lineHeight: 'var(--forum-line-relaxed)',
          }}
          dangerouslySetInnerHTML={renderPreview()}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            minHeight: `${minHeight}px`,
            padding: 'var(--spacing-3)',
            background: 'var(--forum-bg-input)',
            border: '1px solid var(--forum-border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-1)',
            fontFamily: 'inherit',
            fontSize: 'var(--forum-body)',
            lineHeight: 'var(--forum-line-relaxed)',
            resize: 'vertical',
          }}
        />
      )}

      {/* Actions */}
      {(onSave || onCancel) && (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {onSave && (
            <Button onClick={onSave} disabled={!value.trim()}>
              Save
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

