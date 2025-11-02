/**
 * Tests for NavLink component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NavLink } from '../NavLink';

// Wrapper for components that use React Router
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('NavLink', () => {
  it('should render link with correct text and icon', () => {
    render(
      <RouterWrapper>
        <NavLink to="/dashboard" icon="🏠">
          Dashboard
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(link).toHaveTextContent('🏠');
  });

  it('should apply active class when isActive is true', () => {
    render(
      <RouterWrapper>
        <NavLink to="/dashboard" icon="🏠" isActive={true}>
          Dashboard
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveClass('nav-link--active');
  });

  it('should not apply active class when isActive is false', () => {
    render(
      <RouterWrapper>
        <NavLink to="/dashboard" icon="🏠" isActive={false}>
          Dashboard
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).not.toHaveClass('nav-link--active');
  });

  it('should always have nav-link class', () => {
    render(
      <RouterWrapper>
        <NavLink to="/dashboard" icon="🏠">
          Dashboard
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveClass('nav-link');
  });

  it('should render icon in span with correct class', () => {
    const { container } = render(
      <RouterWrapper>
        <NavLink to="/dashboard" icon="🏠">
          Dashboard
        </NavLink>
      </RouterWrapper>
    );

    const iconSpan = container.querySelector('.nav-link__icon');
    expect(iconSpan).toBeInTheDocument();
    expect(iconSpan).toHaveTextContent('🏠');
  });
});

