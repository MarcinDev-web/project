import { Link, useLocation } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/shared/Button';
import { NavLink } from './NavLink';
import { UserMenu } from './UserMenu';

export const NavBar = memo(function NavBar() {
  const { isAuthenticated, isAdmin, isModerator } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="navbar">
      {/* Logo / Brand */}
      <Link to="/" className="navbar-brand">
        <span className="navbar-brand__icon">⚡</span>
        <span className="navbar-brand__text">FORGE</span>
      </Link>

      {/* Navigation Links */}
      <div className="navbar-nav">
        {isAuthenticated ? (
          <>
            <NavLink to="/games" isActive={isActive('/games')}>
              Games
            </NavLink>
            <NavLink to="/community-hub" isActive={isActive('/community-hub')}>
              Community
            </NavLink>
            <NavLink to="/studio" isActive={isActive('/studio')}>
              Studio
            </NavLink>
            <NavLink to="/blocks-models-studio" isActive={isActive('/blocks-models-studio')}>
              Model Builder
            </NavLink>
            <NavLink to="/avatar-builder" isActive={isActive('/avatar-builder')}>
              Avatar Builder
            </NavLink>

            {/* Divider */}
            <div className="navbar-divider" />

            <UserMenu />
          </>
        ) : (
          <>
            <Link to="/login" className="auth-link">
              Login
            </Link>
            <Button
              variant="primary"
              size="small"
              onClick={() => window.location.href = '/register'}
            >
              <span>Get Started</span>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
});

