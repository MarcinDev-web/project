import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { router } from './router';
import { initConsoleFilter } from './utils/consoleFilter';
import './styles/main.css';
// Avatar Builder CSS removed - will be rebuilt with new design system

// Initialize console filtering to reduce noise from expected errors/warnings
// Filters out: 404s for avatar-loadout, WebGPU timestamp warnings, etc.
initConsoleFilter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);

