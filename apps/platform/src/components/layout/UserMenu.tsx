import { Link, useNavigate } from 'react-router-dom';
import { useState, memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const UserMenu = memo(function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="user-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`user-menu__button ${isOpen ? 'user-menu__button--open' : ''}`}
      >
        <span className="user-menu__button-icon">👤</span>
        <span className="user-menu__button-text">
          {user.username || user.email.split('@')[0]}
        </span>
        <span className="user-menu__button-arrow">▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="user-menu__backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div className="user-menu__dropdown">
            <div className="user-menu__header">
              <div className="user-menu__header-name">
                {user.username || user.email.split('@')[0]}
              </div>
              <div className="user-menu__header-email">
                {user.email}
              </div>
            </div>
            <div className="user-menu__items">
              <Link
                to="/profile/me"
                onClick={() => setIsOpen(false)}
                className="user-menu__item"
              >
                <span>👤</span>
                <span>My Profile</span>
              </Link>
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="user-menu__item"
              >
                <span>⚙️</span>
                <span>Settings</span>
              </Link>
            </div>
            <div className="user-menu__footer">
              <button
                onClick={handleLogout}
                className="user-menu__item user-menu__item--danger"
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

