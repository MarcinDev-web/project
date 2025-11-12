import { Link, useNavigate } from 'react-router-dom';
import { useState, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const UserMenu = memo(function UserMenu() {
  const { user, logout, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/');
  };

  if (!user) return null;

  // Get user initials for avatar
  const getInitials = () => {
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    const emailPart = user.email.split('@')[0];
    return emailPart.substring(0, 2).toUpperCase();
  };

  const displayName = user.username || user.email.split('@')[0];

  return (
    <div className="user-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`user-menu__button ${isOpen ? 'user-menu__button--open' : ''}`}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        <div className="user-menu__avatar">
          {getInitials()}
        </div>
        <span className="user-menu__button-text">
          {displayName}
        </span>
        <svg 
          className="user-menu__button-arrow" 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M3 4.5L6 7.5L9 4.5" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="user-menu__backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="user-menu__dropdown">
            <div className="user-menu__header">
              <div className="user-menu__header-avatar">
                {getInitials()}
              </div>
              <div className="user-menu__header-info">
                <div className="user-menu__header-name">
                  {displayName}
                </div>
                <div className="user-menu__header-email">
                  {user.email}
                </div>
              </div>
            </div>
            <div className="user-menu__items">
              <Link
                to="/profile/me"
                onClick={() => setIsOpen(false)}
                className="user-menu__item"
              >
                <span className="user-menu__item-icon">👤</span>
                <span>My Profile</span>
              </Link>
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="user-menu__item"
              >
                <span className="user-menu__item-icon">⚙️</span>
                <span>Settings</span>
              </Link>
              
              {/* Admin/Moderator Links */}
              {(isAdmin || isModerator) && (
                <>
                  <div className="user-menu__divider" />
                  {isModerator && (
                    <Link
                      to="/moderator"
                      onClick={() => setIsOpen(false)}
                      className="user-menu__item"
                    >
                      <span className="user-menu__item-icon">🛡️</span>
                      <span>Moderator</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsOpen(false)}
                      className="user-menu__item"
                    >
                      <span className="user-menu__item-icon">⚙️</span>
                      <span>Admin</span>
                    </Link>
                  )}
                </>
              )}
            </div>
            <div className="user-menu__footer">
              <button
                onClick={handleLogout}
                className="user-menu__item user-menu__item--danger"
              >
                <span className="user-menu__item-icon">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

