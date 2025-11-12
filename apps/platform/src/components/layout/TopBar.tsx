import { Link, useLocation } from 'react-router-dom';
import { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { NavLink } from './NavLink';

export const TopBar = memo(function TopBar() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="topbar">
      <div className="topbar-content">
        <div className="topbar-nav">
          <NavLink to="/marketplace" isActive={isActive('/marketplace')}>
            Marketplace
          </NavLink>
          <NavLink to="/shop" isActive={isActive('/shop')}>
            Shop
          </NavLink>
          <NavLink to="/news" isActive={isActive('/news')}>
            News
          </NavLink>
          <NavLink to="/support" isActive={isActive('/support')}>
            Support
          </NavLink>
        </div>
        <div className="topbar-right">
          <NotificationBell />
        </div>
      </div>
    </div>
  );
});

