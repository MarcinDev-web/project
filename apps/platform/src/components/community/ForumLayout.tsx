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
    ? 'forum-layout forum-layout--with-right-sidebar' 
    : 'forum-layout';

  return (
    <div className={`${layoutClass} ${className}`}>
      <a href="#forum-main-content" className="forum-skip-link">
        Skip to main content
      </a>
      {sidebar && (
        <aside className="forum-layout__sidebar" aria-label="Forum navigation">
          {sidebar}
        </aside>
      )}
      
      <main id="forum-main-content" className="forum-layout__content">
        {children}
      </main>
      
      {rightSidebar && (
        <aside className="forum-layout__right-sidebar" aria-label="Forum widgets">
          {rightSidebar}
        </aside>
      )}
    </div>
  );
}

