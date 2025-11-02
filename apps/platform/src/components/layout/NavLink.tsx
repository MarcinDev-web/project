import { Link } from 'react-router-dom';
import { memo } from 'react';

interface NavLinkProps {
  to: string;
  icon: string;
  children: React.ReactNode;
  isActive?: boolean;
}

export const NavLink = memo(function NavLink({ to, icon, children, isActive }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
    >
      <span className="nav-link__icon">{icon}</span>
      <span>{children}</span>
    </Link>
  );
});

