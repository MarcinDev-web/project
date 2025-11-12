import { Link } from 'react-router-dom';
import { memo } from 'react';

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  isActive?: boolean;
}

export const NavLink = memo(function NavLink({ to, children, isActive }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`nav-link ${isActive ? 'nav-link--active' : ''}`}
    >
      <span>{children}</span>
    </Link>
  );
});

