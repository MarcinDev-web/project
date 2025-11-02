import { Link, useLocation } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/shared/Button';
import { NotificationBell } from '../notifications/NotificationBell';
import { NavLink } from './NavLink';
import { UserMenu } from './UserMenu';

export const NavBar = memo(function NavBar() {
  const { isAuthenticated, isAdmin, isModerator } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
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
            <NavLink to="/dashboard" icon="🏠" isActive={isActive('/dashboard')}>
              Dashboard
            </NavLink>
            <NavLink to="/marketplace" icon="🛒" isActive={isActive('/marketplace')}>
              Marketplace
            </NavLink>
            <NavLink to="/shop" icon="🛍️" isActive={isActive('/shop')}>
              Shop
            </NavLink>
            <NavLink to="/avatar-builder" icon="🎨" isActive={isActive('/avatar-builder')}>
              Avatar Builder
            </NavLink>
            <NavLink to="/community" icon="💬" isActive={isActive('/community')}>
              Community
            </NavLink>
            <NavLink to="/messages" icon="💬" isActive={isActive('/messages')}>
              Messages
            </NavLink>
            <NavLink to="/friends" icon="👥" isActive={isActive('/friends')}>
              Friends
            </NavLink>

            {/* Admin/Moderator Links */}
            {(isAdmin || isModerator) && (
              <>
                <div className="navbar-divider" />
                {isModerator && (
                  <NavLink to="/moderator" icon="🛡️" isActive={isActive('/moderator')}>
                    Moderator
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink to="/admin" icon="⚙️" isActive={isActive('/admin')}>
                    Admin
                  </NavLink>
                )}
              </>
            )}

            {/* Divider */}
            <div className="navbar-divider" />

            <NotificationBell />
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
              <span>🚀</span>
              <span>Get Started</span>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
});

