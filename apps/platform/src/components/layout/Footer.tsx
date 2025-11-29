import { memo } from 'react';
import { Link } from 'react-router-dom';

export const Footer = memo(function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Left - Brand & Copyright */}
        <div className="footer-section footer-section--left">
          <div className="footer-brand">
            <span className="footer-brand__icon">🎮</span>
            <span className="footer-brand__text">PLAYVERSE</span>
          </div>
          <p className="footer-copyright">&copy; 2025 Playverse. Powered by Play Engine.</p>
        </div>

        {/* Center - Quick Links */}
        <div className="footer-section footer-section--center">
          <Link to="/community" className="footer-link">Community</Link>
          <span className="footer-divider">•</span>
          <Link to="/marketplace" className="footer-link">Marketplace</Link>
          <span className="footer-divider">•</span>
          <Link to="/support" className="footer-link">Support</Link>
          <span className="footer-divider">•</span>
          <a href="#" className="footer-link">Docs</a>
          <span className="footer-divider">•</span>
          <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
          <span className="footer-divider">•</span>
          <Link to="/terms" className="footer-link">Terms of Service</Link>
        </div>

        {/* Right - Status */}
        <div className="footer-section footer-section--right">
          <div className="footer-status">
            <span className="footer-status__dot"></span>
          </div>
        </div>
      </div>
    </footer>
  );
});

