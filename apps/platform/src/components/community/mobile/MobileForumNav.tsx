import styles from './MobileForumNav.module.css';
import { useState } from 'react';
import { ForumSidebar } from '../ForumSidebar';
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
        className={styles.hamburger}
        aria-label="Toggle navigation"
        aria-expanded={sidebarOpen}
      >
        ☰
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className={styles.overlay}
        />
      )}

      {/* Sidebar */}
      <div className={sidebarOpen ? styles.sidebarOpen : styles.sidebarWrapper}>
        <button
          onClick={() => setSidebarOpen(false)}
          className={styles.closeButton}
          aria-label="Close navigation"
        >
          ×
        </button>
        <ForumSidebar categories={categories} activeCategoryId={activeCategoryId} />
      </div>
    </>
  );
}

