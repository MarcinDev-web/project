import { useState } from 'react';
import { ForumSidebar } from './ForumSidebar';
import type { ForumCategory } from '../../api/forum';

export interface MobileForumNavProps {
  categories: ForumCategory[];
  activeCategoryId?: string;
}

/**
 * Mobile Forum Navigation
 * 
 * Hamburger menu and bottom navigation for mobile devices
 */
export function MobileForumNav({ categories, activeCategoryId }: MobileForumNavProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: 'var(--spacing-4)',
          left: 'var(--spacing-4)',
          zIndex: 1001,
          padding: 'var(--spacing-2)',
          background: 'var(--forum-bg-card)',
          border: '1px solid var(--forum-border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-1)',
          cursor: 'pointer',
          fontSize: 'var(--text-lg)',
        }}
        aria-label="Toggle navigation"
        aria-expanded={sidebarOpen}
      >
        ☰
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          }}
        />
      )}

      {/* Sidebar */}
      <div className={sidebarOpen ? 'forum-sidebar forum-sidebar--mobile-open' : 'forum-sidebar'} style={{ display: sidebarOpen ? 'block' : 'none' }}>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'absolute',
            top: 'var(--spacing-4)',
            right: 'var(--spacing-4)',
            padding: 'var(--spacing-2)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-1)',
            cursor: 'pointer',
            fontSize: 'var(--text-xl)',
          }}
          aria-label="Close navigation"
        >
          ×
        </button>
        <ForumSidebar categories={categories} activeCategoryId={activeCategoryId} />
      </div>
    </>
  );
}

