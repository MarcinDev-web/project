import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { NavBar } from './NavBar';
import { Footer } from './Footer';
import { ToastContainer } from '../shared/Toast';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-container">
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

