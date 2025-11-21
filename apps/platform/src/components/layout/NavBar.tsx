import { Link, useLocation, useNavigate } from 'react-router-dom';
import { memo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/shared/Button';
import { NavLink } from './NavLink';
import { UserMenu } from './UserMenu';

export const NavBar = memo(function NavBar() {
  const { isAuthenticated, isAdmin, isModerator } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="navbar">
      {/* Logo / Brand */}
      <Link to="/" className="navbar-brand">
        <span className="navbar-brand__icon">⚡</span>
        <span className="navbar-brand__text">FORGE</span>
      </Link>

      {/* Mobile Menu Toggle */}
      <button 
        className={`navbar-toggle ${isMobileMenuOpen ? 'is-active' : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggle__bar"></span>
        <span className="navbar-toggle__bar"></span>
        <span className="navbar-toggle__bar"></span>
      </button>

      {/* Navigation Links */}
      <div className={`navbar-nav ${isMobileMenuOpen ? 'is-open' : ''}`}>
        {isAuthenticated ? (
          <>
            <Button
              variant="forge"
              size="small"
              onClick={() => {
                navigate('/studio');
                setIsMobileMenuOpen(false);
              }}
              className="navbar-create-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create Game</span>
            </Button>
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
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="navbar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
});
