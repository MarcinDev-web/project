import { memo } from 'react';
import { Link } from 'react-router-dom';

export const Footer = memo(function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Left - Brand & Copyright */}
        <div className="footer-section footer-section--left">
          <div className="footer-brand">
            <span className="footer-brand__icon">⚡</span>
            <span className="footer-brand__text">FORGE</span>
          </div>
          <p className="footer-copyright">&copy; 2025 Forge World. Powered by Forge Engine.</p>
        </div>

        {/* Center - Quick Links */}
        <div className="footer-section footer-section--center">
          <Link to="/community" className="footer-link">Community</Link>
          <span className="footer-divider">•</span>
          <Link to="/marketplace" className="footer-link">Marketplace</Link>
          <span className="footer-divider">•</span>
          <Link to="/shop" className="footer-link">Shop</Link>
          <span className="footer-divider">•</span>
          <a href="#" className="footer-link">Docs</a>
        </div>

        {/* Right - Status */}
        <div className="footer-section footer-section--right">
          <div className="footer-status">
            <span className="footer-status__dot"></span>
            <span className="footer-status__text">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
});

