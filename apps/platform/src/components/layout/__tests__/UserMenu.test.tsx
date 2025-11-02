/**
 * Tests for UserMenu component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { UserMenu } from '../UserMenu';
import type { PublicUser } from '../../../types/auth';

// Mock AuthContext
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { useAuth } from '../../../contexts/AuthContext';

const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UserMenu', () => {
  const mockUser: PublicUser = {
    id: 'user-123',
    email: 'test@example.com',
    createdAt: Date.now(),
    role: 'user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when user is not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    const { container } = render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render user menu button when user is logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('test'); // email prefix before @
  });

  it('should display user email prefix in button', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should open dropdown menu when button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    // Check if dropdown is visible
    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  it('should display full email in dropdown header', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should close dropdown when backdrop is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    const { container } = render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    // Dropdown should be visible
    await waitFor(() => {
      expect(screen.getByText('My Profile')).toBeInTheDocument();
    });

    // Click backdrop
    const backdrop = container.querySelector('.user-menu__backdrop');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    // Dropdown should be closed
    await waitFor(() => {
      expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
    });
  });

  it('should call logout and navigate to home when logout is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const menuButton = screen.getByRole('button');
    await user.click(menuButton);

    const logoutButton = screen.getByText('Logout').closest('button');
    expect(logoutButton).toBeInTheDocument();
    
    await user.click(logoutButton!);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should have profile and settings links with correct href', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      const profileLink = screen.getByText('My Profile').closest('a');
      const settingsLink = screen.getByText('Settings').closest('a');

      expect(profileLink).toHaveAttribute('href', '/profile/me');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  it('should apply correct CSS classes', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isModerator: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
    });

    const { container } = render(
      <RouterWrapper>
        <UserMenu />
      </RouterWrapper>
    );

    const menuContainer = container.querySelector('.user-menu');
    const button = container.querySelector('.user-menu__button');

    expect(menuContainer).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });
});

