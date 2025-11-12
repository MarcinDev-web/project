import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { TopBar } from './TopBar';
import { NavBar } from './NavBar';
import { Footer } from './Footer';
import { ToastContainer } from '../shared/Toast';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-container">
      <TopBar />
      <NavBar />
      <main className="main-content">
        {children}
      </main>
      <Footer />
      <ToastContainer />
      <Analytics />
    </div>
  );
}

