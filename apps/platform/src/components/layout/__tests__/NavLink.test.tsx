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
        <NavLink to="/marketplace" icon="🛒">
          Marketplace
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /marketplace/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/marketplace');
    expect(link).toHaveTextContent('🛒');
  });

  it('should apply active class when isActive is true', () => {
    render(
      <RouterWrapper>
        <NavLink to="/marketplace" icon="🛒" isActive={true}>
          Marketplace
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /marketplace/i });
    expect(link).toHaveClass('nav-link--active');
  });

  it('should not apply active class when isActive is false', () => {
    render(
      <RouterWrapper>
        <NavLink to="/marketplace" icon="🛒" isActive={false}>
          Marketplace
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /marketplace/i });
    expect(link).not.toHaveClass('nav-link--active');
  });

  it('should always have nav-link class', () => {
    render(
      <RouterWrapper>
        <NavLink to="/marketplace" icon="🛒">
          Marketplace
        </NavLink>
      </RouterWrapper>
    );

    const link = screen.getByRole('link', { name: /marketplace/i });
    expect(link).toHaveClass('nav-link');
  });

  it('should render icon in span with correct class', () => {
    const { container } = render(
      <RouterWrapper>
        <NavLink to="/marketplace" icon="🛒">
          Marketplace
        </NavLink>
      </RouterWrapper>
    );

    const iconSpan = container.querySelector('.nav-link__icon');
    expect(iconSpan).toBeInTheDocument();
    expect(iconSpan).toHaveTextContent('🛒');
  });
});

