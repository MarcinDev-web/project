import styles from './ForumLayout.module.css';
import type { ReactNode } from 'react';

export interface ForumLayoutProps {
  sidebar?: ReactNode;
  children: ReactNode;
  rightSidebar?: ReactNode;
  className?: string;
}

/**
 * Forum Layout Component
 * 
 * 3-column layout: Sidebar | Main Content | Optional Right Sidebar
 * Responsive: collapses to single column on mobile/tablet
 */
export function ForumLayout({ sidebar, children, rightSidebar, className = '' }: ForumLayoutProps) {
  const layoutClass = rightSidebar 
    ? `${styles.layout} ${styles.withRightSidebar}` 
    : styles.layout;

  return (
    <div className={`${layoutClass} ${className}`}>
      <a href="#forum-main-content" className={styles.skipLink}>
        Skip to main content
      </a>
      {sidebar && (
        <aside className={styles.sidebar} aria-label="Forum navigation">
          {sidebar}
        </aside>
      )}
      
      <main id="forum-main-content" className={styles.content}>
        {children}
      </main>
      
      {rightSidebar && (
        <aside className={styles.rightSidebar} aria-label="Forum widgets">
          {rightSidebar}
        </aside>
      )}
    </div>
  );
}

