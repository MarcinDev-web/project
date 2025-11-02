/**
 * Tests for NavBar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NavBar } from '../NavBar';
import type { PublicUser } from '../../../types/auth';

// Mock dependencies
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('../../components/shared/Button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('../UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

import { useAuth } from '../../../contexts/AuthContext';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('NavBar', () => {
  const mockUser: PublicUser = {
    id: 'user-123',
    email: 'test@example.com',
    createdAt: Date.now(),
    role: 'user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
    });

    it('should render navbar with brand logo', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const brandLink = screen.getByText('FORGE').closest('a');
      expect(brandLink).toBeInTheDocument();
      expect(brandLink).toHaveAttribute('href', '/');
    });

    it('should display login and register buttons', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should not display authenticated nav links', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Marketplace')).not.toBeInTheDocument();
    });

    it('should not display user menu', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    });
  });

  describe('when user is authenticated as regular user', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
    });

    it('should display all main navigation links', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Marketplace')).toBeInTheDocument();
      expect(screen.getByText('Shop')).toBeInTheDocument();
      expect(screen.getByText('Avatar Builder')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Friends')).toBeInTheDocument();
    });

    it('should not display admin or moderator links', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
      expect(screen.queryByText('Moderator')).not.toBeInTheDocument();
    });

    it('should display notification bell and user menu', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });

    it('should not display login/register buttons', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
    });
  });

  describe('when user is authenticated as moderator', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { ...mockUser, role: 'moderator' },
        isAuthenticated: true,
        isLoading: false,
        isAdmin: false,
        isModerator: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
    });

    it('should display moderator link', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.getByText('Moderator')).toBeInTheDocument();
    });

    it('should not display admin link', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });

    it('should display divider before moderator section', () => {
      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const dividers = container.querySelectorAll('.navbar-divider');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });

  describe('when user is authenticated as admin', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { ...mockUser, role: 'admin' },
        isAuthenticated: true,
        isLoading: false,
        isAdmin: true,
        isModerator: true, // Admins are also moderators
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });
    });

    it('should display both moderator and admin links', () => {
      render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      expect(screen.getByText('Moderator')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('should apply correct CSS classes to navbar', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('navbar');
    });

    it('should apply correct classes to brand', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const brand = container.querySelector('.navbar-brand');
      expect(brand).toBeInTheDocument();
    });

    it('should apply correct classes to nav container', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const navContainer = container.querySelector('.navbar-nav');
      expect(navContainer).toBeInTheDocument();
    });
  });

  describe('brand logo', () => {
    it('should display lightning emoji icon', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const icon = container.querySelector('.navbar-brand__icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('⚡');
    });

    it('should display FORGE text with gradient class', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isModerator: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const { container } = render(
        <RouterWrapper>
          <NavBar />
        </RouterWrapper>
      );

      const text = container.querySelector('.navbar-brand__text');
      expect(text).toBeInTheDocument();
      expect(text).toHaveTextContent('FORGE');
    });
  });
});

