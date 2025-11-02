import { useState } from 'react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import type { ForumCategory } from '../../api/forum';

interface ForumCategoryEditorProps {
  category?: ForumCategory;
  onSave: (category: Partial<ForumCategory>) => Promise<void>;
  onCancel: () => void;
}

export function ForumCategoryEditor({ category, onSave, onCancel }: ForumCategoryEditorProps) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [icon, setIcon] = useState(category?.icon || '');
  const [color, setColor] = useState(category?.color || '#3b82f6');
  const [order, setOrder] = useState(category?.order ?? 0);
  const [isLocked, setIsLocked] = useState(category?.isLocked || false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedIcon = icon.trim();
      await onSave({
        name: name.trim(),
        description: description.trim(),
        ...(trimmedIcon ? { icon: trimmedIcon } : {}),
        color: color.trim(),
        order,
        isLocked,
      });
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          {category ? 'Edit Category' : 'Create Category'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Icon (emoji)
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="💬"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Color
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Order
            </label>
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="isLocked"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="isLocked" style={{ fontWeight: '500' }}>
              Locked (users cannot create threads)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

